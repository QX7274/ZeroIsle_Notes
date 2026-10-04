"""端点扫描公共脚手架（供三个扫描脚本复用）。

统一处理：mongomock 连接、UUID 编码垫片、登录获取令牌、5xx 统计与退出码。
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
ADMIN_BACKEND = REPO_ROOT / "admin_system" / "backend"


def bootstrap():
    """准备 Django + mongomock 环境，返回已登录的 APIClient。

    注意：这些脚本刻意使用与 admin_system/backend/conftest.py 相同的垫片策略，
    以保证"扫描结果"与"测试结果"基于同一套环境假设。
    """
    sys.path.insert(0, str(ADMIN_BACKEND))
    os.chdir(str(ADMIN_BACKEND))

    import mongomock
    import mongoengine

    _orig_connect = mongoengine.connect

    def _connect(*a, **kw):
        kw["mongo_client_class"] = mongomock.MongoClient
        return _orig_connect(*a, **kw)

    mongoengine.connect = _connect

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "admin_backend.settings")

    import django

    django.setup()

    # mongomock 的 UUID 编码垫片：与 conftest.py 同理（RISK-BE-002 同源问题）
    import bson
    import bson.binary
    import mongomock.collection as mc
    from bson.codec_options import CodecOptions

    codec = CodecOptions(uuid_representation=bson.binary.UuidRepresentation.STANDARD)

    class _B:
        @staticmethod
        def encode(document, check_keys=False, codec_options=None):
            chosen = codec_options
            if chosen is None or getattr(
                chosen, "uuid_representation", None
            ) == bson.binary.UuidRepresentation.UNSPECIFIED:
                chosen = codec
            return bson.BSON.encode(document, check_keys=check_keys, codec_options=chosen)

    mc.BSON = _B

    from django.test.utils import override_settings

    override_settings(ALLOWED_HOSTS=["*", "testserver"]).enable()

    from django.contrib.auth.hashers import make_password
    from rest_framework.test import APIClient
    from users.models import UserProfile

    username = "endpoint_sweep_admin"
    user = UserProfile.objects(username=username).first()
    if user is None:
        user = UserProfile(username=username, email="sweep@example.com")
        user.is_staff = True
        user.save()
    UserProfile.objects(id=user.id).update(password=make_password("Passw0rd!23"))

    client = APIClient()
    resp = client.post(
        "/api/auth/login/",
        {"username": username, "password": "Passw0rd!23"},
        format="json",
    )
    if resp.status_code != 200:
        raise SystemExit(f"登录失败，无法继续扫描：{resp.status_code} {resp.data}")
    client.credentials(HTTP_AUTHORIZATION="Bearer " + resp.data["data"]["access"])

    import warnings

    warnings.filterwarnings("ignore")
    return client


def api_get_paths():
    """枚举所有不含路径参数的 api/ 路由。"""
    from django.urls import get_resolver

    def walk(resolver, prefix=""):
        for pattern in resolver.url_patterns:
            path = prefix + str(pattern.pattern)
            if hasattr(pattern, "url_patterns"):
                yield from walk(pattern, path)
            else:
                yield path

    found = []
    for raw in walk(get_resolver()):
        if not raw.startswith("api/"):
            continue
        if "docs" in raw:
            continue
        clean = raw.replace("^", "").replace("$", "")
        if not clean.startswith("/"):
            clean = "/" + clean
        if "(" in clean:
            continue
        if not clean.endswith("/"):
            clean += "/"
        found.append(clean)
    return sorted(set(found))


def report(title: str, total: int, failures: list) -> int:
    """统一输出与退出码（0 通过 / 1 有 5xx）。"""
    print(f"\n{title}：共 {total} 项，5xx = {len(failures)}")
    for item in failures:
        print("  " + str(item))
    if failures:
        print("[FAIL] 存在 5xx，门禁不通过")
        return 1
    print("[OK] 无 5xx")
    return 0
