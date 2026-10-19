"""Evaluate saved places locally; save only aggregate evidence under ignored data/.

--prepare-binding explicitly creates a new binding after reviewing the current
code/policy. Normal evaluation never updates it or the original snapshot/review.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import socket
from unittest.mock import patch
import urllib.request

try:
    from scripts.data import retrieve_saved_places as r
    from scripts.data import retrieval_json_adapter as adapter
except ModuleNotFoundError:
    import retrieve_saved_places as r
    import retrieval_json_adapter as adapter


def file_sha(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def save_new_private(path, data, snapshot):
    destination = Path(path).resolve()
    roots = [(r.c.ROOT / "data/private").resolve(), (r.c.ROOT / "data/runtime").resolve()]
    r.check(any(destination.is_relative_to(root) for root in roots)
            and not destination.is_relative_to(Path(snapshot).resolve()), "INVALID_INPUT")
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        with destination.open("xb") as stream:
            stream.write(r.c.encoded(data) + b"\n")
    except OSError:
        raise r.RetrievalError("DATA_UNAVAILABLE") from None


def evaluate(snapshot, now):
    cases, comparison = [], []
    for anchor, (lon, lat) in r.review.ANCHORS.items():
        for scenario, budgets in (("short_walk", (30, 60)), ("first_visit", (60, 90)), ("coffee_stop", (30, 45))):
            for budget in budgets:
                base = {"latitude": lat, "longitude": lon, "query": "offline scenario evaluation",
                        "available_minutes": budget, "now": now, "scenario": scenario,
                        "max_distance_m": 2000, "categories": [], "return_to_start": True}
                for returned, buffer in ((True, 0), (False, 0), (True, 10)):
                    request = {**base, "return_to_start": returned, "buffer_minutes": buffer}
                    result = r.retrieve(request, snapshot)
                    r.check(result == r.retrieve(request, snapshot))
                    cases.append({"anchor": anchor, "scenario": scenario, "budget_minutes": budget,
                                  "return_to_start": returned, "buffer_minutes": buffer,
                                  "status": result["status"], "eligible_count": result["eligible_count"],
                                  "returned_count": len(result["candidates"]), "reason_codes": result["reason_codes"]})
                    if returned and buffer == 0:
                        historical = r.review.scenario_rows(snapshot.assessments, (lon, lat), scenario, budget)
                        old_count = sum(row["passes_offline_screen"] for row in historical)
                        comparison.append({"anchor": anchor, "scenario": scenario, "budget_minutes": budget,
                                           "historical_audit_count": old_count,
                                           "member2_policy_count": result["eligible_count"]})
        for field, value in [("required_amenities", [a]) for a in sorted(r.AMENITIES)] + [("require_open", True), ("events_only", True)]:
            request = {"latitude": lat, "longitude": lon, "query": "offline constraint evaluation",
                       "available_minutes": 90, "now": now, "categories": ["cafe"], field: value}
            result = r.retrieve(request, snapshot)
            r.check(result["status"] == "no_match" and not result["candidates"])
            cases.append({"anchor": anchor, "constraint": field, "value": value,
                          "status": result["status"], "eligible_count": result["eligible_count"],
                          "returned_count": 0, "reason_codes": result["reason_codes"]})
    return {"status": "passed", "mode": "offline_evaluation", "evaluated_at": now,
            "snapshot_id": snapshot.snapshot_id, "binding_id": snapshot.binding_id,
            "policy_id": snapshot.policy_id, "review_id": snapshot.annotations_id,
            "source_records": len(snapshot.rows), "review_counts": dict(Counter(a["status"] for a in snapshot.assessments)),
            "cases_checked": len(cases), "cases": cases, "historical_policy_comparison": comparison,
            "comparison_note": "Counts may differ: member2 speed/visit defaults replace the old audit; galleries lack an app-v1 category. Same 2 km radius and explicit round trip for comparison.",
            "network_requests": 0, "demo_eligible": False, "external_processing_allowed": False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--annotations", type=Path, required=True)
    parser.add_argument("--binding", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--prepare-binding", action="store_true")
    parser.add_argument("--now", default=datetime.now(timezone.utc).isoformat())
    args = parser.parse_args(argv)
    try:
        guarded = [args.snapshot / "pois.jsonl", args.snapshot / "quality.json", args.annotations]
        for relative in ("data/runtime/2gis-probe-v1/ledger.jsonl", "data/runtime/2gis-collection/ledger.jsonl",
                         "data/runtime/2gis-collection/current.json", "data/private/walking-review-final/review.json"):
            path = r.c.ROOT / relative
            if path.exists():
                guarded.append(path)
        before = [file_sha(path) for path in guarded]
        with patch.object(socket, "socket", side_effect=AssertionError("NETWORK_FORBIDDEN")), \
             patch.object(socket, "create_connection", side_effect=AssertionError("NETWORK_FORBIDDEN")), \
             patch.object(urllib.request, "urlopen", side_effect=AssertionError("NETWORK_FORBIDDEN")):
            if args.prepare_binding:
                binding = r.prepare_binding(args.snapshot, args.annotations)
                save_new_private(args.binding, binding, args.snapshot)
            saved = r.load_snapshot(args.snapshot, args.annotations, args.binding)
            report = evaluate(saved, args.now)
            # Verify actual saved data cannot leave through default app mode.
            lon, lat = r.review.ANCHORS["bayterek"]
            request = {"latitude": lat, "longitude": lon, "query": "offline privacy check",
                       "categories": ["cafe"], "available_minutes": 60, "now": args.now}
            if saved.kind == "collected":
                try:
                    adapter.run(r.c.encoded(request), snapshot=args.snapshot, annotations=args.annotations, binding=args.binding)
                except r.RetrievalError as error:
                    r.check(str(error) == "DATA_UNAVAILABLE")
                else:
                    raise r.RetrievalError("DATA_INVALID")
            after = [file_sha(path) for path in guarded]
            r.check(before == after)
            report["unchanged_input_files"] = len(guarded)
            report["input_sha256"] = before  # Hashes only; no paths or records.
            save_new_private(args.output, report, args.snapshot)
        print(json.dumps({key: report[key] for key in ("status", "mode", "source_records", "review_counts",
                                                      "cases_checked", "unchanged_input_files", "network_requests")}))
        return 0
    except (r.RetrievalError, OSError, ValueError):
        print('{"status":"error","code":"EVALUATION_FAILED"}')
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
