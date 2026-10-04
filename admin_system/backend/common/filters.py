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
from rest_framework.pagination import PageNumberPagination

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


class MongoSearchFilter(BaseFilterBackend):
    """用 mongoengine 语法实现的搜索后端，替代 DRF 的 SearchFilter。

    为什么不能用 DRF 自带的 SearchFilter：
    它内部会构造 Django ORM 的 Q 对象并依赖 queryset.model._meta，
    而本项目的 queryset 是 mongoengine QuerySet。实测带 ?search= 请求时抛：
        InvalidQueryError: Not a query object: (OR: ('title__icontains', 'x'), ...)
        Did you intend to use key=value?
    即 **每个挂了 SearchFilter 的接口一旦使用搜索就 500**（本轮实测 17 个端点全中）。

    行为对齐：读取 view.search_fields（与 DRF 同名），
    默认用 icontains 做 OR 模糊匹配，支持 DRF 的前缀约定：
        ^  前缀匹配（startswith）
        =  精确匹配（exact）
        $  正则匹配（regex）
        @  全文检索（本项目未启用，按 icontains 处理）
    多个搜索词之间为 AND（与 DRF 一致）。
    """

    search_param = "search"

    # 与 DRF SearchFilter.lookup_prefixes 保持一致的前缀语义
    lookup_prefixes = {
        "^": "istartswith",
        "=": "iexact",
        "$": "iregex",
        "@": "icontains",  # 未启用全文检索，退化为包含匹配
    }

    def get_search_fields(self, view, request):
        return getattr(view, "search_fields", None)

    def get_search_terms(self, request):
        """按空格/逗号切分搜索词（与 DRF 行为一致）。"""
        params = request.query_params.get(self.search_param, "")
        params = params.replace("\x00", "").replace(",", " ")
        return [t for t in params.split() if t]

    def construct_search(self, field_name, search_term):
        """把 search_fields 条目转换成一个 mongoengine 查询条件。

        返回 (lookup_string, value)，可直接喂给 queryset.filter(**{lookup: value})。
        """
        if field_name and field_name[0] in self.lookup_prefixes:
            lookup = self.lookup_prefixes[field_name[0]]
            field_name = field_name[1:]
        else:
            lookup = "icontains"
        return f"{field_name}__{lookup}", search_term

    def filter_queryset(self, request, queryset, view):
        search_fields = self.get_search_fields(view, request)
        search_terms = self.get_search_terms(request)
        if not search_fields or not search_terms:
            return queryset

        from mongoengine.queryset.visitor import Q as MongoQ

        try:
            # 每个词内部 OR，词与词之间 AND（与 DRF 语义一致）
            combined = None
            for term in search_terms:
                term_q = None
                for field in search_fields:
                    lookup, value = self.construct_search(field, term)
                    piece = MongoQ(**{lookup: value})
                    term_q = piece if term_q is None else (term_q | piece)
                if term_q is None:
                    continue
                combined = term_q if combined is None else (combined & term_q)
            if combined is None:
                return queryset
            return queryset.filter(combined)
        except Exception as exc:  # noqa: BLE001
            # 搜索条件非法（例如字段不存在）时不要让请求 500：
            # 记 warning 并忽略搜索条件，返回未过滤结果。
            logger.warning("MongoSearchFilter 搜索失败，已忽略搜索条件：%s", exc)
            return queryset

    def get_schema_operation_parameters(self, view):
        return [
            {
                "name": self.search_param,
                "required": False,
                "in": "query",
                "description": "模糊搜索（多个词以空格分隔，词间为 AND）",
                "schema": {"type": "string"},
            }
        ]


class MongoPageNumberPagination(PageNumberPagination):
    """分页类：同时接受 page_size 与 pageSize 两种参数名。

    为什么需要它：
    DRF 的 PageNumberPagination 只认 query 参数 `page_size`（下划线），
    而本项目管理后台前端统一发送 **camelCase 的 pageSize**
    （见 admin_system/frontend/src/services/userService.js 与各页面）。
    两者对不上，导致前端传的每页条数被**静默忽略**，永远返回默认的 10 条 ——
    用户翻到第 2 页仍只看到 10 条，且没有任何报错，属于很难发现的集成缺陷。

    这里同时接受两种写法，与前端现有调用保持一致；
    并对 page_size 做上限约束，避免一次性拉取过多数据。
    """

    page_size_query_param = "page_size"
    max_page_size = 200

    def get_page_size(self, request):
        params = getattr(request, "query_params", None) or getattr(request, "GET", {})
        # 前端用小驼峰；若只给了 pageSize，则临时映射成 page_size 走父类逻辑
        if params.get(self.page_size_query_param) in (None, ""):
            camel = params.get("pageSize")
            if camel not in (None, ""):
                try:
                    mutable = request.query_params.copy()
                except Exception:  # noqa: BLE001
                    mutable = None
                if mutable is not None:
                    mutable[self.page_size_query_param] = camel
                    request._request.GET = mutable
                    try:
                        request.query_params._mutable = True
                        request.query_params[self.page_size_query_param] = camel
                    except Exception:  # noqa: BLE001
                        pass
        size = super().get_page_size(request)
        # 非法或超限时回退到默认值，绝不因为一个坏参数让请求 500
        if not isinstance(size, int) or size <= 0:
            return self.page_size
        return min(size, self.max_page_size)
