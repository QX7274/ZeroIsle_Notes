"""
Optional virus scanning service using ClamAV (clamd) over TCP.
If ClamAV is not available or scanning is disabled, the functions are no-ops.
"""
from __future__ import annotations

import socket
from typing import Optional
from django.conf import settings


class VirusScanResult:
    def __init__(self, infected: bool, signature: Optional[str] = None, error: Optional[str] = None):
        self.infected = infected
        self.signature = signature
        self.error = error


def clamav_ping(host: str, port: int, timeout: float = 2.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout) as s:
            s.sendall(b"PING\n")
            data = s.recv(64)
            return b"PONG" in data
    except Exception:
        return False


def scan_bytes(data: bytes) -> VirusScanResult:
    enabled = getattr(settings, "DOC_CONVERTER_VIRUS_SCAN", False)
    if not enabled:
        return VirusScanResult(infected=False)

    host = getattr(settings, "CLAMAV_HOST", "127.0.0.1")
    port = int(getattr(settings, "CLAMAV_PORT", 3310))

    try:
        with socket.create_connection((host, port), timeout=3.0) as s:
            s.sendall(b"zINSTREAM\n")
            # send size then chunk
            chunk = data
            size = len(chunk).to_bytes(4, byteorder="big")
            s.sendall(size + chunk)
            # end of stream
            s.sendall((0).to_bytes(4, byteorder="big"))
            result = s.recv(1024).decode("utf-8", errors="ignore")
            # Result example: "stream: OK" or "stream: Eicar-Test-Signature FOUND"
            if "FOUND" in result:
                sig = result.split(":", 1)[-1].strip()
                return VirusScanResult(infected=True, signature=sig)
            return VirusScanResult(infected=False)
    except Exception as e:
        # On scanner errors, be permissive but record the error
        return VirusScanResult(infected=False, error=str(e))

