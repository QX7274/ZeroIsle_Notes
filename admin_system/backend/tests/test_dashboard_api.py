"""仪表盘接口测试（Dashboard 首页的数据来源）。

锁定的真实缺陷：
  前端 Dashboard 调用 `GET /stats/dashboard`，但后端从来没有该路由，
  因此登录后的首页一直"加载失败"，所有卡片只能显示占位值。

本测试同时锁定"字段契约"：Dashboard.js 读取哪些字段，本用例就断言哪些字段，
避免后端改字段名而前端静默显示 0。
"""

import pytest
from rest_framework.test import APIClient

from content.models import Attachment, Comment, Note, NoteVersion, Tag
from users.models import UserProfile


@pytest.fixture(scope="module")
def client():
    from django.contrib.auth.hashers import make_password

    admin = UserProfile.objects(username="dash_admin").first()
    if admin is None:
        admin = UserProfile(username="dash_admin", email="dash@example.com", is_staff=True)
        admin.save()
    UserProfile.objects(id=admin.id).update(password=make_password("Passw0rd!23"))

    # 造一点数据，让统计不为全 0（能验证聚合方向正确）
    if not Note.objects(title="dash_note").first():
        Note(title="dash_note", content="x", user_id="dash-user-1").save()
    dash_note = Note.objects(title="dash_note").first()
    if not Tag.objects(name="dash_tag").first():
        Tag(name="dash_tag").save()
    if not Comment.objects(content="dash_comment").first():
        Comment(content="dash_comment", user_id="dash-user-1", note=dash_note).save()
    if not Attachment.objects(filename="dash_f.png").first():
        Attachment(filename="dash_f.png", file_path="/tmp/dash_f.png", file_type="image", user_id="dash-user-1").save()

    api = APIClient()
    resp = api.post(
        "/api/auth/login/",
        {"username": "dash_admin", "password": "Passw0rd!23"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    api.credentials(HTTP_AUTHORIZATION="Bearer " + resp.data["data"]["access"])
    return api


def test_dashboard_endpoint_exists(client):
    """端点必须存在（修复前为 404）。"""
    resp = client.get("/api/stats/dashboard/")
    assert resp.status_code == 200, getattr(resp, "data", None)


def test_dashboard_returns_fields_frontend_reads(client):
    """严格按 Dashboard.js 实际读取的字段断言。"""
    data = client.get("/api/stats/dashboard/").data

    for key in (
        "totalUsers", "todayNewUsers", "totalNotes", "todayNewNotes",
        "totalTags", "totalComments", "recentUsers",
        "contentDistribution", "userGrowthData", "userActivityData",
        "systemStatus",
    ):
        assert key in data, f"缺少 Dashboard 需要的字段: {key}"


def test_content_distribution_shape(client):
    """contentDistribution 需含饼图用到的 5 个键。"""
    dist = client.get("/api/stats/dashboard/").data["contentDistribution"]
    for key in ("notes", "images", "audio", "video", "documents"):
        assert key in dist, f"contentDistribution 缺少 {key}"


def test_growth_and_activity_series_shape(client):
    """折线图需要 {dates, values} 且长度一致。"""
    data = client.get("/api/stats/dashboard/").data
    for key in ("userGrowthData", "userActivityData"):
        series = data[key]
        assert "dates" in series and "values" in series
        assert len(series["dates"]) == len(series["values"]) == 7, key


def test_recent_users_rows_have_table_columns(client):
    """最近注册用户表格读取 username/email/createdAt/status。"""
    rows = client.get("/api/stats/dashboard/").data["recentUsers"]
    assert isinstance(rows, list)
    assert rows, "应至少有一条用户（测试已创建管理员）"
    for row in rows:
        for key in ("id", "username", "email", "createdAt", "status"):
            assert key in row, f"recentUsers 行缺少 {key}"
        assert row["status"] in ("active", "inactive")


def test_counts_reflect_real_data(client):
    """计数应基于真实集合，而不是固定常量。"""
    data = client.get("/api/stats/dashboard/").data
    assert data["totalUsers"] == UserProfile.objects.count()
    assert data["totalNotes"] == Note.objects.count()
    assert data["totalTags"] == Tag.objects.count()
    assert data["totalComments"] == Comment.objects.count()


def test_system_status_does_not_fabricate_metrics(client):
    """系统状态不得编造 CPU/磁盘数据。

    本项目是应用后端，不采集宿主机指标；若返回一个看似真实的数字，
    运维会据此误判。因此 cpu/disk 必须为 null，并有显式说明。
    """
    st = client.get("/api/stats/dashboard/").data["systemStatus"]
    assert st["cpu"] is None, "不应编造 CPU 使用率"
    assert st["disk"] is None, "不应编造磁盘使用率"
    assert st["metrics_available"] is False
    assert "metrics_note" in st and st["metrics_note"]


def test_note_versions_endpoint_exists(client):
    """笔记版本历史端点（NoteDetail 页面使用）必须存在。"""
    note = Note.objects(title="dash_note").first()
    resp = client.get(f"/api/content/notes/{note.id}/versions/")
    assert resp.status_code == 200, getattr(resp, "data", None)
    assert "results" in resp.data


def test_note_version_model_uses_shared_collection(client):
    """NoteVersion 必须指向主后端同一个 note_versions 集合且主键口径一致。"""
    assert NoteVersion._meta["collection"] == "note_versions"
    assert NoteVersion._fields["id"]._binary is True
