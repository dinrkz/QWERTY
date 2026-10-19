"""Run the actual Node→Python bridge offline with authored synthetic fixtures.

Pass --app-root pointing at member 2's local checkout/export. Nothing is fetched.
No private snapshot or credentials are read. No dependencies are installed.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from scripts.data import retrieve_saved_places as r
from tests.data.saved_retrieval_fixtures import record, request, write_fixture


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app-root", type=Path, required=True)
    parser.add_argument("--node", default="node")
    args = parser.parse_args(argv)
    scratch = ROOT / "data/runtime/retrieval-bridge-tests"
    scratch.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=scratch) as temp:
        directory = Path(temp)
        r.check(directory.resolve().is_relative_to(scratch.resolve()))
        synthetic = write_fixture(directory / "synthetic")
        collected = write_fixture(directory / "collected-shaped", [record(identity="2gis:authored-synthetic")], kind="collected")
        invalid = write_fixture(directory / "invalid")
        invalid["binding"].write_bytes(b"{}")
        def command(config):
            return [sys.executable, str(ROOT / "tests/data/retrieval_child_offline.py"),
                    str(ROOT / "scripts/data/retrieval_json_adapter.py"),
                    *[part for key, value in config.items() for part in ("--" + key, str(value))]]
        estimate_cases = []
        for categories in (["park"], ["museum"], ["landmark"], ["cafe"], ["event"], ["park", "museum"]):
            for returned in (False, True):
                for wheelchair in (False, True):
                    for coords in ({"lat": 51.1, "lon": 71.4}, {"lat": 51.115, "lon": 71.413}):
                        req = r.validate_request(request(categories=categories, return_to_start=returned,
                                                        required_amenities=["wheelchair"] if wheelchair else [], buffer_minutes=7.5))
                        poi = {"latitude": coords["lat"], "longitude": coords["lon"], "categories": categories}
                        estimate_cases.append({"request": req, "poi": poi, "python": r.estimates(req, coords, categories)})
        raw_request = request()
        now = raw_request.pop("now")
        config = {"request": raw_request, "now": now, "cwd": str(ROOT),
                  "command": command(synthetic), "collected_command": command(collected),
                  "invalid_command": command(invalid),
                  "missing_command": command({**synthetic, "snapshot": directory / "absent"}),
                  "estimate_cases": estimate_cases}
        config_path = directory / "bridge-config.json"
        config_path.write_bytes(r.c.encoded(config))
        env = {key: os.environ[key] for key in ("PATH", "Path", "SystemRoot", "WINDIR", "PATHEXT", "TEMP", "TMP") if key in os.environ}
        result = subprocess.run([args.node, str(ROOT / "tests/data/saved_retrieval_bridge.mjs"),
                                 str(args.app_root.resolve()), str(config_path)],
                                cwd=ROOT, env=env, capture_output=True, timeout=60)
        if result.returncode:
            # All inputs are synthetic; retain diagnostics only under ignored storage.
            (scratch / "failure.txt").write_bytes(result.stdout + result.stderr)
            print(json.dumps({"status": "failed", "diagnostics": "data/runtime/retrieval-bridge-tests/failure.txt"}))
            return 1
        print(result.stdout.decode("utf-8").strip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
