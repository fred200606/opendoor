# OpenDoor Business Registry (simulated legacy SOAP service)

A **simulation** of a DTI/SEC business registry that only speaks SOAP 1.1 (document/literal). The real DTI BNRS and SEC systems have no public machine interface, so this service is seeded with sample records; the contract, WS-Security header and faults are a real SOAP integration (SIA documentation 4.3). Only the Core Service calls it, over the private network – it has no public URL.

Plain PHP 8.3+ with the `soap`, `pdo_sqlite` and `dom` extensions – no Composer packages.

| Request | Answer |
|---|---|
| `GET /soap?wsdl` | `wsdl/registry.wsdl`, with `soap:address` set to the URL the client used (or `REGISTRY_PUBLIC_URL`) |
| `POST /soap` | Operation `VerifyBusinessRegistration`, SOAPAction `urn:opendoor:registry:v1#VerifyBusinessRegistration` |
| `GET /health` | `{"status":"ok","database":"ok"}`, or 503 `degraded` when `registry.db` is missing |

Every request needs a WS-Security 1.0 `UsernameToken` (PasswordText) with `REGISTRY_SOAP_USER` / `REGISTRY_SOAP_PASSWORD` – the same values as in `services/core-api/.env`.

| Fault (`soapenv:` = SOAP 1.1 envelope namespace) | When |
|---|---|
| `soapenv:Client.Authentication` | Header missing, wrong user or password, or a PasswordDigest token |
| `soapenv:Client.Validation` | `RegistrationNumber` not 5–20 letters/digits (hyphens and spaces are ignored), `RegistryType` not DTI/SEC, empty `BusinessName` |
| `soapenv:Client` | Malformed XML (raised by PHP `SoapServer`) |
| `soapenv:Server` | Anything unexpected, e.g. the database is missing (generic message; details only in the server log) |

`NameMatchScore` (0–1, 2 decimals) compares the submitted and registered names after normalizing them (upper case, `&` → `AND`, punctuation removed, trailing INC./CORP./CO./LTD./OPC dropped) with `similar_text`. The Core Service highlights scores below 0.80; the registry never decides anything.

## Local setup

```powershell
copy .env.example .env      # set REGISTRY_SOAP_PASSWORD to the value in services/core-api/.env
php seed.php                # creates data/registry.db (git-ignored); safe to re-run
php -S localhost:8003 -t public
php tests/run.php           # unit checks + a smoke test on its own port, credentials and database
```

## Seeded records (`seed.php`)

| Number | Registry | Registered name | Status |
|---|---|---|---|
| 3456789 | DTI | BAYANIHAN TECH SOLUTIONS | ACTIVE (demo employer@) |
| CS201912345 | SEC | KALINGA FOODS, INC. | ACTIVE (demo employer2@) |
| CS201800777 | SEC | BRIGHT PATH BPO INC. | ACTIVE |
| 7654321 | DTI | LIWANAG PRINTING SERVICES | ACTIVE |
| CS202100456 | SEC | TAHANAN ACCESSIBLE HOMES CORPORATION | ACTIVE |
| 1234567, 2345678 | DTI | SARI-SARI DIGITAL SERVICES, MABUHAY CATERING | EXPIRED |
| CS201500321, CS201700999 | SEC | METRO ACCESS LOGISTICS CORP., PANDAY WORKS MANUFACTURING INC. | CANCELLED |

Any other number answers `Found=false`, `Status=NOT_FOUND`.

## Environment

| Variable | Purpose |
|---|---|
| `PORT` | 8003 (used by the Docker image; locally pass it to `php -S`) |
| `REGISTRY_SOAP_USER`, `REGISTRY_SOAP_PASSWORD` | Accepted UsernameToken (secret – never logged) |
| `REGISTRY_DB_PATH` | Optional; default `data/registry.db` |
| `REGISTRY_PUBLIC_URL` | Optional; fixed `soap:address` instead of the request's host |
