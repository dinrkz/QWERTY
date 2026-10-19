"""Isolated, network-disabled entry point for the private offline interface."""
from pathlib import Path
import socket
import sys


def deny_network(*args, **kwargs):
    raise OSError("Offline retrieval does not permit network access")


class OfflineSocket(socket.socket):
    connect = deny_network
    connect_ex = deny_network
    sendto = deny_network
    sendmsg = deny_network


socket.socket = OfflineSocket
socket.create_connection = deny_network
socket.getaddrinfo = deny_network
# -I ignores PYTHONPATH and user site packages. Only this repository is added.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts.data.retrieval_json_adapter import main

if __name__ == "__main__":
    raise SystemExit(main())
