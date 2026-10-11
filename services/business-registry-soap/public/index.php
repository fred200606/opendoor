<?php

declare(strict_types=1);

/*
 * Front controller (php -S 127.0.0.1:8003 -t public locally; FrankenPHP php-server in the Docker image).
 *   GET  /soap?wsdl  WSDL with soap:address pointing at the URL the client used
 *   POST /soap       SOAP 1.1 endpoint (VerifyBusinessRegistration)
 *   GET  /health     {"status":"ok"|"degraded","database":"ok"|"unavailable"}
 * Request bodies are never logged: they carry the WS-Security password.
 */

use OpenDoor\Registry\BusinessRegistry;
use OpenDoor\Registry\Config;
use OpenDoor\Registry\WsSecurity;

require dirname(__DIR__).'/src/bootstrap.php';

const WSDL_FILE = __DIR__.'/../wsdl/registry.wsdl';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = rtrim((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), '/') ?: '/';

$connect = function (): PDO {
    $file = Config::databasePath();
    if (! is_file($file)) {
        throw new RuntimeException('registry.db not found – run php seed.php');
    }
    $pdo = new PDO('sqlite:'.$file, options: [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

    return $pdo;
};

if ($path === '/health' && $method === 'GET') {
    try {
        $connect()->query('SELECT 1 FROM registrations LIMIT 1');
        $database = 'ok';
    } catch (Throwable) {
        $database = 'unavailable';
    }
    header('Content-Type: application/json');
    http_response_code($database === 'ok' ? 200 : 503);
    echo json_encode(['status' => $database === 'ok' ? 'ok' : 'degraded', 'service' => 'business-registry-soap', 'database' => $database]);
    exit;
}

if ($path !== '/soap') {
    http_response_code(404);
    header('Content-Type: text/plain');
    echo "Not found. SOAP endpoint: POST /soap, WSDL: GET /soap?wsdl\n";
    exit;
}

if ($method === 'GET') {
    if (! isset($_GET['wsdl'])) {
        http_response_code(405);
        header('Allow: POST');
        header('Content-Type: text/plain');
        echo "Use POST for SOAP requests; the contract is at /soap?wsdl\n";
        exit;
    }
    $scheme = (! empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = preg_match('/^[A-Za-z0-9.\-]+(:\d+)?$/', $_SERVER['HTTP_HOST'] ?? '') ? $_SERVER['HTTP_HOST'] : 'localhost:8003';
    $location = Config::get('REGISTRY_PUBLIC_URL') ?? "{$scheme}://{$host}/soap";
    header('Content-Type: text/xml; charset=utf-8');
    echo str_replace('http://registry.railway.internal:8003/soap', htmlspecialchars($location, ENT_XML1), (string) file_get_contents(WSDL_FILE));
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    header('Allow: GET, POST');
    exit;
}

$envelope = (string) file_get_contents('php://input');
$authenticated = WsSecurity::isValid(
    WsSecurity::credentials($envelope),
    Config::get('REGISTRY_SOAP_USER'),
    Config::get('REGISTRY_SOAP_PASSWORD'),
);

$server = new SoapServer(WSDL_FILE, ['soap_version' => SOAP_1_1, 'cache_wsdl' => WSDL_CACHE_NONE, 'encoding' => 'UTF-8']);
$server->setObject(new BusinessRegistry(Closure::fromCallable($connect), $authenticated));
$server->handle($envelope);
