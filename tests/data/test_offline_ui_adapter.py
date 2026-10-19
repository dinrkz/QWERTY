"""Offline interface child checks use authored fixtures, never provider calls."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from tests.data.saved_retrieval_fixtures import write_fixture, request

ROOT = Path(__file__).resolve().parents[2]
ENTRY = ROOT / "scripts/data/offline_ui_adapter.py"


class OfflineUiAdapterTests(unittest.TestCase):
    def test_isolated_entrypoint_reads_synthetic_snapshot_without_provider_environment(self):
        scratch = ROOT / 'data/runtime/offline-ui-tests'
        scratch.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as tmp:
            self.assertTrue(Path(tmp).resolve().is_relative_to(scratch.resolve()))
            config = write_fixture(tmp)
            argv = [sys.executable, "-I", "-B", str(ENTRY), "--mode", "offline"]
            for key, path in config.items():
                argv += ["--" + key, str(path)]
            env = {key: value for key, value in os.environ.items()
                   if key.upper() in {"PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP"}}
            result = subprocess.run(argv, input=json.dumps(request()).encode(), stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE, env=env, timeout=15, cwd=tmp)
            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stderr, b"")
            parsed = json.loads(result.stdout)
            self.assertEqual(parsed["status"], "offline_evaluation")
            self.assertEqual(parsed["result"]["dataset_kind"], "synthetic")
            self.assertEqual(len(parsed["result"]["candidates"]), 1)

    def test_entrypoint_blocks_socket_connections_and_dns_without_contacting_network(self):
        code = """import runpy, socket, sys
runpy.run_path(sys.argv[1], run_name='offline_guard_test')
checks = [lambda: socket.getaddrinfo('example.invalid', 443),
          lambda: socket.create_connection(('example.invalid', 443))]
with socket.socket() as sock:
    checks.extend([lambda: sock.connect(('127.0.0.1', 1)),
                   lambda: sock.connect_ex(('127.0.0.1', 1)),
                   lambda: sock.sendto(b'x', ('127.0.0.1', 1))])
    for check in checks:
        try: check()
        except OSError as error: assert 'does not permit' in str(error)
        else: raise AssertionError('Network guard did not reject operation')
print('5 network operations blocked before I/O')
"""
        result = subprocess.run([sys.executable, "-I", "-B", "-c", code, str(ENTRY)],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=15)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stderr, b"")
        self.assertIn(b"5 network operations blocked", result.stdout)


if __name__ == "__main__":
    unittest.main()
