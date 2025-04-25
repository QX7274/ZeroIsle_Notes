"""
搜索服务
"""

import logging
import time
import jieba
import re
from django.db.models import Q, F, Value, CharField
from django.db.models.functions import Concat
from django.contrib.contenttypes.models import ContentType
from search.models import SearchIndex, SearchQuery, SearchResult
from .suggestion_service import SuggestionService
from .vector_service import VectorService

logger = logging.getLogger('backend')

class SearchService:
    """
    搜索服务类
    处理搜索的业务逻辑
    """
    
    def __init__(self):
        """初始化"""
        self.suggestion_service = SuggestionService()
        self.vector_service = VectorService()
        
        # 初始化结巴分词
        jieba.initialize()
    
    def search(self, query, user, filters=None, page=1, page_size=20, use_vector=True):
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
            # 创建搜索查询记录
            search_query = SearchQuery.objects.create(
                user=user,
                query=query,
                filters=filters or {}
            )
            
            # 分词
            tokens = self._tokenize(query)
            
            # 构建查询条件
            base_query = self._build_base_query(user, filters)
            
            # 执行搜索
            if use_vector and query:
                # 向量搜索
                vector = self.vector_service.generate_vector(query)
                results = self._vector_search(base_query, vector, tokens, page, page_size)
            else:
                # 关键词搜索
                results = self._keyword_search(base_query, tokens, page, page_size)
            
            # 记录搜索结果
            self._record_search_results(search_query, results)
            
            # 更新搜索建议
            if query:
                self.suggestion_service.add_suggestion(query, user)
            
            # 计算执行时间
            duration = time.time() - start_time
            
            # 更新查询记录
            search_query.result_count = len(results)
            search_query.execution_time = duration
            search_query.save(update_fields=['result_count', 'execution_time'])
            
            # 构建响应
            response = {
                'query': query,
                'filters': filters or {},
                'total': len(results),
                'duration': duration,
                'page': page,
                'page_size': page_size,
                'results': results
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
            
            return list(recent_searches.values('id', 'query', 'result_count', 'created_at'))
        except Exception as e:
            logger.error(f"获取最近搜索失败: {e}")
            raise
    
    def get_popular_searches(self, limit=10):
        """
        获取热门搜索
        
        Args:
            limit: 限制数量
            
        Returns:
            list: 热门搜索列表
        """
        try:
            from django.db.models import Count
            
            popular_searches = SearchQuery.objects.values(
                'query'
            ).annotate(
                count=Count('query')
            ).order_by('-count')[:limit]
            
            return list(popular_searches)
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
            deleted, _ = SearchQuery.objects.filter(user=user).delete()
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
        
        return base_query
    
    def _keyword_search(self, base_query, tokens, page, page_size):
        """
        关键词搜索
        
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
            # 构建查询条件
            query_conditions = Q()
            
            for token in tokens:
                query_conditions |= Q(title__icontains=token)
                query_conditions |= Q(content__icontains=token)
                query_conditions |= Q(keywords__icontains=token)
            
            queryset = base_query.filter(query_conditions)
        
        # 分页
        start = (page - 1) * page_size
        end = start + page_size
        
        # 执行查询
        results = queryset[start:end]
        
        # 转换为结果列表
        return self._format_results(results, tokens)
    
    def _vector_search(self, base_query, vector, tokens, page, page_size):
        """
        向量搜索
        
        Args:
            base_query: 基础查询
            vector: 查询向量
            tokens: 分词结果
            page: 页码
            page_size: 每页大小
            
        Returns:
            list: 搜索结果
        """
        # 获取所有索引
        indices = list(base_query)
        
        # 计算相似度
        results_with_scores = []
        
        for index in indices:
            if index.vector:
                # 计算向量相似度
                similarity = self.vector_service.calculate_similarity(vector, index.vector)
                
                # 关键词匹配加权
                keyword_boost = self._calculate_keyword_boost(index, tokens)
                
                # 最终分数
                final_score = similarity + keyword_boost
                
                results_with_scores.append((index, final_score))
        
        # 按分数排序
        results_with_scores.sort(key=lambda x: x[1], reverse=True)
        
        # 分页
        start = (page - 1) * page_size
        end = start + page_size
        
        # 提取结果
        paged_results = results_with_scores[start:end]
        
        # 转换为结果列表
        return self._format_results_with_scores(paged_results, tokens)
    
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
                'id': result.id,
                'title': result.title,
                'snippet': snippet,
                'type': result.index_type,
                'type_display': result.get_index_type_display(),
                'object_id': result.object_id,
                'content_type': result.content_type.model,
                'is_public': result.is_public,
                'updated_at': result.updated_at,
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
                'id': result.id,
                'title': result.title,
                'snippet': snippet,
                'type': result.index_type,
                'type_display': result.get_index_type_display(),
                'object_id': result.object_id,
                'content_type': result.content_type.model,
                'is_public': result.is_public,
                'updated_at': result.updated_at,
                'score': score,
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
        # 批量创建搜索结果记录
        search_results = []
        
        for result in results:
            # 获取内容类型
            try:
                content_type = ContentType.objects.get(model=result['content_type'])
                
                search_results.append(SearchResult(
                    query=search_query,
                    title=result['title'],
                    snippet=result['snippet'],
                    score=result['score'],
                    position=result['position'],
                    content_type=content_type,
                    object_id=result['object_id'],
                    result_type=result['type']
                ))
            except ContentType.DoesNotExist:
                logger.warning(f"内容类型不存在: {result['content_type']}")
        
        # 批量创建
        if search_results:
            SearchResult.objects.bulk_create(search_results)
