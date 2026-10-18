"""Synthetic unit checks; these do not establish live-source availability."""

import importlib.util
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import URLError


PATH = Path(__file__).resolve().parents[2] / "scripts/data/probe_wikidata.py"
SPEC = importlib.util.spec_from_file_location("probe_wikidata", PATH)
probe = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(probe)


class ProbeSummaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Workspace-local, ignored scratch space also works in restricted Windows runs.
        cls.scratch = PATH.parents[2] / "data/runtime/source-probe-tests"
        cls.scratch.mkdir(parents=True, exist_ok=True)

    def test_duplicate_rows_do_not_inflate_entity_coverage(self):
        row = {"item": {"value": "http://www.wikidata.org/entity/Q1"}}
        described = {**row, "itemDescription": {"value": "Synthetic description"},
                     "type": {"value": "http://www.wikidata.org/entity/Q2"}}
        result = probe.summarize({"results": {"bindings": [row, described]}})
        self.assertEqual(result["unique_entities"], 1)
        self.assertEqual(result["entities_with_description"], 1)
        self.assertEqual(result["entities_with_type"], 1)
        self.assertFalse(result["coverage_complete"])

    def test_empty_result_is_honest(self):
        result = probe.summarize({"results": {"bindings": []}})
        self.assertEqual(result["unique_entities"], 0)
        self.assertFalse(result["coverage_complete"])

    def test_capped_sample_is_flagged(self):
        row = {"item": {"value": "http://www.wikidata.org/entity/Q1"}}
        result = probe.summarize({"results": {"bindings": [row] * 200}})
        self.assertTrue(result["row_limit_reached"])

    def test_malformed_source_fails(self):
        for payload in ({}, {"results": {"bindings": {}}},
                        {"results": {"bindings": [{"item": {"value": "bad"}}]}}):
            with self.subTest(payload=payload), self.assertRaises((ValueError, KeyError)):
                probe.summarize(payload)

    def test_failed_fetch_records_failure_without_response_or_sensitive_text(self):
        with tempfile.TemporaryDirectory(dir=self.scratch) as directory:
            output = Path(directory) / "run"
            with patch("sys.argv", ["probe", "--output-dir", str(output)]), \
                 patch.object(probe, "fetch", side_effect=URLError("sensitive URL")), \
                 contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(probe.main(), 1)
            report_text = (output / "report.json").read_text(encoding="utf-8")
            self.assertEqual(json.loads(report_text)["status"], "failed")
            self.assertNotIn("sensitive URL", report_text)
            self.assertFalse((output / "response.json").exists())

    def test_existing_evidence_is_never_overwritten(self):
        with tempfile.TemporaryDirectory(dir=self.scratch) as directory:
            with patch("sys.argv", ["probe", "--output-dir", directory]), \
                 patch.object(probe, "fetch") as fetch, \
                 self.assertRaises(FileExistsError):
                probe.main()
            fetch.assert_not_called()


if __name__ == "__main__":
    unittest.main()
