#!/usr/bin/env python3
"""写路径扫描：对可写端点 POST 空 body，要求 0 个 5xx。

锁定过的真实缺陷：视图用 except Exception 把 DRF 的 ValidationError
（数据不合法，应 400）吞成 500。
空 body 触发校验路径，正确语义是 400/405，绝不应该是 5xx。
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _admin_sweep_common import bootstrap, report  # noqa: E402

ENDPOINTS = [
    "/api/users/profiles/",
    "/api/content/categories/",
    "/api/content/tags/",
    "/api/content/notes/",
    "/api/content/comments/",
    "/api/content/attachments/",
    "/api/content/reports/",
    "/api/settings/system/",
    "/api/settings/announcements/",
    "/api/settings/backups/",
    "/api/logs/export-history/",
    "/api/sync/configs/",
    "/api/analytics/reports/",
    "/api/analytics/widgets/",
    "/api/analytics/templates/",
]


def main() -> int:
    client = bootstrap()
    failures = []
    for path in ENDPOINTS:
        try:
            resp = client.post(path, {}, format="json")
            status = resp.status_code
        except Exception as exc:  # noqa: BLE001
            failures.append(f"EXC POST {path}: {type(exc).__name__}: {exc}")
            continue
        if status >= 500:
            body = str(getattr(resp, "data", ""))[:200]
            failures.append(f"{status} POST {path} :: {body}")

    return report("写路径扫描（POST 空 body）", len(ENDPOINTS), failures)


if __name__ == "__main__":
    raise SystemExit(main())
