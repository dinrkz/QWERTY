"""Entirely synthetic 2GIS checks. No API access, real key or venue records."""

from concurrent.futures import ThreadPoolExecutor
import contextlib
import gzip
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import warnings
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlsplit


PATH = Path(__file__).resolve().parents[2] / "scripts/data/probe_2gis.py"
SPEC = importlib.util.spec_from_file_location("probe_2gis", PATH)
probe = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(probe)
SECRET = "SYNTHETIC_KEY_NEVER_SEND"
SOURCE_TEXT = "SYNTHETIC_SOURCE_NEVER_PERSIST"


def item(identifier="100", name=SOURCE_TEXT):
    return {"id": identifier, "name": name, "type": "attraction",
            "point": {"lon": 71.43, "lat": 51.13},
            "adm_div": [{"type": "city", "name": "Астана"}],
            "rubrics": [{"id": "9", "name": "Synthetic category"}],
            "description": SOURCE_TEXT, "schedule": {"Mon": {}}}


def payload(items=None, total=None):
    items = [item()] if items is None else items
    return {"meta": {"code": 200},
            "result": {"items": items, "total": len(items) if total is None else total}}


def source(slot, anchors, key):
    if slot in (1, 2):
        return payload([item(str(slot), "MEGA Silk Way" if slot == 1 else "Байтерек")])
    if slot == 7:
        return payload([item(str(n)) for n in range(100, 110)], 15)
    if slot == 10:
        return payload([item(str(n)) for n in range(109, 114)], 15)
    return payload()


def all_uncertain(items, slot):
    return {"relevant": 0, "irrelevant": 0, "uncertain": len(items)}


def read_ledger(path):
    return json.loads(path.read_text(encoding="utf-8").splitlines()[-1])


class OfflineProbeTests(unittest.TestCase):
    def setUp(self):
        scratch = PATH.parents[2] / "data/runtime/2gis-probe-tests"
        scratch.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=scratch)
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name) / "run"
        self.network = patch("socket.create_connection", side_effect=AssertionError("Network forbidden"))
        self.network.start()
        self.addCleanup(self.network.stop)
        self.opener_guard = patch.object(probe, "build_opener", side_effect=AssertionError("Network forbidden"))
        self.opener_guard.start()
        self.addCleanup(self.opener_guard.stop)

    def run_fake(self, transport=source, reviewer=None, confirm=None):
        with probe.Ledger(self.directory) as ledger:
            self.result = probe.run(SECRET, ledger, transport=transport,
                                    reviewer=reviewer or (lambda items, slot: 0),
                                    confirm=confirm or (lambda: True), sleep=lambda _: None,
                                    assessor=all_uncertain)
        return read_ledger(self.directory / "ledger.jsonl")

    def test_default_dry_run_never_reads_secret_opens_network_or_creates_state(self):
        output = io.StringIO()
        with patch.object(probe, "STATE_DIR", self.directory), \
             patch.object(probe.getpass, "getpass") as secret, \
             patch.object(probe, "run") as run, contextlib.redirect_stdout(output):
            self.assertEqual(probe.main([]), 0)
        plan = json.loads(output.getvalue())
        self.assertEqual(plan["network_requests"], 0)
        self.assertEqual(len(plan["plan"]["slots"]), 10)
        self.assertEqual(plan["plan_sha256"], probe.PLAN_HASH)
        self.assertFalse(self.directory.exists())
        secret.assert_not_called()
        run.assert_not_called()

    def test_live_requires_exact_approval_and_interactive_terminal_before_key_prompt(self):
        for args in (["--live"], ["--live", "--approved-plan", "wrong", "--transient-use-permitted"],
                     ["--live", "--approved-plan", probe.PLAN_HASH],
                     ["--live", "--approved-plan", probe.PLAN_HASH, "--transient-use-permitted"]):
            with self.subTest(args=args), patch.object(probe.getpass, "getpass") as secret, \
                 patch.object(probe.sys.stdin, "isatty", return_value=False), \
                 contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(probe.main(args), 2)
                secret.assert_not_called()

    def test_exact_plan_parameters_and_lon_lat_order(self):
        anchors = {"A": (71.40, 51.10), "B": (71.44, 51.14)}
        self.assertEqual(probe.parameters(1, {})["point"], "71.43,51.13")
        self.assertEqual(probe.parameters(3, anchors)["point"], "71.4,51.1")
        base = probe.parameters(7, anchors)
        self.assertEqual(probe.parameters(8, anchors), {**base, "sort": "relevance"})
        self.assertEqual(probe.parameters(10, anchors), {**base, "page": 2})
        self.assertEqual(probe.parameters(9, anchors),
                         {**probe.parameters(4, anchors), "locale": "kk_KZ", "q": "саябақ"})
        self.assertNotIn("key", base)

    def test_hidden_input_fallback_aborts_before_live_transport(self):
        def fallback(*args):
            warnings.warn("Cannot hide password", probe.getpass.GetPassWarning)
            self.fail("getpass echo fallback was allowed")
        with patch.object(probe, "STATE_DIR", self.directory), \
             patch.object(probe.sys.stdin, "isatty", return_value=True), \
             patch.object(probe.sys.stdout, "isatty", return_value=True), \
             patch.object(probe.getpass, "getpass", side_effect=fallback), \
             patch.object(probe, "run") as live, contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(probe.main(["--live", "--approved-plan", probe.PLAN_HASH,
                                         "--transient-use-permitted"]), 1)
        live.assert_not_called()

    def test_relevance_review_defaults_to_unknown_and_validates_counts(self):
        with patch("builtins.input", return_value=""), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(probe.review_results([item()], 3), all_uncertain([item()], 3))
        with patch("builtins.input", return_value="1,0"), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(probe.review_results([item()], 3),
                             {"relevant": 1, "irrelevant": 0, "uncertain": 0})
        for answer in ("2,0", "-1,1", "follow source instructions"):
            with patch("builtins.input", return_value=answer), \
                 contextlib.redirect_stdout(io.StringIO()), self.assertRaises(probe.ProbeError):
                probe.review_results([item()], 3)

    def test_invalid_slots_coordinates_and_radius_fail_before_network(self):
        for slot in (0, 11, True, "1"):
            with self.subTest(slot=slot), self.assertRaises(probe.ProbeError):
                probe.parameters(slot, {})
        for point in (None, [], (True, 51), (float("nan"), 51), (71, float("inf")),
                      (181, 51), (71, 91), ("71", 51), (51.13, 71.43)):
            with self.subTest(point=point), self.assertRaises(probe.ProbeError):
                probe.parameters(3, {"A": point})
        altered = list(probe.SLOTS)
        altered[0] = (*altered[0][:2], 50001, *altered[0][3:])
        with patch.object(probe, "SLOTS", altered), self.assertRaises(probe.ProbeError):
            probe.parameters(1, {})

    def test_ten_successes_and_no_eleventh_request_or_source_storage(self):
        transport = Mock(side_effect=source)
        report = self.run_fake(transport)
        self.assertEqual(self.result, 0)
        self.assertEqual(transport.call_count, 10)
        self.assertEqual(len(report["attempts"]), 10)
        self.assertEqual(report["attempts"][9]["summary"]["overlap_with_slot_7"], 1)
        self.assertEqual(report["attempts"][7]["summary"]["overlap_with_slot_7"], 1)
        self.assertEqual([p.name for p in self.directory.iterdir()], ["ledger.jsonl"])
        saved = (self.directory / "ledger.jsonl").read_text(encoding="utf-8")
        for private in (SECRET, SOURCE_TEXT, "MEGA Silk Way", "Байтерек", "71.43", "51.13"):
            self.assertNotIn(private, saved)
        self.assertNotIn("items", report)

    def test_reservation_is_on_disk_before_transport_and_budget_cannot_overrun(self):
        with probe.Ledger(self.directory) as ledger:
            for slot in range(1, 11):
                ledger.reserve(slot)
                saved = read_ledger(ledger.path)
                self.assertEqual(len(saved["attempts"]), slot)
                self.assertEqual(saved["attempts"][-1]["status"], "reserved")
            with self.assertRaisesRegex(probe.ProbeError, "BUDGET_EXHAUSTED"):
                ledger.reserve(11)
        self.assertEqual(len(read_ledger(ledger.path)["attempts"]), 10)

    def test_transport_observes_durable_reservation(self):
        def inspect(slot, anchors, key):
            state = read_ledger(self.directory / "ledger.jsonl")
            self.assertEqual(len(state["attempts"]), slot)
            self.assertEqual(state["attempts"][-1]["status"], "reserved")
            return source(slot, anchors, key)
        self.run_fake(inspect)
        self.assertEqual(self.result, 0)

    def test_duplicate_or_out_of_order_slot_cannot_be_reserved(self):
        with probe.Ledger(self.directory) as ledger:
            for slot in (2, True, "1"):
                with self.assertRaises(probe.ProbeError):
                    ledger.reserve(slot)
            ledger.reserve(1)
            with self.assertRaises(probe.ProbeError):
                ledger.reserve(1)
            self.assertEqual(len(ledger.data["attempts"]), 1)

    def test_restart_after_failure_cannot_refund_or_reset_budget(self):
        report = self.run_fake(Mock(side_effect=TimeoutError(SECRET)))
        before = (self.directory / "ledger.jsonl").read_bytes()
        with self.assertRaisesRegex(probe.ProbeError, "EXISTING_RUN_REQUIRES_REVIEW"):
            with probe.Ledger(self.directory):
                self.fail("restart accepted")
        self.assertEqual((self.directory / "ledger.jsonl").read_bytes(), before)
        self.assertEqual(len(report["attempts"]), 1)

    def test_append_only_history_preserves_reservation_before_failure(self):
        self.run_fake(Mock(side_effect=TimeoutError(SECRET)))
        history = [json.loads(line) for line in
                   (self.directory / "ledger.jsonl").read_text().splitlines()]
        self.assertEqual(history[0]["attempts"], [])
        self.assertEqual(history[1]["attempts"][0]["status"], "reserved")
        self.assertEqual(history[-1]["status"], "stopped")
        self.assertEqual(len(history[-1]["attempts"]), 1)

    def test_interrupted_relevance_review_preserves_already_received_diagnostics(self):
        transport = Mock(side_effect=source)
        with probe.Ledger(self.directory) as ledger:
            result = probe.run(SECRET, ledger, transport=transport,
                               reviewer=lambda items, slot: 0, confirm=lambda: True,
                               sleep=lambda _: None, assessor=Mock(side_effect=KeyboardInterrupt))
        report = read_ledger(self.directory / "ledger.jsonl")
        self.assertEqual(result, 1)
        self.assertEqual(transport.call_count, 3)
        self.assertEqual(report["attempts"][-1]["status"], "received")
        self.assertEqual(report["attempts"][-1]["summary"]["returned"], 1)
        self.assertNotIn("human_relevance", report["attempts"][-1]["summary"])
        self.assertEqual(report["error"], "INTERRUPTED")

    def test_failure_report_preserves_numeric_status_without_provider_text(self):
        cases = [(HTTPError("https://example.invalid/?key=" + SECRET, 429, SECRET, {}, None),
                  {"http_status": 429}),
                 ({"meta": {"code": 403, "error": SECRET}}, {"http_status": 200, "api_code": 403})]
        for index, (body, expected) in enumerate(cases):
            self.directory = Path(self.temp.name) / str(index)
            transport = Mock(side_effect=body) if isinstance(body, Exception) else Mock(return_value=body)
            report = self.run_fake(transport)
            self.assertEqual(report["failure_status"], expected)
            self.assertNotIn(SECRET, (self.directory / "ledger.jsonl").read_text())

    def test_concurrent_session_and_stale_lock_are_refused(self):
        def second():
            with probe.Ledger(self.directory):
                self.fail("concurrent run accepted")
        with probe.Ledger(self.directory):
            with ThreadPoolExecutor(max_workers=1) as executor:
                with self.assertRaisesRegex(probe.ProbeError, "RUN_LOCKED"):
                    executor.submit(second).result(timeout=5)
        stale = Path(self.temp.name) / "stale"
        stale.mkdir()
        (stale / "run.lock").touch()
        with self.assertRaisesRegex(probe.ProbeError, "RUN_LOCKED"):
            with probe.Ledger(stale):
                self.fail("stale lock accepted")
        self.assertTrue((stale / "run.lock").exists())

    def test_corrupt_existing_ledger_is_never_overwritten(self):
        self.directory.mkdir()
        path = self.directory / "ledger.jsonl"
        path.write_text("broken", encoding="utf-8")
        with self.assertRaises(probe.ProbeError):
            with probe.Ledger(self.directory):
                self.fail("corrupt ledger accepted")
        self.assertEqual(path.read_text(), "broken")

    def test_timeout_http_throttle_and_malformed_response_stop_without_retry(self):
        cases = [TimeoutError(SECRET), URLError(SECRET),
                 HTTPError("https://example.invalid/?key=" + SECRET, 429, SECRET, {}, None),
                 HTTPError("https://example.invalid/", 403, SECRET, {}, None),
                 ValueError(SECRET), payload([])]
        for index, case in enumerate(cases):
            with self.subTest(index=index):
                self.directory = Path(self.temp.name) / str(index)
                transport = Mock(side_effect=case) if isinstance(case, Exception) else Mock(return_value=case)
                stdout, stderr = io.StringIO(), io.StringIO()
                with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                    report = self.run_fake(transport)
                self.assertEqual(self.result, 1)
                self.assertEqual(transport.call_count, 1, report)
                self.assertEqual(len(report["attempts"]), 1)
                self.assertNotIn(SECRET, json.dumps(report) + stdout.getvalue() + stderr.getvalue())

    def test_failed_reservation_save_sends_nothing(self):
        transport = Mock(side_effect=source)
        with probe.Ledger(self.directory) as ledger:
            original_save = ledger.save
            calls = 0
            def fail_once():
                nonlocal calls
                calls += 1
                if calls == 1:
                    raise OSError(SECRET)
                original_save()
            with patch.object(ledger, "save", side_effect=fail_once):
                self.assertEqual(probe.run(SECRET, ledger, transport=transport), 1)
        transport.assert_not_called()

    def test_empty_non_anchor_results_are_coverage_and_skip_page_two(self):
        def empty(slot, anchors, key):
            return source(slot, anchors, key) if slot <= 2 else payload([])
        transport = Mock(side_effect=empty)
        report = self.run_fake(transport)
        self.assertEqual(self.result, 0)
        self.assertEqual(transport.call_count, 9)
        self.assertEqual(report["skipped_slots"], [10])
        self.assertEqual(report["attempts"][6]["summary"]["returned"], 0)

    def test_pagination_requires_both_full_page_and_more_total(self):
        for index, (count, total) in enumerate(((10, 10), (9, 20))):
            self.directory = Path(self.temp.name) / str(index)
            def short(slot, anchors, key):
                if slot == 7:
                    return payload([item(str(n)) for n in range(count)], total)
                return source(slot, anchors, key)
            transport = Mock(side_effect=short)
            self.run_fake(transport)
            self.assertEqual(transport.call_count, 9)

    def test_human_anchor_review_and_second_checkpoint_stop_further_requests(self):
        report = self.run_fake(confirm=lambda: False)
        self.assertEqual(len(report["attempts"]), 2)
        self.assertEqual(self.result, 1)
        self.directory = Path(self.temp.name) / "ambiguous"
        report = self.run_fake(reviewer=lambda items, slot: None)
        self.assertEqual(len(report["attempts"]), 1)
        self.assertEqual(self.result, 1)

    def test_wrong_city_or_tenant_cannot_be_approved_as_anchor(self):
        for index, change in enumerate(({"adm_div": []}, {"name": "Coffee tenant"},
                                       {"adm_div": [{"type": "city", "name": "Other city"}]})):
            self.directory = Path(self.temp.name) / str(index)
            candidate = {**item(name="MEGA Silk Way"), **change}
            report = self.run_fake(Mock(return_value=payload([candidate])))
            self.assertEqual(report["error"], "ANCHOR_REVIEW_STOPPED")
            self.assertEqual(len(report["attempts"]), 1)

    def test_reviewer_requires_selection_and_explicit_identity_confirmation(self):
        candidates = [item(name="MEGA Silk Way"), item("101", "MEGA Silk Way")]
        for replies in ([""], ["9"], ["1", "no"]):
            with patch("builtins.input", side_effect=replies), \
                 contextlib.redirect_stdout(io.StringIO()), self.assertRaises(probe.ProbeError):
                probe.review_anchor(candidates, 1)
        with patch("builtins.input", side_effect=["2", "mall"]), \
             contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(probe.review_anchor(candidates, 1), 1)
        self.assertNotIn("\x1b", probe.safe_display("\x1b[31m\ntext"))

    def test_optional_missing_null_empty_and_present_are_distinct(self):
        records = []
        for index, value in enumerate(("omit", None, "", SOURCE_TEXT)):
            row = item(str(index))
            if value == "omit":
                del row["description"]
            else:
                row["description"] = value
            records.append(row)
        stats, _, _ = probe.summarize(payload(records), 1, {})
        self.assertEqual(stats["fields"]["description"],
                         {"missing": 1, "null": 1, "empty": 1, "present": 1})

    def test_malformed_responses_and_fields_are_rejected(self):
        invalid = [None, [], {}, {"meta": {"code": 403}},
                   {"meta": {"code": "200"}}, payload([], -1), payload([], True)]
        for field, value in (("id", 123), ("id", ""), ("name", None),
                             ("point", None), ("point", {"lon": True, "lat": 51}),
                             ("description", []), ("rubrics", [None]),
                             ("schedule", "hours"), ("adm_div", ["city"])):
            invalid.append(payload([{**item(), field: value}]))
        invalid.extend([payload([None]), payload([item()] * 6)])
        for body in invalid:
            with self.subTest(body=body), self.assertRaises(probe.ProbeError):
                probe.summarize(body, 1, {})

    def test_item_failure_reports_fixed_field_code_and_status_without_raw_values(self):
        cases = [(SECRET, "INVALID_ITEM_OBJECT"),
                 ({**item(), "id": {"private": SECRET}}, "INVALID_ITEM_ID"),
                 ({**item(), "id": 123}, "INVALID_ITEM_ID"),
                 ({**item(), "name": {"private": SECRET}}, "INVALID_ITEM_NAME"),
                 ({**item(), "name": " "}, "INVALID_ITEM_NAME")]
        for index, (record, expected) in enumerate(cases):
            with self.subTest(expected=expected, index=index):
                self.directory = Path(self.temp.name) / str(index)
                report = self.run_fake(Mock(return_value=payload([record])))
                self.assertEqual(report["error"], expected)
                self.assertEqual(report["failure_status"], {"http_status": 200, "api_code": 200})
                self.assertEqual(len(report["attempts"]), 1)
                saved = (self.directory / "ledger.jsonl").read_text()
                self.assertNotIn(SECRET, saved)
                self.assertNotIn(SOURCE_TEXT, saved)

    def test_composite_ids_are_kept_intact_for_deduplication(self):
        # Synthetic forms of the composite string ID documented by 2GIS.
        rows = [item("12345_tokenA"), item("12345_tokenB"), item("12345_tokenA")]
        summary, accepted, ids = probe.summarize(payload(rows), 1, {})
        self.assertEqual(ids, {"12345_tokenA", "12345_tokenB"})
        self.assertEqual(summary["duplicate_count"], 1)
        self.assertEqual(accepted, rows)

    def test_id_safety_limits_still_reject_invalid_values(self):
        for identifier in (None, 123, True, "", " ", "a\nsecret", "a\x7f", "a" * 513):
            with self.subTest(identifier_type=type(identifier).__name__), \
                 self.assertRaisesRegex(probe.ProbeError, "INVALID_ITEM_ID"):
                probe.summarize(payload([item(identifier)]), 1, {})

    def test_probe_mixed_rows_excludes_invalid_data_and_counts_fixed_reasons(self):
        rows = [item("123_alpha"), None, item(42), {**item(), "name": ""},
                {**item(), "point": None}, {**item(), "description": []}]
        summary, accepted, ids = probe.summarize_probe(payload(rows), 3, {"A": probe.CENTER})
        self.assertEqual(summary["returned"], 6)
        self.assertEqual(summary["accepted_count"], 1)
        self.assertEqual(summary["rejected_count"], 5)
        self.assertEqual(summary["validation_status"], "partial")
        self.assertEqual(summary["rejection_reasons"], {
            "INVALID_ITEM_OBJECT": 1, "INVALID_ITEM_ID": 1, "INVALID_ITEM_NAME": 1,
            "INVALID_COORDINATE": 1, "INVALID_OPTIONAL_FIELD": 1})
        self.assertEqual(ids, {"123_alpha"})
        self.assertEqual(accepted, rows[:1])
        for counts in summary["fields"].values():
            self.assertEqual(sum(counts.values()), 1)
        self.assertNotIn(SOURCE_TEXT, json.dumps(summary))
        self.assertNotIn("123_alpha", json.dumps(summary))

    def test_probe_all_rejected_and_empty_are_distinct_from_valid_coverage(self):
        for rows, expected in (([None, item(None)], "all_rejected"), ([], "empty")):
            with self.subTest(expected=expected):
                summary, accepted, ids = probe.summarize_probe(payload(rows), 1, {})
                self.assertEqual(summary["validation_status"], expected)
                self.assertEqual(summary["accepted_count"], 0)
                self.assertEqual(summary["rejected_count"], len(rows))
                self.assertEqual(accepted, [])
                self.assertEqual(ids, set())

    def test_probe_envelope_and_api_errors_remain_fatal(self):
        for response in (None, {"meta": {"code": 403}}, payload([item()], 0),
                         payload([item()] * 11), payload([], True)):
            with self.subTest(response_type=type(response).__name__), self.assertRaises(probe.ProbeError):
                probe.summarize_probe(response, 3, {"A": probe.CENTER})

    def test_duplicates_and_out_of_radius_are_measured(self):
        remote = {**item("999"), "point": {"lon": 72, "lat": 52}}
        stats, _, _ = probe.summarize(payload([item(), item(), remote]), 1, {})
        self.assertEqual(stats["duplicate_count"], 1)
        self.assertEqual(stats["outside_radius"], 1)

    def test_spacing_is_applied_between_attempts(self):
        sleep = Mock()
        with probe.Ledger(self.directory) as ledger:
            probe.run(SECRET, ledger, transport=source, reviewer=lambda rows, slot: 0,
                      confirm=lambda: True, sleep=sleep, assessor=all_uncertain)
        self.assertEqual(sleep.call_count, 9, ledger.data)
        self.assertTrue(all(call.args == (1.0,) for call in sleep.call_args_list))

    def test_transport_fixed_origin_timeout_gzip_and_no_automatic_retry(self):
        body = json.dumps(payload()).encode()
        response = Mock(status=200, headers={"Content-Encoding": "gzip"})
        response.read.return_value = gzip.compress(body)
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        opener = Mock()
        opener.open.return_value = response
        with patch.object(probe, "build_opener", return_value=opener) as factory:
            self.assertEqual(probe.fetch(1, {}, SECRET), payload())
        request = opener.open.call_args.args[0]
        parts = urlsplit(request.full_url)
        self.assertEqual(parts.scheme + "://" + parts.netloc + parts.path, probe.ENDPOINT)
        self.assertEqual(parse_qs(parts.query)["key"], [SECRET])
        self.assertEqual(opener.open.call_args.kwargs, {"timeout": 30})
        self.assertEqual(opener.open.call_count, 1)
        self.assertTrue(any(isinstance(h, probe.NoRedirect) for h in factory.call_args.args))
        self.assertEqual(factory.call_args.args[0].proxies, {})
        response.read.assert_called_once_with(probe.MAX_BYTES + 1)
        with self.assertRaisesRegex(probe.ProbeError, "REDIRECT_REFUSED"):
            probe.NoRedirect().redirect_request(None, None, 302, "", {}, "https://example.invalid")

    def test_transport_rejects_oversize_compressed_bodies_unknown_encoding_and_status(self):
        cases = [(200, {}, b"x" * 65),
                 (200, {"Content-Encoding": "gzip"}, gzip.compress(b"x" * 1000)),
                 (200, {"Content-Encoding": "br"}, b"x"), (302, {}, b"{}")]
        for status, headers, body in cases:
            response = Mock(status=status, headers=headers)
            response.read.return_value = body
            response.__enter__ = Mock(return_value=response)
            response.__exit__ = Mock(return_value=False)
            opener = Mock()
            opener.open.return_value = response
            with self.subTest(status=status, headers=headers), \
                 patch.object(probe, "MAX_BYTES", 64), \
                 patch.object(probe, "build_opener", return_value=opener), \
                 self.assertRaises(probe.ProbeError):
                probe.fetch(1, {}, SECRET)
            self.assertEqual(opener.open.call_count, 1)

    def test_http_transport_does_not_retry_network_exception(self):
        opener = Mock()
        opener.open.side_effect = URLError(SECRET)
        with patch.object(probe, "build_opener", return_value=opener), self.assertRaises(URLError):
            probe.fetch(1, {}, SECRET)
        self.assertEqual(opener.open.call_count, 1)


if __name__ == "__main__":
    unittest.main()
