"""ViewSet 可服务性守护：防止 queryset 占位与过滤器组合再次导致 500。

锁定两个真实缺陷：
  1. `queryset = []` 占位 + DRF 的 list/retrieve 会调 order_by()/filter()
     -> AttributeError: list object has no attribute order_by -> 500；
  2. `DjangoFilterBackend` 需要 queryset.model（Django ORM 概念），
     对 list 或 mongoengine QuerySet 都会失败
     -> AttributeError: list object has no attribute model -> 500。

审计时共有 11 个 ViewSet 命中组合 (2)，9 个命中 (1)，
分布在 analytics / content / logs / settings_api / users / sync 六个 app。
"""

import ast
import importlib
import inspect
import os
import pathlib

import pytest

BACKEND_DIR = pathlib.Path(__file__).resolve().parents[1]

# 需要检查的 app 与它们的 views 文件
VIEW_MODULES = [
    "analytics.views",
    "content.views",
    "logs.views",
    "settings_api.views",
    "sync.views",
    "users.views",
]


def _viewset_classes():
    """收集所有 DRF **ModelViewSet** 子类。

    只收 ModelViewSet：只有它自带 list/retrieve，才会去调用
    queryset.order_by()/filter()，因此也只有它会因空占位而 500。
    普通 ViewSet（如 AnalyticsViewSet）自己实现 action，不适用本断言。
    """
    from rest_framework import viewsets

    found = []
    for mod_name in VIEW_MODULES:
        try:
            mod = importlib.import_module(mod_name)
        except Exception:  # noqa: BLE001
            continue
        for name, obj in vars(mod).items():
            if (
                inspect.isclass(obj)
                and issubclass(obj, viewsets.ModelViewSet)
                and obj is not viewsets.ModelViewSet
                and obj.__module__ == mod_name
            ):
                found.append((mod_name, name, obj))
    return found


VEWSETS = _viewset_classes()


def test_found_viewset_classes():
    """前提检查：确实收集到了 ModelViewSet（否则下面的断言会变成空转）。"""
    assert len(VEWSETS) >= 8, f"只收集到 {len(VEWSETS)} 个 ModelViewSet，测试前提不成立"


@pytest.mark.parametrize("mod_name,cls_name,cls", VEWSETS,
                         ids=[f"{m}.{c}" for m, c, _ in VEWSETS])
def test_listable_viewset_has_usable_queryset(mod_name, cls_name, cls):
    """可列表的 ViewSet 必须能提供一个可用于 order_by/filter 的查询集。

    占位的 `queryset = []`（或 None）会让 DRF 在 list 时崩。
    正确做法是提供真正的 QuerySet，或实现 get_queryset()。
    """
    queryset = getattr(cls, "queryset", None)
    has_get_queryset = callable(getattr(cls, "get_queryset", None))

    # 占位 list（或 None）必须由 get_queryset() 兜底
    is_placeholder = queryset is None or (
        isinstance(queryset, list) and len(queryset) == 0
    )
    if is_placeholder:
        assert has_get_queryset, (
            f"{cls_name} 的 queryset 是空占位（{queryset!r}）且没有实现 get_queryset()，",
            "DRF 在 list 时会调用 order_by()/filter() 而崩溃（500）。",
            "请提供真正的 QuerySet 或实现 get_queryset()。"
        )


@pytest.mark.parametrize("mod_name,cls_name,cls", VEWSETS,
                         ids=[f"{m}.{c}" for m, c, _ in VEWSETS])
def test_no_django_filter_backend_on_mongoengine_viewset(mod_name, cls_name, cls):
    """不得在 mongoengine 视图集上使用 DjangoFilterBackend。

    它要求 queryset.model（Django ORM 概念），对本项目的查询集会 500。
    应使用 common.filters.MongoFilterBackend。
    """
    backends = getattr(cls, "filter_backends", []) or []
    names = [getattr(b, "__name__", str(b)) for b in backends]
    assert "DjangoFilterBackend" not in names, (
        f"{cls_name} 仍使用 DjangoFilterBackend：{names}；",
        "该项目查询集是 mongoengine 的，没有 .model 属性，会导致 500。"
    )


def test_mongo_filter_backend_works_on_queryset():
    """MongoFilterBackend 必须真的能按字段过滤（不是只换个名字）。"""
    from common.filters import MongoFilterBackend
    from content.models import Tag

    Tag(name="alpha").save()
    Tag(name="beta").save()

    class _View:
        filterset_fields = ["name"]

    class _Req:
        query_params = {"name": "alpha"}

    qs = Tag.objects.all()
    filtered = MongoFilterBackend().filter_queryset(_Req(), qs, _View())
    names = [t.name for t in filtered]
    assert names == ["alpha"], names


def test_mongo_filter_backend_ignores_undeclared_fields():
    """未在 filterset_fields 中声明的参数应被忽略，而不是报错。"""
    from common.filters import MongoFilterBackend
    from content.models import Tag

    Tag(name="gamma").save()

    class _View:
        filterset_fields = ["name"]

    class _Req:
        query_params = {"nonexistent_field": "x"}

    qs = Tag.objects.all()
    result = MongoFilterBackend().filter_queryset(_Req(), qs, _View())
    assert result.count() == qs.count()


def test_mongo_filter_backend_supports_in_lookup():
    """支持 field__in=a,b 形式的多值过滤。"""
    from common.filters import MongoFilterBackend
    from content.models import Tag

    Tag(name="d1").save()
    Tag(name="d2").save()
    Tag(name="d3").save()

    class _View:
        filterset_fields = ["name"]

    class _Req:
        query_params = {"name__in": "d1,d3"}

    result = MongoFilterBackend().filter_queryset(_Req(), Tag.objects.all(), _View())
    names = sorted(t.name for t in result)
    assert names == ["d1", "d3"], names
