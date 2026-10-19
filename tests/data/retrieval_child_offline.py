"""Test harness: deny network in the real Python JSON adapter child."""
import runpy
from pathlib import Path
import socket
import sys
import urllib.request


def forbidden(*args, **kwargs):
    raise AssertionError("NETWORK_FORBIDDEN")


socket.socket = forbidden
socket.create_connection = forbidden
urllib.request.urlopen = forbidden
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
sys.argv = sys.argv[1:]
runpy.run_path(sys.argv[0], run_name="__main__")
