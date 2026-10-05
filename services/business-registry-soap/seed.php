<?php

declare(strict_types=1);

/*
 * Creates data/registry.db (or REGISTRY_DB_PATH) with simulated DTI/SEC records.
 * Safe to re-run: the table is rebuilt from the list below every time.
 *
 *   php seed.php
 *
 * The first two records match the demo employers seeded by Core (DemoEmployerSeeder);
 * the others cover the negative cases (EXPIRED, CANCELLED, a name that does not match).
 */

use OpenDoor\Registry\Config;

require __DIR__.'/src/bootstrap.php';

/** registration_number, registry_type, registered_name, status, date_registered */
const RECORDS = [
    // Demo employers (Core DemoEmployerSeeder)
    ['3456789', 'DTI', 'BAYANIHAN TECH SOLUTIONS', 'ACTIVE', '2021-06-15'],
    ['CS201912345', 'SEC', 'KALINGA FOODS, INC.', 'ACTIVE', '2019-03-14'],
    // Other active businesses (T14 and live demos)
    ['CS201800777', 'SEC', 'BRIGHT PATH BPO INC.', 'ACTIVE', '2018-08-01'],
    ['7654321', 'DTI', 'LIWANAG PRINTING SERVICES', 'ACTIVE', '2020-01-08'],
    ['CS202100456', 'SEC', 'TAHANAN ACCESSIBLE HOMES CORPORATION', 'ACTIVE', '2021-11-30'],
    // Negative samples
    ['1234567', 'DTI', 'SARI-SARI DIGITAL SERVICES', 'EXPIRED', '2015-02-10'],
    ['2345678', 'DTI', 'MABUHAY CATERING', 'EXPIRED', '2016-07-22'],
    ['CS201500321', 'SEC', 'METRO ACCESS LOGISTICS CORP.', 'CANCELLED', '2015-11-20'],
    ['CS201700999', 'SEC', 'PANDAY WORKS MANUFACTURING INC.', 'CANCELLED', '2017-04-03'],
];

$file = Config::databasePath();
if (! is_dir(dirname($file))) {
    mkdir(dirname($file), 0775, true);
}

$pdo = new PDO('sqlite:'.$file, options: [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->beginTransaction();
$pdo->exec('DROP TABLE IF EXISTS registrations');
$pdo->exec(<<<'SQL'
    CREATE TABLE registrations (
        registration_number TEXT PRIMARY KEY,
        registry_type TEXT NOT NULL CHECK (registry_type IN ('DTI', 'SEC')),
        registered_name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')),
        date_registered TEXT NOT NULL
    )
    SQL);

$insert = $pdo->prepare('INSERT INTO registrations VALUES (?, ?, ?, ?, ?)');
foreach (RECORDS as $record) {
    $insert->execute($record);
}
$pdo->commit();

echo 'Seeded '.count(RECORDS).' registrations into '.$file.PHP_EOL;
