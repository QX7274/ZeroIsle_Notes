"""搜索与查询参数守护：search / ordering / 分页 / filterset_fields 不得导致 5xx。

锁定两类真实缺陷：
  1. DRF 的 SearchFilter 内部构造 django.db.models.Q 并依赖 queryset.model._meta，
     在 mongoengine 上带 ?search= 必抛：
       InvalidQueryError: Not a query object: (OR: ...)
     实测 17 个挂了 SearchFilter 的端点全部 500。现改用 MongoSearchFilter。
  2. filterset_fields 声明了模型上不存在的字段（AnalyticsReport.status），
     带该参数查询时抛 InvalidQueryError: Cannot resolve field "status"。
"""

import importlib

import pytest
from rest_framework.test import APIClient

from common.filters import MongoSearchFilter
from users.models import UserProfile

# (app, 模型名) —— 用于校验 filterset_fields 的字段真实性
MODEL_APPS = ["users", "content", "settings_api", "logs", "sync", "analytics"]

# 带 query 的端点扫描清单
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
    "start_date=2026-01-01&end_date=2026-12-31",
    "keyword=abc",
    "ordering=-nonexistent_field",
    "page=99999",
]


@pytest.fixture(scope="module")
def client():
    from django.contrib.auth.hashers import make_password

    username = "query_smoke_admin"
    user = UserProfile.objects(username=username).first()
    if user is None:
        user = UserProfile(username=username, email="query_smoke@example.com")
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


@pytest.mark.parametrize("path", ENDPOINTS)
def test_search_param_never_500(client, path):
    """每个端点的 ?search= 都必须可用。

    这是本轮最有价值的回归点：修复前 17 个端点全部 500。
    """
    resp = client.get(path + "?search=test")
    if resp.status_code >= 500:
        body = str(getattr(resp, "data", ""))[:250]
        raise AssertionError(f"{path}?search=test 返回 {resp.status_code}；{body}")


@pytest.mark.parametrize("path", ENDPOINTS)
@pytest.mark.parametrize("query", QUERIES)
def test_query_params_never_500(client, path, query):
    """常见查询参数组合不得导致 5xx（4xx 属正常语义）。"""
    resp = client.get(f"{path}?{query}")
    if resp.status_code >= 500:
        body = str(getattr(resp, "data", ""))[:250]
        raise AssertionError(f"{path}?{query} 返回 {resp.status_code}；{body}")


def test_mongo_search_filter_actually_filters():
    """MongoSearchFilter 必须真的按 search_fields 过滤（不是只返回原集）。"""
    UserProfile(username="searchtarget", email="st@example.com").save()

    class _View:
        search_fields = ["username", "email"]

    class _Req:
        query_params = {"search": "searchtarget"}

    qs = UserProfile.objects.all()
    filtered = MongoSearchFilter().filter_queryset(_Req(), qs, _View())
    names = [u.username for u in filtered]
    assert names == ["searchtarget"], names


def test_mongo_search_filter_supports_prefixes():
    """支持 DRF 的 ^（前缀）/ =（精确）前缀约定。"""
    UserProfile(username="prefixuser", email="p@example.com").save()

    class _View:
        search_fields = ["^username"]

    class _Req:
        query_params = {"search": "prefix"}

    qs = UserProfile.objects.all()
    names = [u.username for u in MongoSearchFilter().filter_queryset(_Req(), qs, _View())]
    assert names == ["prefixuser"], names


def test_mongo_search_filter_multi_terms_are_anded():
    """多个搜索词之间是 AND：两个词都对才命中。"""
    UserProfile(username="alphaone", email="a@example.com").save()

    class _View:
        search_fields = ["username"]

    class _Req:
        query_params = {"search": "alpha nonexistent"}

    qs = UserProfile.objects.all()
    assert MongoSearchFilter().filter_queryset(_Req(), qs, _View()).count() == 0


@pytest.mark.parametrize("app", MODEL_APPS)
def test_filterset_fields_exist_on_model(app):
    """filterset_fields 声明的字段必须真实存在于模型上。

    声明了不存在的字段，一带该查询参数就 500
    （本轮实例：AnalyticsReportViewSet 声明了 status，但模型没有该字段）。
    """
    views = importlib.import_module(f"{app}.views")
    models_mod = importlib.import_module(f"{app}.models")

    offenders = []
    for name in dir(views):
        view_cls = getattr(views, name)
        if not isinstance(view_cls, type):
            continue
        fields = getattr(view_cls, "filterset_fields", None)
        if not fields:
            continue
        serializer = getattr(view_cls, "serializer_class", None)
        model = getattr(getattr(serializer, "Meta", None), "model", None)
        if model is None:
            # 回退：从 get_queryset 源码里找 "Xxx.objects"
            try:
                import inspect

                src = inspect.getsource(view_cls.get_queryset)
                for cand in dir(models_mod):
                    if (cand + ".objects") in src:
                        model = getattr(models_mod, cand)
                        break
            except Exception:  # noqa: BLE001
                continue
        if model is None or not hasattr(model, "_fields"):
            continue
        missing = [f for f in fields if f not in model._fields]
        if missing:
            offenders.append(f"{app}.{name} ({model.__name__}): {missing}")

    assert not offenders, (
        "以下 filterset_fields 声明了模型上不存在的字段，"
        "带该参数查询会 500：\n" + "\n".join(offenders)
    )


def test_no_drf_search_filter_left():
    """源码级守护：不得再用 DRF 的 SearchFilter（它构造 Django ORM 的 Q）。"""
    import ast
    import pathlib

    backend = pathlib.Path(__file__).resolve().parents[1]
    offenders = []
    for app in MODEL_APPS:
        path = backend / app / "views.py"
        if not path.exists():
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Attribute) and node.attr == "SearchFilter":
                offenders.append(f"{app}/views.py:{node.lineno}")
    assert not offenders, "以下位置仍使用 DRF SearchFilter：" + str(offenders)