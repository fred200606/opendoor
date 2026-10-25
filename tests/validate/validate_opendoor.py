"""OpenDoor service validation: checks that each service answers, that the gateway routes to
Core and Insights, and that Insights reaches Core over the service-to-service link.

Standard library only. Read-only: every request is a GET, so it is safe against production.

    python tests/validate/validate_opendoor.py                  # local stack
    python tests/validate/validate_opendoor.py --id 3           # use posting 3 as the sample
    python tests/validate/validate_opendoor.py --gateway https://gateway-production-4e58.up.railway.app --gateway-only

See README.md next to this file for what to check when a test fails.
"""

import argparse
import json
import sys
import urllib.error
import urllib.request

UNKNOWN_ID = 2147483647  # largest id Core accepts; no posting has it

parser = argparse.ArgumentParser(description="Validate the OpenDoor services and their links.")
parser.add_argument("--gateway", default="http://127.0.0.1:8080")
parser.add_argument("--core", default="http://127.0.0.1:8001")
parser.add_argument("--insights", default="http://127.0.0.1:8002")
parser.add_argument("--registry", default="http://127.0.0.1:8003")
parser.add_argument("--id", type=int, help="sample job posting id (default: the first open posting)")
parser.add_argument("--timeout", type=float, default=2.0, help="seconds per request (default 2)")
parser.add_argument("--snapshot-timeout", type=float, default=15.0,
                    help="seconds for snapshot requests, which call PSGC/Nominatim/Overpass (default 15)")
parser.add_argument("--gateway-only", action="store_true",
                    help="skip checks that call Core, Insights or the registry directly (production: private network)")
args = parser.parse_args()


def get(url, timeout=None):
    """GET a URL -> (status, parsed JSON or raw text). HTTP errors return their status, not raise."""
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout or args.timeout) as response:
            status, body = response.status, response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as error:
        status, body = error.code, error.read().decode("utf-8", "replace")
    try:
        return status, json.loads(body)
    except ValueError:
        return status, body


def expect(condition, message):
    if not condition:
        raise AssertionError(message)


def sample_id():
    expect(sample["id"] is not None, "no sample posting (see 'Sample posting found' above)")
    return sample["id"]


def error_code(body):
    return body.get("error", {}).get("code") if isinstance(body, dict) else None


results = []  # True = pass, False = fail; skipped checks are not counted


def check(name, direct=False):
    """Run the decorated function as a check now and print one PASS/FAIL/SKIP line
    (plus the detail the function returns, if any)."""
    def run(fn):
        if direct and args.gateway_only:
            print(f"[SKIP] {name}")
            return fn
        try:
            detail = fn()
            print(f"[PASS] {name}")
            if detail:
                print(f" {detail}")
            results.append(True)
        except Exception as error:  # one broken service must not stop the other checks
            reason = error.reason if isinstance(error, urllib.error.URLError) else error
            print(f"[FAIL] {name}\n       -> {type(error).__name__}: {reason}")
            results.append(False)
        return fn
    return run


G, C, I, R = (url.rstrip("/") for url in (args.gateway, args.core, args.insights, args.registry))
sample = {"id": args.id}


# --- 1. Each service is up -------------------------------------------------------------------

@check("Core is up (GET /up)", direct=True)
def _():
    status, _ = get(f"{C}/up")
    expect(status == 200, f"HTTP {status}")


@check("Insights is up (GET /health)", direct=True)
def _():
    status, body = get(f"{I}/health")
    expect(status == 200 and body.get("status") == "ok", f"HTTP {status} {body}")


@check("Business Registry is up (GET /health, database ok)", direct=True)
def _():
    status, body = get(f"{R}/health")
    expect(status == 200 and body.get("database") == "ok", f"HTTP {status} {body}")


@check("Business Registry serves its WSDL (GET /soap?wsdl)", direct=True)
def _():
    status, body = get(f"{R}/soap?wsdl")
    expect(status == 200 and "VerifyBusinessRegistration" in str(body), f"HTTP {status}, operation missing")


@check("Gateway reaches Core and Insights (GET /api/health)")
def _():
    status, body = get(f"{G}/api/health", timeout=max(args.timeout, 4))  # gateway pings with 3 s timeouts
    expect(status == 200, f"HTTP {status}")
    expect(body.get("services") == {"core": "up", "insights": "up"}, f"services = {body.get('services')}")


# --- 2. Direct lookup in Core ----------------------------------------------------------------

# The sample comes from the search list (ids differ between databases), through the gateway
# with --gateway-only, else from Core directly.
@check("Sample posting found (GET /api/job-postings)")
def _():
    if sample["id"] is None:
        status, body = get(f"{G if args.gateway_only else C}/api/job-postings")
        expect(status == 200, f"HTTP {status}")
        expect(body.get("data"), "no open postings - seed the database or pass --id")
        sample["id"] = body["data"][0]["id"]
    return f"sample job posting id = {sample['id']}"


@check("Core returns the posting directly (GET /api/job-postings/{id})", direct=True)
def _():
    posting_id = sample_id()
    status, body = get(f"{C}/api/job-postings/{posting_id}")
    expect(status == 200, f"HTTP {status} {error_code(body)}")
    expect(body.get("id") == posting_id, f"id = {body.get('id')}, expected {posting_id}")
    sample["direct"] = body


# --- 3. Gateway routing ----------------------------------------------------------------------

@check("Gateway routes /api/* to Core: same posting")
def _():
    posting_id = sample_id()
    status, body = get(f"{G}/api/job-postings/{posting_id}")
    expect(status == 200, f"HTTP {status} {error_code(body)}")
    expect(body.get("id") == posting_id, f"id = {body.get('id')}, expected {posting_id}")
    if "direct" in sample:
        expect(body.get("title") == sample["direct"].get("title"), "title differs from Core's answer")


@check("Gateway passes Core's 404 for an unknown posting (error envelope)")
def _():
    status, body = get(f"{G}/api/job-postings/{UNKNOWN_ID}")
    expect(status == 404 and error_code(body) == "NOT_FOUND", f"HTTP {status} {error_code(body)}")
    expect(body["error"].get("request_id"), "no request_id in the error")


@check("Gateway requires a token for /api/me (401)")
def _():
    status, body = get(f"{G}/api/me")
    expect(status == 401 and error_code(body) == "UNAUTHENTICATED", f"HTTP {status} {error_code(body)}")


# --- 4. Service-to-service: Insights -> Core /internal ---------------------------------------

def expect_snapshot(base):
    posting_id = sample_id()
    status, body = get(f"{base}/api/insights/job-postings/{posting_id}", timeout=args.snapshot_timeout)
    expect(status == 200, f"HTTP {status} {error_code(body)}")
    expect(body.get("job_posting_id") == posting_id,
           f"job_posting_id = {body.get('job_posting_id')}, expected {posting_id}")
    expect(body.get("sources", {}).get("core") == "ok", f"sources = {body.get('sources')}")
    return f"sources = {body['sources']}"


@check("Insights builds the snapshot from Core's /internal summary", direct=True)
def _():
    return expect_snapshot(I)


@check("Gateway routes /api/insights/* to Insights: same snapshot")
def _():
    return expect_snapshot(G)


@check("Core refuses /internal without the service key (401)", direct=True)
def _():
    status, body = get(f"{C}/internal/job-postings/{sample_id()}/summary")
    expect(status == 401 and error_code(body) == "UNAUTHENTICATED", f"HTTP {status} {error_code(body)}")


@check("Gateway never exposes /internal (404)")
def _():
    status, body = get(f"{G}/internal/job-postings/{sample_id()}/summary")
    expect(status == 404 and error_code(body) == "NOT_FOUND", f"HTTP {status} {error_code(body)}")


passed, total = sum(results), len(results)
print(f"\nResult: {passed}/{total} checks passed")
sys.exit(0 if passed == total else 1)
