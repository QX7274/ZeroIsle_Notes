"""
代码片段视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from mongoengine.queryset.visitor import Q

from code.mongodb_models import CodeSnippet
from code.serializers import CodeSnippetSerializer
from common.permissions import IsOwnerOrReadOnly
from common.pagination import StandardResultsSetPagination

class CodeSnippetViewSet(viewsets.ModelViewSet):
    """代码片段视图集"""
    serializer_class = CodeSnippetSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['language', 'is_public']
    search_fields = ['title', 'description', 'code', 'tags']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']

    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        # 返回用户自己的代码片段和公开的代码片段
        return CodeSnippet.objects.filter(
            Q(user=user) | Q(is_public=True)
        )

    def perform_create(self, serializer):
        """创建代码片段"""
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def my(self, request):
        """获取当前用户的代码片段"""
        queryset = CodeSnippet.objects.filter(user=request.user)
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def public(self, request):
        """获取公开的代码片段"""
        queryset = CodeSnippet.objects.filter(is_public=True)
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_language(self, request):
        """按语言获取代码片段"""
        language = request.query_params.get('language')
        if not language:
            return Response(
                {'error': '缺少language参数'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        queryset = CodeSnippet.objects.filter(
            Q(user=user) | Q(is_public=True)
        ).filter(language=language)

        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_tag(self, request):
        """按标签获取代码片段"""
        tag = request.query_params.get('tag')
        if not tag:
            return Response(
                {'error': '缺少tag参数'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        queryset = CodeSnippet.objects.filter(
            Q(user=user) | Q(is_public=True)
        ).filter(tags=tag)

        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
