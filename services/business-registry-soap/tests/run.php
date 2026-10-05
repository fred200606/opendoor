<?php

declare(strict_types=1);

/*
 * Registry tests without Composer:  php tests/run.php
 *
 * 1. Unit: NameMatcher, WsSecurity, request validation.
 * 2. Smoke: starts `php -S` on a free port with test credentials and a temporary database, then
 *    calls the service with PHP SoapClient exactly like the Core Service does (WSDL, UsernameToken,
 *    faults), plus raw HTTP checks (health, malformed XML, missing database → Server fault).
 * Exit code 1 when any check fails.
 */

use OpenDoor\Registry\BusinessRegistry;
use OpenDoor\Registry\NameMatcher;
use OpenDoor\Registry\WsSecurity;

require dirname(__DIR__).'/src/bootstrap.php';

$failures = 0;
$checks = 0;
function check(string $name, bool $ok, string $detail = ''): void
{
    global $failures, $checks;
    $checks++;
    if (! $ok) {
        $failures++;
    }
    echo ($ok ? '  PASS ' : '  FAIL ').$name.($ok || $detail === '' ? '' : " – {$detail}").PHP_EOL;
}

const WSSE = WsSecurity::NS;
const TEST_USER = 'registry-test-user';
const TEST_PASSWORD = 'registry-test-password';

function envelope(string $body, ?string $user = TEST_USER, ?string $password = TEST_PASSWORD): string
{
    $header = $user === null ? '' : '<soapenv:Header><wsse:Security><wsse:UsernameToken><wsse:Username>'.$user
        .'</wsse:Username><wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">'
        .$password.'</wsse:Password></wsse:UsernameToken></wsse:Security></soapenv:Header>';

    return '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:reg="urn:opendoor:registry:v1" xmlns:wsse="'.WSSE.'">'
        .$header.'<soapenv:Body>'.$body.'</soapenv:Body></soapenv:Envelope>';
}

// ------------------------------------------------------------------ 1. unit

echo "Unit\n";
foreach ([
    ['Kalinga Foods Inc.', 'KALINGA FOODS, INC.', 1.0],
    ['Bright Path BPO, Inc', 'BRIGHT PATH BPO INC.', 1.0],
    ['Tahanan Accessible Homes Corp.', 'TAHANAN ACCESSIBLE HOMES CORPORATION', 1.0],
    ['A & B Trading', 'A AND B TRADING', 1.0],
    ['', 'BRIGHT PATH BPO INC.', 0.0],
] as [$a, $b, $expected]) {
    check("score('{$a}', '{$b}') = {$expected}", NameMatcher::score($a, $b) === $expected, (string) NameMatcher::score($a, $b));
}
$different = NameMatcher::score('Golden Harvest Farms', 'BRIGHT PATH BPO INC.');
check('a different business scores below 0.80', $different < 0.80, (string) $different);
$close = NameMatcher::score('Kalinga Food Inc', 'KALINGA FOODS, INC.');
check('a near-identical spelling scores between 0.80 and 1', $close >= 0.80 && $close < 1.0, (string) $close);
check('suffixes are dropped only at the end', NameMatcher::normalize('CO Working Hub Co.') === 'CO WORKING HUB');

check('UsernameToken is read', WsSecurity::credentials(envelope('<x/>')) === ['username' => TEST_USER, 'password' => TEST_PASSWORD]);
check('missing header → no credentials', WsSecurity::credentials(envelope('<x/>', null)) === null);
check('malformed XML → no credentials', WsSecurity::credentials('<soapenv:Envelope') === null);
check('digest passwords are refused', WsSecurity::credentials(str_replace('#PasswordText', '#PasswordDigest', envelope('<x/>'))) === null);
check('right user + password is valid', WsSecurity::isValid(['username' => 'u', 'password' => 'p'], 'u', 'p'));
check('wrong password is invalid', ! WsSecurity::isValid(['username' => 'u', 'password' => 'x'], 'u', 'p'));
check('unconfigured password never validates', ! WsSecurity::isValid(['username' => 'u', 'password' => ''], 'u', ''));

$valid = (object) ['RegistrationNumber' => ' cs-2019 12345 ', 'RegistryType' => 'sec', 'BusinessName' => ' Kalinga Foods Inc. '];
check('number is normalized (hyphens, spaces, case)', BusinessRegistry::validated($valid) === ['CS201912345', 'SEC', 'Kalinga Foods Inc.']);
foreach ([
    'empty number' => ['RegistrationNumber' => '', 'RegistryType' => 'DTI', 'BusinessName' => 'X'],
    'number with symbols' => ['RegistrationNumber' => '1234/567', 'RegistryType' => 'DTI', 'BusinessName' => 'X'],
    'number too long' => ['RegistrationNumber' => str_repeat('1', 21), 'RegistryType' => 'DTI', 'BusinessName' => 'X'],
    'unknown registry' => ['RegistrationNumber' => '3456789', 'RegistryType' => 'BIR', 'BusinessName' => 'X'],
    'missing name' => ['RegistrationNumber' => '3456789', 'RegistryType' => 'DTI'],
] as $label => $fields) {
    try {
        BusinessRegistry::validated((object) $fields);
        check("{$label} → Client.Validation", false, 'no fault');
    } catch (SoapFault $fault) {
        check("{$label} → Client.Validation", str_ends_with($fault->faultcode, 'Client.Validation'), $fault->faultcode);
    }
}

// ------------------------------------------------------------------ 2. smoke over HTTP

echo "Smoke (php -S + SoapClient)\n";
$root = dirname(__DIR__);
$database = sys_get_temp_dir().'/opendoor-registry-test-'.getmypid().'.db';
$env = ['REGISTRY_SOAP_USER' => TEST_USER, 'REGISTRY_SOAP_PASSWORD' => TEST_PASSWORD, 'REGISTRY_DB_PATH' => $database] + getenv();

$seed = proc_open([PHP_BINARY, $root.'/seed.php'], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, $root, $env);
stream_get_contents($pipes[1]);
check('seed.php creates the database', proc_close($seed) === 0 && is_file($database));

$socket = stream_socket_server('tcp://127.0.0.1:0');
$port = (int) substr((string) stream_socket_get_name($socket, false), strrpos((string) stream_socket_get_name($socket, false), ':') + 1);
fclose($socket);
$log = sys_get_temp_dir().'/opendoor-registry-test-'.getmypid().'.log';
$server = proc_open([PHP_BINARY, '-S', "127.0.0.1:{$port}", '-t', $root.'/public'], [1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes, $root, $env, ['bypass_shell' => true]);
$base = "http://127.0.0.1:{$port}";

function http(string $method, string $url, ?string $body = null): array
{
    $context = stream_context_create(['http' => [
        'method' => $method, 'ignore_errors' => true, 'timeout' => 5,
        'header' => "Content-Type: text/xml; charset=utf-8\r\nSOAPAction: \"urn:opendoor:registry:v1#VerifyBusinessRegistration\"\r\n",
        'content' => $body ?? '',
    ]]);
    $response = @file_get_contents($url, false, $context);
    $status = isset($http_response_header[0]) ? (int) explode(' ', $http_response_header[0])[1] : 0;

    return [$status, (string) $response];
}

for ($i = 0; $i < 50 && http('GET', "{$base}/health")[0] !== 200; $i++) {
    usleep(100_000);
}

try {
    [$status, $body] = http('GET', "{$base}/health");
    check('GET /health → 200 ok', $status === 200 && json_decode($body, true)['database'] === 'ok', $body);

    [$status, $wsdl] = http('GET', "{$base}/soap?wsdl");
    check('GET /soap?wsdl → WSDL with this host as soap:address', $status === 200 && str_contains($wsdl, "location=\"{$base}/soap\""));

    $client = function (?string $user = TEST_USER, ?string $password = TEST_PASSWORD) use ($base): SoapClient {
        $client = new SoapClient("{$base}/soap?wsdl", ['exceptions' => true, 'cache_wsdl' => WSDL_CACHE_NONE, 'connection_timeout' => 5]);
        if ($user !== null) {
            $token = '<wsse:Security xmlns:wsse="'.WSSE.'"><wsse:UsernameToken><wsse:Username>'.$user.'</wsse:Username><wsse:Password>'
                .$password.'</wsse:Password></wsse:UsernameToken></wsse:Security>';
            $client->__setSoapHeaders([new SoapHeader(WSSE, 'Security', new SoapVar($token, XSD_ANYXML), true)]);
        }

        return $client;
    };
    $call = function (array $request, ?string $user = TEST_USER, ?string $password = TEST_PASSWORD) use ($client) {
        try {
            return $client($user, $password)->VerifyBusinessRegistration($request);
        } catch (SoapFault $fault) {
            return $fault;
        }
    };

    $active = $call(['RegistrationNumber' => 'CS201912345', 'RegistryType' => 'SEC', 'BusinessName' => 'Kalinga Foods Inc.']);
    check('ACTIVE SEC record with a matching name', $active instanceof stdClass && $active->Found === true && $active->Status === 'ACTIVE'
        && $active->RegisteredName === 'KALINGA FOODS, INC.' && $active->DateRegistered === '2019-03-14' && (float) $active->NameMatchScore === 1.0
        && preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+08:00$/', $active->CheckedAt) === 1, json_encode($active));

    $expired = $call(['RegistrationNumber' => '1234567', 'RegistryType' => 'DTI', 'BusinessName' => 'Sari-Sari Digital Services']);
    check('EXPIRED DTI record', $expired instanceof stdClass && $expired->Status === 'EXPIRED', json_encode($expired));
    $cancelled = $call(['RegistrationNumber' => 'CS201500321', 'RegistryType' => 'SEC', 'BusinessName' => 'Metro Access Logistics']);
    check('CANCELLED SEC record', $cancelled instanceof stdClass && $cancelled->Status === 'CANCELLED', json_encode($cancelled));

    $wrongRegistry = $call(['RegistrationNumber' => 'CS201912345', 'RegistryType' => 'DTI', 'BusinessName' => 'Kalinga Foods Inc.']);
    check('number in the other registry → NOT_FOUND', $wrongRegistry instanceof stdClass && $wrongRegistry->Found === false
        && $wrongRegistry->Status === 'NOT_FOUND' && ! isset($wrongRegistry->RegisteredName) && (float) $wrongRegistry->NameMatchScore === 0.0, json_encode($wrongRegistry));

    $mismatch = $call(['RegistrationNumber' => 'CS201800777', 'RegistryType' => 'SEC', 'BusinessName' => 'Golden Harvest Farms']);
    check('name mismatch → score below 0.80', $mismatch instanceof stdClass && (float) $mismatch->NameMatchScore < 0.80, json_encode($mismatch));

    $request = ['RegistrationNumber' => '3456789', 'RegistryType' => 'DTI', 'BusinessName' => 'Bayanihan Tech Solutions'];
    foreach (['wrong password' => [TEST_USER, 'wrong'], 'wrong user' => ['someone', TEST_PASSWORD], 'no header' => [null, null]] as $label => [$user, $password]) {
        $fault = $call($request, $user, $password);
        check("{$label} → soapenv:Client.Authentication", $fault instanceof SoapFault && $fault->faultcode === 'SOAP-ENV:Client.Authentication',
            $fault instanceof SoapFault ? $fault->faultcode : 'no fault');
    }

    $fault = $call(['RegistrationNumber' => 'A1', 'RegistryType' => 'DTI', 'BusinessName' => 'X']);
    check('invalid number → soapenv:Client.Validation', $fault instanceof SoapFault && $fault->faultcode === 'SOAP-ENV:Client.Validation'
        && $fault->getMessage() === 'RegistrationNumber is required and must be 5-20 letters or digits');

    [$status, $body] = http('POST', "{$base}/soap", '<soapenv:Envelope');
    check('malformed XML → HTTP 500 with a SOAP Client fault', $status === 500 && str_contains($body, '<faultcode>SOAP-ENV:Client</faultcode>'), $body);

    [$status, $body] = http('GET', "{$base}/soap");
    check('GET /soap without ?wsdl → 405', $status === 405);

    // Raw envelope as written in SIA 4.3 (prefix soapenv, reg:, Type attribute on the password).
    [$status, $body] = http('POST', "{$base}/soap", envelope(
        '<reg:VerifyBusinessRegistrationRequest><reg:RegistrationNumber>CS201800777</reg:RegistrationNumber><reg:RegistryType>SEC</reg:RegistryType>'
        .'<reg:BusinessName>Bright Path BPO Inc.</reg:BusinessName></reg:VerifyBusinessRegistrationRequest>',
    ));
    check('raw SIA 4.3 envelope → 200 with VerifyBusinessRegistrationResponse', $status === 200
        && str_contains($body, 'VerifyBusinessRegistrationResponse') && str_contains($body, '<ns1:NameMatchScore>1</ns1:NameMatchScore>'), $body);

    // Database gone → Server fault, no internals in the message; health reports it.
    unlink($database);
    $fault = $call($request);
    check('missing database → soapenv:Server, generic message', $fault instanceof SoapFault && $fault->faultcode === 'SOAP-ENV:Server'
        && $fault->getMessage() === 'The registry is temporarily unavailable', $fault instanceof SoapFault ? $fault->getMessage() : json_encode($fault));
    check('GET /health → 503 degraded', http('GET', "{$base}/health")[0] === 503);
} finally {
    proc_terminate($server);
    proc_close($server);
    @unlink($database);
}

$serverLog = (string) @file_get_contents($log);
@unlink($log);
check('the password never appears in the server log', ! str_contains($serverLog, TEST_PASSWORD));

echo PHP_EOL.($checks - $failures)."/{$checks} checks passed".PHP_EOL;
exit($failures === 0 ? 0 : 1);
