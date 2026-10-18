"""Save-first 2GIS collection engine; CLI is deliberately offline-only for now.

No credentials are loaded and no network adapter is installed. An injected transport
is the boundary exercised by synthetic tests. Live activation is a separate step.
"""

import argparse
from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import tempfile
from urllib.parse import quote, quote_plus


ROOT = Path(__file__).resolve().parents[2]
ENDPOINT = "https://catalog.api.2gis.com/3.0/items"
CAMPAIGN = "qadam-2gis-v1"
MAX_ATTEMPTS = 12
HISTORICAL_ATTEMPTS = 10
MAX_BYTES = 4 * 1024 * 1024
MAX_STORED_BYTES = MAX_BYTES * 6 + 64 * 1024
FIELDS = "items.point,items.rubrics,items.description,items.schedule,items.adm_div"
SENSITIVE = {"key", "api_key", "apikey", "authorization", "access_token", "token"}


class CollectionError(Exception):
    """Fixed local codes only; never include transport/provider exception text."""


def encoded(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def digest(value):
    return hashlib.sha256(encoded(value)).hexdigest()


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def strict_json(data):
    def invalid(_):
        raise ValueError("NON_FINITE")
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("DUPLICATE_KEY")
            result[key] = value
        return result
    return json.loads(data, parse_constant=invalid, object_pairs_hook=unique)


def atomic_write(path, data):
    """Only complete fsynced temporary files replace final artifacts."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".pending-",
                                         delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def coordinate(value):
    if (not isinstance(value, (list, tuple)) or len(value) != 2 or
            any(type(v) not in (int, float) or not math.isfinite(v) for v in value) or
            not -180 <= value[0] <= 180 or not -90 <= value[1] <= 90):
        raise CollectionError("INVALID_COORDINATE")
    return tuple(value)


def parameters(value):
    """Small fixed query surface; key, endpoint overrides and extra fields rejected."""
    required = {"q", "point", "radius", "page_size", "page", "sort", "locale", "fields"}
    if not isinstance(value, dict) or set(value) != required:
        raise CollectionError("INVALID_PARAMETERS")
    if not isinstance(value["q"], str) or not value["q"].strip() or len(value["q"]) > 100:
        raise CollectionError("INVALID_QUERY")
    try:
        if not isinstance(value["point"], str):
            raise ValueError()
        lon, lat = coordinate(tuple(float(v) for v in value["point"].split(",")))
    except (ValueError, CollectionError):
        raise CollectionError("INVALID_QUERY_POINT") from None
    # Local collection scope, not device/user location input.
    if not 71.0 <= lon <= 72.0 or not 50.8 <= lat <= 51.5:
        raise CollectionError("OUTSIDE_ASTANA_SCOPE")
    for name, ceiling in (("radius", 2000), ("page_size", 50), ("page", 5)):
        if type(value[name]) is not int or not 1 <= value[name] <= ceiling:
            raise CollectionError("INVALID_QUERY_LIMIT")
    if value["sort"] != "distance" or value["locale"] != "ru_KZ" or value["fields"] != FIELDS:
        raise CollectionError("INVALID_QUERY_MODE")
    return {**value, "q": value["q"].strip(), "point": f"{lon},{lat}"}


def fingerprint(params):
    return digest({"endpoint": ENDPOINT, "parameters": parameters(params)})


def draft_manifest():
    requests = []
    for area, point in (("bayterek", "71.430456,51.128301"),
                        ("mega-silk-way", "71.405441,51.089347")):
        for category, query in (("coffee", "кофейня"), ("parks", "парк"),
                                ("museums", "музей"), ("sights", "достопримечательности")):
            requests.append({"id": f"{area}-{category}", "area": area,
                             "intent": category, "parameters": {
                                 "q": query, "point": point,
                                 "radius": 1500 if category == "coffee" else 2000,
                                 "page_size": 50, "page": 1, "sort": "distance",
                                 "locale": "ru_KZ", "fields": FIELDS}})
    return {"campaign": CAMPAIGN, "max_attempts": MAX_ATTEMPTS,
            "historical_attempts": HISTORICAL_ATTEMPTS,
            "storage_basis": None, "requests": requests,
            "pending": ["hub-gap-1", "hub-gap-2", "neighborhood-coffee", "neighborhood-parks"],
            "anchor_provenance": "Reviewed source coordinates from completed probe; docs/2GIS_PROBE_PLAN.md",
            "status": "draft; offline only; no live authorization"}


def validate_manifest(manifest):
    if (not isinstance(manifest, dict) or manifest.get("campaign") != CAMPAIGN or
            type(manifest.get("max_attempts")) is not int or manifest["max_attempts"] != 12 or
            type(manifest.get("historical_attempts")) is not int or manifest["historical_attempts"] != 10):
        raise CollectionError("INVALID_MANIFEST_BUDGET")
    if set(manifest) != {"campaign", "max_attempts", "historical_attempts", "storage_basis",
                         "requests", "pending", "anchor_provenance", "status"}:
        raise CollectionError("INVALID_MANIFEST_FIELDS")
    for field in ("anchor_provenance", "status"):
        if not isinstance(manifest[field], str) or not manifest[field].strip():
            raise CollectionError("INVALID_MANIFEST_METADATA")
    if manifest["storage_basis"] is not None and not isinstance(manifest["storage_basis"], str):
        raise CollectionError("INVALID_STORAGE_BASIS")
    if not isinstance(manifest["pending"], list) or any(not isinstance(v, str) for v in manifest["pending"]):
        raise CollectionError("INVALID_PENDING_SLOTS")
    requests = manifest.get("requests")
    if not isinstance(requests, list) or not 1 <= len(requests) <= MAX_ATTEMPTS:
        raise CollectionError("INVALID_MANIFEST_REQUESTS")
    names = set()
    for request in requests:
        if not isinstance(request, dict) or set(request) != {"id", "area", "intent", "parameters"}:
            raise CollectionError("INVALID_MANIFEST_REQUEST")
        name = request["id"]
        if not isinstance(name, str) or not re.fullmatch(r"[a-z0-9-]{1,80}", name) or name in names:
            raise CollectionError("INVALID_REQUEST_ID")
        names.add(name)
        if any(not isinstance(request[field], str) or not request[field].strip()
               for field in ("area", "intent")):
            raise CollectionError("INVALID_REQUEST_LABEL")
        parameters(request["parameters"])
    return manifest


def scrub_body(body, secrets):
    if not isinstance(body, bytes) or len(body) > MAX_BYTES:
        raise CollectionError("RESPONSE_TOO_LARGE_OR_INVALID")
    try:
        text = body.decode("utf-8")
    except UnicodeError:
        raise CollectionError("INVALID_RESPONSE_ENCODING") from None
    forms, escaped_patterns = set(), []
    for secret in secrets:
        if not isinstance(secret, str) or not secret or len(secret) > 1024:
            raise CollectionError("INVALID_REDACTION_SECRET")
        forms.update({secret, json.dumps(secret)[1:-1], quote(secret, safe=""), quote_plus(secret)})
        escaped_patterns.append(re.compile("".join(
            "(?:" + "|".join(re.escape(v) for v in {
                character, json.dumps(character)[1:-1],
                "\\u%04x" % ord(character), "\\u%04X" % ord(character),
                "\\/" if character == "/" else character}) + ")"
            for character in secret)))
    def redact(text):
        for pattern in escaped_patterns:
            text = pattern.sub("[REDACTED]", text)
        for form in sorted(forms, key=len, reverse=True):
            text = text.replace(form, "[REDACTED]")
        return text
    text = redact(text)
    # Also scrub known credential fields if the provider reflects a request.
    def clean(value):
        if isinstance(value, dict):
            return {redact(k): "[REDACTED]" if k.lower() in SENSITIVE else clean(v) for k, v in value.items()}
        if isinstance(value, list):
            return [clean(v) for v in value]
        if isinstance(value, str):
            return redact(value)
        return value
    try:
        return encoded(clean(strict_json(text))).decode("utf-8")
    except (ValueError, RecursionError):
        # Malformed bodies remain recoverable evidence with known secret values scrubbed.
        return text


def envelope(response):
    if response["http_status"] != 200:
        raise CollectionError("HTTP_STATUS_ERROR")
    try:
        body = strict_json(response["body"])
    except (ValueError, RecursionError):
        raise CollectionError("INVALID_JSON_RESPONSE") from None
    if not isinstance(body, dict) or not isinstance(body.get("meta"), dict):
        raise CollectionError("INVALID_RESPONSE_ENVELOPE")
    if type(body["meta"].get("code")) is not int or body["meta"]["code"] != 200:
        raise CollectionError("API_STATUS_ERROR")
    result = body.get("result")
    if (not isinstance(result, dict) or not isinstance(result.get("items"), list) or
            type(result.get("total")) is not int or result["total"] < len(result["items"]) or
            len(result["items"]) > response["parameters"]["page_size"]):
        raise CollectionError("INVALID_RESPONSE_ENVELOPE")
    return result["items"], result["total"]


def normalize_item(item):
    if not isinstance(item, dict):
        raise CollectionError("INVALID_ITEM_OBJECT")
    identifier, name, point = item.get("id"), item.get("name"), item.get("point")
    if (not isinstance(identifier, str) or not identifier.strip() or len(identifier) > 512 or
            any(ord(c) < 32 or ord(c) == 127 for c in identifier)):
        raise CollectionError("INVALID_ITEM_ID")
    if not isinstance(name, str) or not name.strip():
        raise CollectionError("INVALID_ITEM_NAME")
    if not isinstance(point, dict):
        raise CollectionError("INVALID_COORDINATE")
    lon, lat = coordinate((point.get("lon"), point.get("lat")))
    warnings = []
    def optional(field, expected):
        value = item.get(field)
        if value is not None and not isinstance(value, expected):
            warnings.append("INVALID_" + field.upper())
            return None
        return value
    rubrics = optional("rubrics", list)
    if rubrics is not None and any(not isinstance(v, dict) or not isinstance(v.get("name"), str) for v in rubrics):
        warnings.append("INVALID_RUBRICS")
        rubrics = None
    description = optional("description", str)
    if description is not None and not description.strip():
        description = None
    return {"id": "2gis:" + identifier, "source_id": identifier, "name": name,
            "coordinates": {"lon": lon, "lat": lat},
            "source_description": description, "source_rubrics": rubrics,
            "source_type": optional("type", str), "address": optional("address_name", str),
            "schedule": optional("schedule", dict), "adm_div": optional("adm_div", list),
            "demo_eligible": False, "eligibility_note": "member_2_contract_pending"}, warnings


class Collector:
    """One campaign, one journal, one lock. No network implementation is supplied."""

    def __init__(self, root=ROOT):
        self.root = Path(root)
        self.runtime = self.root / "data/runtime/2gis-collection"
        self.raw = self.root / "data/raw/2gis" / CAMPAIGN
        self.ledger = self.runtime / "ledger.jsonl"
        self.lock = self.runtime / "run.lock"

    @contextmanager
    def locked(self):
        self.runtime.mkdir(parents=True, exist_ok=True)
        # OS locks are released on process exit, including a crash. Keep the file:
        # unlinking it could let another process lock a different file at this path.
        with self.lock.open("a+b") as stream:
            try:
                if os.name == "nt":
                    import msvcrt
                    stream.seek(0)
                    msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError:
                raise CollectionError("COLLECTOR_LOCKED") from None
            try:
                yield
            finally:
                if os.name == "nt":
                    stream.seek(0)
                    msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    fcntl.flock(stream.fileno(), fcntl.LOCK_UN)

    def events(self):
        if not self.ledger.exists():
            if self.raw.exists():
                raise CollectionError("MISSING_LEDGER")
            return []
        data = self.ledger.read_bytes()
        if not data or not data.endswith(b"\n"):
            raise CollectionError("CORRUPT_LEDGER")
        events, previous, reservations, receipts = [], None, {}, set()
        try:
            for index, line in enumerate(data.splitlines()):
                event = strict_json(line)
                check = dict(event)
                event_hash = check.pop("sha256")
                if event["previous"] != previous or digest(check) != event_hash:
                    raise ValueError()
                kind = event["kind"]
                if index == 0:
                    if kind != "init" or event["campaign"] != CAMPAIGN or event["max_attempts"] != 12 or event["historical_attempts"] != 10:
                        raise ValueError()
                elif kind == "reserve":
                    fp = event["fingerprint"]
                    if (fp in reservations or fp != fingerprint(event["parameters"]) or
                            event["attempt"] != len(reservations) + 1 or len(reservations) >= 12):
                        raise ValueError()
                    reservations[fp] = event
                elif kind == "saved":
                    if event["fingerprint"] not in reservations or event["fingerprint"] in receipts:
                        raise ValueError()
                    receipts.add(event["fingerprint"])
                elif kind != "blocked":
                    raise ValueError()
                events.append(event)
                previous = event_hash
        except (ValueError, TypeError, KeyError, CollectionError):
            raise CollectionError("CORRUPT_LEDGER") from None
        return events

    def append(self, kind, **values):
        events = self.events()
        event = {"kind": kind, "previous": events[-1]["sha256"] if events else None, **values}
        event["sha256"] = digest(event)
        with self.ledger.open("ab") as stream:
            stream.write(encoded(event) + b"\n")
            stream.flush()
            os.fsync(stream.fileno())
        return event

    def initialize(self):
        if not self.events():
            self.append("init", campaign=CAMPAIGN, max_attempts=MAX_ATTEMPTS,
                        historical_attempts=HISTORICAL_ATTEMPTS)

    def response_path(self, fp):
        return self.raw / "responses" / (fp + ".json")

    def load_response(self, reservation, expected=None):
        path = self.response_path(reservation["fingerprint"])
        data = path.read_bytes()
        if len(data) > MAX_STORED_BYTES:
            raise CollectionError("CORRUPT_SAVED_RESPONSE")
        checksum = hashlib.sha256(data).hexdigest()
        try:
            response = strict_json(data)
            unsigned = dict(response)
            stored_hash = unsigned.pop("sha256")
            if (digest(unsigned) != stored_hash or response["fingerprint"] != reservation["fingerprint"] or
                    response["parameters"] != reservation["parameters"] or
                    response["attempt"] != reservation["attempt"] or
                    response["reserved_at"] != reservation["reserved_at"] or
                    response["manifest_sha256"] != reservation["manifest_sha256"] or
                    not isinstance(response["collected_at"], str) or
                    response["campaign"] != CAMPAIGN or response["endpoint"] != ENDPOINT or
                    type(response["http_status"]) is not int or not isinstance(response["body"], str) or
                    (expected is not None and checksum != expected)):
                raise ValueError()
        except (ValueError, TypeError, KeyError):
            raise CollectionError("CORRUPT_SAVED_RESPONSE") from None
        return response, checksum

    def reconcile(self):
        events = self.events()
        reserved_fps = {e["fingerprint"] for e in events if e["kind"] == "reserve"}
        if any(path.stem not in reserved_fps for path in (self.raw / "responses").glob("*.json")):
            raise CollectionError("ORPHAN_SAVED_RESPONSE")
        saved = {e["fingerprint"]: e["body_sha256"] for e in events if e["kind"] == "saved"}
        responses = []
        for reservation in (e for e in events if e["kind"] == "reserve"):
            fp = reservation["fingerprint"]
            try:
                manifest_hash = reservation["manifest_sha256"]
                if not isinstance(manifest_hash, str) or not re.fullmatch(r"[0-9a-f]{64}", manifest_hash):
                    raise ValueError()
                manifest = validate_manifest(strict_json(
                    (self.raw / "manifests" / (manifest_hash + ".json")).read_bytes()))
                if digest(manifest) != manifest_hash or not any(
                        r["id"] == reservation["request_id"] and parameters(r["parameters"]) == reservation["parameters"]
                        for r in manifest["requests"]):
                    raise ValueError()
            except (OSError, ValueError, KeyError, TypeError, CollectionError):
                raise CollectionError("CORRUPT_OR_MISSING_MANIFEST") from None
            if not self.response_path(fp).exists():
                raise CollectionError("SAVED_RESPONSE_MISSING" if fp in saved else "UNCERTAIN_ATTEMPT_NO_RETRY")
            response, checksum = self.load_response(reservation, saved.get(fp))
            if fp not in saved:
                self.append("saved", fingerprint=fp, body_sha256=checksum)
            responses.append(response)
        return responses

    def publish(self, responses):
        records, rejected, warnings, pages = {}, Counter(), Counter(), []
        occurrences = 0
        for response in responses:
            items, total = envelope(response)
            accepted, new = 0, 0
            for index, item in enumerate(items):
                try:
                    record, row_warnings = normalize_item(item)
                except CollectionError as error:
                    rejected[str(error)] += 1
                    continue
                warnings.update(row_warnings)
                occurrences += 1
                accepted += 1
                version_hash = digest(record)
                provenance = {"response": str(self.response_path(response["fingerprint"]).relative_to(self.root)),
                              "request_fingerprint": response["fingerprint"], "item_index": index,
                              "collected_at": response["collected_at"], "locale": response["parameters"]["locale"],
                              "manifest_sha256": response["manifest_sha256"],
                              "field_provenance": "All fields in this version come from this response/item; null denotes unknown"}
                identifier = record["id"]
                if identifier not in records:
                    records[identifier] = {"id": identifier, "versions": []}
                    new += 1
                entry = records[identifier]
                version = next((v for v in entry["versions"] if v["sha256"] == version_hash), None)
                if version is None:
                    version = {"sha256": version_hash, "fields": record, "provenance": []}
                    entry["versions"].append(version)
                version["provenance"].append(provenance)
                entry["latest_version"] = version_hash
            pages.append({"fingerprint": response["fingerprint"], "returned": len(items),
                          "reported_total": total, "accepted": accepted, "new_unique": new,
                          "coverage_review_required": True})
        rows = [records[key] for key in sorted(records)]
        missing = sum(next(v for v in row["versions"] if v["sha256"] == row["latest_version"])
                      ["fields"]["source_description"] is None for row in rows)
        attempts = sum(e["kind"] == "reserve" for e in self.events())
        quality = {"schema_version": 1, "unique_places": len(rows), "accepted_occurrences": occurrences,
                   "duplicate_occurrences": occurrences - len(rows), "rejections": dict(rejected),
                   "optional_field_warnings": dict(warnings), "missing_descriptions": missing,
                   "pages": pages, "new_attempts_used": attempts, "new_attempts_remaining": 12 - attempts,
                   "historical_attempts": 10, "project_attempts": 10 + attempts,
                   "demo_eligible": False, "source": "2GIS", "attribution": "2GIS",
                   "rights_and_integration": "See stored manifest storage_basis; AI use/redistribution not implied"}
        snapshot_id = digest({"rows": rows, "quality": quality})
        folder = self.root / "data/private/2gis" / snapshot_id
        atomic_write(folder / "pois.jsonl", b"".join(encoded(row) + b"\n" for row in rows))
        atomic_write(folder / "quality.json", encoded(quality) + b"\n")
        # Consumers follow this pointer only after both snapshot files are complete.
        atomic_write(self.runtime / "current.json", encoded({"snapshot_id": snapshot_id}) + b"\n")
        return quality

    def replay(self):
        with self.locked():
            if not self.events():
                raise CollectionError("NO_SAVED_COLLECTION")
            return self.publish(self.reconcile())

    def collect_one(self, manifest, request_id, transport, *, secrets=()):
        """One explicit entry per invocation; transport(params) -> (status, bytes).

        Only intended for offline injected transports until live activation is
        reviewed. A future live adapter must supply its key in `secrets` and bind
        explicit execution approval to the complete manifest digest.
        """
        validate_manifest(manifest)
        request = next((r for r in manifest["requests"] if r["id"] == request_id), None)
        if request is None:
            raise CollectionError("UNKNOWN_REQUEST")
        params = parameters(request["parameters"])
        fp = fingerprint(params)
        with self.locked():
            self.initialize()
            responses = self.reconcile()
            # Rebuild from cached pages before any next dispatch: parser/disk errors stop spending.
            if responses:
                quality = self.publish(responses)
            if any(r["fingerprint"] == fp for r in responses):
                return quality
            if any(e["kind"] == "blocked" for e in self.events()):
                raise CollectionError("COLLECTION_BLOCKED")
            old_path = self.raw / "manifest.json"
            if old_path.exists():
                old = strict_json(old_path.read_bytes())
                old_requests = {r["id"]: r for r in old["requests"]}
                new_requests = {r["id"]: r for r in manifest["requests"]}
                if any(new_requests.get(name) != value for name, value in old_requests.items()):
                    raise CollectionError("MANIFEST_MUST_BE_APPEND_ONLY")
            attempts = sum(e["kind"] == "reserve" for e in self.events())
            if attempts >= MAX_ATTEMPTS:
                raise CollectionError("BUDGET_EXHAUSTED")
            atomic_write(old_path, encoded(manifest) + b"\n")
            atomic_write(self.raw / "manifests" / (digest(manifest) + ".json"), encoded(manifest) + b"\n")
            reserved = self.append("reserve", fingerprint=fp, parameters=params,
                                   attempt=attempts + 1, reserved_at=timestamp(),
                                   manifest_sha256=digest(manifest), request_id=request_id)
            try:
                status, body = transport(dict(params))
                if type(status) is not int:
                    raise CollectionError("INVALID_HTTP_STATUS")
                response = {"campaign": CAMPAIGN, "endpoint": ENDPOINT,
                            "fingerprint": fp, "parameters": params,
                            "attempt": reserved["attempt"], "reserved_at": reserved["reserved_at"],
                            "manifest_sha256": reserved["manifest_sha256"],
                            "collected_at": timestamp(), "http_status": status,
                            "body": scrub_body(body, secrets)}
                response["sha256"] = digest(response)
                output = encoded(response) + b"\n"
                if len(output) > MAX_STORED_BYTES:
                    raise CollectionError("STORED_RESPONSE_TOO_LARGE")
                atomic_write(self.response_path(fp), output)
            except Exception:
                # Reservation remains spent, even if recording the failure also fails.
                self.append("blocked", code="TRANSPORT_OR_SAVE_FAILED", fingerprint=fp)
                raise CollectionError("TRANSPORT_OR_SAVE_FAILED") from None
            self.append("saved", fingerprint=fp, body_sha256=hashlib.sha256(output).hexdigest())
            try:
                envelope(response)
            except CollectionError as error:
                self.append("blocked", code=str(error), fingerprint=fp)
                raise
            return self.publish(responses + [response])


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--replay", action="store_true", help="Rebuild local saved pages, without network")
    args = parser.parse_args(argv)
    try:
        if args.replay:
            print(json.dumps(Collector().replay(), indent=2, ensure_ascii=False))
        else:
            manifest = draft_manifest()
            print(json.dumps({"manifest": manifest, "manifest_sha256": digest(manifest),
                              "live_enabled": False, "max_project_attempts": 22,
                              "destinations": {"raw": str(Collector().raw),
                                               "ledger": str(Collector().ledger),
                                               "normalized": str(ROOT / "data/private/2gis/<snapshot-id>")}},
                             indent=2, ensure_ascii=False))
        return 0
    except CollectionError as error:
        print(json.dumps({"error": str(error)}))
        return 1
    except (OSError, ValueError, TypeError, RecursionError):
        print(json.dumps({"error": "LOCAL_STORAGE_OR_DATA_ERROR"}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
