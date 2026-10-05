<?php

declare(strict_types=1);

// No Composer: the service is plain PHP (soap, pdo_sqlite, dom extensions).
spl_autoload_register(function (string $class): void {
    $prefix = 'OpenDoor\\Registry\\';
    if (str_starts_with($class, $prefix)) {
        require __DIR__.'/'.substr($class, strlen($prefix)).'.php';
    }
});

date_default_timezone_set('Asia/Manila');
