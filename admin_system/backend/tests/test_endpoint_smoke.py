"""全量端点冒烟：登录后遍历所有无参 GET 路由，确保没有 5xx。

这是本轮最有价值的回归网 —— 它一次性发现了 8 个真实 500：
  - Django ORM 聚合方法用在 mongoengine 上：
      values_list(flat=True) / values() / annotate()  -> AttributeError
  - mongoengine 不支持的查询运算符：
      operation_time__hour  -> InvalidQueryError: Cannot resolve ... hour
      last_login__isnull    -> InvalidQueryError: Cannot resolve ... isnull
  - 视图构造的 dict 与序列化器声明字段名不一致：
      KeyError when attempting to get a value for field new_users_today

单测容易漏掉这些，因为它们的共同前提是"把整个请求真的走一遍"。
因此这里用 APIClient 遍历真实路由。
"""

import pytest
from django.urls import get_resolver
from rest_framework.test import APIClient

from users.models import UserProfile


def _iter_api_get_paths():
    """枚举所有不含路径参数的 api/ GET 路由。"""

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
        # 跳过带路径参数的路由：需要真实对象 id，噪声大
        if "(" in clean:
            continue
        if not clean.endswith("/"):
            clean += "/"
        found.append(clean)
    return sorted(set(found))


API_PATHS = _iter_api_get_paths()


def test_path_discovery_found_routes():
    """前提检查：确实枚举到了路由，否则下面的冒烟会空转。"""
    assert len(API_PATHS) >= 50, f"只枚举到 {len(API_PATHS)} 个路由，测试前提不成立"


@pytest.fixture(scope="module")
def admin_client():
    """登录后返回带凭据的 APIClient。

    用 module 作用域：mongomock 的内存库在整个测试进程内共享，
    若每个用例都重新创建同名用户会撞 users.username 唯一索引
    （NotUniqueError），与端点是否可用无关。登录一次即可复用。
    """
    from django.contrib.auth.hashers import make_password

    username = "smoke_admin"
    user = UserProfile.objects(username=username).first()
    if user is None:
        user = UserProfile(username=username, email="smoke@example.com")
        user.is_staff = True
        user.save()
    UserProfile.objects(id=user.id).update(password=make_password("Passw0rd!23"))

    client = APIClient()
    resp = client.post(
        "/api/auth/login/",
        {"username": username, "password": "Passw0rd!23"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    client.credentials(HTTP_AUTHORIZATION="Bearer " + resp.data["data"]["access"])
    return client


@pytest.mark.parametrize("path", API_PATHS)
def test_no_server_error_on_get(admin_client, path):
    """任一管理后台 GET 接口都不得返回 5xx。

    4xx（含 401/403/405）是允许的：那属于鉴权或方法不允许的正常语义，
    本用例只关心服务端是否崩了。
    """
    resp = admin_client.get(path)
    if resp.status_code >= 500:
        body = str(getattr(resp, "data", ""))[:300]
        raise AssertionError(f"{path} 返回 {resp.status_code}；body={body}")
