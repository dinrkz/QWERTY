"""Offline scenario audit. Reads a collector snapshot; writes a separate review.

No network, credentials, index, generated descriptions or changes to source data.
This is an analyst report, not the agreed application retrieval interface.
"""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path

try:
    from scripts.data import collect_2gis as c
except ModuleNotFoundError:
    import collect_2gis as c


RUBRICS = {"162": "coffeehouse", "58871": "coffee_point", "168": "park",
           "193": "museum", "190": "gallery", "111526": "viewpoint",
           "112670": "interesting_building", "112720": "fountain",
           "112900": "sculpture"}
SCENARIOS = {
    "short_walk": {"park", "viewpoint", "interesting_building", "fountain", "sculpture"},
    "first_visit": {"park", "museum", "gallery", "viewpoint", "interesting_building", "fountain", "sculpture"},
    "coffee_stop": {"coffeehouse", "coffee_point"},
}
VISITS = {"park": 20, "museum": 45, "gallery": 30, "viewpoint": 20,
          "interesting_building": 15, "fountain": 10, "sculpture": 10,
          "coffeehouse": 20, "coffee_point": 10}
ANCHORS = {"bayterek": (71.430456, 51.128301),
           "mega-silk-way": (71.405441, 51.089347),
           "zhetysu": (71.439453, 51.135968)}
UNKNOWN_AMENITIES = ["seating", "quietness", "sockets", "accessibility", "child_suitability"]
DAYS = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}


def distance_m(a, b):
    lon1, lat1 = c.coordinate(a)
    lon2, lat2 = c.coordinate(b)
    h = (math.sin(math.radians(lat2-lat1)/2)**2
         + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))
         * math.sin(math.radians(lon2-lon1)/2)**2)
    return 6371000 * 2 * math.asin(math.sqrt(min(1, max(0, h))))


def load_snapshot(folder):
    folder = Path(folder)
    source = (folder / "pois.jsonl").read_bytes()
    rows = [c.strict_json(line) for line in source.splitlines()]
    quality_bytes = (folder / "quality.json").read_bytes()
    quality = c.strict_json(quality_bytes)
    if c.digest({"rows": rows, "quality": quality}) != folder.name:
        raise ValueError("SNAPSHOT_HASH_MISMATCH")
    ids = set()
    for record in rows:
        if record["id"] in ids:
            raise ValueError("DUPLICATE_RECORD_ID")
        ids.add(record["id"])
        versions = record["versions"]
        if len({v["sha256"] for v in versions}) != len(versions):
            raise ValueError("DUPLICATE_VERSION")
        for version in versions:
            if c.digest(version["fields"]) != version["sha256"]:
                raise ValueError("VERSION_HASH_MISMATCH")
            if version["fields"]["id"] != record["id"] or not version["provenance"]:
                raise ValueError("INVALID_RECORD_PROVENANCE")
        if sum(v["sha256"] == record["latest_version"] for v in versions) != 1:
            raise ValueError("INVALID_LATEST_VERSION")
    return rows, quality, {"pois_sha256": hashlib.sha256(source).hexdigest(),
                           "quality_sha256": hashlib.sha256(quality_bytes).hexdigest()}


def assess(record):
    version = next(v for v in record["versions"] if v["sha256"] == record["latest_version"])
    f = version["fields"]
    coordinate = (f["coordinates"]["lon"], f["coordinates"]["lat"])
    c.coordinate(coordinate)
    rubrics = f.get("source_rubrics") or []
    categories = sorted({RUBRICS[str(r["id"])] for r in rubrics if str(r.get("id")) in RUBRICS})
    source_type = f.get("source_type")
    flags = ["access_unverified", "walking_route_unverified", "open_now_unknown"]
    if not f.get("source_description"):
        flags.append("description_missing")
    schedule = f.get("schedule")
    missing_days = sorted(DAYS - set(schedule or {}))
    if not schedule:
        flags.append("schedule_missing")
    elif missing_days:
        flags.append("schedule_days_unknown")
    # A source comment is retained for manual interpretation, never executable.
    comment = schedule.get("comment") if isinstance(schedule, dict) else None
    if comment:
        flags.append("schedule_comment_requires_review")
    if "coffee_point" in categories:
        flags.append("coffee_point_seating_unknown")
    if source_type == "adm_div":
        flags.append("area_point_not_entrance")
    generic = f["name"].strip().casefold() in {"сооружение", "здание", "объект"}
    if generic:
        flags.append("generic_entity")
    if source_type == "building" or generic:
        status, reason = "review", "building_or_generic_entity_not_independent_stop"
    elif not categories:
        status = "review" if not rubrics else "exclude"
        reason = "category_unknown" if not rubrics else "outside_selected_scenario_categories"
    elif source_type not in {"branch", "attraction", "adm_div"}:
        status, reason = "review", "unsupported_source_type"
    elif source_type == "adm_div" and categories != ["park"]:
        status, reason = "review", "area_requires_entity_review"
    elif comment:
        status, reason = "review", "interpret_source_schedule_comment_before_visit"
    else:
        status, reason = "candidate", "supported_source_category"
    return {"id": record["id"], "source_version": version["sha256"], "name": f["name"],
            "source_type": source_type, "coordinates": f["coordinates"],
            "address": f.get("address"), "categories": categories,
            "category_evidence": rubrics, "status": status, "reason": reason,
            "flags": flags, "unknown_amenities": UNKNOWN_AMENITIES.copy(),
            "schedule_missing_days": missing_days, "source_schedule_comment": comment,
            "provenance": version["provenance"], "demo_eligible": False}


def scenario_rows(assessments, anchor, scenario, budget, radius=2000, required_amenities=()):
    if scenario not in SCENARIOS or type(budget) not in (int, float) or not math.isfinite(budget) or budget <= 0:
        raise ValueError("INVALID_SCENARIO_OR_BUDGET")
    if type(radius) not in (int, float) or not math.isfinite(radius) or radius <= 0:
        raise ValueError("INVALID_RADIUS")
    c.coordinate(anchor)
    output = []
    for row in assessments:
        coords = row["coordinates"]
        distance = distance_m(anchor, (coords["lon"], coords["lat"]))
        matching = SCENARIOS[scenario].intersection(row["categories"])
        reasons = []
        if row["status"] != "candidate":
            reasons.append(row["reason"])
        if not matching:
            reasons.append("scenario_category_not_supported")
        if distance > radius:  # Compare full precision; rounding is display-only.
            reasons.append("outside_radius")
        if required_amenities:
            reasons.append("required_amenities_not_verified")
        visit = max((VISITS[x] for x in matching), default=0)
        travel = 2 * distance * 1.3 / 80  # round trip, heuristic detour, 80 m/min
        total = travel + visit
        if total > budget:
            reasons.append("estimated_time_exceeds_budget")
        output.append({"id": row["id"], "name": row["name"],
                       "distance_m": round(distance, 1), "estimated_travel_minutes": round(travel, 1),
                       "assumed_visit_minutes": visit, "estimated_total_minutes": round(total, 1),
                       "passes_offline_screen": not reasons, "exclusion_reasons": reasons})
    return sorted(output, key=lambda r: (r["distance_m"], r["id"]))


def possible_same_sites(assessments):
    pairs = []
    for i, a in enumerate(assessments):
        for b in assessments[i+1:]:
            same_address = bool(a["address"] and a["address"] == b["address"])
            pa, pb = a["coordinates"], b["coordinates"]
            near = distance_m((pa["lon"], pa["lat"]), (pb["lon"], pb["lat"])) <= 20
            if same_address or near:
                pairs.append({"ids": [a["id"], b["id"]], "same_address": same_address,
                              "within_20m": near, "action": "review_only_do_not_merge"})
    return pairs


def apply_annotations(assessments, annotations, snapshot, hashes):
    """Explicit reviewer decisions are version-bound and kept separate from facts."""
    if annotations["source_snapshot"] != snapshot or annotations["input_pois_sha256"] != hashes["pois_sha256"]:
        raise ValueError("STALE_REVIEW_ANNOTATIONS")
    by_id = {a["id"]: a for a in assessments}
    decisions = annotations["assessments"]
    if len(decisions) != len(by_id) or {d["id"] for d in decisions} != set(by_id):
        raise ValueError("ANNOTATION_ID_MISMATCH")
    for decision in decisions:
        row = by_id[decision["id"]]
        if decision["source_version"] != row["source_version"]:
            raise ValueError("STALE_REVIEW_VERSION")
        if decision["status"] not in {"candidate", "review", "exclude"} or not decision["reason"]:
            raise ValueError("INVALID_REVIEW_DECISION")
        allowed_type = (row["source_type"] in {"branch", "attraction"}
                        or row["source_type"] == "adm_div" and row["categories"] == ["park"])
        if decision["status"] == "candidate" and (not row["categories"] or "generic_entity" in row["flags"] or not allowed_type):
            raise ValueError("REVIEW_CANNOT_INVENT_CATEGORY_OR_ENTITY")
        row["automated_status"], row["automated_reason"] = row["status"], row["reason"]
        row["status"], row["reason"] = decision["status"], decision["reason"]
        row["review_annotation"] = decision


def build_report(folder, annotations=None):
    rows, quality, hashes = load_snapshot(folder)
    assessments = [assess(r) for r in rows]
    if annotations is not None:
        apply_annotations(assessments, annotations, Path(folder).name, hashes)
    coverage = []
    for anchor_name, anchor in ANCHORS.items():
        for scenario, budgets in (("short_walk", (30, 60)), ("first_visit", (60, 90)), ("coffee_stop", (30, 45))):
            for budget in budgets:
                choices = scenario_rows(assessments, anchor, scenario, budget)
                coverage.append({"anchor": anchor_name, "scenario": scenario, "budget_minutes": budget,
                                 "radius_m": 2000, "candidate_count": sum(r["passes_offline_screen"] for r in choices),
                                 "results": choices})
    return {"schema_version": 1, "source_snapshot": Path(folder).name, "input_hashes": hashes,
            "purpose": "offline_relevance_audit_not_live_recommendations", "network_requests": 0,
            "assumptions": {"travel": "round trip; straight-line x 1.3 / 80 m per minute; not routing",
                            "visit_minutes": VISITS, "availability": "unknown; no open-now claim",
                            "choices": "alternatives, not combined multi-stop route",
                            "eligibility": "category/time screen only; access and application integration unverified"},
            "review_annotations_sha256": c.digest(annotations) if annotations is not None else None,
            "source_quality": quality, "status_counts": dict(Counter(a["status"] for a in assessments)),
            "assessments": assessments, "possible_same_sites": possible_same_sites(assessments),
            "coverage": coverage,
            "hard_amenity_check": {"requirements": ["quietness", "sockets"],
                                   "supported_candidates": 0, "reason": "no_verified_amenity_evidence"}}


def markdown(report):
    lines = ["# Offline walking-scenario review", "", f"Snapshot: `{report['source_snapshot']}`.",
             "", "No API requests. Original records retained. Candidates pass the relevance review; the table adds distance and time screens. Access, current hours and actual walking routes remain unverified.",
             "", "Travel estimates assume a round trip at 80 m/min with a 1.3 straight-line multiplier. Visit times are analyst assumptions. Options are alternatives, not an itinerary.",
             "", f"Status counts: {report['status_counts']}. Quiet coffee with sockets: zero verified matches.",
             "", "| Anchor | Scenario | Budget (min) | Passing candidates |", "|---|---|---:|---:|"]
    for v in report["coverage"]:
        lines.append(f"| {v['anchor']} | {v['scenario']} | {v['budget_minutes']} | {v['candidate_count']} |")
    lines += ["", "See review.json for every record, evidence, exclusions, source comments and possible shared sites. Names/addresses never cause automatic merging. Missing descriptions are not filled.", ""]
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True, help="New directory under data/private or data/runtime")
    parser.add_argument("--annotations", type=Path, help="Optional version-bound offline reviewer decisions")
    args = parser.parse_args(argv)
    destination = args.output.resolve()
    allowed = [(c.ROOT / "data/private").resolve(), (c.ROOT / "data/runtime").resolve()]
    snapshot = args.snapshot.resolve()
    if not any(destination.is_relative_to(root) for root in allowed) or destination == snapshot or destination.is_relative_to(snapshot):
        parser.error("Output must be a new private review directory, separate from the snapshot")
    annotations = c.strict_json(args.annotations.read_bytes()) if args.annotations else None
    report = build_report(snapshot, annotations)
    destination.mkdir(parents=True, exist_ok=False)
    (destination / "review.json").write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    (destination / "README.md").write_text(markdown(report), encoding="utf-8")
    print(json.dumps({"output": str(destination), "status_counts": report["status_counts"], "network_requests": 0}))


if __name__ == "__main__":
    main()
