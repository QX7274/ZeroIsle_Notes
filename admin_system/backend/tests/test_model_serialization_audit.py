"""运行时审计：逐个实例化并序列化每个管理后台模型，捕获未声明字段导致的 500。

为什么用"序列化"而不是"静态扫源码"：
  - 500 的真实触发点是"代码读取了未声明字段"；
  - 静态扫描无法区分 obj.field（危险）与 self.helper()（无害），噪声极大；
  - 直接构造每个 Document 并跑一遍它的序列化器，能用最少假设覆盖真实路径。

本文件既是审计手段，也是长期回归网：任何模型再出现"读未声明字段"都会在此暴露。
"""

import importlib
import inspect

import pytest
from django.utils import timezone

from common.serializers import MongoDocumentSerializer

# 供需要"真实时间"的 required DateTimeField 使用（如 SyncStatistics.date）
_now = timezone.now()

# app -> [(model_name, serializer_name)]，序列化器为 None 表示仅构造模型
MODELS = {
    "users": ["UserProfile", "UserActivity", "VerificationCode"],
    "content": ["NoteCategory", "Tag", "ContentReport", "Note", "Comment", "Attachment"],
    "settings_api": ["SystemSetting", "Announcement", "SystemBackup"],
    "logs": ["AdminOperationLog", "SystemLog", "LogExportHistory"],
    "sync": ["SyncRecord", "SyncConfig", "SyncStatistics"],
    "analytics": ["AnalyticsReport", "DashboardWidget", "ReportTemplate"],
    "auth_api": ["AdminLoginLog"],
}

# 每个模型"看起来像实例"的最小声构造参数（必填字段）
REQUIRED = {
    "UserProfile": {"username": "audit_user", "email": "audit@example.com"},
    "UserActivity": {"activity_type": "audit"},
    "VerificationCode": {"code": "123456", "purpose": "login", "expires_at": None},
    "NoteCategory": {"name": "audit_cat"},
    "Tag": {"name": "audit_tag"},
    "ContentReport": {"content_id": "c1", "content_type": "note", "reporter_id": "u1", "reason": "spam"},
    "Note": {"title": "audit_note", "content": "x"},
    "Comment": {"content": "audit_comment"},
    "Attachment": {"filename": "f.txt", "file_path": "/tmp/f.txt"},
    "SystemSetting": {"key": "audit_key"},
    "Announcement": {"title": "audit_ann"},
    "SystemBackup": {"name": "audit_backup"},
    "AdminOperationLog": {"admin_username": "a", "ip_address": "127.0.0.1", "module": "m", "action": "create", "description": "d"},
    "SystemLog": {"level": "info", "message": "m"},
    "LogExportHistory": {"log_type": "system", "format": "csv"},
    "SyncRecord": {"sync_type": "users"},
    # SyncConfig 的主键就是 key（primary_key=True），不是 config_key
    "SyncConfig": {"key": "audit", "value": "v"},
    # SyncStatistics.date 是 required=True，必须给真实时间
    "SyncStatistics": {"date": _now},
    "AnalyticsReport": {"title": "audit_report", "report_type": "user", "created_by": "a"},
    "DashboardWidget": {"title": "w", "widget_type": "chart", "created_by": "a"},
    "ReportTemplate": {"title": "t", "template_type": "user", "created_by": "a"},
    "AdminLoginLog": {"username": "a", "ip_address": "127.0.0.1", "user_agent": "ua"},
}


def _all_serializers():
    """收集所有 MongoDocumentSerializer 子类，按 Meta.model 归类。"""
    found = {}
    for app in MODELS:
        try:
            mod = importlib.import_module(f"{app}.serializers")
        except Exception:  # noqa: BLE001
            continue
        for _name, obj in vars(mod).items():
            if (
                inspect.isclass(obj)
                and issubclass(obj, MongoDocumentSerializer)
                and obj is not MongoDocumentSerializer
            ):
                model = getattr(getattr(obj, "Meta", None), "model", None)
                if model is not None:
                    found.setdefault(model.__name__, []).append(obj)
    return found


SERIALIZERS = _all_serializers()


@pytest.mark.parametrize("app,model_name", [
    (app, m) for app, models in MODELS.items() for m in models
])
def test_model_can_be_instantiated_and_serialized(app, model_name):
    """构造模型并用其全部序列化器渲染 —— 任何未声明字段的读取都会在此暴露。"""
    mod = importlib.import_module(f"{app}.models")
    model_cls = getattr(mod, model_name)

    kwargs = dict(REQUIRED.get(model_name, {}))
    instance = model_cls(**kwargs)

    # 不落库：只验证属性访问与序列化不抛异常
    for ser_cls in SERIALIZERS.get(model_name, []):
        try:
            ser_cls(instance).data
        except Exception as exc:  # noqa: BLE001
            raise AssertionError(
                f"{app}.{model_name} 用 {ser_cls.__name__} 序列化失败："
                f"{type(exc).__name__}: {exc}"
            ) from exc


@pytest.mark.parametrize("app,model_name", [
    (app, m) for app, models in MODELS.items() for m in models
])
def test_model_declared_fields_are_all_readable(app, model_name):
    """模型声明的每个字段都必须能被读取（含 sparse/required 缺省的情形）。"""
    mod = importlib.import_module(f"{app}.models")
    model_cls = getattr(mod, model_name)
    instance = model_cls(**dict(REQUIRED.get(model_name, {})))

    for field_name in model_cls._fields:
        try:
            getattr(instance, field_name)
        except Exception as exc:  # noqa: BLE001
            raise AssertionError(
                f"{app}.{model_name}.{field_name} 读取失败："
                f"{type(exc).__name__}: {exc}"
            ) from exc
