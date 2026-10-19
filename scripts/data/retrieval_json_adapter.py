"""One UTF-8 JSON request on stdin, one JSON result on stdout, no network.

Default app-v1 mode rejects collected/private snapshots. --mode offline explicitly
returns a separate protocol that cannot pass the existing application validator.
"""
import argparse
from pathlib import Path
import sys

try:
    from scripts.data import retrieve_saved_places as r
except ModuleNotFoundError:
    import retrieve_saved_places as r


MAX_INPUT_BYTES = 16 * 1024
MAX_OUTPUT_BYTES = 512 * 1024


class QuietParser(argparse.ArgumentParser):
    def error(self, message):
        raise r.RetrievalError("INVALID_INPUT")


def run(raw, *, snapshot, annotations, binding, mode="app-v1"):
    if mode not in {"app-v1", "offline"} or len(raw) > MAX_INPUT_BYTES:
        raise r.RetrievalError("INVALID_INPUT")
    try:
        request = r.parse(raw)
    except r.RetrievalError:
        raise r.RetrievalError("INVALID_INPUT") from None
    request = r.validate_request(request)
    saved = r.load_snapshot(snapshot, annotations, binding)
    if mode == "app-v1" and saved.kind != "synthetic":
        raise r.RetrievalError("DATA_UNAVAILABLE")
    result = r.retrieve(request, saved)
    return r.offline_envelope(result) if mode == "offline" else r.synthetic_app_result(result)


def main(argv=None, stdin=None, stdout=None):
    stdin = stdin if stdin is not None else sys.stdin.buffer
    stdout = stdout if stdout is not None else sys.stdout.buffer
    parser = QuietParser(description=__doc__, add_help=False)
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--annotations", type=Path, required=True)
    parser.add_argument("--binding", type=Path, required=True)
    parser.add_argument("--mode", choices=("app-v1", "offline"), default="app-v1")
    try:
        args = parser.parse_args(argv)
        raw = stdin.read(MAX_INPUT_BYTES + 1)
        result = run(raw, **vars(args))
        encoded = r.c.encoded(result)
        if len(encoded) + 1 > MAX_OUTPUT_BYTES:
            raise r.RetrievalError("DATA_INVALID")
    except r.RetrievalError as error:
        code = str(error)
        if code not in {"DATA_INVALID", "DATA_UNAVAILABLE", "INVALID_INPUT", "UNSUPPORTED_MODE"}:
            code = "DATA_INVALID"
        encoded = r.c.encoded({"status": "error", "code": code})
    except (OSError, ValueError, TypeError, KeyError, RecursionError):
        encoded = r.c.encoded({"status": "error", "code": "DATA_INVALID"})
    stdout.write(encoded + b"\n")
    return 0  # Typed errors must survive Node's subprocess adapter.


if __name__ == "__main__":
    raise SystemExit(main())
