"""Synthetic, offline checks for the five-slot and final-four continuations."""

from concurrent.futures import ThreadPoolExecutor
import contextlib
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

from scripts.data import finish_2gis_probe as finish

ROOT = Path(__file__).resolve().parents[2]
p = finish.p
SECRET = "SYNTHETIC_FINISH_KEY_NEVER_SEND"
SOURCE_TEXT = "SYNTHETIC_FINISH_SOURCE_NEVER_PERSIST"
ANCHORS = {"A": (71.407, 51.089), "B": (71.43, 51.128)}


def source(slot, anchors, key):
    name = "MEGA Silk Way" if slot == 1 else "Байтерек" if slot == 2 else SOURCE_TEXT
    xy = ANCHORS["A"] if slot in (1, 3, 4, 9) else ANCHORS["B"]
    identifiers = range(100, 110) if slot == 7 else range(105, 115) if slot == 8 else [100]
    rows = [{"id": str(identifier), "name": name, "type": "attraction",
             "point": {"lon": xy[0], "lat": xy[1]},
             "adm_div": [{"type": "city", "name": "Астана"}],
             "rubrics": [{"name": "Synthetic category"}],
             "description": SOURCE_TEXT, "schedule": {"Mon": {}}}
            for identifier in identifiers]
    return {"meta": {"code": 200}, "result": {"items": rows, "total": len(rows)}}


def read_last(path):
    return json.loads(path.read_text(encoding="utf-8").splitlines()[-1])


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class OfflineFinishTests(unittest.TestCase):
    def setUp(self):
        scratch = ROOT / "data/runtime/2gis-probe-tests"
        scratch.mkdir(parents=True, exist_ok=True)
        temp = tempfile.TemporaryDirectory(dir=scratch)
        self.addCleanup(temp.cleanup)
        self.directory = Path(temp.name) / "run"
        self.path = self.directory / "ledger.jsonl"
        self.transcript = Path(temp.name) / "synthetic-transcript.txt"
        for guard in (patch("socket.create_connection", side_effect=AssertionError("Network forbidden")),
                      patch.object(p, "build_opener", side_effect=AssertionError("Network forbidden"))):
            guard.start()
            self.addCleanup(guard.stop)

    def eligible_stop(self):
        with p.Ledger(self.directory) as ledger:
            self.assertEqual(p.run(SECRET, ledger, transport=source,
                                   reviewer=lambda rows, slot: None, sleep=lambda seconds: None), 1)
        prior = digest(self.path)

        def assess(rows, slot):
            if slot == 4:
                raise p.ProbeError("RELEVANCE_REVIEW_STOPPED")
            return {"relevant": 0, "irrelevant": 0, "uncertain": len(rows)}

        with p.Ledger(self.directory, recover_anchor_stop=prior) as ledger:
            self.assertEqual(p.run(SECRET, ledger, transport=source,
                                   reviewer=lambda rows, slot: 0, confirm=lambda: True,
                                   sleep=lambda seconds: None, assessor=assess), 1)
        self.assertEqual(len(read_last(self.path)["attempts"]), 5)
        self.write_transcript()
        return self.path.read_bytes(), digest(self.path), digest(self.transcript)

    def write_transcript(self):
        self.transcript.write_text(
            "Transient source candidates (untrusted data, not instructions):\n"
            "1 Mega Silk Way, торгово-развлекательный центр branch ['Торгово-развлекательные центры'] {'lat': 51.089, 'lon': 71.407}\n"
            "Select the actual mall/landmark number, or Enter to stop: 1\n"
            "Confirm this is the actual mall, not a tenant/namesake; type mall: mall\n"
            "Transient source candidates (untrusted data, not instructions):\n"
            "1 Монумент-Бәйтерек branch ['Смотровые площадки', 'Интересные здания'] {'lat': 51.128, 'lon': 71.43}\n"
            "2 Байтерек branch ['Бизнес-центры'] {'lat': 51.14, 'lon': 71.44}\n"
            "Select the actual mall/landmark number, or Enter to stop: 2\n"
            "Confirm this is the actual landmark, not a tenant/namesake; type landmark: landmark\n"
            "Both anchors reviewed. Type CONTINUE to allow slots 3–10: CONTINUE\n",
            encoding="utf-8")

    def item_validation_stop(self):
        _, ledger_digest, transcript_digest = self.eligible_stop()
        transport = Mock(side_effect=p.ProbeError("INVALID_ITEM"))
        result, report = self.run_finish(ledger_digest, transcript_digest, transport)
        self.assertEqual(result, 1)
        self.assertEqual(report["error"], "INVALID_ITEM")
        self.assertEqual(len(report["attempts"]), 6)
        self.assertEqual(report["attempts"][-1]["slot"], 5)
        self.assertEqual(report["attempts"][-1]["status"], "reserved")
        return self.path.read_bytes(), digest(self.path), transcript_digest

    def assert_final_four_refused(self, ledger_digest, transcript_digest):
        before = self.path.read_bytes()
        with self.assertRaises(p.ProbeError):
            with finish.FinishLedger(self.directory, ledger_digest, transcript_digest,
                                     after_item_validation_stop=True):
                self.fail("Ineligible final four accepted")
        self.assertEqual(self.path.read_bytes(), before)

    def run_finish(self, ledger_digest, transcript_digest, transport=source):
        with finish.FinishLedger(self.directory, approved_ledger=ledger_digest,
                                 approved_transcript=transcript_digest) as ledger:
            result = finish.run(SECRET, ledger, ANCHORS,
                                transport=transport, sleep=lambda seconds: None)
        return result, read_last(self.path)

    def assert_refused(self, ledger_digest, transcript_digest):
        before = self.path.read_bytes() if self.path.exists() else None
        with self.assertRaises(finish.p.ProbeError):
            with finish.FinishLedger(self.directory, approved_ledger=ledger_digest,
                                     approved_transcript=transcript_digest):
                self.fail("Ineligible final continuation accepted")
        if before is None:
            self.assertFalse(self.path.exists())
        else:
            self.assertEqual(self.path.read_bytes(), before)

    def test_five_remaining_slots_preserve_prefix_and_prior_attempts_without_review(self):
        before, ledger_digest, transcript_digest = self.eligible_stop()
        transport = Mock(side_effect=source)
        with patch("builtins.input", side_effect=AssertionError("No interactive review")):
            result, report = self.run_finish(ledger_digest, transcript_digest, transport)
        self.assertEqual(result, 0)
        self.assertEqual(report["status"], "completed")
        self.assertEqual([call.args[0] for call in transport.call_args_list], list(range(5, 10)))
        self.assertEqual([a["slot"] for a in report["attempts"]], [1, 1, 2, 3, 4, 5, 6, 7, 8, 9])
        self.assertEqual(report["attempts"][:5], json.loads(before.splitlines()[-1])["attempts"])
        self.assertTrue(self.path.read_bytes().startswith(before))
        self.assertEqual(report["attempts"][8]["summary"]["overlap_with_slot_7"], 5)
        for attempt in report["attempts"][5:]:
            self.assertNotIn("human_relevance", attempt["summary"])
            self.assertEqual(attempt["summary"]["unassessed_relevance"], {
                "relevant": 0, "irrelevant": 0, "uncertain": attempt["summary"]["returned"]})
        saved = self.path.read_text(encoding="utf-8")
        for private in (SECRET, SOURCE_TEXT, "Mega Silk Way", "Байтерек", "71.407", "51.128"):
            self.assertNotIn(private, saved)
        self.assertEqual([path.name for path in self.directory.iterdir()], ["ledger.jsonl"])

    def test_reservations_durable_before_dispatch_and_no_eleventh_attempt(self):
        before, ledger_digest, transcript_digest = self.eligible_stop()
        calls = []

        def inspect(slot, anchors, key):
            calls.append(slot)
            saved = read_last(self.path)
            self.assertEqual(len(saved["attempts"]), 5 + len(calls))
            self.assertEqual(saved["attempts"][-1]["slot"], slot)
            self.assertEqual(saved["attempts"][-1]["status"], "reserved")
            self.assertTrue(self.path.read_bytes().startswith(before))
            return source(slot, anchors, key)

        with finish.FinishLedger(self.directory, approved_ledger=ledger_digest,
                                 approved_transcript=transcript_digest) as ledger:
            self.assertEqual(finish.run(SECRET, ledger, ANCHORS,
                                        transport=inspect, sleep=lambda seconds: None), 0)
            with self.assertRaises(finish.p.ProbeError):
                ledger.reserve(10)
        self.assertEqual(calls, list(range(5, 10)))

    def test_transport_failure_is_counted_without_retry_or_secret_leak(self):
        before, ledger_digest, transcript_digest = self.eligible_stop()
        transport = Mock(side_effect=TimeoutError(SECRET))
        result, report = self.run_finish(ledger_digest, transcript_digest, transport)
        self.assertEqual(result, 1)
        self.assertEqual(transport.call_count, 1)
        self.assertEqual(len(report["attempts"]), 6)
        self.assertEqual(report["attempts"][-1]["status"], "reserved")
        self.assertEqual(report["error"], "NETWORK_ERROR")
        self.assertTrue(self.path.read_bytes().startswith(before))
        self.assertNotIn(SECRET, self.path.read_text(encoding="utf-8"))
        self.assert_refused(digest(self.path), transcript_digest)

    def test_failed_reservation_write_prevents_transport(self):
        _, ledger_digest, transcript_digest = self.eligible_stop()
        transport = Mock(side_effect=source)
        with finish.FinishLedger(self.directory, approved_ledger=ledger_digest,
                                 approved_transcript=transcript_digest) as ledger:
            save = ledger.save
            writes = 0

            def fail_first_write():
                nonlocal writes
                writes += 1
                if writes == 1:
                    raise OSError(SECRET)
                save()

            with patch.object(ledger, "save", side_effect=fail_first_write):
                self.assertEqual(finish.run(SECRET, ledger, ANCHORS,
                                            transport=transport, sleep=lambda seconds: None), 1)
        transport.assert_not_called()
        self.assertNotIn(SECRET, self.path.read_text(encoding="utf-8"))

    def test_second_continuation_and_concurrent_runner_refused(self):
        _, ledger_digest, transcript_digest = self.eligible_stop()

        def concurrent():
            with finish.FinishLedger(self.directory, approved_ledger=ledger_digest,
                                     approved_transcript=transcript_digest):
                self.fail("Concurrent continuation accepted")

        with finish.FinishLedger(self.directory, approved_ledger=ledger_digest,
                                 approved_transcript=transcript_digest):
            with ThreadPoolExecutor(max_workers=1) as executor:
                with self.assertRaisesRegex(finish.p.ProbeError, "RUN_LOCKED"):
                    executor.submit(concurrent).result(timeout=5)
        self.assert_refused(digest(self.path), transcript_digest)

    def test_ledger_hash_change_corrupt_empty_missing_and_truncated_refused(self):
        before, ledger_digest, transcript_digest = self.eligible_stop()
        self.assert_refused("0" * 64, transcript_digest)
        for content in (b"", b"broken\n", before.rstrip(b"\r\n"), before + b'{"partial":'):
            with self.subTest(content_length=len(content)):
                self.path.write_bytes(content)
                self.assert_refused(digest(self.path), transcript_digest)
        self.path.unlink()
        self.assert_refused(ledger_digest, transcript_digest)

    def test_wrong_stop_and_wrong_slot_sequence_refused(self):
        before, _, transcript_digest = self.eligible_stop()
        for change in ("error", "slot"):
            with self.subTest(change=change):
                history = [json.loads(line) for line in before.splitlines()]
                if change == "error":
                    history[-1]["error"] = "NETWORK_ERROR"
                else:
                    history[-1]["attempts"][-1]["slot"] = 5
                self.path.write_text("".join(json.dumps(row) + "\n" for row in history), encoding="utf-8")
                self.assert_refused(digest(self.path), transcript_digest)

    def test_transcript_selects_mall_and_monument_not_business_center(self):
        self.write_transcript()
        self.assertEqual(finish.read_anchors(self.transcript, digest(self.transcript)), ANCHORS)

    def test_transcript_hash_missing_corrupt_and_truncated_refused(self):
        self.write_transcript()
        with self.assertRaises(finish.p.ProbeError):
            finish.read_anchors(self.transcript, "0" * 64)
        for content in (b"", b"broken", b"\xff\xff", b"2 Mon"):
            self.transcript.write_bytes(content)
            with self.subTest(content=content), self.assertRaises(finish.p.ProbeError):
                finish.read_anchors(self.transcript, digest(self.transcript))
        self.transcript.unlink()
        with self.assertRaises(finish.p.ProbeError):
            finish.read_anchors(self.transcript, "0" * 64)

    def test_gui_cancel_and_invalid_key_preserve_ledger_without_dispatch(self):
        before, ledger_digest, transcript_digest = self.eligible_stop()
        args = ["--live", "--approved-plan", finish.FINISH_PLAN_HASH,
                "--approved-ledger", ledger_digest, "--transcript", str(self.transcript),
                "--approved-transcript", transcript_digest, "--key-dialog"]
        for entry in (None, "", "not a valid key"):
            with self.subTest(entry=entry), patch.object(p, "STATE_DIR", self.directory), \
                 patch.object(finish, "dialog_key", return_value=entry) as dialog, \
                 patch.object(finish, "run") as run, \
                 contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(finish.main(args), 1)
                dialog.assert_called_once()
                run.assert_not_called()
                self.assertEqual(self.path.read_bytes(), before)
                self.assertFalse((self.directory / "run.lock").exists())

    def test_dry_run_never_asks_for_key_opens_network_or_modifies_ledger(self):
        before, _, _ = self.eligible_stop()
        output = io.StringIO()
        with patch.object(p, "STATE_DIR", self.directory), \
             patch.object(finish, "dialog_key") as dialog, \
             patch.object(finish.getpass, "getpass") as secret, \
             patch.object(finish, "run") as run, contextlib.redirect_stdout(output):
            self.assertEqual(finish.main([]), 0)
        self.assertEqual(json.loads(output.getvalue())["network_requests"], 0)
        self.assertEqual(self.path.read_bytes(), before)
        dialog.assert_not_called()
        secret.assert_not_called()
        run.assert_not_called()

    def test_final_four_preserves_six_spent_and_prior_continuation_without_repeating_slot_five(self):
        before, ledger_digest, transcript_digest = self.item_validation_stop()
        prior = json.loads(before.splitlines()[-1])
        calls = []

        def inspect(slot, anchors, key):
            calls.append(slot)
            saved = read_last(self.path)
            self.assertEqual(len(saved["attempts"]), 6 + len(calls))
            self.assertEqual(saved["attempts"][-1]["slot"], slot)
            self.assertEqual(saved["attempts"][-1]["status"], "reserved")
            self.assertTrue(self.path.read_bytes().startswith(before))
            return source(slot, anchors, key)

        with finish.FinishLedger(self.directory, ledger_digest, transcript_digest,
                                 after_item_validation_stop=True) as ledger:
            with patch("builtins.input", side_effect=AssertionError("No interactive review")):
                self.assertEqual(finish.run(SECRET, ledger, ANCHORS,
                                            transport=inspect, sleep=lambda seconds: None), 0)
            with self.assertRaises(p.ProbeError):
                ledger.reserve(10)
        report = read_last(self.path)
        self.assertEqual(calls, [6, 7, 8, 9])
        self.assertEqual(len(report["attempts"]), 10)
        self.assertEqual(report["attempts"][:6], prior["attempts"])
        self.assertEqual(report["continuation"], prior["continuation"])
        self.assertEqual(report["status"], "completed")
        self.assertEqual(report["attempts"][8]["summary"]["overlap_with_slot_7"], 5)
        self.assertIn(10, report["skipped_slots"])
        for attempt in report["attempts"][6:]:
            self.assertNotIn("human_relevance", attempt["summary"])
            self.assertEqual(attempt["summary"]["unassessed_relevance"]["uncertain"],
                             attempt["summary"]["returned"])
        saved = self.path.read_text(encoding="utf-8")
        self.assertNotIn(SECRET, saved)
        self.assertNotIn(SOURCE_TEXT, saved)
        self.assert_final_four_refused(digest(self.path), transcript_digest)

    def test_final_four_failure_is_spent_without_retry_or_second_admission(self):
        before, ledger_digest, transcript_digest = self.item_validation_stop()
        transport = Mock(side_effect=TimeoutError(SECRET))
        with finish.FinishLedger(self.directory, ledger_digest, transcript_digest,
                                 after_item_validation_stop=True) as ledger:
            self.assertEqual(finish.run(SECRET, ledger, ANCHORS, transport=transport,
                                        sleep=lambda seconds: None), 1)
        report = read_last(self.path)
        self.assertEqual(transport.call_count, 1)
        self.assertEqual(transport.call_args.args[0], 6)
        self.assertEqual(len(report["attempts"]), 7)
        self.assertEqual(report["attempts"][-1]["status"], "reserved")
        self.assertEqual(report["error"], "NETWORK_ERROR")
        self.assertTrue(self.path.read_bytes().startswith(before))
        self.assertNotIn(SECRET, self.path.read_text(encoding="utf-8"))
        self.assert_final_four_refused(digest(self.path), transcript_digest)

    def test_final_four_rejects_wrong_prestate_prefix_or_transcript_hash(self):
        before, ledger_digest, transcript_digest = self.item_validation_stop()
        self.assert_final_four_refused("0" * 64, transcript_digest)
        self.assert_final_four_refused(ledger_digest, "0" * 64)
        for change in ("wrong_stop", "received", "slot", "prefix", "prior_transcript"):
            with self.subTest(change=change):
                history = [json.loads(line) for line in before.splitlines()]
                last = history[-1]
                if change == "wrong_stop":
                    last["error"] = "NETWORK_ERROR"
                elif change == "received":
                    last["attempts"][-1]["status"] = "received"
                elif change == "slot":
                    last["attempts"][-1]["slot"] = 6
                elif change == "prefix":
                    history[0]["started_at"] = "changed"
                else:
                    last["continuation"]["transcript_sha256"] = "0" * 64
                self.path.write_text("".join(json.dumps(row) + "\n" for row in history), encoding="utf-8")
                self.assert_final_four_refused(digest(self.path), transcript_digest)

    def test_final_four_gui_cancel_uses_four_attempt_label_and_preserves_ledger(self):
        before, ledger_digest, transcript_digest = self.item_validation_stop()
        args = ["--live", "--approved-plan", finish.FINAL_FOUR_PLAN_HASH,
                "--approved-ledger", ledger_digest, "--transcript", str(self.transcript),
                "--approved-transcript", transcript_digest, "--key-dialog",
                "--after-item-validation-stop"]
        with patch.object(p, "STATE_DIR", self.directory), \
             patch.object(finish, "dialog_key", return_value=None) as dialog, \
             patch.object(finish, "run") as run, \
             contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(finish.main(args), 1)
            dialog.assert_called_once_with(4)
            run.assert_not_called()
            self.assertEqual(self.path.read_bytes(), before)
            self.assertFalse((self.directory / "run.lock").exists())

    def test_env_file_quoted_and_unquoted_keys_allow_non_tty_without_echo(self):
        scratch = self.directory.parent
        for index, value in enumerate((SECRET, '"' + SECRET + '"', "'" + SECRET + "'")):
            with self.subTest(value_style=index):
                self.directory = scratch / ("env-run-" + str(index))
                self.path = self.directory / "ledger.jsonl"
                before, ledger_digest, transcript_digest = self.item_validation_stop()
                env_path = scratch / "synthetic.env"
                env_path.write_text("# Synthetic fixture\nUNRELATED_SECRET=DO_NOT_ECHO\n"
                                    "TWOGIS_API_KEY=" + value + "\n", encoding="utf-8")
                output, errors = io.StringIO(), io.StringIO()

                def inspect(key, ledger, anchors):
                    self.assertEqual(key, SECRET)
                    self.assertEqual(anchors, ANCHORS)
                    self.assertEqual(len(ledger.data["attempts"]), 6)
                    self.assertTrue(self.path.read_bytes().startswith(before))
                    return 0

                with patch.object(p, "STATE_DIR", self.directory), \
                     patch.object(finish.sys.stdin, "isatty", return_value=False), \
                     patch.object(finish, "dialog_key") as dialog, \
                     patch.object(finish.getpass, "getpass") as getpass, \
                     patch.object(finish, "run", side_effect=inspect) as run, \
                     contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
                    self.assertEqual(finish.main([
                        "--live", "--approved-plan", finish.FINAL_FOUR_PLAN_HASH,
                        "--approved-ledger", ledger_digest, "--transcript", str(self.transcript),
                        "--approved-transcript", transcript_digest, "--after-item-validation-stop",
                        "--env-file", str(env_path)]), 0)
                run.assert_called_once()
                dialog.assert_not_called()
                getpass.assert_not_called()
                emitted = output.getvalue() + errors.getvalue() + self.path.read_text(encoding="utf-8")
                self.assertNotIn(SECRET, emitted)
                self.assertNotIn("DO_NOT_ECHO", emitted)

    def test_env_file_missing_duplicate_or_invalid_key_refused_before_ledger_change(self):
        before, ledger_digest, transcript_digest = self.item_validation_stop()
        env_path = self.directory.parent / "synthetic.env"
        cases = (None, "OTHER_KEY=DO_NOT_ECHO\n", "TWOGIS_API_KEY=\n",
                 "TWOGIS_API_KEY=" + SECRET + "\nTWOGIS_API_KEY=" + SECRET + "\n",
                 'TWOGIS_API_KEY="' + SECRET + "\n", "TWOGIS_API_KEY=$(DO_NOT_EXECUTE)\n")
        for index, content in enumerate(cases):
            with self.subTest(case=index):
                if content is not None:
                    env_path.write_text(content, encoding="utf-8")
                output, errors = io.StringIO(), io.StringIO()
                with patch.object(p, "STATE_DIR", self.directory), \
                     patch.object(finish, "dialog_key") as dialog, \
                     patch.object(finish.getpass, "getpass") as getpass, \
                     patch.object(finish, "run") as run, \
                     contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
                    self.assertEqual(finish.main([
                        "--live", "--approved-plan", finish.FINAL_FOUR_PLAN_HASH,
                        "--approved-ledger", ledger_digest, "--transcript", str(self.transcript),
                        "--approved-transcript", transcript_digest, "--after-item-validation-stop",
                        "--env-file", str(env_path)]), 1)
                run.assert_not_called()
                dialog.assert_not_called()
                getpass.assert_not_called()
                self.assertEqual(self.path.read_bytes(), before)
                self.assertFalse((self.directory / "run.lock").exists())
                self.assertNotIn(SECRET, output.getvalue() + errors.getvalue())
                self.assertNotIn("DO_NOT_EXECUTE", output.getvalue() + errors.getvalue())

    def test_env_file_and_dialog_are_mutually_exclusive(self):
        with patch.object(finish, "dialog_key") as dialog, \
             patch.object(finish, "run") as run, contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as stopped:
                finish.main(["--env-file", "synthetic-unused.env", "--key-dialog"])
            self.assertEqual(stopped.exception.code, 2)
        dialog.assert_not_called()
        run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
