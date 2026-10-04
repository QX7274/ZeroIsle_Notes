"""mongoengine 与 DRF/django_filters 的兼容工具。

问题
----
管理后台的 ViewSet 普遍用两种写法：
  1. queryset = [] 作为占位（注释写着"避免导入阶段触发 MongoDB 连接"）；
  2. filter_backends 里挂 DjangoFilterBackend + filterset_fields。

这两者组合会必然 500，原因是 django_filters 的 AutoFilterSet 会访问：
    model = queryset.model
而：
  - [] 是 list，没有 .model → AttributeError: list object has no attribute model；
  - 即便是 mongoengine QuerySet，也没有 Django ORM 意义上的 .model，
    且 django_filters 会按 ORM 字段语义去解析 mongoengine 的字段名，方向本身就不对。

实测：/api/analytics/templates/ 与 /api/analytics/reports/ 等接口在登录后仍返回 500。
审计发现共有 11 个 ViewSet 处于该组合下（analytics/content/logs/settings_api/users）。

解决方式
--------
提供 MongoFilterBackend：继承 DRF 的 BaseFilterBackend，
按请求里的查询参数，用 mongoengine 的语法（field=value 与 field__in=）过滤，
完全不依赖 Django ORM 的 .model 与字段解析。

各 ViewSet 只需把 DjangoFilterBackend 换成它即可，
filterset_fields 的语义（"允许按这些字段精确过滤"）保持不变。
"""

from __future__ import annotations

import logging

from rest_framework.filters import BaseFilterBackend

logger = logging.getLogger(__name__)


class MongoFilterBackend(BaseFilterBackend):
    """用 mongoengine 语法实现的过滤后端，替代 DjangoFilterBackend。

    只处理 filterset_fields 中声明的字段，行为与 django_filters 的
    "精确匹配"语义一致；额外支持 ?field__in=a,b 形式的多值过滤。
    """

    #: 允许被过滤的字段来源（与 ViewSet 上 django_filters 用的属性名保持一致）
    fields_attr = "filterset_fields"

    def get_schema_operation_parameters(self, view):
        """让 API 文档能列出过滤参数（保持与 DjangoFilterBackend 相近的体验）。"""
        params = []
        for field in getattr(view, self.fields_attr, []) or []:
            params.append({
                "name": field,
                "required": False,
                "in": "query",
                "description": f"按 {field} 精确过滤",
                "schema": {"type": "string"},
            })
        return params

    def filter_queryset(self, request, queryset, view):
        allowed = set(getattr(view, self.fields_attr, []) or [])
        if not allowed:
            return queryset

        params = getattr(request, "query_params", None) or getattr(request, "GET", {})
        lookup = {}

        for raw_key, raw_value in params.items():
            if raw_value in (None, ""):
                continue

            # 支持 field__in=a,b,c
            if raw_key.endswith("__in"):
                field = raw_key[: -len("__in")]
                if field not in allowed:
                    continue
                values = [v.strip() for v in str(raw_value).split(",") if v.strip()]
                if values:
                    lookup[f"{field}__in"] = values
                continue

            if raw_key not in allowed:
                continue

            value = raw_value
            # 布尔字符串需要转成布尔，否则按字符串比较永远不匹配
            if isinstance(value, str) and value.lower() in ("true", "false"):
                value = value.lower() == "true"
            lookup[raw_key] = value

        if not lookup:
            return queryset

        try:
            return queryset.filter(**lookup)
        except Exception as exc:  # noqa: BLE001
            # 过滤条件非法时不要让整个请求 500：记录后忽略该条件
            logger.warning("MongoFilterBackend 过滤失败，已忽略条件 %s：%s", lookup, exc)
            return queryset
