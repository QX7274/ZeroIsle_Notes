"""
搜索建议视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from search.models import SearchSuggestion
from search.serializers import SearchSuggestionSerializer
from search.services import SuggestionService
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class SearchSuggestionViewSet(viewsets.ModelViewSet):
    """搜索建议视图集"""
    serializer_class = SearchSuggestionSerializer
    permission_classes = [IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_global']
    search_fields = ['text']
    ordering_fields = ['frequency', 'last_used', 'created_at']
    ordering = ['-frequency', '-last_used']
    
    def get_queryset(self):
        """获取查询集"""
        return SearchSuggestion.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """创建建议时设置用户"""
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def autocomplete(self, request):
        """自动完成"""
        # 获取参数
        prefix = request.query_params.get('prefix', '')
        limit = int(request.query_params.get('limit', 10))
        include_global = request.query_params.get('include_global', 'true').lower() == 'true'
        
        # 获取建议
        suggestion_service = SuggestionService()
        suggestions = suggestion_service.get_suggestions(
            prefix=prefix,
            user=request.user,
            limit=limit,
            include_global=include_global
        )
        
        return Response(suggestions)
    
    @action(detail=False, methods=['post'])
    def clear(self, request):
        """清除建议"""
        # 获取参数
        is_global = request.data.get('is_global', False)
        
        # 清除建议
        suggestion_service = SuggestionService()
        deleted = suggestion_service.clear_suggestions(
            user=request.user,
            is_global=is_global
        )
        
        return Response({
            'deleted': deleted
        })
