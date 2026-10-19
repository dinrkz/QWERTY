"""Deterministic, network-free retrieval from immutable reviewed collector snapshots.

Source facts stay separate from review judgments and estimates. No .env, provider
client, embedding service, raw-response reader, or logging is used here.
"""
from dataclasses import dataclass
from copy import deepcopy
from datetime import datetime
from functools import wraps
import hashlib
import math
from pathlib import Path
import re
import unicodedata

try:
    from scripts.data import collect_2gis as c
    from scripts.data import review_walking_dataset as review
except ModuleNotFoundError:
    import collect_2gis as c
    import review_walking_dataset as review


APP_COMMIT = "1661770e7e1310b40e696b20570be67818f12f6b"
# Broad retrieval buckets, NOT replacements for source rubrics. A gallery is
# held out of app-v1 buckets until member 2 agrees a gallery activity/category.
CATEGORY_MAP = {"coffeehouse": "cafe", "coffee_point": "cafe", "park": "park",
                "museum": "museum", "viewpoint": "landmark",
                "interesting_building": "landmark", "fountain": "landmark",
                "sculpture": "landmark"}
CATEGORIES = {"park", "museum", "landmark", "cafe", "event"}
AMENITIES = {"sockets", "quiet", "child_friendly", "wheelchair"}
POLICY = {"version": "member1-retrieval-v1", "app_commit": APP_COMMIT,
          "earth_radius_m": 6371000, "detour_factor": 1.3,
          "walking_m_per_minute": 4000 / 60, "reduced_m_per_minute": 2500 / 60,
          "visit_minutes": {"park": 20, "museum": 45, "landmark": 15, "cafe": 25, "event": 30},
          "category_map": CATEGORY_MAP, "ranking": "lexical-distinct-tokens,distance,id",
          "amenities": "unknown", "hours": "unsupported", "events": "unsupported"}
MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024
MAX_METADATA_BYTES = 2 * 1024 * 1024
MAX_RECORDS = 10000
HASH = re.compile(r"^[0-9a-f]{64}$")


class RetrievalError(Exception):
    """A fixed public code: never embed paths, source text, or request values."""


def check(condition, code="DATA_INVALID"):
    if not condition:
        raise RetrievalError(code)


def text(value, maximum=1000):
    return (isinstance(value, str) and bool(value.strip()) and len(value) <= maximum
            and not any(ord(x) < 32 and x not in "\t\n\r" for x in value))


def number(value, low, high):
    return type(value) in (int, float) and math.isfinite(value) and low <= value <= high


def valid_identity(value, maximum=522):
    return text(value, maximum) and not any(ord(char) < 32 or ord(char) == 127 for char in value)


def instant(value):
    check(isinstance(value, str) and re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})", value))
    if not value.endswith("Z"):
        check(int(value[-5:-3]) <= 23 and int(value[-2:]) <= 59)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        check(parsed.utcoffset() is not None)
        return parsed
    except (ValueError, OverflowError):
        raise RetrievalError("DATA_INVALID") from None


def read_bounded(path, maximum):
    try:
        with Path(path).open("rb") as stream:
            raw = stream.read(maximum + 1)
        check(len(raw) <= maximum)
        return raw
    except OSError:
        raise RetrievalError("DATA_UNAVAILABLE") from None


def parse(raw):
    try:
        value = c.strict_json(raw)
        pending, nodes = [(value, 0)], 0
        while pending:
            node, depth = pending.pop()
            nodes += 1
            check(depth <= 32 and nodes <= 100000)
            if isinstance(node, dict):
                pending.extend((child, depth + 1) for child in node.values())
            elif isinstance(node, list):
                pending.extend((child, depth + 1) for child in node)
            elif isinstance(node, float):
                check(math.isfinite(node))
        return value
    except (ValueError, UnicodeError, RecursionError):
        raise RetrievalError("DATA_INVALID") from None


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def fixed_errors(code):
    def decorate(function):
        @wraps(function)
        def call(*args, **kwargs):
            try:
                return function(*args, **kwargs)
            except (KeyError, TypeError, ValueError, OverflowError, RecursionError):
                raise RetrievalError(code) from None
        return call
    return decorate


def policy_id():
    # Pin actual rubric/review implementation as well as retrieval assumptions.
    return c.digest({"policy": POLICY, "assessment_code_sha256":
                     sha(Path(review.__file__).read_bytes()),
                     "retrieval_code_sha256": sha(Path(__file__).read_bytes())})


@dataclass(frozen=True)
class Snapshot:
    snapshot_id: str
    kind: str
    rows: tuple
    assessments: tuple
    hashes: dict
    annotations_id: str
    binding_id: str
    policy_id: str
    collected_at: str


def _validate_fields(fields, identity, kind):
    check(isinstance(fields, dict))
    check(valid_identity(fields.get("source_id"), 512))
    prefix = "2gis:" if kind == "collected" else "synthetic:"
    check(fields.get("id") == identity == prefix + fields["source_id"])
    check(text(fields.get("name"), 1000) and fields.get("demo_eligible") is False)
    coords = fields.get("coordinates")
    check(isinstance(coords, dict) and set(coords) == {"lat", "lon"})
    check(number(coords["lat"], -90, 90) and number(coords["lon"], -180, 180))
    for key in ("source_description", "address", "source_type"):
        check(fields.get(key) is None or text(fields[key], 64000 if key == "source_description" else 2000))
    rubrics = fields.get("source_rubrics")
    check(rubrics is None or isinstance(rubrics, list) and len(rubrics) <= 100)
    for rubric in rubrics or []:
        check(isinstance(rubric, dict) and text(rubric.get("name"), 500))
        check(isinstance(rubric.get("id"), str) and text(rubric["id"], 200))
    schedule = fields.get("schedule")
    check(schedule is None or isinstance(schedule, dict))
    if schedule and schedule.get("comment") is not None:
        check(isinstance(schedule["comment"], str))


def _read_inputs(folder, annotation_path):
    """Read each input once; never follow source-provided paths or current.json."""
    folder = Path(folder)
    source = read_bounded(folder / "pois.jsonl", MAX_SNAPSHOT_BYTES)
    quality_bytes = read_bounded(folder / "quality.json", MAX_METADATA_BYTES)
    annotation_bytes = read_bounded(annotation_path, MAX_METADATA_BYTES)
    lines = source.splitlines()
    check(0 < len(lines) <= MAX_RECORDS and all(len(line) <= 256 * 1024 for line in lines))
    rows = [parse(line) for line in lines]
    quality, annotations = parse(quality_bytes), parse(annotation_bytes)
    check(isinstance(quality, dict) and type(quality.get("schema_version")) is int
          and quality["schema_version"] == 1 and quality.get("demo_eligible") is False)
    check(type(quality.get("unique_places")) is int and quality["unique_places"] == len(rows))
    check(quality.get("source") in {"2GIS", "Synthetic"})
    kind = "collected" if quality["source"] == "2GIS" else "synthetic"
    check(HASH.fullmatch(folder.name) and c.digest({"rows": rows, "quality": quality}) == folder.name)
    hashes = {"pois_sha256": sha(source), "quality_sha256": sha(quality_bytes)}
    ids, collected = set(), []
    for row in rows:
        check(isinstance(row, dict) and valid_identity(row.get("id")))
        check(row["id"] not in ids)
        ids.add(row["id"])
        versions = row.get("versions")
        check(isinstance(versions, list) and 0 < len(versions) <= 100)
        seen = set()
        for version in versions:
            check(isinstance(version, dict) and isinstance(version.get("sha256"), str))
            check(HASH.fullmatch(version["sha256"]) and version["sha256"] not in seen)
            seen.add(version["sha256"])
            fields = version.get("fields")
            _validate_fields(fields, row["id"], kind)
            check(c.digest(fields) == version["sha256"])
            provenance = version.get("provenance")
            check(isinstance(provenance, list) and 0 < len(provenance) <= 100)
            for item in provenance:
                check(isinstance(item, dict))
                for key in ("response", "locale", "field_provenance"):
                    check(text(item.get(key), 2000))
                for key in ("request_fingerprint", "manifest_sha256"):
                    check(isinstance(item.get(key), str) and HASH.fullmatch(item[key]))
                check(type(item.get("item_index")) is int and 0 <= item["item_index"] < 10000)
                instant(item.get("collected_at"))
                collected.append(item["collected_at"])
        check(row.get("latest_version") in seen)
    check(isinstance(annotations, dict) and annotations.get("source_snapshot") == folder.name
          and annotations.get("input_pois_sha256") == hashes["pois_sha256"])
    decisions = annotations.get("assessments")
    check(isinstance(decisions, list) and len(decisions) == len(rows))
    decision_ids = set()
    for decision in decisions:
        check(isinstance(decision, dict) and valid_identity(decision.get("id")))
        check(decision["id"] not in decision_ids)
        decision_ids.add(decision["id"])
        check(decision.get("status") in {"candidate", "review", "exclude"}
              and text(decision.get("reason"), 4000))
        check(isinstance(decision.get("source_version"), str) and HASH.fullmatch(decision["source_version"]))
        check(decision.get("demo_eligible", False) is False)
        if "caveats" in decision:
            check(isinstance(decision["caveats"], list) and len(decision["caveats"]) <= 100
                  and all(text(item, 4000) for item in decision["caveats"]))
        if "review_source" in decision:
            check(text(decision["review_source"], 2000))
    check(decision_ids == ids)
    try:
        assessments = [review.assess(row) for row in rows]
        review.apply_annotations(assessments, annotations, folder.name, hashes)
    except (ValueError, KeyError, TypeError, c.CollectionError):
        raise RetrievalError("DATA_INVALID") from None
    return rows, assessments, hashes, c.digest(annotations), kind, max(collected, key=instant)


@fixed_errors("DATA_INVALID")
def prepare_binding(folder, annotations):
    """Explicit setup step, not automatic re-binding during retrieval. Returns data.

    The caller reviews and saves this separately; original annotations stay intact.
    """
    _, _, hashes, annotation_id, kind, _ = _read_inputs(folder, annotations)
    return {"schema_version": 1, "snapshot_id": Path(folder).name,
            "input_hashes": hashes, "annotations_sha256": annotation_id,
            "policy_id": policy_id(), "dataset_kind": kind, "mode": "offline_evaluation",
            "demo_eligible": False, "external_processing_allowed": False}


@fixed_errors("DATA_INVALID")
def load_snapshot(folder, annotations, binding):
    rows, assessments, hashes, annotation_id, kind, collected = _read_inputs(folder, annotations)
    manifest = parse(read_bounded(binding, 16384))
    expected = {"schema_version": 1, "snapshot_id": Path(folder).name,
                "input_hashes": hashes, "annotations_sha256": annotation_id,
                "policy_id": policy_id(), "dataset_kind": kind, "mode": "offline_evaluation",
                "demo_eligible": False, "external_processing_allowed": False}
    # Compare canonical bytes too: Python's True == 1 must not accept a wrong type.
    check(c.encoded(manifest) == c.encoded(expected))
    return Snapshot(Path(folder).name, kind, tuple(rows), tuple(assessments), hashes,
                    annotation_id, c.digest(manifest), expected["policy_id"], collected)


def _vocabulary(value, allowed):
    return (isinstance(value, list) and len(value) <= len(allowed)
            and all(isinstance(x, str) and x in allowed for x in value)
            and len(set(value)) == len(value))


@fixed_errors("INVALID_INPUT")
def validate_request(raw):
    code = "INVALID_INPUT"
    allowed = {"latitude", "longitude", "query", "available_minutes", "language", "travel_mode",
               "categories", "required_amenities", "preferred_amenities", "max_distance_m",
               "return_to_start", "buffer_minutes", "require_open", "events_only", "first_visit",
               "now", "query_terms", "limit", "scenario", "fine_categories"}
    check(isinstance(raw, dict) and set(raw) <= allowed, code)
    check(number(raw.get("latitude"), 50.9, 51.35) and number(raw.get("longitude"), 71.15, 71.75), code)
    check(text(raw.get("query")) and type(raw.get("available_minutes")) is int
          and 5 <= raw["available_minutes"] <= 480, code)
    defaults = {"language": "auto", "travel_mode": "walking", "categories": [],
                "required_amenities": [], "preferred_amenities": [], "max_distance_m": 3000,
                "return_to_start": False, "buffer_minutes": 0, "require_open": False,
                "events_only": False, "first_visit": False, "query_terms": [], "limit": 10,
                "scenario": None, "fine_categories": []}
    req = {**defaults, **raw}
    check(req["travel_mode"] == "walking", "UNSUPPORTED_MODE")
    check(req["language"] in ("auto", "ru", "kk", "en"), code)
    check(_vocabulary(req["categories"], CATEGORIES), code)
    for key in ("required_amenities", "preferred_amenities"):
        check(_vocabulary(req[key], AMENITIES), code)
    check(number(req["max_distance_m"], 1, 10000) and number(req["buffer_minutes"], 0, 479)
          and req["buffer_minutes"] < req["available_minutes"], code)
    check(all(type(req[key]) is bool for key in ("return_to_start", "require_open", "events_only", "first_visit")), code)
    check(type(req["limit"]) is int and 1 <= req["limit"] <= 10, code)
    check(isinstance(req["query_terms"], list) and len(req["query_terms"]) <= 12
          and all(text(term, 60) for term in req["query_terms"]), code)
    check(req["scenario"] is None or isinstance(req["scenario"], str) and req["scenario"] in review.SCENARIOS, code)
    check(_vocabulary(req["fine_categories"], set(review.VISITS)), code)
    # App v1 has no scenario: an empty interpreted category list means all
    # supported reviewed categories. Resolving text constraints belongs upstream.
    if req["scenario"]:
        check(not req["fine_categories"] or set(req["fine_categories"]) <= review.SCENARIOS[req["scenario"]], code)
        coarse = {CATEGORY_MAP[x] for x in review.SCENARIOS[req["scenario"]] if x in CATEGORY_MAP}
        check(not req["categories"] or bool(coarse.intersection(req["categories"])), code)
    try:
        instant(req.get("now"))
    except RetrievalError:
        raise RetrievalError(code) from None
    return req


def estimates(request, coordinates, categories):
    distance = review.distance_m((request["longitude"], request["latitude"]),
                                 (coordinates["lon"], coordinates["lat"]))
    speed = POLICY["reduced_m_per_minute"] if "wheelchair" in request["required_amenities"] else POLICY["walking_m_per_minute"]
    travel = distance * POLICY["detour_factor"] / speed
    visit = max(POLICY["visit_minutes"][category] for category in categories)
    return {"distance_m": distance, "distance_kind": "straight_line",
            "travel_minutes_estimate": travel, "visit_minutes_estimate": visit,
            "total_minutes_estimate": travel * (2 if request["return_to_start"] else 1) + visit + request["buffer_minutes"]}


def tokens(value):
    return set(re.findall(r"[^\W_]+", unicodedata.normalize("NFKC", value).casefold(), re.UNICODE))


@fixed_errors("DATA_INVALID")
def retrieve(raw, snapshot):
    req = validate_request(raw)
    check(instant(snapshot.collected_at) <= instant(req["now"]))
    check(snapshot.policy_id == policy_id())
    candidates, reasons = [], set()
    warnings = ["Private offline evaluation; not live RAG or demo permission.",
                "Straight-line distance and heuristic times; alternatives, not a route.",
                "Opening, access, amenities and source update time are unknown."]
    query_tokens = tokens(" ".join(req["query_terms"]) if req["query_terms"] else req["query"])
    for row, assessment in zip(snapshot.rows, snapshot.assessments):
        if assessment["status"] != "candidate":
            reasons.add("REVIEW_HELD_OR_EXCLUDED")
            continue
        fine = set(assessment["categories"])
        matching_fine = set(fine)
        if req["scenario"]:
            matching_fine.intersection_update(review.SCENARIOS[req["scenario"]])
        if req["fine_categories"]:
            matching_fine.intersection_update(req["fine_categories"])
        if not matching_fine:
            reasons.add("NO_REVIEWED_CATEGORY_MATCH")
            continue
        categories = sorted({CATEGORY_MAP[x] for x in fine if x in CATEGORY_MAP})
        matching_categories = {CATEGORY_MAP[x] for x in matching_fine if x in CATEGORY_MAP}
        if not matching_categories:
            reasons.add("CATEGORY_MAPPING_UNSUPPORTED")
            continue
        if req["categories"] and not matching_categories.intersection(req["categories"]):
            reasons.add("NO_REVIEWED_CATEGORY_MATCH")
            continue
        if req["require_open"] or req["events_only"]:
            if req["require_open"]:
                reasons.add("OPENING_UNVERIFIED")
            if req["events_only"]:
                reasons.add("EVENT_UNVERIFIED")
            continue
        version = next(v for v in row["versions"] if v["sha256"] == row["latest_version"])
        fields = version["fields"]
        if not (50.9 <= fields["coordinates"]["lat"] <= 51.35 and 71.15 <= fields["coordinates"]["lon"] <= 71.75):
            reasons.add("OUTSIDE_COVERAGE")
            continue
        estimate = estimates(req, fields["coordinates"], categories)
        if estimate["distance_m"] > req["max_distance_m"]:
            reasons.add("OUTSIDE_RADIUS")
            continue
        if estimate["total_minutes_estimate"] > req["available_minutes"]:
            reasons.add("TIME_BUDGET_EXCEEDED")
            continue
        if req["required_amenities"]:
            reasons.add("REQUIRED_AMENITY_UNVERIFIED")
            continue
        search_text = " ".join([fields["name"], fields.get("address") or "",
                                fields.get("source_description") or ""]
                               + [rubric["name"] for rubric in fields.get("source_rubrics") or []])
        collected_at = min((item["collected_at"] for item in version["provenance"]), key=instant)
        evidence_id = "source:" + version["sha256"]
        description = fields.get("source_description")
        poi = {"id": fields["id"], "source_id": fields["source_id"], "name": fields["name"],
               "latitude": fields["coordinates"]["lat"], "longitude": fields["coordinates"]["lon"],
               "description": description, "description_kind": "source" if description else None,
               "description_language": None, "categories": categories, "source_categories": sorted(fine),
               "source_rubrics": deepcopy(fields.get("source_rubrics")),
               "source_schedule_comment": assessment["source_schedule_comment"],
               "tags": [], "source_url": None, "collected_at": collected_at, "source_updated_at": None,
               "attribution": "2GIS" if snapshot.kind == "collected" else "Synthetic test fixture",
               "reuse_terms": None, "source_version": version["sha256"],
               "evidence": [{"id": evidence_id, "source_version": version["sha256"],
                             "source_fields": ["name", "coordinates", "source_rubrics"] + (["source_description"] if description else []),
                             "collected_at": collected_at}],
               "description_evidence_ids": [evidence_id] if description else [],
               "amenities": {}, "opening_hours": None, "event": None,
               "access": {"value": "unknown", "evidence_ids": []},
               "operating_status": {"value": "unknown", "evidence_ids": []},
               "demo_eligible": False}
        candidates.append({"poi": poi, **estimate, "review_status": "candidate",
                           "review": {"reason": assessment["reason"],
                                      "caveats": list(assessment["review_annotation"].get("caveats", [])),
                                      "kind": "analyst_judgment_not_source_fact"},
                           "uncertainty_codes": list(assessment["flags"]),
                           "ranking_factors": {"supported_preference_count": 0,
                                               "lexical_match_count": len(query_tokens.intersection(tokens(search_text)))}})
    candidates.sort(key=lambda item: (-item["ranking_factors"]["lexical_match_count"], item["distance_m"], item["poi"]["id"]))
    if req["preferred_amenities"]:
        warnings.append("Preferred amenities are unknown and earn no ranking credit.")
    return {"status": "ok" if candidates else "no_match", "dataset_kind": snapshot.kind,
            "snapshot_id": snapshot.snapshot_id, "collected_at": snapshot.collected_at,
            "candidates": candidates[:req["limit"]], "eligible_count": len(candidates),
            "warnings": warnings, "reason_codes": sorted(reasons), "policy_id": snapshot.policy_id,
            "review_id": snapshot.annotations_id, "binding_id": snapshot.binding_id,
            "demo_eligible": False, "external_processing_allowed": False}


def offline_envelope(result):
    # Intentionally rejected by the current app validator: unknown extra flags
    # on a v1-shaped success would NOT prevent it from reaching generation.
    return {"status": "offline_evaluation", "contract": "qadam-private-retrieval-v1", "result": result}


@fixed_errors("DATA_INVALID")
def synthetic_app_result(result):
    """Test-only v1 projection. No collected record can enter this path."""
    check(result["dataset_kind"] == "synthetic", "DATA_UNAVAILABLE")
    output = deepcopy(result)
    for candidate in output["candidates"]:
        poi = candidate["poi"]
        check(poi["id"].startswith("synthetic:") and text(poi["description"], 4000))
        for key, maximum in (("id", 200), ("source_id", 200), ("name", 200), ("description", 4000)):
            check(text(poi[key], maximum) and len(poi[key].encode("utf-16-le")) // 2 <= maximum)
        # These values describe authored test fixtures, never source records.
        poi.update(description_language="en", source_url="https://example.invalid/synthetic-fixture",
                   reuse_terms="Authored synthetic fixture; tests only")
        poi["evidence"] = [{"id": poi["description_evidence_ids"][0],
                            "source_url": poi["source_url"], "source_field": "description",
                            "collected_at": poi["collected_at"], "source_updated_at": None}]
    return output
