"""Authored synthetic collector-shaped fixtures; contains no provider records."""
import copy
from pathlib import Path

from scripts.data import retrieve_saved_places as r


def record(identity="synthetic:one", rubric="162", lon=71.4, lat=51.1,
           description="Authored synthetic description", name="Synthetic coffee stop", kind="branch"):
    fields = {"id": identity, "source_id": identity.split(":", 1)[1], "name": name,
              "coordinates": {"lon": lon, "lat": lat}, "source_description": description,
              "source_rubrics": [{"id": rubric, "name": "Synthetic rubric"}],
              "source_type": kind, "address": None, "schedule": None, "adm_div": None,
              "demo_eligible": False, "eligibility_note": "Synthetic test fixture"}
    version = {"fields": fields, "sha256": r.c.digest(fields), "provenance": [{
        "response": "synthetic-fixture-only", "request_fingerprint": "a" * 64,
        "manifest_sha256": "b" * 64, "collected_at": "2026-10-18T00:00:00Z",
        "item_index": 0, "locale": "ru_KZ", "field_provenance": "Authored synthetic fixture"}]}
    return {"id": identity, "versions": [version], "latest_version": version["sha256"]}


def rehash(row):
    row["versions"][-1]["sha256"] = r.c.digest(row["versions"][-1]["fields"])
    row["latest_version"] = row["versions"][-1]["sha256"]
    return row


def request(**changes):
    return {"latitude": 51.1, "longitude": 71.4, "query": "coffee", "available_minutes": 60,
            "language": "en", "travel_mode": "walking", "categories": ["cafe"],
            "now": "2026-10-19T00:00:00Z", **changes}


def write_fixture(root, rows=None, *, kind="synthetic", edit_quality=None, edit_annotations=None):
    """Write a self-consistent digest even for malformed-schema test inputs."""
    root = Path(root)
    rows = copy.deepcopy(rows if rows is not None else [record()])
    quality = {"schema_version": 1, "unique_places": len(rows), "demo_eligible": False,
               "source": "Synthetic" if kind == "synthetic" else "2GIS"}
    if edit_quality:
        edit_quality(quality)
    folder = root / r.c.digest({"rows": rows, "quality": quality})
    folder.mkdir(parents=True, exist_ok=True)
    pois = b"".join(r.c.encoded(row) + b"\n" for row in rows)
    quality_bytes = r.c.encoded(quality) + b"\n"
    (folder / "pois.jsonl").write_bytes(pois)
    (folder / "quality.json").write_bytes(quality_bytes)
    decisions = []
    for row in rows:
        try:
            assessed = r.review.assess(row)
            status, reason = assessed["status"], assessed["reason"]
        except (KeyError, TypeError, ValueError, StopIteration, r.c.CollectionError):
            status, reason = "review", "Synthetic malformed input"
        decisions.append({"id": row["id"], "source_version": row["latest_version"],
                          "status": status, "reason": reason, "caveats": [], "review_source": "Synthetic reviewer"})
    annotations = {"source_snapshot": folder.name, "input_pois_sha256": r.sha(pois), "assessments": decisions}
    if edit_annotations:
        edit_annotations(annotations)
    annotation_path = root / "annotations.json"
    annotation_path.write_bytes(r.c.encoded(annotations))
    binding = {"schema_version": 1, "snapshot_id": folder.name,
               "input_hashes": {"pois_sha256": r.sha(pois), "quality_sha256": r.sha(quality_bytes)},
               "annotations_sha256": r.c.digest(annotations), "policy_id": r.policy_id(),
               "dataset_kind": kind, "mode": "offline_evaluation", "demo_eligible": False,
               "external_processing_allowed": False}
    binding_path = root / "binding.json"
    binding_path.write_bytes(r.c.encoded(binding))
    return {"snapshot": folder, "annotations": annotation_path, "binding": binding_path}


def load(config):
    return r.load_snapshot(config["snapshot"], config["annotations"], config["binding"])
