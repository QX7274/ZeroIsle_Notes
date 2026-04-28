"""
搜索服务
"""

import logging
import time
import jieba
import re
from datetime import datetime
from mongoengine.queryset.visitor import Q

from django.utils import timezone
from django.core.cache import cache
from search.mongodb_models import SearchIndex, SearchQuery, SearchResult
from .suggestion_service import SuggestionService
from .enhanced_vector_service import EnhancedVectorService

logger = logging.getLogger('backend')

class SearchService:
    """
    搜索服务类
    处理搜索的业务逻辑
    """

    def __init__(self):
        """初始化"""
        self.suggestion_service = SuggestionService()
        self.vector_service = EnhancedVectorService.get_instance()

        # 初始化结巴分词
        jieba.initialize()

    def search(self, query, user, filters=None, page=1, page_size=20, use_vector=False):
        """
        搜索

        Args:
            query: 查询内容
            user: 用户对象
            filters: 过滤条件
            page: 页码
            page_size: 每页大小
            use_vector: 是否使用向量搜索

        Returns:
            dict: 搜索结果
        """
        start_time = time.time()

        try:
            # 参数验证和安全限制
            page = max(1, int(page))
            page_size = min(100, max(1, int(page_size)))  # 限制最大100条

            # 验证filters
            if filters:
                filters = self._validate_filters(filters)
            # 创建搜索查询记录
            search_query = SearchQuery(
                user=user,
                query=query,
                filters=filters or {}
            )
            search_query.save()

            # 分词
            tokens = self._tokenize(query)

            # 构建查询条件
            base_query = self._build_base_query(user, filters)

            # 执行搜索
            if use_vector and query:
                # 向量搜索
                vector = self.vector_service.generate_vector(query)
                results, total = self._vector_search(base_query, vector, tokens, page, page_size)
            else:
                # 关键词搜索
                sort = (filters or {}).get('sort') if isinstance(filters, dict) else None
                results, total = self._keyword_search(base_query, tokens, page, page_size, sort=sort)

            # 记录搜索结果
            self._record_search_results(search_query, results)

            # 更新搜索建议（仅当有结果时）
            if query and len(results) > 0:
                self.suggestion_service.add_suggestion(query, user)

            # 计算执行时间
            duration = time.time() - start_time

            # 更新查询记录
            search_query.result_count = int(total or 0)
            search_query.execution_time = duration
            search_query.save()

            # 构建响应
            response = {
                'query': query,
                'filters': filters or {},
                'total': int(total or 0),
                'duration': duration,
                'page': page,
                'page_size': page_size,
                'results': results,
                'has_more': (page * page_size) < int(total or 0),
                'total_pages': (int(total or 0) + page_size - 1) // page_size
            }

            return response
        except Exception as e:
            logger.error(f"搜索失败: {e}")
            raise

    def get_recent_searches(self, user, limit=10):
        """
        获取最近搜索

        Args:
            user: 用户对象
            limit: 限制数量

        Returns:
            list: 最近搜索列表
        """
        try:
            recent_searches = SearchQuery.objects.filter(
                user=user
            ).order_by('-created_at')[:limit]

            result = []
            for item in recent_searches:
                result.append({
                    'id': str(item.id),
                    'query': item.query,
                    'result_count': item.result_count,
                    'created_at': item.created_at.isoformat() if item.created_at else None,
                })
            return result
        except Exception as e:
            logger.error(f"获取最近搜索失败: {e}")
            raise

    def get_popular_searches(self, limit=10, window=None, min_count=1):
        """
        获取热门搜索

        Args:
            limit: 限制数量

        Returns:
            list: 热门搜索列表
        """
        try:
            # 使用MongoDB聚合管道
            # 简单缓存，避免频繁聚合
            cache_key = f"popular_searches:{window}:{limit}:{min_count}"
            cached = cache.get(cache_key)
            if cached is not None:
                return cached

            match_stage = None
            if window:
                # 解析窗口，如 '7d', '30d', '12h'
                try:
                    unit = window[-1]
                    value = int(window[:-1])
                    delta = None
                    if unit == 'd':
                        delta = timezone.timedelta(days=value)
                    elif unit == 'h':
                        delta = timezone.timedelta(hours=value)
                    elif unit == 'm':
                        delta = timezone.timedelta(minutes=value)
                    if delta is not None:
                        start_time = timezone.now() - delta
                        match_stage = {"$match": {"created_at": {"$gte": start_time}}}
                except Exception:
                    # 无法解析则忽略窗口
                    match_stage = None

            pipeline = []
            if match_stage:
                pipeline.append(match_stage)
            pipeline.extend([
                {"$group": {"_id": "$query", "count": {"$sum": 1}}},
                {"$match": {"count": {"$gte": int(min_count)}}},
                {"$sort": {"count": -1}},
                {"$limit": int(limit)},
                {"$project": {"query": "$_id", "count": 1, "_id": 0}}
            ])

            popular_searches = list(SearchQuery.objects.aggregate(*pipeline))
            # 缓存60秒
            cache.set(cache_key, popular_searches, timeout=60)
            return popular_searches
        except Exception as e:
            logger.error(f"获取热门搜索失败: {e}")
            raise

    def clear_search_history(self, user):
        """
        清除搜索历史

        Args:
            user: 用户对象

        Returns:
            int: 删除数量
        """
        try:
            deleted = SearchQuery.objects.filter(user=user).delete()
            return deleted
        except Exception as e:
            logger.error(f"清除搜索历史失败: {e}")
            raise

    def _tokenize(self, query):
        """
        分词

        Args:
            query: 查询内容
        Returns:
            list: 分词结果
        """
        if not query:
            return []

        # 使用结巴分词
        tokens = jieba.cut_for_search(query)
        return [token for token in tokens if token.strip()]

    def _normalize_query(self, query: str) -> str:
        """
        规范化查询文本并进行基本校验。
        - 去首尾空白、折叠连续空白
        - 转为小写（英文场景去重）
        - 长度<=100，且至少包含一个中英文或数字字符
        返回规范化后的文本；无效则返回空字符串。
        """
        import re
        if query is None:
            return ""
        norm = re.sub(r"\s+", " ", str(query).strip()).lower()
        if not re.search(r"[A-Za-z0-9\u4e00-\u9fa5]", norm):
            return ""
        if len(norm) > 100:
            return ""
        return norm

    def _validate_filters(self, filters):
        """
        验证和清理过滤条件

        Args:
            filters: 过滤条件字典

        Returns:
            dict: 验证后的过滤条件
        """
        if not isinstance(filters, dict):
            return {}

        validated = {}

        # 验证 index_type
        if 'index_type' in filters:
            valid_types = [choice[0] for choice in SearchIndex.INDEX_TYPE_CHOICES]
            index_type = filters['index_type']

            if isinstance(index_type, list):
                # 过滤掉无效的类型
                validated['index_type'] = [t for t in index_type if t in valid_types]
            elif index_type in valid_types:
                validated['index_type'] = index_type

        # 验证 is_public
        if 'is_public' in filters:
            validated['is_public'] = bool(filters['is_public'])

        return validated

    def _build_base_query(self, user, filters):
        """
        构建基础查询

        Args:
            user: 用户对象
            filters: 过滤条件

        Returns:
            QuerySet: 查询集
        """
        # 基础查询：用户自己的索引 或 公开的索引
        base_query = SearchIndex.objects.filter(
            Q(user=user) | Q(is_public=True)
        )

        # 应用过滤条件
        if filters:
            if 'index_type' in filters:
                index_types = filters['index_type']
                if isinstance(index_types, list):
                    base_query = base_query.filter(index_type__in=index_types)
                else:
                    base_query = base_query.filter(index_type=index_types)

            if 'is_public' in filters:
                base_query = base_query.filter(is_public=filters['is_public'])

            # 时间范围过滤（ISO8601 字符串）
            updated_after = filters.get('updated_after')
            updated_before = filters.get('updated_before')
            if updated_after:
                try:
                    dt = datetime.fromisoformat(updated_after)
                    if dt.tzinfo is None:
                        dt = timezone.make_aware(dt)
                    base_query = base_query.filter(updated_at__gte=dt)
                except Exception:
                    pass
            if updated_before:
                try:
                    dt = datetime.fromisoformat(updated_before)
                    if dt.tzinfo is None:
                        dt = timezone.make_aware(dt)
                    base_query = base_query.filter(updated_at__lte=dt)
                except Exception:
                    pass

        return base_query

    def _keyword_search(self, base_query, tokens, page, page_size, sort=None):
        """
        关键词搜索（优化版：限制tokens数量）

        Args:
            base_query: 基础查询
            tokens: 分词结果
            page: 页码
            page_size: 每页大小

        Returns:
            list: 搜索结果
        """
        if not tokens:
            # 如果没有查询词，返回最新的索引
            queryset = base_query.order_by('-updated_at')
        else:
            # 限制tokens数量，防止过多OR条件
            MAX_TOKENS = 10
            tokens = tokens[:MAX_TOKENS]

            # 构建查询条件
            query_conditions = Q()

            for token in tokens:
                query_conditions |= Q(title__icontains=token)
                query_conditions |= Q(content__icontains=token)
                query_conditions |= Q(keywords__icontains=token)

            queryset = base_query.filter(query_conditions)

        # 排序（可选）
        if sort == 'updated_asc':
            queryset = queryset.order_by('updated_at')
        elif sort == 'updated_desc' or sort is None:
            queryset = queryset.order_by('-updated_at')

        # 真实总数
        total = queryset.count()

        # 分页
        start = (page - 1) * page_size
        end = start + page_size

        # 执行查询
        results = queryset[start:end]

        # 转换为结果列表
        return self._format_results(results, tokens), total

    def _vector_search(self, base_query, vector, tokens, page, page_size):
        """
        向量搜索（优化版：候选集预筛+可配置的融合排序）

        Args:
            base_query: 基础查询
            vector: 查询向量
            tokens: 分词结果
            page: 页码
            page_size: 每页大小

        Returns:
            list: 搜索结果
        """
        # 从数据库动态获取搜索配置（修复模块/包导入冲突，改为模块内定义）
        from search.mongodb_models import SearchConfiguration
        config = SearchConfiguration.get_config()

        # 使用配置项（与 SearchConfiguration 对齐）
        keyword_weight = getattr(config, 'keyword_weight', 0.6)
        vector_weight = getattr(config, 'vector_weight', 0.4)
        vector_score_threshold = getattr(config, 'relevance_threshold', 0.7)
        MAX_CANDIDATES = int(getattr(config, 'vector_candidate_limit', 1000))

        # 1. 预筛候选集
        if tokens:
            query_conditions = Q()
            for token in tokens:
                query_conditions |= Q(title__icontains=token)
                query_conditions |= Q(content__icontains=token)
                query_conditions |= Q(keywords__icontains=token)
            candidates = list(base_query.filter(query_conditions)[:MAX_CANDIDATES])
        else:
            candidates = list(base_query.order_by('-updated_at')[:MAX_CANDIDATES])

        # 2. 计算分数并融合
        results_with_scores = []
        for index in candidates:
            if not index.vector:
                continue

            # 计算语义相似度分数
            semantic_score = self.vector_service.calculate_similarity(vector, index.vector)

            # 应用语义相似度阈值
            if semantic_score < vector_score_threshold:
                continue

            # 计算关键词匹配分数（作为BM25的代理）
            keyword_score = self._calculate_keyword_boost(index, tokens)

            # 3. 融合排序：应用新的融合权重
            final_score = (keyword_score * float(keyword_weight)) + (semantic_score * float(vector_weight))

            results_with_scores.append((index, final_score))

        # 4. 按最终分数排序
        results_with_scores.sort(key=lambda x: x[1], reverse=True)

        # 分页
        start = (page - 1) * page_size
        end = start + page_size

        # 提取结果
        paged_results = results_with_scores[start:end]

        # 转换为结果列表
        return self._format_results_with_scores(paged_results, tokens), len(results_with_scores)

    def _calculate_keyword_boost(self, index, tokens):
        """
        计算关键词加权

        Args:
            index: 索引对象
            tokens: 分词结果

        Returns:
            float: 加权分数
        """
        if not tokens:
            return 0

        boost = 0

        # 标题匹配权重高
        for token in tokens:
            if token in index.title:
                boost += 0.2

        # 关键词匹配权重中等
        if index.keywords:
            for token in tokens:
                if token in index.keywords:
                    boost += 0.1

        # 内容匹配权重低
        if index.content:
            for token in tokens:
                if token in index.content:
                    boost += 0.05

        return boost

    def _format_results(self, results, tokens):
        """
        格式化结果

        Args:
            results: 查询结果
            tokens: 分词结果

        Returns:
            list: 格式化的结果列表
        """
        formatted_results = []

        for i, result in enumerate(results):
            # 生成摘要
            snippet = self._generate_snippet(result.content, tokens)

            # 格式化结果
            formatted_result = {
                'id': str(result.id),
                'title': result.title,
                'snippet': snippet,
                'type': result.index_type,
                'type_display': result.get_index_type_display(),
                'object_id': result.object_id,
                'content_type': result.content_type,  # 直接使用字符串
                'is_public': result.is_public,
                'updated_at': result.updated_at.isoformat() if result.updated_at else None,
                'score': 0,
                'position': i + 1
            }

            formatted_results.append(formatted_result)

        return formatted_results

    def _format_results_with_scores(self, results_with_scores, tokens):
        """
        格式化带分数的结果

        Args:
            results_with_scores: 带分数的查询结果
            tokens: 分词结果

        Returns:
            list: 格式化的结果列表
        """
        formatted_results = []

        for i, (result, score) in enumerate(results_with_scores):
            # 生成摘要
            snippet = self._generate_snippet(result.content, tokens)

            # 格式化结果
            formatted_result = {
                'id': str(result.id),
                'title': result.title,
                'snippet': snippet,
                'type': result.index_type,
                'type_display': result.get_index_type_display(),
                'object_id': result.object_id,
                'content_type': result.content_type,  # 直接使用字符串
                'is_public': result.is_public,
                'updated_at': result.updated_at.isoformat() if result.updated_at else None,
                'score': float(score) if score else 0,
                'position': i + 1
            }

            formatted_results.append(formatted_result)

        return formatted_results

    def _generate_snippet(self, content, tokens, max_length=200):
        """
        生成摘要

        Args:
            content: 内容
            tokens: 分词结果
            max_length: 最大长度

        Returns:
            str: 摘要
        """
        if not content:
            return ""

        if not tokens:
            # 如果没有查询词，返回内容的前一部分
            return content[:max_length] + ("..." if len(content) > max_length else "")

        # 查找第一个匹配的位置
        first_match_pos = len(content)

        for token in tokens:
            pos = content.lower().find(token.lower())
            if pos != -1 and pos < first_match_pos:
                first_match_pos = pos

        # 如果没有匹配，返回内容的前一部分
        if first_match_pos == len(content):
            return content[:max_length] + ("..." if len(content) > max_length else "")

        # 计算摘要的起始位置
        start_pos = max(0, first_match_pos - 50)

        # 调整到单词边界
        if start_pos > 0:
            # 向前找到空格或标点
            while start_pos > 0 and not re.match(r'[\s\.,;!?，。；！？]', content[start_pos-1]):
                start_pos -= 1

        # 提取摘要
        snippet = content[start_pos:start_pos + max_length]

        # 添加省略号
        if start_pos > 0:
            snippet = "..." + snippet

        if start_pos + max_length < len(content):
            snippet = snippet + "..."

        return snippet

    def _record_search_results(self, search_query, results):
        """
        记录搜索结果

        Args:
            search_query: 搜索查询对象
            results: 搜索结果

        Returns:
            None
        """
        # 批量创建搜索结果记录（使用 MongoEngine）
        import uuid
        search_results = []

        for result in results:
            try:
                search_result = SearchResult(
                    id=uuid.uuid4(),
                    query=search_query,
                    title=result['title'],
                    snippet=result['snippet'],
                    score=result['score'],
                    position=result['position'],
                    content_type=result['content_type'],  # 直接使用字符串
                    object_id=result['object_id'],
                    result_type=result['type']
                )
                search_results.append(search_result)
            except Exception as e:
                logger.warning(f"创建搜索结果失败: {e}")

        # 批量保存
        for result in search_results:
            try:
                result.save()
            except Exception as e:
                logger.error(f"保存搜索结果失败: {e}")

    def get_search_history(self, user, limit=20):
        """
        获取用户搜索历史

        Args:
            user: 用户对象
            limit: 限制数量

        Returns:
            list: 搜索历史列表
        """
        try:
            # 获取用户的搜索历史
            history = SearchQuery.objects.filter(
                user=user
            ).order_by('-created_at')[:limit]

            # 转换为列表
            result = []
            for item in history:
                result.append({
                    'id': str(item.id),
                    'query': item.query,
                    'search_type': item.search_type,
                    'result_count': item.result_count,
                    'execution_time': item.execution_time,
                    'created_at': item.created_at.isoformat()
                })

            return result
        except Exception as e:
            logger.error(f"获取搜索历史失败: {e}")
            return []

    def add_search_history(self, user, query, search_type='text', result_count=0):
        """
        添加搜索历史

        Args:
            user: 用户对象
            query: 搜索关键词
            search_type: 搜索类型
            result_count: 结果数量

        Returns:
            SearchQuery: 搜索查询对象
        """
        try:
            # 规范化与质量控制
            normalized = self._normalize_query(query)
            if not normalized:
                return None
            # 只在有结果时写入
            if int(result_count or 0) <= 0:
                return None

            # 创建搜索查询记录
            search_query = SearchQuery.objects.create(
                user=user,
                query=normalized,
                search_type=search_type,
                result_count=int(result_count)
            )

            return search_query
        except Exception as e:
            logger.error(f"添加搜索历史失败: {e}")
            return None
