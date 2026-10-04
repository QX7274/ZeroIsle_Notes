#!/usr/bin/env python3
"""无参 GET 端点扫描：遍历所有 api/ 路由，要求 0 个 5xx。

这是本轮最有价值的门禁 —— 它一次性发现过 8 个真实 500
（Django ORM 聚合方法、mongoengine 不支持的查询运算符、序列化字段名不匹配等）。
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _admin_sweep_common import api_get_paths, bootstrap, report  # noqa: E402


def main() -> int:
    client = bootstrap()
    paths = api_get_paths()
    if len(paths) < 50:
        raise SystemExit(f"只枚举到 {len(paths)} 个路由，扫描前提不成立")

    failures = []
    for path in paths:
        try:
            resp = client.get(path)
            status = resp.status_code
        except Exception as exc:  # noqa: BLE001
            failures.append(f"EXC {path}: {type(exc).__name__}: {exc}")
            continue
        if status >= 500:
            body = str(getattr(resp, "data", ""))[:200]
            failures.append(f"{status} GET {path} :: {body}")

    return report("无参 GET 端点扫描", len(paths), failures)


if __name__ == "__main__":
    raise SystemExit(main())
