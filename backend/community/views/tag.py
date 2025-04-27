"""
标签视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q

from community.models import Tag, Post
from community.serializers import TagSerializer
from common.pagination import StandardResultsSetPagination

class TagViewSet(viewsets.ModelViewSet):
    """标签视图集"""
    queryset = Tag.objects.filter(is_active=True).annotate(
        post_count=Count('posts', filter=Q(posts__is_deleted=False, posts__status='published'))
    )
    serializer_class = TagSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'post_count']
    ordering = ['name']

    def get_permissions(self):
        """根据操作类型设置权限"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['get'])
    def posts(self, request, pk=None):
        """获取标签下的帖子"""
        tag = self.get_object()

        # 获取帖子
        posts = Post.objects.filter(
            tags=tag,
            is_deleted=False,
            is_public=True,
            status='published'
        )

        # 分页
        page = self.paginate_queryset(posts)

        if page is not None:
            from community.serializers import PostListSerializer
            serializer = PostListSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        from community.serializers import PostListSerializer
        serializer = PostListSerializer(posts, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def popular(self, request):
        """获取热门标签"""
        tags = Tag.objects.filter(is_active=True).annotate(
            post_count=Count('posts', filter=Q(posts__is_deleted=False, posts__status='published'))
        ).order_by('-post_count')[:20]

        serializer = self.get_serializer(tags, many=True)
        return Response(serializer.data)
