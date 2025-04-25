"""
搜索查询视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from search.models import SearchQuery, SearchResult
from search.serializers import SearchQuerySerializer, SearchResultSerializer
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class SearchQueryViewSet(viewsets.ReadOnlyModelViewSet):
    """搜索查询视图集"""
    serializer_class = SearchQuerySerializer
    permission_classes = [IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['query']
    search_fields = ['query']
    ordering_fields = ['created_at', 'result_count', 'execution_time']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """获取查询集"""
        return SearchQuery.objects.filter(user=self.request.user)
    
    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        """获取查询结果"""
        query = self.get_object()
        
        # 获取结果
        results = SearchResult.objects.filter(query=query).order_by('position')
        
        # 分页
        page = self.paginate_queryset(results)
        if page is not None:
            serializer = SearchResultSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = SearchResultSerializer(results, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['delete'])
    def delete(self, request, pk=None):
        """删除查询"""
        query = self.get_object()
        query.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)
