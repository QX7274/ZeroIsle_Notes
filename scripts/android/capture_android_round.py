#!/usr/bin/env python
"""
Android真机取证脚本：
1) 可选拉起目标应用
2) 抓取UI布局XML
3) 抓取截图PNG
4) 按 round 名称统一落盘到 .local/android-mcp-server
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path


def run_adb(serial: str, *args: str) -> None:
    cmd = ["adb", "-s", serial, *args]
    subprocess.run(cmd, check=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--round", required=True, help="证据轮次名称，例如 round44_sync_online_retry")
    parser.add_argument("--serial", default="HGR3Y9MA", help="设备序列号")
    parser.add_argument("--package", default="com.zeroisle_notes", help="应用包名")
    parser.add_argument("--activity", default=".MainActivity", help="应用启动Activity")
    parser.add_argument("--launch", action="store_true", help="抓取前先拉起应用")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    mcp_dir = repo_root / ".local" / "android-mcp-server"
    py = mcp_dir / ".venv" / "Scripts" / "python.exe"
    manager = mcp_dir / "adbdevicemanager.py"

    if not py.exists() or not manager.exists():
        raise FileNotFoundError("android-mcp-server 运行环境不存在，请先确认 .local/android-mcp-server 已正确安装")

    if args.launch:
        run_adb(args.serial, "shell", "am", "start", "-n", f"{args.package}/{args.activity}")

    # 通过 adbdevicemanager 生成 window_dump.xml / screenshot.png
    capture_code = (
        "from adbdevicemanager import AdbDeviceManager\n"
        f"m=AdbDeviceManager('{args.serial}')\n"
        "_=m.get_uilayout()\n"
        "m.take_screenshot()\n"
        "print('ok')\n"
    )
    subprocess.run([str(py), "-c", capture_code], cwd=str(mcp_dir), check=True)

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

