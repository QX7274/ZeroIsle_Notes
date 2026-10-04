"""
管理后台后端「可运行性」回归测试（阶段2）。

这些用例锁定本轮修复的两个启动阻塞问题，防止再次回退：

1. `admin_backend/urls.py` 曾在导入期使用 DRF `include_docs_urls`（依赖 coreapi），
   导致 `manage.py check` / `runserver` / `migrate` 全部崩溃。
2. 各 app 的序列化器曾用 DRF `ModelSerializer` 绑定 mongoengine `Document`，
   实例化即抛 `AttributeError: 'MetaDict' object has no attribute 'concrete_model'`。
"""

import importlib
import inspect

import pytest
from django.urls import get_resolver, reverse

from common.serializers import MongoDocumentSerializer


# 使用 mongoengine Document 的 app（auth_api 面向 Django ORM User，不在其列）
MONGO_SERIALIZER_APPS = ["users", "content", "logs", "settings_api", "sync", "analytics"]


def test_urlconf_imports_without_coreapi():
    """URLConf 必须能在无 coreapi 的环境下导入（回归：启动阻塞）。"""
    urls = importlib.import_module("admin_backend.urls")
    assert hasattr(urls, "urlpatterns")
    assert len(urls.urlpatterns) > 0


def test_docs_route_uses_drf_yasg_not_coreapi():
    """API 文档路由必须可反向解析，且不再依赖 DRF CoreAPI。"""
    assert reverse("admin-api-docs") == "/api/docs/"

    # 用 AST 检查真实导入语句，避免被注释文本误伤
    import ast

    import admin_backend.urls as urls_mod

    tree = ast.parse(inspect.getsource(urls_mod))
    imported = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            for alias in node.names:
                imported.add(f"{node.module}.{alias.name}")
        elif isinstance(node, ast.Import):
            for alias in node.names:
                imported.add(alias.name)

    assert "rest_framework.documentation.include_docs_urls" not in imported, (
        "不应再使用依赖 coreapi 的 include_docs_urls"
    )
    assert "drf_yasg.views.get_schema_view" in imported, "API 文档应改用 drf_yasg"


def test_every_mongo_serializer_instantiates():
    """所有 mongoengine 序列化器都必须能实例化并产出 fields（回归：MetaDict）。"""
    failures = []
    checked = 0
    for app in MONGO_SERIALIZER_APPS:
        mod = importlib.import_module(f"{app}.serializers")
        for name, obj in vars(mod).items():
            if (
                inspect.isclass(obj)
                and issubclass(obj, MongoDocumentSerializer)
                and obj is not MongoDocumentSerializer
            ):
                checked += 1
                try:
                    fields = obj().fields
                    assert len(fields) > 0, f"{app}.{name} 未产出任何字段"
                except Exception as exc:  # noqa: BLE001
                    failures.append(f"{app}.{name}: {type(exc).__name__}: {exc}")
    assert checked >= 30, f"预期至少 30 个 mongoengine 序列化器，实际 {checked}"
    assert not failures, "以下序列化器实例化失败：\n" + "\n".join(failures)


def test_django_orm_serializer_kept_on_model_serializer():
    """面向 Django ORM 模型的序列化器必须继续使用 DRF ModelSerializer。"""
    from rest_framework import serializers as drf

    from auth_api.serializers import UserSerializer

    assert issubclass(UserSerializer, drf.ModelSerializer)
    assert not issubclass(UserSerializer, MongoDocumentSerializer)


def test_choice_display_fields_resolve_display_names():
    """mongoengine 不生成 get_xxx_display，基类必须能补出显示名。"""
    from rest_framework import serializers as drf

    from content.models import ContentReport

    class ReportSerializer(MongoDocumentSerializer):
        reason_display = drf.CharField(source="get_reason_display", read_only=True)

        class Meta:
            model = ContentReport
            fields = ["id", "reason", "reason_display"]

    obj = ContentReport(content_id="c1", content_type="note", reporter_id="u1", reason="spam")
    data = ReportSerializer(obj).data
    assert data["reason"] == "spam"
    assert data["reason_display"] == "垃圾信息"


def test_core_api_routes_are_reachable():
    """核心接口必须存在且可反向解析（冒烟）。"""
    assert reverse("login") == "/api/auth/login/"
    assert reverse("check-auth") == "/api/auth/check/"
    assert reverse("user-profile-list").endswith("/api/users/profiles/")
    assert reverse("note-list").endswith("/api/content/notes/")
