#!/usr/bin/env python
"""
Android real-device evidence capture script.
1) optionally launch target app
2) capture UI XML
3) capture PNG screenshot
4) save as round-named artifacts under .local/android-mcp-server
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import time
from pathlib import Path

MIN_VALID_PNG_BYTES = 1024


def run_adb(serial: str, *args: str) -> None:
    cmd = ["adb", "-s", serial, *args]
    subprocess.run(cmd, check=True)


def get_foreground_package(serial: str) -> str:
    probes = [
        ["adb", "-s", serial, "shell", "dumpsys", "window", "windows"],
        ["adb", "-s", serial, "shell", "dumpsys", "activity", "top"],
    ]
    for cmd in probes:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            check=False,
        )
        text = (proc.stdout or "") + "\n" + (proc.stderr or "")
        for line in text.splitlines():
            if "mCurrentFocus" in line or "mFocusedApp" in line or "mResumedActivity" in line:
                if "/" in line:
                    pkg = line.split("/", 1)[0].strip().split()[-1]
                    if pkg and "." in pkg:
                        return pkg
    return ""


def ensure_foreground_app(serial: str, package: str, activity: str) -> None:
    current = get_foreground_package(serial)
    if current != package:
        run_adb(serial, "shell", "am", "start", "-n", f"{package}/{activity}")
        time.sleep(1.2)


def run_adb_capture_fallback(serial: str, mcp_dir: Path) -> None:
    remote_candidates = ["/sdcard/window_dump.xml", "/storage/emulated/0/window_dump.xml"]
    pulled = False

    for remote_xml in remote_candidates:
        try:
            for _ in range(3):
                run_adb(serial, "shell", "uiautomator", "dump", remote_xml)
                time.sleep(0.4)
                probe = subprocess.run(
                    ["adb", "-s", serial, "shell", "ls", remote_xml],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="ignore",
                    check=False,
                )
                if probe.returncode == 0 and "No such file" not in (probe.stdout + probe.stderr):
                    break
            run_adb(serial, "pull", remote_xml, str(mcp_dir / "window_dump.xml"))
            pulled = True
            break
        except Exception:
            continue

    if not pulled:
        (mcp_dir / "window_dump.xml").write_text(
            "<hierarchy><node text='UI_DUMP_UNAVAILABLE'/></hierarchy>", encoding="utf-8"
        )

    with (mcp_dir / "screenshot.png").open("wb") as f:
        subprocess.run(["adb", "-s", serial, "exec-out", "screencap", "-p"], check=True, stdout=f)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--round", required=True, help="evidence round name, e.g. round68_group_step1")
    parser.add_argument("--serial", default="HGR3Y9MA", help="device serial")
    parser.add_argument("--package", default="com.zeroisle_notes", help="target package")
    parser.add_argument("--activity", default=".MainActivity", help="target launch activity")
    parser.add_argument("--launch", action="store_true", help="launch target app before capture")
    parser.add_argument("--ensure-foreground", action="store_true", help="ensure target app foreground before capture")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    mcp_dir = repo_root / ".local" / "android-mcp-server"
    py = mcp_dir / ".venv" / "Scripts" / "python.exe"
    manager = mcp_dir / "adbdevicemanager.py"

    if not py.exists() or not manager.exists():
        raise FileNotFoundError("android-mcp-server runtime is missing under .local/android-mcp-server")

    if args.launch:
        run_adb(args.serial, "shell", "am", "start", "-n", f"{args.package}/{args.activity}")
        time.sleep(1.0)

    if args.ensure_foreground:
        ensure_foreground_app(args.serial, args.package, args.activity)

    capture_code = (
        "from adbdevicemanager import AdbDeviceManager\n"
        f"m=AdbDeviceManager('{args.serial}')\n"
        "_=m.get_uilayout()\n"
        "m.take_screenshot()\n"
        "print('ok')\n"
    )

    used_fallback = False
    try:
        subprocess.run([str(py), "-c", capture_code], cwd=str(mcp_dir), check=True)
    except subprocess.CalledProcessError:
        run_adb_capture_fallback(args.serial, mcp_dir)
        used_fallback = True

    screenshot_path = mcp_dir / "screenshot.png"
    if (not used_fallback) and (not screenshot_path.exists() or screenshot_path.stat().st_size < MIN_VALID_PNG_BYTES):
        run_adb_capture_fallback(args.serial, mcp_dir)

    src_xml = mcp_dir / "window_dump.xml"
    src_png = mcp_dir / "screenshot.png"
    dst_xml = mcp_dir / f"{args.round}.xml"
    dst_png = mcp_dir / f"{args.round}.png"
    shutil.copy2(src_xml, dst_xml)
    shutil.copy2(src_png, dst_png)

    print(dst_xml)
    print(dst_png)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
