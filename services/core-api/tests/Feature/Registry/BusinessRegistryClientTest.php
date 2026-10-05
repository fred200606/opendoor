<?php

namespace Tests\Feature\Registry;

use App\Enums\RegistryStatus;
use App\Services\Registry\BusinessRegistryClient;
use App\Services\Registry\RegistryException;
use ArrayObject;
use Closure;
use SoapClient;
use SoapFault;
use Tests\TestCase;

/**
 * The real SoapClient against the registry's real WSDL, with the HTTP exchange replaced: checks the
 * envelope Core sends (WS-Security header, document/literal body) and the mapping of answers and
 * faults (integrations.md). No network.
 */
class BusinessRegistryClientTest extends TestCase
{
    private const WSDL = __DIR__.'/../../../../business-registry-soap/wsdl/registry.wsdl';

    /** @var ArrayObject<int, string> requests seen by the fake transport */
    private ArrayObject $requests;

    protected function setUp(): void
    {
        parent::setUp();
        $this->requests = new ArrayObject;
    }

    /** @param  Closure(string): string  $respond  request XML → response XML (or throws) */
    private function client(Closure $respond, array $config = []): BusinessRegistryClient
    {
        $requests = $this->requests;
        $factory = fn (string $wsdl, array $options) => new class(self::WSDL, $options, $respond, $requests) extends SoapClient
        {
            public function __construct(string $wsdl, array $options, private Closure $respond, private ArrayObject $requests)
            {
                parent::__construct($wsdl, $options);
            }

            public function __doRequest(string $request, string $location, string $action, int $version, bool $oneWay = false, ?string $uriParserClass = null): ?string
            {
                $this->requests[] = $request;

                return ($this->respond)($request);
            }
        };

        return new BusinessRegistryClient(
            ['wsdl' => self::WSDL, 'user' => 'opendoor-core', 'password' => 'p<a&ss', 'timeout' => 5, ...$config],
            $factory,
        );
    }

    private static function response(string $body): string
    {
        return '<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" '
            .'xmlns:ns1="urn:opendoor:registry:v1"><SOAP-ENV:Body>'.$body.'</SOAP-ENV:Body></SOAP-ENV:Envelope>';
    }

    private static function fault(string $code, string $message): string
    {
        return self::response("<SOAP-ENV:Fault><faultcode>SOAP-ENV:{$code}</faultcode><faultstring>{$message}</faultstring></SOAP-ENV:Fault>");
    }

    private static function found(string $status, string $name, string $score): string
    {
        return self::response('<ns1:VerifyBusinessRegistrationResponse><ns1:Found>true</ns1:Found><ns1:Status>'.$status.'</ns1:Status>'
            .'<ns1:RegisteredName>'.$name.'</ns1:RegisteredName><ns1:DateRegistered>2019-03-14</ns1:DateRegistered>'
            .'<ns1:NameMatchScore>'.$score.'</ns1:NameMatchScore><ns1:CheckedAt>2026-10-02T10:02:11+08:00</ns1:CheckedAt>'
            .'</ns1:VerifyBusinessRegistrationResponse>');
    }

    private function expectRegistryError(Closure $call, string $code, int $status): RegistryException
    {
        try {
            $call();
        } catch (RegistryException $error) {
            $this->assertSame([$code, $status], [$error->errorCode, $error->status]);

            return $error;
        }
        $this->fail("Expected {$code}");
    }

    public function test_it_sends_a_ws_security_envelope_and_maps_an_active_registration(): void
    {
        $result = $this->client(fn () => self::found('ACTIVE', 'KALINGA FOODS, INC.', '0.96'))
            ->verify('CS201912345', 'SEC', 'Kalinga Foods & Co');

        $this->assertSame(RegistryStatus::Active, $result->status);
        $this->assertSame('KALINGA FOODS, INC.', $result->registeredName);
        $this->assertSame(0.96, $result->nameMatch);
        $this->assertSame('2026-10-02T10:02:11+08:00', $result->checkedAt->toIso8601String());
        $this->assertStringContainsString('<ns1:Status>ACTIVE</ns1:Status>', $result->rawResponse);

        $request = $this->requests[0];
        $this->assertStringContainsString('<wsse:Username>opendoor-core</wsse:Username>', $request);
        $this->assertStringContainsString('#PasswordText">p&lt;a&amp;ss</wsse:Password>', $request, 'password is XML-escaped');
        $this->assertStringContainsString('<ns1:RegistrationNumber>CS201912345</ns1:RegistrationNumber>', $request);
        $this->assertStringContainsString('<ns1:BusinessName>Kalinga Foods &amp; Co</ns1:BusinessName>', $request);
        $this->assertStringNotContainsString('Password', $result->rawResponse, 'only the response is kept');
    }

    public function test_not_found_has_no_name_and_no_score(): void
    {
        $result = $this->client(fn () => self::response('<ns1:VerifyBusinessRegistrationResponse><ns1:Found>false</ns1:Found>'
            .'<ns1:Status>NOT_FOUND</ns1:Status><ns1:NameMatchScore>0</ns1:NameMatchScore><ns1:CheckedAt>2026-10-02T10:02:11+08:00</ns1:CheckedAt>'
            .'</ns1:VerifyBusinessRegistrationResponse>'))->verify('99999999', 'DTI', 'Nobody');

        $this->assertSame(RegistryStatus::NotFound, $result->status);
        $this->assertNull($result->registeredName);
        $this->assertNull($result->nameMatch);
    }

    public function test_faults_map_to_api_errors(): void
    {
        $this->expectRegistryError(fn () => $this->client(fn () => self::fault('Client.Authentication', 'Invalid WS-Security credentials'))
            ->verify('3456789', 'DTI', 'X'), 'REGISTRY_AUTH_FAILED', 502);

        $invalid = $this->expectRegistryError(fn () => $this->client(fn () => self::fault('Client.Validation', 'RegistryType must be DTI or SEC'))
            ->verify('3456789', 'DTI', 'X'), 'REGISTRY_INVALID_REQUEST', 422);
        $this->assertSame('The business registry rejected the registration details: RegistryType must be DTI or SEC', $invalid->getMessage());

        $server = $this->expectRegistryError(fn () => $this->client(fn () => self::fault('Server', 'The registry is temporarily unavailable'))
            ->verify('3456789', 'DTI', 'X'), 'REGISTRY_UNAVAILABLE', 502);
        $this->assertStringContainsString('<faultcode>SOAP-ENV:Server</faultcode>', $server->rawResponse);
    }

    public function test_transport_problems_and_odd_answers_are_unavailable(): void
    {
        $this->expectRegistryError(fn () => $this->client(fn () => throw new SoapFault('HTTP', 'Could not connect to host'))
            ->verify('3456789', 'DTI', 'X'), 'REGISTRY_UNAVAILABLE', 502);
        $this->expectRegistryError(fn () => $this->client(fn () => '<html>Bad gateway</html>')
            ->verify('3456789', 'DTI', 'X'), 'REGISTRY_UNAVAILABLE', 502);
        $this->expectRegistryError(fn () => $this->client(fn () => self::found('SUSPENDED', 'X', '1'))
            ->verify('3456789', 'DTI', 'X'), 'REGISTRY_UNAVAILABLE', 502);
    }

    public function test_missing_credentials_never_call_the_registry(): void
    {
        $this->expectRegistryError(fn () => $this->client(fn () => self::found('ACTIVE', 'X', '1'), ['password' => null])
            ->verify('3456789', 'DTI', 'X'), 'REGISTRY_AUTH_FAILED', 502);
        $this->assertCount(0, $this->requests);
    }
}
