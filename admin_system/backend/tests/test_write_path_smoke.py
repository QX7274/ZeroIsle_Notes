"""写路径冒烟：对可写端点发请求，断言不出现 5xx。

为什么需要它：上一轮的端点冒烟只覆盖无参 GET。
写路径更容易 500 —— 序列化器的 create/update、mongoengine 校验、
引用字段赋值都在这条链上。

本轮靠它发现并修掉了一类系统性缺陷：
  视图用 except Exception 包住整个处理流程并把异常转成 500，
  于是 DRF 的 ValidationError（数据不合法，本应 400）被吞成 500，
  把客户端错误伪装成服务端故障。共 40 处，分布在 7 个文件。
"""

import pytest
from rest_framework.test import APIClient

from users.models import UserProfile

# 各集合的 list 路由：对它们 POST 空 body，用于触发校验路径
WRITE_ENDPOINTS = [
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


@pytest.fixture(scope="module")
def client():
    """登录后的 APIClient（module 作用域，避免重复建用户撞唯一索引）。"""
    from django.contrib.auth.hashers import make_password

    username = "write_smoke_admin"
    user = UserProfile.objects(username=username).first()
    if user is None:
        user = UserProfile(username=username, email="write_smoke@example.com")
        user.is_staff = True
        user.save()
    UserProfile.objects(id=user.id).update(password=make_password("Passw0rd!23"))

    api = APIClient()
    resp = api.post(
        "/api/auth/login/",
        {"username": username, "password": "Passw0rd!23"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    api.credentials(HTTP_AUTHORIZATION="Bearer " + resp.data["data"]["access"])
    return api


@pytest.mark.parametrize("path", WRITE_ENDPOINTS)
def test_post_empty_body_never_returns_5xx(client, path):
    """空 body 的 POST 不允许返回 5xx。

    正确语义是 400（校验失败）或 405（方法不允许）；
    返回 5xx 说明校验异常被 except Exception 吞掉并转成了服务端错误。
    """
    resp = client.post(path, {}, format="json")
    if resp.status_code >= 500:
        body = str(getattr(resp, "data", ""))[:300]
        raise AssertionError(f"{path} 返回 {resp.status_code}；body={body}")


def test_validation_error_is_not_swallowed_into_500(client):
    """回归：数据不合法必须得到 4xx，而不是 500。

    以日志导出历史为例 —— 它缺少必填的 log_type/format，
    修复前会返回 500 并带上"该字段是必填项"的校验信息（自相矛盾）。
    """
    resp = client.post("/api/logs/export-history/", {}, format="json")
    assert resp.status_code < 500, (
        "校验失败被转成了 " + str(resp.status_code)
    )
    assert resp.status_code in (400, 405, 403), resp.status_code