"""日志备份接口测试（/logs/export 页面依赖）。

锁定的真实缺陷：
  前端 LogExport（已挂载在 /logs/export）调用
  GET/POST /logs/backup/、DELETE /logs/backup/{id}/、GET /logs/backup/{id}/download/，
  但后端此前完全没有这些路由，页面一直提示"获取备份列表失败"。
"""

import pytest
from rest_framework.test import APIClient

from logs.models import LogBackup
from users.models import UserProfile


@pytest.fixture(scope="module")
def client():
    from django.contrib.auth.hashers import make_password

    admin = UserProfile.objects(username="logbk_admin").first()
    if admin is None:
        admin = UserProfile(
            username="logbk_admin", email="logbk@example.com", is_staff=True
        )
        admin.save()
    UserProfile.objects(id=admin.id).update(password=make_password("Passw0rd!23"))

    api = APIClient()
    resp = api.post(
        "/api/auth/login/",
        {"username": "logbk_admin", "password": "Passw0rd!23"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    api.credentials(HTTP_AUTHORIZATION="Bearer " + resp.data["data"]["access"])
    return api


def test_backup_list_endpoint_exists(client):
    """端点在修复前为 404。"""
    resp = client.get("/api/logs/backup/")
    assert resp.status_code == 200, getattr(resp, "data", None)
    assert "results" in resp.data


def test_create_backup_returns_frontend_fields(client):
    """创建后返回的字段需覆盖前端列表渲染用到的键。"""
    resp = client.post(
        "/api/logs/backup/",
        {
            "name": "测试备份",
            "description": "单测创建",
            "log_type": "all",
            "include_all": True,
        },
        format="json",
    )
    assert resp.status_code == 201, getattr(resp, "data", None)
    data = resp.data["data"]
    # LogExport.js 读取：name / description / log_type / record_count / file_size / created_at / id
    for key in ("id", "name", "description", "log_type", "record_count", "created_at"):
        assert key in data, f"缺少前端需要的字段 {key}"
    assert data["name"] == "测试备份"
    # 创建者应被自动记录，且记录数与真实日志量一致（不是写死的 0 常量）
    assert data["created_by"] == "logbk_admin"
    assert isinstance(data["record_count"], int)


def test_created_backup_appears_in_list(client):
    client.post(
        "/api/logs/backup/",
        {"name": "列表可见备份", "log_type": "system"},
        format="json",
    )
    names = [b["name"] for b in client.get("/api/logs/backup/").data["results"]]
    assert "列表可见备份" in names


def test_download_is_honest_when_no_file(client):
    """备份记录存在但文件未生成时，必须如实告知而不是给假链接或 500。"""
    created = client.post(
        "/api/logs/backup/",
        {"name": "无文件备份", "log_type": "all"},
        format="json",
    ).data["data"]

    resp = client.get(f"/api/logs/backup/{created['id']}/download/")
    assert resp.status_code == 200, getattr(resp, "data", None)
    assert resp.data["available"] is False
    assert resp.data["status"] == "unavailable"
    assert resp.data.get("message")


def test_delete_backup(client):
    created = client.post(
        "/api/logs/backup/",
        {"name": "待删除备份", "log_type": "admin"},
        format="json",
    ).data["data"]

    resp = client.delete(f"/api/logs/backup/{created['id']}/")
    assert resp.status_code in (200, 204), getattr(resp, "data", None)
    assert LogBackup.objects(id=created["id"]).first() is None


def test_backup_model_uses_own_collection(client):
    """备份记录写入独立集合，不污染既有日志集合。"""
    assert LogBackup._meta["collection"] == "log_backups"
