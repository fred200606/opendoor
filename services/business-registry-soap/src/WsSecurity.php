<?php

declare(strict_types=1);

namespace OpenDoor\Registry;

use DOMDocument;
use DOMXPath;

/**
 * WS-Security 1.0 UsernameToken (PasswordText) check, done on the raw envelope before SoapServer
 * dispatches the call. Only the OASIS wsse namespace is accepted; PasswordDigest is not supported
 * by this simulated registry.
 */
final class WsSecurity
{
    public const NS = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd';

    private const PASSWORD_TEXT = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText';

    /** @return array{username: string, password: string}|null null when the header is missing or malformed */
    public static function credentials(string $envelope): ?array
    {
        if (trim($envelope) === '') {
            return null;
        }

        $dom = new DOMDocument;
        $previous = libxml_use_internal_errors(true);
        // LIBXML_NONET: never fetch external entities (XXE); no DTDs are loaded.
        $loaded = $dom->loadXML($envelope, LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        if (! $loaded) {
            return null;
        }

        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('soapenv', 'http://schemas.xmlsoap.org/soap/envelope/');
        $xpath->registerNamespace('wsse', self::NS);
        $token = $xpath->query('/soapenv:Envelope/soapenv:Header/wsse:Security/wsse:UsernameToken')->item(0);
        if ($token === null) {
            return null;
        }

        $username = $xpath->query('wsse:Username', $token)->item(0);
        $password = $xpath->query('wsse:Password', $token)->item(0);
        if ($username === null || $password === null) {
            return null;
        }

        $type = $password->attributes?->getNamedItem('Type')?->nodeValue;
        if ($type !== null && $type !== self::PASSWORD_TEXT) {
            return null;
        }

        return ['username' => trim($username->textContent), 'password' => $password->textContent];
    }

    /** Constant-time comparison against the configured REGISTRY_SOAP_USER / REGISTRY_SOAP_PASSWORD. */
    public static function isValid(?array $credentials, ?string $expectedUser, ?string $expectedPassword): bool
    {
        if ($credentials === null || ! $expectedUser || ! $expectedPassword) {
            return false;
        }

        $userOk = hash_equals($expectedUser, $credentials['username']);
        $passwordOk = hash_equals($expectedPassword, $credentials['password']);

        return $userOk && $passwordOk;
    }
}
