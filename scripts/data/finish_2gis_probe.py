"""Finish the approved remaining 2GIS probe slots without interactive review.

Default is an offline dry run. Preserve five prior attempts for slots 5-9,
or six prior attempts for the final-four continuation through slots 6-9.
"""

import argparse
import copy
import getpass
import hashlib
import json
from pathlib import Path
import re
import sys
import time
import warnings

try:
    from . import probe_2gis as p
except ImportError:
    import probe_2gis as p


FINISH_PLAN = {
    "version": 1, "original_plan_sha256": p.PLAN_HASH,
    "recovery_plan_sha256": p.RECOVERY_PLAN_HASH,
    "eligible_stop": "five received slots [1,1,2,3,4]; RELEVANCE_REVIEW_STOPPED",
    "slots": [5, 6, 7, 8, 9], "max_additional_attempts": 5,
    "max_total_attempts": 10,
    "policy": "one continuation; transcript-reviewed corrected anchors; no retries; relevance unassessed",
}
FINISH_PLAN_HASH = hashlib.sha256(
    json.dumps(FINISH_PLAN, sort_keys=True).encode()).hexdigest()
FINAL_FOUR_PLAN = {
    "version": 1, "original_plan_sha256": p.PLAN_HASH,
    "previous_continuation_sha256": FINISH_PLAN_HASH,
    "eligible_stop": "six attempts [1,1,2,3,4,5]; slot 5 reserved; item validation stop",
    "slots": [6, 7, 8, 9], "max_additional_attempts": 4,
    "max_total_attempts": 10,
    "policy": "one final continuation; preserve failed slot 5; no retries; relevance unassessed",
}
FINAL_FOUR_PLAN_HASH = hashlib.sha256(
    json.dumps(FINAL_FOUR_PLAN, sort_keys=True).encode()).hexdigest()
ITEM_STOP_CODES = {"INVALID_ITEM", "INVALID_ITEM_OBJECT", "INVALID_ITEM_ID", "INVALID_ITEM_NAME"}


def approved_bytes(path, digest, code):
    if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise p.ProbeError(code)
    try:
        with Path(path).open("rb") as stream:
            raw = stream.read(p.MAX_BYTES + 1)
    except OSError:
        raise p.ProbeError(code) from None
    if len(raw) > p.MAX_BYTES or hashlib.sha256(raw).hexdigest() != digest:
        raise p.ProbeError(code)
    return raw


def read_anchors(path, digest):
    """Extract two reviewed rows, never execute or persist transcript content."""
    raw = approved_bytes(path, digest, "TRANSCRIPT_CHANGED")
    try:
        transcript = raw.decode("utf-8-sig")
    except UnicodeError:
        raise p.ProbeError("INVALID_ANCHOR_TRANSCRIPT") from None
    # PowerShell wrapping can split a decimal coordinate across physical lines.
    number = r"(-?\d[\d.\r\n ]*)"
    point = r"\{'lat':\s*" + number + r",\s*'lon':\s*" + number + r"\}"
    patterns = {
        "A": r"(?m)^1 Mega Silk Way, торгово-развлекательный центр branch "
             r"\['Торгово-развлекательные центры'\]\s*" + point,
        "B": r"(?m)^1 Монумент-Бәйтерек branch "
             r"\['Смотровые площадки', 'Интересные здания'\]\s*" + point,
    }
    anchors = {}
    for label, pattern in patterns.items():
        matches = re.findall(pattern, transcript)
        if len(matches) != 1:
            raise p.ProbeError("INVALID_ANCHOR_TRANSCRIPT")
        try:
            lat, lon = (float(re.sub(r"\s", "", value)) for value in matches[0])
            anchors[label] = p.coordinate((lon, lat))
        except (ValueError, p.ProbeError):
            raise p.ProbeError("INVALID_ANCHOR_TRANSCRIPT") from None
        if p.distance(p.CENTER, anchors[label]) > 15000:
            raise p.ProbeError("INVALID_ANCHOR_TRANSCRIPT")
    return anchors


class FinishLedger(p.Ledger):
    """Append-only exception bound to a reviewed ledger and transcript."""

    def __init__(self, directory, approved_ledger, approved_transcript,
                 after_item_validation_stop=False):
        super().__init__(directory, recover_anchor_stop=approved_ledger)
        self.approved_transcript = approved_transcript
        self.after_item_validation_stop = after_item_validation_stop

    def prepare_recovery(self):
        if (not isinstance(self.approved_transcript, str) or
            not re.fullmatch(r"[0-9a-f]{64}", self.approved_transcript) or
            any((self.directory / name).exists() for name in ("ledger.json", "ledger.tmp"))):
            raise p.ProbeError("CONTINUATION_NOT_ELIGIBLE")
        raw = approved_bytes(self.path, self.recover_anchor_stop, "CONTINUATION_LEDGER_CHANGED")
        try:
            lines = raw.splitlines(keepends=True)
            if not raw.endswith(b"\n") or len(lines) < 5:
                raise p.ProbeError("CONTINUATION_NOT_ELIGIBLE")
            history = [json.loads(line) for line in lines]
            if self.after_item_validation_stop:
                self.prepare_final_four(history, lines)
                return
            last = self.validate_five_stop(history, lines)
        except (UnicodeError, ValueError, KeyError, TypeError, IndexError):
            raise p.ProbeError("CONTINUATION_NOT_ELIGIBLE") from None
        self.data = copy.deepcopy(last)
        for name in ("error", "failure_status", "finished_at"):
            self.data.pop(name, None)
        self.data["status"] = "running"
        self.data["continuation"] = {
            "plan_sha256": FINISH_PLAN_HASH,
            "prior_ledger_sha256": self.recover_anchor_stop,
            "transcript_sha256": self.approved_transcript,
            "prior_attempts": 5, "max_additional_attempts": 5,
            "started_at": p.now(),
            "anchor_review": "A retained; B corrected from namesake to monument candidate 1 in supplied transcript",
            "relevance_policy": "unassessed; all uncertain; no human assessment",
        }

    @staticmethod
    def validate_five_stop(history, lines):
        """Validate the originally reviewed five-attempt stop without mutation."""
        try:
            last = history[-1]
            attempts = last["attempts"]
            recovery = last["recovery"]
            if (last["plan_sha256"] != p.PLAN_HASH or last["status"] != "stopped" or
                last["error"] != "RELEVANCE_REVIEW_STOPPED" or
                last.get("failure_status") != {} or last["skipped_slots"] != [10] or
                len(attempts) != 5 or [a["slot"] for a in attempts] != [1, 1, 2, 3, 4] or
                any(type(a["slot"]) is not int or a["status"] != "received" or
                    a["summary"]["http_status"] != 200 or a["summary"]["api_code"] != 200
                    for a in attempts) or
                recovery["plan_sha256"] != p.RECOVERY_PLAN_HASH or
                recovery["prior_attempts"] != 1 or recovery["max_additional_attempts"] != 9 or
                hashlib.sha256(b"".join(lines[:4])).hexdigest() != recovery["prior_ledger_sha256"] or
                history[3]["attempts"] != attempts[:1] or
                history[3]["error"] != "ANCHOR_REVIEW_STOPPED" or
                any("continuation" in snapshot or "final_four" in snapshot for snapshot in history)):
                raise p.ProbeError("CONTINUATION_NOT_ELIGIBLE")
        except (UnicodeError, ValueError, KeyError, TypeError, IndexError):
            raise p.ProbeError("CONTINUATION_NOT_ELIGIBLE") from None
        return last

    def prepare_final_four(self, history, lines):
        """Admit exactly the failed first dispatch of the previous continuation."""
        if any("final_four" in snapshot for snapshot in history):
            raise p.ProbeError("CONTINUATION_NOT_ELIGIBLE")
        positions = [i for i, snapshot in enumerate(history) if "continuation" in snapshot]
        if len(positions) != 3 or positions != list(range(len(history) - 3, len(history))):
            raise p.ProbeError("CONTINUATION_NOT_ELIGIBLE")
        start = positions[0]
        prior = self.validate_five_stop(history[:start], lines[:start])
        last = history[-1]
        continuation = last["continuation"]
        attempts = last["attempts"]
        if (continuation["plan_sha256"] != FINISH_PLAN_HASH or
            continuation["prior_attempts"] != 5 or continuation["max_additional_attempts"] != 5 or
            continuation["transcript_sha256"] != self.approved_transcript or
            continuation["prior_ledger_sha256"] != hashlib.sha256(b"".join(lines[:start])).hexdigest() or
            len(attempts) != 6 or attempts[:5] != prior["attempts"] or
            type(attempts[5]["slot"]) is not int or attempts[5]["slot"] != 5 or
            attempts[5]["status"] != "reserved" or
            set(attempts[5]) != {"slot", "reserved_at", "status"} or
            not isinstance(attempts[5]["reserved_at"], str) or
            last["status"] != "stopped" or last["error"] not in ITEM_STOP_CODES or
            last.get("failure_status") != {}):
            raise p.ProbeError("CONTINUATION_NOT_ELIGIBLE")
        base = copy.deepcopy(prior)
        for name in ("error", "failure_status", "finished_at"):
            base.pop(name, None)
        base.update(status="running", continuation=continuation)
        reserved = {**base, "attempts": attempts}
        stopped = {**reserved, "status": "stopped", "error": last["error"],
                   "failure_status": {}, "finished_at": last["finished_at"]}
        if history[start:] != [base, reserved, stopped]:
            raise p.ProbeError("CONTINUATION_NOT_ELIGIBLE")
        self.data = copy.deepcopy(reserved)
        self.data["final_four"] = {
            "plan_sha256": FINAL_FOUR_PLAN_HASH,
            "prior_ledger_sha256": self.recover_anchor_stop,
            "transcript_sha256": self.approved_transcript,
            "prior_attempts": 6, "max_additional_attempts": 4,
            "started_at": p.now(), "failed_slot_5": "counted; not repeated; cause unverified",
        }


def run(key, ledger, anchors, transport=p.fetch, sleep=time.sleep):
    """Dispatch only remaining approved slots; no discovery or review prompts."""
    ids_by_slot = {}
    try:
        slots = (FINAL_FOUR_PLAN if ledger.after_item_validation_stop else FINISH_PLAN)["slots"]
        for slot in slots:
            p.parameters(slot, anchors)
            if slot != slots[0]:
                sleep(p.INTERVAL)
            ledger.reserve(slot)
            payload = transport(slot, anchors, key)
            summary, items, ids = p.summarize_probe(payload, slot, anchors)
            if slot == 8:
                summary["overlap_with_slot_7"] = len(ids & ids_by_slot[7])
            summary["unassessed_relevance"] = {
                "relevant": 0, "irrelevant": 0, "uncertain": len(items),
            }
            ledger.finish(summary)
            ids_by_slot[slot] = ids
            del payload, items
        ledger.data["status"] = "completed"
    except (Exception, KeyboardInterrupt) as error:
        ledger.data["status"] = "stopped"
        ledger.data["error"] = p.failure(error)
        ledger.data["failure_status"] = p.failure_status(error)
    ledger.data["finished_at"] = p.now()
    ledger.save()
    return 0 if ledger.data["status"] == "completed" else 1


def dialog_key(max_additional_attempts=5):
    """Native masked entry; never put the key in a command line or environment."""
    import tkinter
    from tkinter import simpledialog
    root = tkinter.Tk()
    root.withdraw()
    try:
        return simpledialog.askstring(
            "Qadam 2GIS probe", f"Paste the 2GIS key. At most {max_additional_attempts} more attempts (10 total).",
            show="*", parent=root)
    finally:
        root.destroy()


def env_file_key(path):
    """Read just TWOGIS_API_KEY; no expansion, environment updates, or logging."""
    try:
        with Path(path).open("rb") as stream:
            raw = stream.read(65537)
        if len(raw) > 65536:
            raise p.ProbeError("INVALID_KEY_FILE")
        lines = raw.decode("utf-8-sig").splitlines()
    except (OSError, UnicodeError):
        raise p.ProbeError("INVALID_KEY_FILE") from None
    found = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export ") or line.startswith("export\t"):
            line = line[6:].lstrip()
        if not re.match(r"TWOGIS_API_KEY(?:\s|=|$)", line):
            continue
        match = re.fullmatch(r"TWOGIS_API_KEY\s*=\s*(.*)", line)
        if match is None:
            raise p.ProbeError("INVALID_KEY_FILE")
        value = match[1].strip()
        if value and value[0] in ("'", '"'):
            if len(value) < 2 or value[-1] != value[0]:
                raise p.ProbeError("INVALID_KEY_FILE")
            value = value[1:-1]
        if not re.fullmatch(r"[A-Za-z0-9_-]+", value):
            raise p.ProbeError("INVALID_KEY_FILE")
        found.append(value)
    if len(found) != 1:
        raise p.ProbeError("INVALID_KEY_FILE")
    return found[0]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--approved-plan")
    parser.add_argument("--approved-ledger")
    parser.add_argument("--transcript", type=Path)
    parser.add_argument("--approved-transcript")
    key_source = parser.add_mutually_exclusive_group()
    key_source.add_argument("--key-dialog", action="store_true")
    key_source.add_argument("--env-file", type=Path)
    parser.add_argument("--after-item-validation-stop", action="store_true")
    args = parser.parse_args(argv)
    plan = FINAL_FOUR_PLAN if args.after_item_validation_stop else FINISH_PLAN
    plan_hash = FINAL_FOUR_PLAN_HASH if args.after_item_validation_stop else FINISH_PLAN_HASH
    if not args.live:
        print(json.dumps({"mode": "dry_run", "network_requests": 0,
                          "plan_sha256": plan_hash, "plan": plan}, indent=2))
        return 0
    if args.approved_plan != plan_hash or args.transcript is None:
        print("LIVE_APPROVAL_REQUIRED", file=sys.stderr)
        return 2
    if not args.key_dialog and args.env_file is None and (not sys.stdin.isatty() or not sys.stdout.isatty()):
        print("INTERACTIVE_TERMINAL_REQUIRED", file=sys.stderr)
        return 2
    try:
        anchors = read_anchors(args.transcript, args.approved_transcript)
        # Preflight without changing state; __enter__ repeats under its lock.
        ledger = FinishLedger(p.STATE_DIR, args.approved_ledger, args.approved_transcript,
                              after_item_validation_stop=args.after_item_validation_stop)
        ledger.prepare_recovery()
        if args.env_file is not None:
            key = env_file_key(args.env_file)
        elif args.key_dialog:
            key = dialog_key(plan["max_additional_attempts"])
        else:
            with warnings.catch_warnings():
                warnings.simplefilter("error", getpass.GetPassWarning)
                key = getpass.getpass("2GIS key (hidden; never saved): ")
        if key is None:
            print("KEY_ENTRY_CANCELLED")
            return 1
        key = key.strip()
        if not re.fullmatch(r"[A-Za-z0-9_-]+", key):
            raise p.ProbeError("INVALID_KEY_INPUT")
        with ledger:
            result = run(key, ledger, anchors)
            del key
            print(json.dumps(ledger.data, indent=2))
            return result
    except (Exception, KeyboardInterrupt) as error:
        print(p.failure(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
