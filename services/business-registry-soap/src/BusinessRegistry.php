<?php

declare(strict_types=1);

namespace OpenDoor\Registry;

use Closure;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use SoapFault;
use Throwable;

/**
 * SoapServer handler for operation VerifyBusinessRegistration (wsdl/registry.wsdl).
 *
 * Faults (SIA 4.3): Client.Authentication – WS-Security header missing or wrong;
 * Client.Validation – bad input; Server – anything unexpected (no details leak to the client).
 */
final class BusinessRegistry
{
    /** Faults are qualified with the SOAP 1.1 envelope namespace (soapenv:Client.Validation, …). */
    private const ENV = 'http://schemas.xmlsoap.org/soap/envelope/';

    /** @param Closure(): PDO $connect opened lazily, so a missing database becomes a Server fault */
    public function __construct(
        private readonly Closure $connect,
        private readonly bool $authenticated,
    ) {}

    /**
     * @param  object  $request  VerifyBusinessRegistrationRequest
     * @return array<string, mixed> VerifyBusinessRegistrationResponse
     */
    public function VerifyBusinessRegistration(object $request): array
    {
        if (! $this->authenticated) {
            throw self::fault('Client.Authentication', 'Invalid WS-Security credentials');
        }

        [$number, $type, $name] = self::validated($request);

        try {
            $statement = ($this->connect)()->prepare(
                'SELECT registered_name, status, date_registered FROM registrations
                 WHERE registration_number = :number AND registry_type = :type',
            );
            $statement->execute(['number' => $number, 'type' => $type]);
            $record = $statement->fetch(PDO::FETCH_ASSOC);
        } catch (Throwable $error) {
            error_log('registry: database error: '.$error->getMessage());
            throw self::fault('Server', 'The registry is temporarily unavailable');
        }

        $checkedAt = (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format(DATE_ATOM);
        if ($record === false) {
            return ['Found' => false, 'Status' => 'NOT_FOUND', 'NameMatchScore' => 0, 'CheckedAt' => $checkedAt];
        }

        return [
            'Found' => true,
            'Status' => $record['status'],
            'RegisteredName' => $record['registered_name'],
            'DateRegistered' => $record['date_registered'],
            'NameMatchScore' => NameMatcher::score($name, $record['registered_name']),
            'CheckedAt' => $checkedAt,
        ];
    }

    /**
     * Hyphens and spaces in the number are ignored ("CS-2019-12345" = "CS201912345").
     *
     * @return array{string, string, string}
     */
    public static function validated(object $request): array
    {
        $number = strtoupper((string) preg_replace('/[\s-]+/', '', self::text($request, 'RegistrationNumber')));
        if (! preg_match('/^[A-Z0-9]{5,20}$/', $number)) {
            throw self::fault('Client.Validation', 'RegistrationNumber is required and must be 5-20 letters or digits');
        }

        $type = strtoupper(trim(self::text($request, 'RegistryType')));
        if (! in_array($type, ['DTI', 'SEC'], true)) {
            throw self::fault('Client.Validation', 'RegistryType must be DTI or SEC');
        }

        $name = trim(self::text($request, 'BusinessName'));
        if ($name === '' || mb_strlen($name) > 255) {
            throw self::fault('Client.Validation', 'BusinessName is required (at most 255 characters)');
        }

        return [$number, $type, $name];
    }

    private static function fault(string $code, string $message): SoapFault
    {
        return new SoapFault([self::ENV, $code], $message);
    }

    private static function text(object $request, string $element): string
    {
        $value = $request->{$element} ?? '';

        return is_scalar($value) ? (string) $value : '';
    }
}
