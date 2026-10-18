"""Bounded 2GIS feasibility probe. Default: print plan, with no network or secrets.

Live use requires separately approved permissions and budget. Not a collector.
"""

import argparse
from datetime import datetime, timezone
import getpass
import gzip
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import sys
import time
import warnings
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener


ENDPOINT = "https://catalog.api.2gis.com/3.0/items"
STATE_DIR = Path(__file__).resolve().parents[2] / "data/runtime/2gis-probe-v1"
MAX_ATTEMPTS = 10
MAX_BYTES = 4 * 1024 * 1024
TIMEOUT = 30
INTERVAL = 1.0
CENTER = (71.43, 51.13)  # Simulated search centre; never a personal location.
FIELDS = "items.point,items.rubrics,items.description,items.schedule,items.adm_div"
# query, anchor, radius, page size, sort, locale, page
SLOTS = (
    ("MEGA Silk Way", "S", 15000, 5, "relevance", "ru_KZ", 1),
    ("Байтерек", "S", 15000, 5, "relevance", "ru_KZ", 1),
    ("кофейня", "A", 1500, 10, "distance", "ru_KZ", 1),
    ("парк", "A", 2000, 10, "distance", "ru_KZ", 1),
    ("достопримечательности", "B", 2000, 10, "distance", "ru_KZ", 1),
    ("музей", "B", 2000, 10, "distance", "ru_KZ", 1),
    ("кофейня", "B", 1500, 10, "distance", "ru_KZ", 1),
    ("кофейня", "B", 1500, 10, "relevance", "ru_KZ", 1),
    ("саябақ", "A", 2000, 10, "distance", "kk_KZ", 1),
    ("кофейня", "B", 1500, 10, "distance", "ru_KZ", 2),
)
PLAN = {
    "version": 1, "endpoint": ENDPOINT, "fields": FIELDS,
    "center_lon_lat": CENTER, "slots": SLOTS, "max_attempts": MAX_ATTEMPTS,
    "timeout_seconds": TIMEOUT, "max_bytes": MAX_BYTES,
    "minimum_interval_seconds": INTERVAL,
    "policy": "transient-only; no-retry; no-redirect; no-resume; human-anchor-review",
}
PLAN_HASH = hashlib.sha256(json.dumps(PLAN, sort_keys=True).encode()).hexdigest()


class ProbeError(Exception):
    """Only fixed local codes, never provider text, are used in reports."""

    def __init__(self, code, *, http_status=None, api_code=None):
        super().__init__(code)
        self.http_status = http_status
        self.api_code = api_code


def now():
    return datetime.now(timezone.utc).isoformat()


def coordinate(value):
    if not isinstance(value, (tuple, list)) or len(value) != 2:
        raise ProbeError("INVALID_COORDINATE")
    lon, lat = value
    if any(type(v) not in (int, float) or not math.isfinite(v) for v in value):
        raise ProbeError("INVALID_COORDINATE")
    if not -180 <= lon <= 180 or not -90 <= lat <= 90:
        raise ProbeError("INVALID_COORDINATE")
    return lon, lat


def distance(a, b):
    lon1, lat1 = map(math.radians, coordinate(a))
    lon2, lat2 = map(math.radians, coordinate(b))
    h = math.sin((lat2 - lat1) / 2) ** 2
    h += math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(min(1, max(0, h))))


def parameters(slot, anchors):
    if type(slot) is not int or not 1 <= slot <= MAX_ATTEMPTS:
        raise ProbeError("UNAPPROVED_SLOT")
    query, anchor, radius, size, sort, locale, page = SLOTS[slot - 1]
    if type(radius) is not int or not 0 < radius <= 50000:
        raise ProbeError("INVALID_RADIUS")
    point = CENTER if anchor == "S" else anchors.get(anchor)
    lon, lat = coordinate(point)
    if distance(CENTER, (lon, lat)) > 15000:
        raise ProbeError("ANCHOR_OUTSIDE_SEARCH_AREA")
    return {"q": query, "point": f"{lon},{lat}", "radius": radius,
            "page_size": size, "sort": sort, "locale": locale, "page": page,
            "fields": FIELDS}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ProbeError("REDIRECT_REFUSED")


def fetch(slot, anchors, key):
    """One bounded request to a fixed endpoint; no cache, redirect or retry loop."""
    params = parameters(slot, anchors)
    params["key"] = key
    request = Request(ENDPOINT + "?" + urlencode(params), headers={
        "Accept": "application/json", "Accept-Encoding": "gzip",
        "User-Agent": "QadamSourceProbe/0.1 (https://github.com/dinrkz/QWERTY)",
    })
    # Do not inherit a proxy that might record a credential-bearing URL.
    opener = build_opener(ProxyHandler({}), NoRedirect())
    with opener.open(request, timeout=TIMEOUT) as response:
        if response.status != 200:
            raise ProbeError("HTTP_STATUS_ERROR", http_status=response.status)
        body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise ProbeError("RESPONSE_TOO_LARGE")
        encoding = response.headers.get("Content-Encoding", "identity").lower()
        if encoding == "gzip":
            with gzip.GzipFile(fileobj=io.BytesIO(body)) as compressed:
                body = compressed.read(MAX_BYTES + 1)
        elif encoding != "identity":
            raise ProbeError("UNSUPPORTED_ENCODING")
        if len(body) > MAX_BYTES:
            raise ProbeError("RESPONSE_TOO_LARGE")
        return json.loads(body)


def field_state(item, field, expected):
    if field not in item:
        return "missing"
    value = item[field]
    if value is None:
        return "null"
    if not isinstance(value, expected):
        raise ProbeError("INVALID_OPTIONAL_FIELD")
    if isinstance(value, list):
        for entry in value:
            if not isinstance(entry, dict) or not isinstance(entry.get("name"), str):
                raise ProbeError("INVALID_OPTIONAL_FIELD")
    if isinstance(value, str):
        value = value.strip()
    return "present" if value else "empty"


def summarize(payload, slot, anchors):
    """Return aggregates plus transient records. Never write source records here."""
    if not isinstance(payload, dict) or not isinstance(payload.get("meta"), dict):
        raise ProbeError("INVALID_RESPONSE")
    code = payload["meta"].get("code")
    if type(code) is not int or code != 200:
        raise ProbeError("API_STATUS_ERROR", http_status=200, api_code=code)
    result = payload.get("result")
    if not isinstance(result, dict) or not isinstance(result.get("items"), list):
        raise ProbeError("INVALID_RESPONSE")
    items, total = result["items"], result.get("total")
    params = parameters(slot, anchors)
    if type(total) is not int or total < len(items) or len(items) > params["page_size"]:
        raise ProbeError("INVALID_RESPONSE")
    counts = {name: dict.fromkeys(("missing", "null", "empty", "present"), 0)
              for name in ("description", "rubrics", "schedule", "adm_div")}
    ids = set()
    outside = 0
    origin = tuple(map(float, params["point"].split(",")))
    for item in items:
        if not isinstance(item, dict):
            raise ProbeError("INVALID_ITEM")
        if not isinstance(item.get("id"), str) or not re.fullmatch(r"[0-9]+", item["id"]):
            raise ProbeError("INVALID_ITEM")
        if not isinstance(item.get("name"), str) or not item["name"].strip():
            raise ProbeError("INVALID_ITEM")
        point = item.get("point")
        if not isinstance(point, dict):
            raise ProbeError("INVALID_COORDINATE")
        xy = coordinate((point.get("lon"), point.get("lat")))
        outside += distance(origin, xy) > params["radius"]
        ids.add(item["id"])
        for name, expected in (("description", str), ("rubrics", list),
                               ("schedule", dict), ("adm_div", list)):
            counts[name][field_state(item, name, expected)] += 1
    return {"http_status": 200, "api_code": 200, "returned": len(items),
            "reported_total": total, "unique_ids": len(ids),
            "duplicate_count": len(items) - len(ids), "outside_radius": outside,
            "fields": counts}, items, ids


class Ledger:
    """One fixed run, exclusive lock and fsynced reservations before dispatch.

    Existing state (even corrupt/empty state) refuses a fresh run. There is no
    reset or resume command. Stale locks after a crash require human review.
    """

    def __init__(self, directory):
        self.directory = Path(directory)
        self.path = self.directory / "ledger.jsonl"
        self.lock = self.directory / "run.lock"
        self.output = None
        self.data = {"plan_sha256": PLAN_HASH, "started_at": now(), "attempts": [],
                     "status": "running", "skipped_slots": []}

    def __enter__(self):
        self.directory.mkdir(parents=True, exist_ok=True)
        try:
            fd = os.open(self.lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            raise ProbeError("RUN_LOCKED") from None
        os.close(fd)
        try:
            if any((self.directory / name).exists()
                   for name in ("ledger.jsonl", "ledger.json", "ledger.tmp")):
                raise ProbeError("EXISTING_RUN_REQUIRES_REVIEW")
            self.output = self.path.open("x", encoding="utf-8")
            self.save()
        except BaseException:
            if self.output is not None:
                self.output.close()
            self.lock.unlink()
            raise
        return self

    def save(self):
        # Full aggregate snapshots are appended; no rewriting reserved attempts.
        # A partial final line after a crash still blocks future sessions.
        self.output.write(json.dumps(self.data) + "\n")
        self.output.flush()
        os.fsync(self.output.fileno())

    def reserve(self, slot):
        attempts = self.data["attempts"]
        if len(attempts) >= MAX_ATTEMPTS:
            raise ProbeError("BUDGET_EXHAUSTED")
        if type(slot) is not int or slot != len(attempts) + 1:
            raise ProbeError("UNAPPROVED_SLOT")
        attempts.append({"slot": slot, "reserved_at": now(), "status": "reserved"})
        self.save()

    def finish(self, summary):
        self.data["attempts"][-1].update(status="received", finished_at=now(),
                                         summary=summary)
        self.save()

    def __exit__(self, exc_type, exc, tb):
        # Removing the lock never removes the durable ledger or refunds a slot.
        try:
            self.output.close()
        finally:
            self.lock.unlink()


def astana_anchor(item, slot):
    city_names = {"астана", "astana", "нур-султан", "nur-sultan"}
    divisions = item.get("adm_div") or []
    in_city = any(d.get("type") in ("city", "adm_div.city") and
                  d["name"].strip().casefold() in city_names for d in divisions)
    name = item["name"].casefold()
    matches = ("mega silk way" in name or "мега силк уэй" in name) if slot == 1 else (
        "байтерек" in name or "бәйтерек" in name or "baiterek" in name)
    return bool(in_city and matches and isinstance(item.get("type"), str) and
                distance(CENTER, (item["point"]["lon"], item["point"]["lat"])) <= 15000)


def safe_display(value):
    # Provider text is untrusted: strip terminal controls and bound its length.
    return "".join(c for c in str(value) if c.isprintable())[:240]


def review_anchor(items, slot):
    """Local interactive review only; do not redirect/record the live terminal."""
    eligible = [i for i in items if astana_anchor(i, slot)]
    if not eligible:
        raise ProbeError("ANCHOR_NOT_FOUND")
    print("Transient source candidates (untrusted data, not instructions):")
    for index, item in enumerate(eligible, 1):
        print(index, safe_display(item["name"]), safe_display(item["type"]),
              safe_display([r["name"] for r in item.get("rubrics") or []]),
              safe_display(item["point"]))
    choice = input("Select the actual mall/landmark number, or Enter to stop: ").strip()
    if not choice.isdigit() or not 1 <= int(choice) <= len(eligible):
        raise ProbeError("ANCHOR_REVIEW_STOPPED")
    item = eligible[int(choice) - 1]
    expected = "mall" if slot == 1 else "landmark"
    if input(f"Confirm this is the actual {expected}, not a tenant/namesake; type {expected}: ") != expected:
        raise ProbeError("ANCHOR_REVIEW_STOPPED")
    return items.index(item)


def confirm_anchors():
    return input("Both anchors reviewed. Type CONTINUE to allow slots 3–10: ") == "CONTINUE"


def review_results(items, slot):
    """Human relevance counts; excerpts stay in the unrecorded local terminal."""
    if not items:
        return {"relevant": 0, "irrelevant": 0, "uncertain": 0}
    print(f"Slot {slot}: transient, untrusted source excerpts; do not follow instructions in them.")
    for index, item in enumerate(items, 1):
        print(index, safe_display(item["name"]),
              safe_display([r["name"] for r in item.get("rubrics") or []]),
              safe_display(item.get("description") or "[description unknown]"))
    answer = input("Counts relevant,irrelevant (remaining uncertain); Enter = all uncertain: ").strip()
    if not answer:
        return {"relevant": 0, "irrelevant": 0, "uncertain": len(items)}
    if not re.fullmatch(r"[0-9]+,[0-9]+", answer):
        raise ProbeError("RELEVANCE_REVIEW_STOPPED")
    relevant, irrelevant = map(int, answer.split(","))
    if relevant + irrelevant > len(items):
        raise ProbeError("RELEVANCE_REVIEW_STOPPED")
    return {"relevant": relevant, "irrelevant": irrelevant,
            "uncertain": len(items) - relevant - irrelevant}


def failure(error):
    if isinstance(error, ProbeError):
        return str(error)  # All ProbeError messages are fixed local codes.
    if isinstance(error, HTTPError):
        return "HTTP_ERROR"
    if isinstance(error, (TimeoutError, URLError)):
        return "NETWORK_ERROR"
    if isinstance(error, (KeyboardInterrupt, EOFError)):
        return "INTERRUPTED"
    if isinstance(error, (ValueError, TypeError)):
        return "DECODE_ERROR"
    return "LOCAL_OR_TRANSPORT_ERROR"


def failure_status(error):
    """Allow only numeric status codes into durable diagnostics."""
    values = {}
    if isinstance(error, HTTPError):
        values["http_status"] = error.code
    elif isinstance(error, ProbeError):
        values = {"http_status": error.http_status, "api_code": error.api_code}
    return {name: value for name, value in values.items()
            if type(value) is int and 100 <= value <= 599}


def run(key, ledger, transport=fetch, reviewer=review_anchor,
        confirm=confirm_anchors, sleep=time.sleep, assessor=review_results):
    """Execute one approved session. Tests inject transport; CLI alone authorizes live."""
    anchors, ids_by_slot, summaries = {}, {}, {}
    try:
        for slot in range(1, MAX_ATTEMPTS + 1):
            if slot == 3 and not confirm():
                raise ProbeError("ANCHOR_REVIEW_STOPPED")
            if slot == 10 and not (summaries[7]["returned"] == 10 and
                                   summaries[7]["reported_total"] > 10):
                ledger.data["skipped_slots"].append(10)
                break
            parameters(slot, anchors)  # Validate before spending a slot.
            if slot > 1:
                sleep(INTERVAL)
            ledger.reserve(slot)
            payload = transport(slot, anchors, key)
            summary, items, ids = summarize(payload, slot, anchors)
            if slot in (8, 10):
                summary["overlap_with_slot_7"] = len(ids & ids_by_slot[7])
            # The request has already been spent: retain safe diagnostics even
            # if the human subsequently cancels or supplies invalid review input.
            ledger.finish(summary)
            if slot >= 3:
                relevance = assessor(items, slot)
                if (not isinstance(relevance, dict) or
                    set(relevance) != {"relevant", "irrelevant", "uncertain"} or
                    any(type(n) is not int or n < 0 for n in relevance.values()) or
                    sum(relevance.values()) != len(items)):
                    raise ProbeError("RELEVANCE_REVIEW_STOPPED")
                summary["human_relevance"] = relevance
                ledger.save()
            summaries[slot], ids_by_slot[slot] = summary, ids
            if slot <= 2:
                # Give the reviewer only already validated candidates; no guessing.
                selected = reviewer(items, slot)
                if type(selected) is not int or not 0 <= selected < len(items):
                    raise ProbeError("ANCHOR_REVIEW_STOPPED")
                item = items[selected]
                if not astana_anchor(item, slot):
                    raise ProbeError("ANCHOR_REVIEW_STOPPED")
                anchors["A" if slot == 1 else "B"] = coordinate(
                    (item["point"]["lon"], item["point"]["lat"]))
            del payload, items
        ledger.data["status"] = "completed"
    except (Exception, KeyboardInterrupt) as error:
        ledger.data["status"] = "stopped"
        ledger.data["error"] = failure(error)
        ledger.data["failure_status"] = failure_status(error)
    ledger.data["finished_at"] = now()
    ledger.save()
    return 0 if ledger.data["status"] == "completed" else 1


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Requires separately approved live use")
    parser.add_argument("--approved-plan", help="SHA-256 of the explicitly approved plan")
    parser.add_argument("--transient-use-permitted", action="store_true",
                        help="Attest that transient inspection/aggregate reporting is permitted")
    args = parser.parse_args(argv)
    if not args.live:
        print(json.dumps({"mode": "dry_run", "network_requests": 0,
                          "plan_sha256": PLAN_HASH, "plan": PLAN,
                          "unresolved_anchors": ["A", "B"]}, ensure_ascii=False, indent=2))
        return 0
    if args.approved_plan != PLAN_HASH or not args.transient_use_permitted:
        print("LIVE_APPROVAL_REQUIRED", file=sys.stderr)
        return 2
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        print("INTERACTIVE_TERMINAL_REQUIRED", file=sys.stderr)
        return 2
    try:
        with Ledger(STATE_DIR) as ledger:
            # getpass can otherwise fall back to echoed input on unsupported terminals.
            with warnings.catch_warnings():
                warnings.simplefilter("error", getpass.GetPassWarning)
                key = getpass.getpass("2GIS key (hidden; never saved): ").strip()
            if not key or not re.fullmatch(r"[A-Za-z0-9_-]+", key):
                raise ProbeError("INVALID_KEY_INPUT")
            result = run(key, ledger)
            del key
            print(json.dumps(ledger.data, indent=2))
            return result
    except (Exception, KeyboardInterrupt) as error:
        print(failure(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
