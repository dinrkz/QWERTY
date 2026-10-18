"""Offline adapter checks: synthetic credentials/responses and blocked sockets."""

from argparse import Namespace
import copy
from datetime import datetime, timedelta, timezone
import io
import json
from pathlib import Path
import socket
import tempfile
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlsplit

from scripts.data import collect_2gis as c
from scripts.data import live_2gis_collector as live


SECRET = "SYNTHETIC_KEY_NEVER_SEND"


def response_bytes():
    return c.encoded({"meta": {"code": 200}, "result": {"items": [{
        "id": "synthetic-composite_suffix", "name": "Synthetic cafe",
        "point": {"lon": 71.430456, "lat": 51.128301},
        "description": "Synthetic data, not a real place"}], "total": 1}})


class Response(io.BytesIO):
    def __init__(self, data=None, code=200, encoding="identity"):
        super().__init__(response_bytes() if data is None else data)
        self.code = code
        self.headers = {"Content-Encoding": encoding}
        self.read_limits = []

    def read(self, size=-1):
        self.read_limits.append(size)
        return super().read(size)


class LiveCollectorTests(unittest.TestCase):
    def setUp(self):
        scratch = c.ROOT / "data/runtime/2gis-live-collector-tests"
        scratch.mkdir(parents=True, exist_ok=True)
        temp = tempfile.TemporaryDirectory(dir=scratch)
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.collector = c.Collector(self.root)
        self.manifest = live.read_manifest(live.PLAN_PATH)
        self.manifest["storage_basis"] = "SYNTHETIC TEST BASIS; not legal approval"
        self.keyfile = self.root / "synthetic.env"
        self.keyfile.write_text("TWOGIS_API_KEY=" + SECRET, encoding="utf-8")
        self.args = Namespace(approved_manifest=c.digest(self.manifest), request_id="bayterek-coffee",
                              max_new_attempts=1, available_requests=12,
                              usage_checked_on=datetime.now(timezone(timedelta(hours=5))).date().isoformat(),
                              reviewed_snapshot=None, green_space_gap_reviewed=False, env_file=self.keyfile)
        self.opener = Mock()
        self.opener.open.side_effect = lambda *a, **kw: Response()
        for guard in (patch.object(socket.socket, "connect", side_effect=AssertionError("NETWORK_FORBIDDEN")),
                      patch("socket.create_connection", side_effect=AssertionError("NETWORK_FORBIDDEN")),
                      patch.object(live, "build_opener", return_value=self.opener)):
            guard.start()
            self.addCleanup(guard.stop)

    def run_live(self):
        return live.run_live(self.manifest, self.args, self.collector)

    def count(self):
        return sum(event["kind"] == "reserve" for event in self.collector.events())

    def test_default_plan_has_exact_twelve_unique_queries_and_selected_neighborhood(self):
        manifest = live.read_manifest(live.PLAN_PATH)
        self.assertEqual(12, len(manifest["requests"]))
        self.assertEqual(12, len({c.fingerprint(r["parameters"]) for r in manifest["requests"]}))
        self.assertEqual([], manifest["pending"])
        self.assertTrue(all(r["parameters"]["page_size"] == 10 for r in manifest["requests"]))
        self.assertIsNone(manifest["storage_basis"])
        neighbors = [r for r in manifest["requests"] if r["area"] == "zhetysu-shubar"]
        self.assertEqual(2, len(neighbors))
        self.assertTrue(all(r["parameters"]["point"] == "71.439453,51.135968" for r in neighbors))
        self.assertEqual(live.OPTIONAL_IDS, {r["id"] for r in manifest["requests"][-2:]})

    def test_default_cli_never_loads_key_or_creates_ledger(self):
        with patch.object(live, "read_key", side_effect=AssertionError("NO_KEY_READ")), patch.object(c, "Collector", side_effect=AssertionError("NO_STATE")), patch("sys.stdout", new_callable=io.StringIO) as out:
            self.assertEqual(0, live.main([]))
            summary = json.loads(out.getvalue())
        self.assertFalse(summary["live"])
        self.assertEqual(0, summary["network_requests"])
        self.opener.open.assert_not_called()

    def test_cli_live_without_approval_stops_before_key_or_network(self):
        with patch.object(live, "read_key", side_effect=AssertionError("NO_KEY_READ")), patch("sys.stdout", new_callable=io.StringIO) as out:
            self.assertEqual(1, live.main(["--live"]))
        self.assertEqual("MANIFEST_APPROVAL_REQUIRED", json.loads(out.getvalue())["error"])
        self.opener.open.assert_not_called()

    def test_every_static_gate_rejects_before_state_key_and_request(self):
        cases = [("approved_manifest", "wrong", "MANIFEST_APPROVAL_REQUIRED"),
                 ("request_id", None, "REQUEST_ID_REQUIRED"),
                 ("max_new_attempts", 12, "ONE_ATTEMPT_APPROVAL_REQUIRED"),
                 ("available_requests", 0, "DASHBOARD_BALANCE_REQUIRED"),
                 ("usage_checked_on", "2000-01-01", "FRESH_USAGE_CHECK_REQUIRED")]
        for field, value, code in cases:
            original = getattr(self.args, field)
            setattr(self.args, field, value)
            with self.subTest(field=field), patch.object(live, "read_key", side_effect=AssertionError("NO_KEY_READ")), self.assertRaisesRegex(c.CollectionError, code):
                self.run_live()
            setattr(self.args, field, original)
        self.assertFalse(self.collector.ledger.exists())
        self.opener.open.assert_not_called()

    def test_storage_basis_not_inferred_from_api_key_or_approval(self):
        self.manifest["storage_basis"] = None
        self.args.approved_manifest = c.digest(self.manifest)
        with self.assertRaisesRegex(c.CollectionError, "STORAGE_BASIS_REQUIRED"):
            self.run_live()
        self.assertFalse(self.collector.ledger.exists())
        self.opener.open.assert_not_called()

    def test_mutated_query_requires_new_hash_approval(self):
        self.manifest["requests"][0]["parameters"]["radius"] = 1000
        with self.assertRaisesRegex(c.CollectionError, "MANIFEST_APPROVAL_REQUIRED"):
            self.run_live()
        self.opener.open.assert_not_called()

    def test_direct_runner_rejects_incomplete_plan_before_dispatch(self):
        self.manifest["requests"].pop()
        self.args.approved_manifest = c.digest(self.manifest)
        with self.assertRaisesRegex(c.CollectionError, "INCOMPLETE_OR_DUPLICATE_LIVE_PLAN"):
            self.run_live()
        self.opener.open.assert_not_called()
        self.assertFalse(self.collector.ledger.exists())

    def test_demo_oversize_page_rejected_before_key_state_or_dispatch(self):
        for index, size in ((0, 11), (11, 50)):
            with self.subTest(index=index, size=size):
                manifest = copy.deepcopy(self.manifest)
                manifest["requests"][index]["parameters"]["page_size"] = size
                self.args.approved_manifest = c.digest(manifest)
                path = self.root / "oversize-plan.json"
                path.write_bytes(c.encoded(manifest))
                with self.assertRaisesRegex(c.CollectionError, "DEMO_PAGE_SIZE_EXCEEDED"):
                    live.read_manifest(path)
                with patch.object(live, "read_key", side_effect=AssertionError("NO_KEY_READ")), self.assertRaisesRegex(c.CollectionError, "DEMO_PAGE_SIZE_EXCEEDED"):
                    live.run_live(manifest, self.args, self.collector)
        self.assertFalse(self.collector.ledger.exists())
        self.opener.open.assert_not_called()

    def test_output_never_pairs_old_quality_with_newer_snapshot(self):
        original = self.collector.collect_one
        def advancing_writer(*args, **kwargs):
            quality = original(*args, **kwargs)
            # Simulate a second writer advancing after the first released its lock.
            # Both transports are synthetic; the second does not use the adapter.
            original(self.manifest, "bayterek-parks", lambda _: (200, response_bytes()))
            return quality
        with patch.object(self.collector, "collect_one", side_effect=advancing_writer):
            with self.assertRaisesRegex(c.CollectionError, "REVIEW_SNAPSHOT_CHANGED"):
                self.run_live()
        self.assertEqual(1, self.opener.open.call_count)
        self.assertEqual(2, self.count())

    def test_first_page_saves_and_second_requires_exact_reviewed_snapshot(self):
        first = self.run_live()
        self.assertEqual(1, self.count())
        self.assertEqual(11, first["quality"]["new_attempts_remaining"])
        self.args.request_id = "bayterek-parks"
        with patch.object(live, "read_key", side_effect=AssertionError("NO_KEY_READ")), self.assertRaisesRegex(c.CollectionError, "SAVED_PAGE_REVIEW_REQUIRED"):
            self.run_live()
        self.assertEqual(1, self.opener.open.call_count)
        self.args.reviewed_snapshot = first["snapshot_sha256"]
        second = self.run_live()
        self.assertEqual(2, self.count())
        self.args.request_id = "bayterek-museums"
        with self.assertRaisesRegex(c.CollectionError, "SAVED_PAGE_REVIEW_REQUIRED"):
            self.run_live()
        self.assertNotEqual(first["snapshot_sha256"], second["snapshot_sha256"])

    def test_cache_replay_does_not_read_key_or_send_request(self):
        self.run_live()
        self.keyfile.unlink()
        with patch.object(live, "read_key", side_effect=AssertionError("NO_KEY_READ")):
            self.run_live()
        self.assertEqual(1, self.opener.open.call_count)
        self.assertEqual(1, self.count())

    def test_out_of_order_and_concurrent_invocation_do_not_load_key(self):
        self.args.request_id = "mega-silk-way-coffee"
        with patch.object(live, "read_key", side_effect=AssertionError("NO_KEY_READ")), self.assertRaisesRegex(c.CollectionError, "REQUEST_OUT_OF_ORDER"):
            self.run_live()
        self.args.request_id = "bayterek-coffee"
        with self.collector.locked(), self.assertRaisesRegex(c.CollectionError, "COLLECTOR_LOCKED"):
            self.run_live()
        self.assertEqual(0, self.count())
        self.opener.open.assert_not_called()

    def test_gate_is_inside_lock_and_precedes_reservation(self):
        def check_key(path):
            self.assertEqual(0, self.count())
            with self.assertRaisesRegex(c.CollectionError, "COLLECTOR_LOCKED"):
                with c.Collector(self.root).locked():
                    pass
            return SECRET
        with patch.object(live, "read_key", side_effect=check_key):
            self.run_live()

    def test_missing_key_does_not_spend_an_attempt(self):
        self.keyfile.unlink()
        with self.assertRaisesRegex(c.CollectionError, "INVALID_KEY_FILE"):
            self.run_live()
        self.assertEqual(0, self.count())
        self.opener.open.assert_not_called()

    def test_pending_broad_query_after_seven_calls_preserves_budget_and_checkpoints(self):
        original_hash = c.digest(self.manifest)
        for request in self.manifest["requests"][:7]:
            self.args.request_id = request["id"]
            result = self.run_live()
            self.args.reviewed_snapshot = result["snapshot_sha256"]
        ledger_prefix = self.collector.ledger.read_bytes()
        query = self.manifest["requests"][7]
        query["id"] = "mega-silk-way-all-categories"
        query["intent"] = "all-categories-sample"
        query["parameters"].pop("q", None)
        self.args.request_id = query["id"]
        self.args.approved_manifest = c.digest(self.manifest)
        for approval, code in ((None, "MANIFEST_MUST_BE_APPEND_ONLY"),
                               ("0" * 64, "PREVIOUS_MANIFEST_APPROVAL_MISMATCH")):
            self.args.revise_pending_from = approval
            with patch.object(live, "read_key", side_effect=AssertionError("NO_KEY_READ")), self.assertRaisesRegex(c.CollectionError, code):
                self.run_live()
        self.assertEqual(ledger_prefix, self.collector.ledger.read_bytes())
        self.assertEqual(7, self.opener.open.call_count)
        self.args.revise_pending_from = original_hash
        reviewed = self.args.reviewed_snapshot
        self.args.reviewed_snapshot = "stale"
        with self.assertRaisesRegex(c.CollectionError, "SAVED_PAGE_REVIEW_REQUIRED"):
            self.run_live()
        self.args.reviewed_snapshot = reviewed
        result = self.run_live()
        self.assertEqual(8, self.opener.open.call_count)
        self.assertEqual(8, result["quality"]["new_attempts_used"])
        self.assertEqual(4, result["quality"]["new_attempts_remaining"])
        self.assertEqual(18, result["quality"]["project_attempts"])
        self.assertTrue(self.collector.ledger.read_bytes().startswith(ledger_prefix))
        self.assertNotIn("q", parse_qs(urlsplit(self.opener.open.call_args.args[0].full_url).query))
        with patch.object(live, "read_key", side_effect=AssertionError("NO_KEY_READ")):
            self.run_live()
        self.assertEqual(8, self.opener.open.call_count)

    def test_optional_refinements_require_gap_review_and_can_skip_either(self):
        for request in self.manifest["requests"][:10]:
            self.args.request_id = request["id"]
            result = self.run_live()
            self.args.reviewed_snapshot = result["snapshot_sha256"]
        self.args.request_id = "mega-silk-way-green-space"
        with self.assertRaisesRegex(c.CollectionError, "GREEN_SPACE_GAP_REVIEW_REQUIRED"):
            self.run_live()
        self.assertEqual(10, self.count())
        self.args.green_space_gap_reviewed = True
        result = self.run_live()
        self.assertEqual(11, self.count())
        self.args.reviewed_snapshot = result["snapshot_sha256"]
        self.args.request_id = "bayterek-green-space"
        result = self.run_live()
        self.assertEqual(12, self.count())
        self.assertEqual(22, result["quality"]["project_attempts"])
        self.assertEqual(0, result["quality"]["new_attempts_remaining"])
        self.run_live()
        self.assertEqual(12, self.opener.open.call_count)

    def test_http_request_fixed_endpoint_timeout_identity_and_no_proxy(self):
        result = Response()
        self.opener.open.side_effect = None
        self.opener.open.return_value = result
        self.run_live()
        req = self.opener.open.call_args.args[0]
        parsed = urlsplit(req.full_url)
        self.assertEqual("https://catalog.api.2gis.com/3.0/items", parsed.scheme + "://" + parsed.netloc + parsed.path)
        self.assertEqual([SECRET], parse_qs(parsed.query)["key"])
        self.assertEqual("identity", req.get_header("Accept-encoding"))
        self.assertEqual({"timeout": 30}, self.opener.open.call_args.kwargs)
        self.assertEqual([c.MAX_BYTES + 1], result.read_limits)
        handlers = live.build_opener.call_args.args
        self.assertEqual({}, handlers[0].proxies)
        self.assertIsInstance(handlers[1], live.NoRedirect)

    def test_redirect_is_not_followed_and_error_body_is_saved(self):
        handler = live.NoRedirect()
        self.assertIsNone(handler.redirect_request(None, None, 302, "redirect", {}, "https://synthetic.invalid"))
        self.opener.open.side_effect = HTTPError("https://synthetic.invalid/?key=" + SECRET, 302, "redirect", {}, io.BytesIO(b"redirect body"))
        with self.assertRaisesRegex(c.CollectionError, "HTTP_STATUS_ERROR"):
            self.run_live()
        self.assertEqual(1, self.opener.open.call_count)
        self.assertEqual(1, self.count())
        self.assertEqual(1, len(list((self.collector.raw / "responses").glob("*.json"))))

    def test_429_body_scrubbed_and_campaign_stops_without_retry(self):
        self.opener.open.side_effect = HTTPError("https://synthetic.invalid/?key=" + SECRET, 429, SECRET, {}, io.BytesIO(c.encoded({"message": SECRET})))
        with self.assertRaisesRegex(c.CollectionError, "HTTP_STATUS_ERROR"):
            self.run_live()
        with self.assertRaisesRegex(c.CollectionError, "HTTP_STATUS_ERROR"):
            self.run_live()
        for path in (self.root / "data").rglob("*"):
            if path.is_file():
                self.assertNotIn(SECRET, path.read_text(encoding="utf-8"))
        self.assertEqual(1, self.opener.open.call_count)

    def test_oversize_and_unexpected_encoding_remain_charged(self):
        # Each subcase uses a separate isolated synthetic campaign.
        for label, reply in (("large", Response(b"x" * 33)), ("encoded", Response(b"gzip", encoding="gzip"))):
            self.collector = c.Collector(self.root / label)
            self.opener.open.side_effect = lambda *a, _reply=reply, **kw: _reply
            with self.subTest(label=label), patch.object(c, "MAX_BYTES", 32), self.assertRaisesRegex(c.CollectionError, "TRANSPORT_OR_SAVE_FAILED"):
                self.run_live()
            self.assertEqual(1, self.count())
            with self.assertRaisesRegex(c.CollectionError, "UNCERTAIN_ATTEMPT_NO_RETRY"):
                self.run_live()
        self.assertEqual(2, self.opener.open.call_count)

    def test_timeout_is_one_attempt_and_exception_text_never_saved(self):
        self.opener.open.side_effect = URLError("key=" + SECRET)
        with self.assertRaisesRegex(c.CollectionError, "TRANSPORT_OR_SAVE_FAILED"):
            self.run_live()
        with self.assertRaisesRegex(c.CollectionError, "UNCERTAIN_ATTEMPT_NO_RETRY"):
            self.run_live()
        self.assertEqual(1, self.opener.open.call_count)
        self.assertNotIn(SECRET, self.collector.ledger.read_text())

    def test_env_parser_only_one_literal_key_and_no_expansion(self):
        self.keyfile.write_text("OTHER=ignored\nexport TWOGIS_API_KEY='" + SECRET + "'\n", encoding="utf-8-sig")
        self.assertEqual(SECRET, live.read_key(self.keyfile))
        for content in ("TWOGIS_API_KEY=${OTHER}", "TWOGIS_API_KEY=a\nTWOGIS_API_KEY=b",
                        "TWOGIS_API_KEY='broken", "TWOGIS_API_KEY=" + "a" * 1025,
                        "OTHER=a", "x" * 65537):
            self.keyfile.write_text(content, encoding="utf-8")
            with self.subTest(length=len(content)), self.assertRaisesRegex(c.CollectionError, "INVALID_KEY_FILE"):
                live.read_key(self.keyfile)

    def test_bad_manifest_file_and_duplicate_queries_fail_before_transport(self):
        path = self.root / "manifest.json"
        variants = [b"bad json", b"x" * 65537]
        duplicate = copy.deepcopy(self.manifest)
        duplicate["requests"][1]["parameters"] = duplicate["requests"][0]["parameters"]
        variants.append(c.encoded(duplicate))
        for data in variants:
            path.write_bytes(data)
            with self.assertRaises(c.CollectionError):
                live.read_manifest(path)
        self.opener.open.assert_not_called()


if __name__ == "__main__":
    unittest.main()
