<?php

namespace App\Services\Registry;

use App\Enums\RegistryStatus;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Support\Facades\Log;
use SoapClient;
use SoapFault;
use SoapHeader;
use SoapVar;
use Throwable;

/**
 * Calls the legacy Business Registry (SOAP 1.1, services/business-registry-soap) with a WS-Security
 * UsernameToken and maps the XML answer to a RegistryResult. Faults become RegistryException
 * (integrations.md). The request is never logged or stored: it carries the registry password.
 *
 * Bound in AppServiceProvider; tests replace it in the container or pass a SoapClient factory.
 */
class BusinessRegistryClient
{
    private const WSSE = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd';

    /**
     * @param  array{wsdl: string, user: ?string, password: ?string, timeout: int}  $config  config('services.registry')
     * @param  (Closure(string, array<string, mixed>): SoapClient)|null  $factory
     */
    public function __construct(
        private readonly array $config,
        private readonly ?Closure $factory = null,
    ) {}

    public function verify(string $registrationNumber, string $registryType, string $businessName): RegistryResult
    {
        if (! $this->config['user'] || ! $this->config['password']) {
            Log::error('Business registry: REGISTRY_SOAP_USER or REGISTRY_SOAP_PASSWORD is not set.');
            throw RegistryException::authFailed();
        }

        // SoapClient reads the response with default_socket_timeout; connection_timeout covers connecting.
        $previousTimeout = ini_set('default_socket_timeout', (string) $this->config['timeout']);
        $client = null;
        try {
            $client = $this->client();
            $client->__setSoapHeaders([$this->securityHeader()]);
            $response = $client->VerifyBusinessRegistration([
                'RegistrationNumber' => $registrationNumber,
                'RegistryType' => $registryType,
                'BusinessName' => $businessName,
            ]);

            return $this->result($response, $client->__getLastResponse());
        } catch (SoapFault $fault) {
            throw $this->fromFault($fault, $client?->__getLastResponse());
        } catch (RegistryException $error) {
            throw $error;
        } catch (Throwable $error) {
            Log::warning('Business registry call failed.', ['error' => $error->getMessage()]);
            throw RegistryException::unavailable();
        } finally {
            if ($previousTimeout !== false) {
                ini_set('default_socket_timeout', $previousTimeout);
            }
        }
    }

    private function client(): SoapClient
    {
        $options = [
            'soap_version' => SOAP_1_1,
            'exceptions' => true,
            'trace' => true, // needed for __getLastResponse (stored as raw_response)
            'connection_timeout' => $this->config['timeout'],
            'cache_wsdl' => WSDL_CACHE_MEMORY,
            'user_agent' => 'OpenDoor-Core/1.0',
        ];

        return $this->factory
            ? ($this->factory)($this->config['wsdl'], $options)
            : new SoapClient($this->config['wsdl'], $options);
    }

    private function securityHeader(): SoapHeader
    {
        $user = htmlspecialchars((string) $this->config['user'], ENT_XML1);
        $password = htmlspecialchars((string) $this->config['password'], ENT_XML1);
        $xml = '<wsse:Security xmlns:wsse="'.self::WSSE.'">'
            .'<wsse:UsernameToken><wsse:Username>'.$user.'</wsse:Username>'
            .'<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">'
            .$password.'</wsse:Password></wsse:UsernameToken></wsse:Security>';

        return new SoapHeader(self::WSSE, 'Security', new SoapVar($xml, XSD_ANYXML));
    }

    private function result(mixed $response, ?string $raw): RegistryResult
    {
        $status = is_object($response) ? RegistryStatus::tryFrom((string) ($response->Status ?? '')) : null;
        if ($status === null || $status === RegistryStatus::Error) {
            Log::warning('Business registry: unexpected response.', ['status' => is_object($response) ? ($response->Status ?? null) : null]);
            throw RegistryException::unavailable($raw);
        }

        $score = isset($response->NameMatchScore) ? (float) $response->NameMatchScore : null;
        $registeredName = isset($response->RegisteredName) && $response->RegisteredName !== '' ? (string) $response->RegisteredName : null;

        try {
            $checkedAt = CarbonImmutable::parse((string) $response->CheckedAt);
        } catch (Throwable) {
            $checkedAt = CarbonImmutable::now();
        }

        return new RegistryResult(
            status: $status,
            registeredName: $registeredName,
            // NOT_FOUND has no name to compare: no score instead of a misleading 0.
            nameMatch: $status === RegistryStatus::NotFound || $score === null ? null : max(0.0, min(1.0, round($score, 2))),
            checkedAt: $checkedAt,
            rawResponse: $raw,
        );
    }

    /**
     * faultcode is namespace-qualified ("SOAP-ENV:Client.Validation"); transport problems arrive as
     * client-side faults with codes such as "HTTP" or "WSDL".
     */
    private function fromFault(SoapFault $fault, ?string $raw): RegistryException
    {
        $code = (string) $fault->faultcode;
        $code = str_contains($code, ':') ? substr($code, strrpos($code, ':') + 1) : $code;

        return match ($code) {
            'Client.Authentication' => tap(RegistryException::authFailed($raw), fn () => Log::error('Business registry rejected the WS-Security credentials; check REGISTRY_SOAP_USER / REGISTRY_SOAP_PASSWORD.')),
            'Client.Validation' => RegistryException::invalidRequest($fault->getMessage(), $raw),
            default => tap(RegistryException::unavailable($raw), fn () => Log::warning('Business registry unavailable.', ['faultcode' => $fault->faultcode, 'message' => $fault->getMessage()])),
        };
    }
}
