#!/usr/bin/env python3
"""管理后台（admin_system）后端门禁：把本地已验证的检查固化为可复现的一条命令。

为什么需要它：
这些检查此前只在开发机上手工跑过，CI 完全没有覆盖 admin_system ——
于是"导出接口用 Django 的 Q"、"SearchFilter 在 mongoengine 上不可用"、
"前端 pageSize 被静默忽略" 这类缺陷只能靠下一轮人工排查才发现。
本脚本把它们固化成门禁，可在 CI 与本地以同一条命令复现。

它做什么（全部无需真实 MongoDB，用 mongomock）：
  1. manage.py check        —— Django 配置/URLConf 自检；
  2. pytest                 —— 后端全量测试；
  3. 端点扫描（三类）        —— 无参 GET / 写路径 / 查询参数，要求 0 个 5xx。

用法：
    python scripts/check_admin_backend.py            # 全部检查
    python scripts/check_admin_backend.py --quick    # 跳过端点扫描（只跑 check+pytest）

退出码：0 全部通过；1 有检查失败。
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
ADMIN_BACKEND = REPO_ROOT / "admin_system" / "backend"


def _python() -> str:
    """优先用 conda 环境 ZeroIsle（本仓库既定的验收环境），否则回退当前解释器。"""
    conda = Path("/opt/anaconda3/envs/ZeroIsle/bin/python")
    if conda.exists():
        return str(conda)
    env_python = os.environ.get("ADMIN_PYTHON")
    if env_python and Path(env_python).exists():
        return env_python
    return sys.executable


def run(cmd, cwd, desc):
    print(f"\n===== {desc} =====", flush=True)
    print("$ " + " ".join(str(c) for c in cmd), flush=True)
    proc = subprocess.run([str(c) for c in cmd], cwd=str(cwd))
    if proc.returncode != 0:
        print(f"[FAIL] {desc} 退出码 {proc.returncode}", flush=True)
        return False
    print(f"[OK] {desc}", flush=True)
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--quick", action="store_true", help="跳过端点扫描")
    args = parser.parse_args()

    if not ADMIN_BACKEND.is_dir():
        print(f"[ERROR] 未找到 admin_system/backend：{ADMIN_BACKEND}", file=sys.stderr)
        return 1

    py = _python()
    print(f"使用解释器：{py}")
    ok = True

    # 1) Django 自检
    ok &= run([py, "-X", "utf8", "manage.py", "check"], ADMIN_BACKEND, "manage.py check")

    # 2) 后端测试（含端点冒烟、查询参数、分页契约、字段对齐等全部回归网）
    ok &= run([py, "-X", "utf8", "-m", "pytest", "-q"], ADMIN_BACKEND, "pytest（后端全量）")

    # 3) 端点扫描：三类，要求 0 个 5xx
    if not args.quick:
        sweeps = [
            ("scripts/sweep_endpoints_get.py", "无参 GET 端点扫描"),
            ("scripts/sweep_endpoints_write.py", "写路径端点扫描"),
            ("scripts/sweep_endpoints_query.py", "查询参数端点扫描"),
        ]
        for rel, desc in sweeps:
            path = REPO_ROOT / "scripts" / Path(rel).name
            if not path.exists():
                print(f"[SKIP] 未找到 {path}（该扫描暂未提供）", flush=True)
                continue
            ok &= run([py, "-X", "utf8", str(path)], REPO_ROOT, desc)

    print("\n" + "=" * 60)
    print("管理后台后端门禁：" + ("全部通过" if ok else "存在失败项"))
    print("=" * 60)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
