"""Offline recovery checks using synthetic ledgers, records and credentials only."""

from concurrent.futures import ThreadPoolExecutor
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch


PATH = Path(__file__).resolve().parents[2] / "scripts/data/probe_2gis.py"
SPEC = importlib.util.spec_from_file_location("probe_2gis_recovery", PATH)
probe = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(probe)
SECRET = "SYNTHETIC_RECOVERY_KEY_NEVER_SEND"
SOURCE_TEXT = "SYNTHETIC_RECOVERY_SOURCE_NEVER_SAVE"


def source(slot, anchors, key):
    name = "MEGA Silk Way" if slot == 1 else "Байтерек" if slot == 2 else SOURCE_TEXT
    count = 10 if slot == 7 else 1
    rows = [{"id": str(100 + index), "name": name, "type": "attraction",
             "point": {"lon": 71.43, "lat": 51.13},
             "adm_div": [{"type": "city", "name": "Астана"}],
             "rubrics": [{"name": "Synthetic category"}],
             "description": SOURCE_TEXT, "schedule": {"Mon": {}}}
            for index in range(count)]
    return {"meta": {"code": 200},
            "result": {"items": rows, "total": 15 if slot == 7 else count}}


def read_last(path):
    return json.loads(path.read_text(encoding="utf-8").splitlines()[-1])


class OfflineRecoveryTests(unittest.TestCase):
    def setUp(self):
        scratch = PATH.parents[2] / "data/runtime/2gis-probe-tests"
        scratch.mkdir(parents=True, exist_ok=True)
        temp = tempfile.TemporaryDirectory(dir=scratch)
        self.addCleanup(temp.cleanup)
        self.directory = Path(temp.name) / "run"
        self.path = self.directory / "ledger.jsonl"
        for guard in (patch("socket.create_connection", side_effect=AssertionError("Network forbidden")),
                      patch.object(probe, "build_opener", side_effect=AssertionError("Network forbidden"))):
            guard.start()
            self.addCleanup(guard.stop)

    def original_stop(self):
        with probe.Ledger(self.directory) as ledger:
            self.assertEqual(probe.run(SECRET, ledger, transport=source,
                                      reviewer=lambda rows, slot: None,
                                      sleep=lambda seconds: None), 1)
        original = self.path.read_bytes()
        self.assertEqual(read_last(self.path)["error"], "ANCHOR_REVIEW_STOPPED")
        return original, hashlib.sha256(original).hexdigest()

    def run_recovery(self, digest, transport=source, reviewer=None):
        with probe.Ledger(self.directory, recover_anchor_stop=digest) as ledger:
            result = probe.run(SECRET, ledger, transport=transport,
                               reviewer=reviewer or (lambda rows, slot: 0),
                               confirm=lambda: True, sleep=lambda seconds: None,
                               assessor=lambda rows, slot: {
                                   "relevant": 0, "irrelevant": 0, "uncertain": len(rows)})
        return result, read_last(self.path)

    def assert_recovery_refused(self, digest):
        original = self.path.read_bytes() if self.path.exists() else None
        with self.assertRaises(probe.ProbeError):
            with probe.Ledger(self.directory, recover_anchor_stop=digest):
                self.fail("Unsupported recovery accepted")
        if original is None:
            self.assertFalse(self.path.exists())
        else:
            self.assertEqual(self.path.read_bytes(), original)

    def test_one_spent_plus_nine_new_attempts_preserves_original_and_skips_page_two(self):
        original, digest = self.original_stop()
        transport = Mock(side_effect=source)
        result, state = self.run_recovery(digest, transport)
        self.assertEqual(result, 0)
        self.assertEqual(state["status"], "completed")
        self.assertEqual([call.args[0] for call in transport.call_args_list], list(range(1, 10)))
        self.assertEqual(len(state["attempts"]), 10)
        self.assertEqual([attempt["slot"] for attempt in state["attempts"]], [1, *range(1, 10)])
        self.assertIn(10, state["skipped_slots"])
        self.assertEqual(state["recovery"]["plan_sha256"], probe.RECOVERY_PLAN_HASH)
        self.assertEqual(state["recovery"]["prior_ledger_sha256"], digest)
        self.assertEqual(state["attempts"][0], json.loads(original.splitlines()[-1])["attempts"][0])
        self.assertTrue(self.path.read_bytes().startswith(original))
        self.assertTrue(self.path.read_bytes().endswith(b"\n"))
        saved = self.path.read_text(encoding="utf-8")
        for private in (SECRET, SOURCE_TEXT, "MEGA Silk Way", "Байтерек", "71.43", "51.13"):
            self.assertNotIn(private, saved)
        self.assertEqual([path.name for path in self.directory.iterdir()], ["ledger.jsonl"])

    def test_recovery_reservation_is_durable_before_each_dispatch(self):
        original, digest = self.original_stop()
        calls = []

        def inspect(slot, anchors, key):
            calls.append(slot)
            saved = read_last(self.path)
            self.assertEqual(len(saved["attempts"]), len(calls) + 1)
            self.assertEqual(saved["attempts"][-1]["slot"], slot)
            self.assertEqual(saved["attempts"][-1]["status"], "reserved")
            self.assertTrue(self.path.read_bytes().startswith(original))
            return source(slot, anchors, key)

        self.assertEqual(self.run_recovery(digest, inspect)[0], 0)
        self.assertEqual(calls, list(range(1, 10)))

    def test_cumulative_limit_refuses_eleventh_attempt(self):
        _, digest = self.original_stop()
        with probe.Ledger(self.directory, recover_anchor_stop=digest) as ledger:
            for slot in range(1, 10):
                ledger.reserve(slot)
            with self.assertRaisesRegex(probe.ProbeError, "BUDGET_EXHAUSTED"):
                ledger.reserve(10)
        self.assertEqual(len(read_last(self.path)["attempts"]), 10)

    def test_failed_recovery_reservation_write_dispatches_nothing(self):
        _, digest = self.original_stop()
        transport = Mock(side_effect=source)
        with probe.Ledger(self.directory, recover_anchor_stop=digest) as ledger:
            save = ledger.save
            writes = 0

            def fail_first_write():
                nonlocal writes
                writes += 1
                if writes == 1:
                    raise OSError(SECRET)
                save()

            with patch.object(ledger, "save", side_effect=fail_first_write):
                self.assertEqual(probe.run(SECRET, ledger, transport=transport), 1)
        transport.assert_not_called()
        self.assertNotIn(SECRET, self.path.read_text(encoding="utf-8"))

    def test_timeout_counts_second_attempt_without_retry_or_secret_storage(self):
        original, digest = self.original_stop()
        transport = Mock(side_effect=TimeoutError(SECRET))
        result, state = self.run_recovery(digest, transport)
        self.assertEqual(result, 1)
        self.assertEqual(transport.call_count, 1)
        self.assertEqual(len(state["attempts"]), 2)
        self.assertEqual(state["attempts"][-1]["status"], "reserved")
        self.assertEqual(state["error"], "NETWORK_ERROR")
        self.assertTrue(self.path.read_bytes().startswith(original))
        self.assertNotIn(SECRET, self.path.read_text(encoding="utf-8"))
        self.assert_recovery_refused(hashlib.sha256(self.path.read_bytes()).hexdigest())

    def test_repeated_mall_cancellation_cannot_be_recovered_again(self):
        _, digest = self.original_stop()
        result, state = self.run_recovery(digest, reviewer=lambda rows, slot: None)
        self.assertEqual(result, 1)
        self.assertEqual(state["error"], "ANCHOR_REVIEW_STOPPED")
        self.assertEqual(len(state["attempts"]), 2)
        self.assert_recovery_refused(hashlib.sha256(self.path.read_bytes()).hexdigest())

    def test_completed_recovery_and_plain_restart_cannot_reset_budget(self):
        _, digest = self.original_stop()
        self.run_recovery(digest)
        self.assert_recovery_refused(digest)
        self.assert_recovery_refused(hashlib.sha256(self.path.read_bytes()).hexdigest())
        original = self.path.read_bytes()
        with self.assertRaises(probe.ProbeError):
            with probe.Ledger(self.directory):
                self.fail("Plain restart accepted")
        self.assertEqual(self.path.read_bytes(), original)

    def test_hash_mismatch_or_changed_bytes_refuse_without_appending(self):
        original, digest = self.original_stop()
        self.assert_recovery_refused("0" * 64)
        self.path.write_bytes(original + b"\n")
        self.assert_recovery_refused(digest)

    def test_missing_empty_corrupt_and_partial_ledgers_refuse_recovery(self):
        self.assert_recovery_refused(hashlib.sha256(b"").hexdigest())
        self.directory.mkdir(exist_ok=True)
        for content in (b"", b"broken\n", b'{"status":', b"{}\n"):
            with self.subTest(content=content):
                self.path.write_bytes(content)
                self.assert_recovery_refused(hashlib.sha256(content).hexdigest())
        self.path.unlink()
        original, _ = self.original_stop()
        self.path.write_bytes(original.rstrip(b"\r\n"))
        self.assert_recovery_refused(hashlib.sha256(self.path.read_bytes()).hexdigest())

    def test_other_stop_completed_wrong_plan_and_unreceived_attempt_refuse(self):
        original, _ = self.original_stop()
        cases = ({"error": "NETWORK_ERROR"}, {"status": "completed"},
                 {"plan_sha256": "0" * 64}, {"status": "running"})
        for change in cases:
            with self.subTest(change=change):
                history = [json.loads(line) for line in original.splitlines()]
                if "plan_sha256" in change:
                    for snapshot in history:
                        snapshot.update(change)
                else:
                    history[-1].update(change)
                content = "".join(json.dumps(snapshot) + "\n" for snapshot in history).encode()
                self.path.write_bytes(content)
                self.assert_recovery_refused(hashlib.sha256(content).hexdigest())
        history = [json.loads(line) for line in original.splitlines()]
        for snapshot in history[2:]:
            snapshot["attempts"][0]["status"] = "reserved"
        content = "".join(json.dumps(snapshot) + "\n" for snapshot in history).encode()
        self.path.write_bytes(content)
        self.assert_recovery_refused(hashlib.sha256(content).hexdigest())

    def test_concurrent_recovery_refused_and_admitted_recovery_cannot_restart(self):
        _, digest = self.original_stop()

        def second():
            with probe.Ledger(self.directory, recover_anchor_stop=digest):
                self.fail("Concurrent recovery accepted")

        with probe.Ledger(self.directory, recover_anchor_stop=digest):
            with ThreadPoolExecutor(max_workers=1) as executor:
                with self.assertRaisesRegex(probe.ProbeError, "RUN_LOCKED"):
                    executor.submit(second).result(timeout=5)
        self.assert_recovery_refused(hashlib.sha256(self.path.read_bytes()).hexdigest())

    def test_recovery_cli_dry_run_has_no_key_network_or_ledger_changes(self):
        original, digest = self.original_stop()
        output = io.StringIO()
        with patch.object(probe, "STATE_DIR", self.directory), \
             patch.object(probe.getpass, "getpass") as secret, \
             patch.object(probe, "run") as run, contextlib.redirect_stdout(output):
            self.assertEqual(probe.main(["--recover-anchor-stop", digest]), 0)
        self.assertEqual(json.loads(output.getvalue())["network_requests"], 0)
        self.assertEqual(self.path.read_bytes(), original)
        secret.assert_not_called()
        run.assert_not_called()

    def test_recovery_cli_requires_recovery_plan_hash_and_interactive_terminal(self):
        original, digest = self.original_stop()
        for approved in (None, probe.PLAN_HASH, "wrong", probe.RECOVERY_PLAN_HASH):
            args = ["--live", "--recover-anchor-stop", digest, "--transient-use-permitted"]
            if approved is not None:
                args.extend(["--approved-plan", approved])
            with self.subTest(approved=approved), patch.object(probe, "STATE_DIR", self.directory), \
                 patch.object(probe.getpass, "getpass") as secret, \
                 patch.object(probe, "run") as run, \
                 patch.object(probe.sys.stdin, "isatty", return_value=False), \
                 contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(probe.main(args), 2)
                secret.assert_not_called()
                run.assert_not_called()
                self.assertEqual(self.path.read_bytes(), original)

    def test_recovery_cli_correct_plan_and_tty_admits_preserved_attempt_and_marker(self):
        original, digest = self.original_stop()
        output = io.StringIO()
        observed = []

        def inspect(key, ledger):
            self.assertEqual(key, SECRET)
            saved = read_last(self.path)
            self.assertEqual(saved["attempts"], json.loads(original.splitlines()[-1])["attempts"])
            self.assertEqual(saved["recovery"]["prior_attempts"], 1)
            self.assertEqual(saved["recovery"]["max_additional_attempts"], 9)
            self.assertEqual(saved["recovery"]["plan_sha256"], probe.RECOVERY_PLAN_HASH)
            self.assertEqual(saved["recovery"]["prior_ledger_sha256"], digest)
            self.assertEqual(saved["skipped_slots"], [10])
            self.assertTrue(self.path.read_bytes().startswith(original))
            observed.append(saved)
            return 0

        with patch.object(probe, "STATE_DIR", self.directory), \
             patch.object(probe.sys.stdin, "isatty", return_value=True), \
             patch.object(output, "isatty", return_value=True), \
             patch.object(probe.getpass, "getpass", return_value=SECRET) as secret, \
             patch.object(probe, "run", side_effect=inspect) as run, \
             contextlib.redirect_stdout(output):
            self.assertEqual(probe.main([
                "--live", "--recover-anchor-stop", digest,
                "--approved-plan", probe.RECOVERY_PLAN_HASH, "--transient-use-permitted"]), 0)
        secret.assert_called_once()
        run.assert_called_once()
        self.assertEqual(len(observed), 1)
        self.assertNotIn(SECRET, output.getvalue() + self.path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
