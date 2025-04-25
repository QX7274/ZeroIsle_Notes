"""
搜索视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from search.services import SearchService, SuggestionService
from search.serializers import SearchQuerySerializer

class SearchViewSet(viewsets.ViewSet):
    """搜索视图集"""
    permission_classes = [IsAuthenticated]
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.search_service = SearchService()
        self.suggestion_service = SuggestionService()
    
    @action(detail=False, methods=['get'])
    def query(self, request):
        """执行搜索查询"""
        # 获取查询参数
        query = request.query_params.get('q', '')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        use_vector = request.query_params.get('use_vector', 'true').lower() == 'true'
        
        # 获取过滤条件
        filters = {}
        
        if 'type' in request.query_params:
            filters['index_type'] = request.query_params.get('type').split(',')
        
        if 'public' in request.query_params:
            filters['is_public'] = request.query_params.get('public').lower() == 'true'
        
        # 执行搜索
        results = self.search_service.search(
            query=query,
            user=request.user,
            filters=filters,
            page=page,
            page_size=page_size,
            use_vector=use_vector
        )
        
        return Response(results)
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """获取最近搜索"""
        limit = int(request.query_params.get('limit', 10))
        
        recent_searches = self.search_service.get_recent_searches(
            user=request.user,
            limit=limit
        )
        
        return Response(recent_searches)
    
    @action(detail=False, methods=['get'])
    def popular(self, request):
        """获取热门搜索"""
        limit = int(request.query_params.get('limit', 10))
        
        popular_searches = self.search_service.get_popular_searches(
            limit=limit
        )
        
        return Response(popular_searches)
    
    @action(detail=False, methods=['post'])
    def clear_history(self, request):
        """清除搜索历史"""
        deleted = self.search_service.clear_search_history(
            user=request.user
        )
        
        return Response({
            'deleted': deleted
        })
    
    @action(detail=False, methods=['get'])
    def suggestions(self, request):
        """获取搜索建议"""
        prefix = request.query_params.get('prefix', '')
        limit = int(request.query_params.get('limit', 10))
        include_global = request.query_params.get('include_global', 'true').lower() == 'true'
        
        suggestions = self.suggestion_service.get_suggestions(
            prefix=prefix,
            user=request.user,
            limit=limit,
            include_global=include_global
        )
        
        return Response(suggestions)
    
    @action(detail=False, methods=['post'])
    def add_suggestion(self, request):
        """添加搜索建议"""
        text = request.data.get('text')
        is_global = request.data.get('is_global', False)
        
        if not text:
            return Response(
                {'detail': '建议文本不能为空'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        suggestion = self.suggestion_service.add_suggestion(
            text=text,
            user=request.user if not is_global else None,
            is_global=is_global
        )
        
        return Response({
            'id': suggestion.id,
            'text': suggestion.text,
            'frequency': suggestion.frequency,
            'is_global': suggestion.is_global
        })
    
    @action(detail=False, methods=['post'])
    def delete_suggestion(self, request):
        """删除搜索建议"""
        suggestion_id = request.data.get('id')
        
        if not suggestion_id:
            return Response(
                {'detail': '建议ID不能为空'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        success = self.suggestion_service.delete_suggestion(
            suggestion_id=suggestion_id,
            user=request.user
        )
        
        if success:
            return Response({'detail': '删除成功'})
        else:
            return Response(
                {'detail': '删除失败，建议不存在或无权删除'},
                status=status.HTTP_400_BAD_REQUEST
            )
