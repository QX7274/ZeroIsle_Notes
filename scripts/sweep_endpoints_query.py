#!/usr/bin/env python3
"""查询参数扫描：给端点带上搜索/排序/分页/日期等参数，要求 0 个 5xx。

锁定过的真实缺陷：
  - DRF SearchFilter 构造 django.db.models.Q，在 mongoengine 上带 ?search= 必 500；
  - filterset_fields 声明了模型上不存在的字段。
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _admin_sweep_common import bootstrap, report  # noqa: E402

ENDPOINTS = [
    "/api/users/profiles/",
    "/api/users/activities/",
    "/api/content/categories/",
    "/api/content/tags/",
    "/api/content/notes/",
    "/api/content/comments/",
    "/api/content/attachments/",
    "/api/content/reports/",
    "/api/settings/system/",
    "/api/settings/announcements/",
    "/api/settings/backups/",
    "/api/logs/admin-logs/",
    "/api/logs/system-logs/",
    "/api/logs/export-history/",
    "/api/sync/records/",
    "/api/sync/configs/",
    "/api/analytics/reports/",
    "/api/analytics/widgets/",
    "/api/analytics/templates/",
]

QUERIES = [
    "search=test",
    "ordering=-created_at",
    "ordering=created_at",
    "page=1&page_size=5",
    "page=1&pageSize=5",
    "start_date=2026-01-01&end_date=2026-12-31",
    "keyword=abc",
    "ordering=-nonexistent_field",
    "page=99999",
]


def main() -> int:
    client = bootstrap()
    failures = []
    total = 0
    for path in ENDPOINTS:
        for query in QUERIES:
            total += 1
            url = path + "?" + query
            try:
                resp = client.get(url)
                status = resp.status_code
            except Exception as exc:  # noqa: BLE001
                failures.append(f"EXC GET {url}: {type(exc).__name__}: {exc}")
                continue
            if status >= 500:
                body = str(getattr(resp, "data", ""))[:200]
                failures.append(f"{status} GET {url} :: {body}")

    return report("查询参数扫描", total, failures)


if __name__ == "__main__":
    raise SystemExit(main())
