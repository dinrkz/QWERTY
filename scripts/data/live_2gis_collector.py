"""Prepared 2GIS live adapter. Default: inspect the plan; no credentials or network.

--live sends at most one explicitly approved request. Preparation is not execution
approval. Storage basis and a reviewed snapshot are required before continuation.
"""

import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import sys
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

try:
    from scripts.data import collect_2gis as c
except ModuleNotFoundError:
    import collect_2gis as c


PLAN_PATH = Path(__file__).with_name("2gis_collection_plan.json")
TIMEOUT = 30
OPTIONAL_IDS = {"bayterek-green-space", "mega-silk-way-green-space"}


def read_manifest(path):
    try:
        with Path(path).open("rb") as stream:
            data = stream.read(65537)
        if len(data) > 65536:
            raise ValueError()
        manifest = c.validate_manifest(c.strict_json(data))
    except (OSError, ValueError, TypeError, RecursionError):
        raise c.CollectionError("INVALID_MANIFEST_FILE") from None
    return validate_live_manifest(manifest)


def validate_live_manifest(manifest):
    c.validate_manifest(manifest)
    if (len(manifest["requests"]) != 12 or manifest["pending"] or
            manifest["requests"][0]["id"] != "bayterek-coffee" or
            {r["id"] for r in manifest["requests"][-2:]} != OPTIONAL_IDS or
            len({c.fingerprint(r["parameters"]) for r in manifest["requests"]}) != 12):
        raise c.CollectionError("INCOMPLETE_OR_DUPLICATE_LIVE_PLAN")
    return manifest


def read_key(path):
    """Read one TWOGIS_API_KEY assignment, without expansion or logging."""
    try:
        with Path(path).open("rb") as stream:
            raw = stream.read(65537)
        if len(raw) > 65536:
            raise ValueError()
        lines = raw.decode("utf-8-sig").splitlines()
    except (OSError, UnicodeError, ValueError):
        raise c.CollectionError("INVALID_KEY_FILE") from None
    found = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export ") or line.startswith("export\t"):
            line = line[6:].lstrip()
        if not re.match(r"TWOGIS_API_KEY(?:\s|=|$)", line):
            continue
        match = re.fullmatch(r"TWOGIS_API_KEY\s*=\s*(.*)", line)
        if match is None:
            raise c.CollectionError("INVALID_KEY_FILE")
        value = match[1].strip()
        if value and value[0] in ("'", '"'):
            if len(value) < 2 or value[-1] != value[0]:
                raise c.CollectionError("INVALID_KEY_FILE")
            value = value[1:-1]
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,1024}", value):
            raise c.CollectionError("INVALID_KEY_FILE")
        found.append(value)
    if len(found) != 1:
        raise c.CollectionError("INVALID_KEY_FILE")
    return found[0]


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Return the original response via HTTPError so its bounded body can be saved.
        return None


class LiveTransport:
    def __init__(self):
        self.key = None

    def __call__(self, params):
        if not self.key:
            raise c.CollectionError("KEY_NOT_LOADED")
        request = Request(c.ENDPOINT + "?" + urlencode({**c.parameters(params), "key": self.key}),
                          headers={"Accept": "application/json", "Accept-Encoding": "identity",
                                   "User-Agent": "QadamCollector/1.0"})
        # No system proxy, redirects, credentials in headers, retry or fallback endpoint.
        opener = build_opener(ProxyHandler({}), NoRedirect())
        try:
            try:
                response = opener.open(request, timeout=TIMEOUT)
            except HTTPError as error:
                response = error
            with response:
                if response.headers.get("Content-Encoding", "identity").lower() != "identity":
                    raise c.CollectionError("UNSUPPORTED_RESPONSE_ENCODING")
                body = response.read(c.MAX_BYTES + 1)
                if len(body) > c.MAX_BYTES:
                    raise c.CollectionError("RESPONSE_TOO_LARGE")
                return response.code, body
        except c.CollectionError:
            raise
        except Exception:
            raise c.CollectionError("TRANSPORT_FAILED") from None


def snapshot_token(collector, expected_quality=None):
    """Read a complete, freshly replayed snapshot; no secrets or requests."""
    try:
        pointer = c.strict_json((collector.runtime / "current.json").read_bytes())
        token = pointer["snapshot_id"]
        if not re.fullmatch(r"[0-9a-f]{64}", token):
            raise ValueError()
        folder = collector.root / "data/private/2gis" / token
        quality = c.strict_json((folder / "quality.json").read_bytes())
        rows = [c.strict_json(line) for line in (folder / "pois.jsonl").read_bytes().splitlines()]
        if c.digest({"rows": rows, "quality": quality}) != token:
            raise ValueError()
        if expected_quality is not None and quality != expected_quality:
            # A different writer advanced after collect_one released its lock.
            # Never label this invocation's report with that newer review token.
            raise c.CollectionError("REVIEW_SNAPSHOT_CHANGED")
        return token
    except (OSError, ValueError, TypeError, KeyError):
        raise c.CollectionError("INVALID_REVIEW_SNAPSHOT") from None


def approve_static(manifest, args):
    validate_live_manifest(manifest)
    if args.approved_manifest != c.digest(manifest):
        raise c.CollectionError("MANIFEST_APPROVAL_REQUIRED")
    if not isinstance(manifest["storage_basis"], str) or not manifest["storage_basis"].strip():
        raise c.CollectionError("STORAGE_BASIS_REQUIRED")
    if args.request_id not in {r["id"] for r in manifest["requests"]}:
        raise c.CollectionError("REQUEST_ID_REQUIRED")
    if args.max_new_attempts != 1:
        raise c.CollectionError("ONE_ATTEMPT_APPROVAL_REQUIRED")
    # Dashboard balance is a user-verified input, never fetched as a hidden request.
    if type(args.available_requests) is not int or args.available_requests < 1:
        raise c.CollectionError("DASHBOARD_BALANCE_REQUIRED")
    if args.usage_checked_on != datetime.now(timezone(timedelta(hours=5))).date().isoformat():
        raise c.CollectionError("FRESH_USAGE_CHECK_REQUIRED")


def run_live(manifest, args, collector=None):
    approve_static(manifest, args)
    collector = collector or c.Collector()
    transport, secrets = LiveTransport(), []
    request = next(r for r in manifest["requests"] if r["id"] == args.request_id)
    def gate(active, responses):
        completed = {r["fingerprint"] for r in responses}
        mandatory = manifest["requests"][:-2]
        # Mandatory ten searches are sequential. Optional refinements are independent
        # after those ten, so skipping one never forces a replacement request.
        next_required = next((r for r in mandatory if c.fingerprint(r["parameters"]) not in completed), None)
        if next_required is not None and request["id"] != next_required["id"]:
            raise c.CollectionError("REQUEST_OUT_OF_ORDER")
        if responses and args.reviewed_snapshot != snapshot_token(active):
            raise c.CollectionError("SAVED_PAGE_REVIEW_REQUIRED")
        if request["id"] in OPTIONAL_IDS and not args.green_space_gap_reviewed:
            raise c.CollectionError("GREEN_SPACE_GAP_REVIEW_REQUIRED")
        # The existing engine has already checked replay, corruption and budget under
        # its lock. Load the key last; a cached request never reaches this callback.
        transport.key = read_key(args.env_file)
        secrets.append(transport.key)
    quality = collector.collect_one(manifest, args.request_id, transport,
                                    secrets=secrets, before_dispatch=gate)
    return {"quality": quality, "snapshot_sha256": snapshot_token(collector, quality),
            "next_action": "Review saved source/category evidence and replay offline before another request"}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=PLAN_PATH)
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--approved-manifest")
    parser.add_argument("--request-id")
    parser.add_argument("--max-new-attempts", type=int)
    parser.add_argument("--available-requests", type=int)
    parser.add_argument("--usage-checked-on", help="Asia/Qyzylorda date of manual dashboard check (YYYY-MM-DD)")
    parser.add_argument("--reviewed-snapshot")
    parser.add_argument("--green-space-gap-reviewed", action="store_true")
    parser.add_argument("--env-file", type=Path, default=c.ROOT / ".env")
    args = parser.parse_args(argv)
    try:
        manifest = read_manifest(args.manifest)
        if args.live:
            output = run_live(manifest, args)
        else:
            output = {"manifest": manifest, "manifest_sha256": c.digest(manifest),
                      "live": False, "network_requests": 0, "max_new_attempts": 12,
                      "historical_attempts": 10, "per_invocation_limit": 1,
                      "execution_blockers": ["Explicit execution approval", "Current dashboard usage check"] +
                          ([] if manifest["storage_basis"] else ["Applicable storage basis not recorded"])}
        print(json.dumps(output, ensure_ascii=False, indent=2))
        return 0
    except c.CollectionError as error:
        print(json.dumps({"error": str(error)}))
    except (OSError, ValueError, TypeError, RecursionError):
        print(json.dumps({"error": "LOCAL_STORAGE_OR_DATA_ERROR"}))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
