"""
标签视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
import uuid
from django.utils import timezone
from mongoengine.queryset.visitor import Q

from community.mongodb_models import Tag, Post
from community.serializers import TagSerializer
from common.pagination import StandardResultsSetPagination

class TagViewSet(viewsets.ViewSet):
    """标签视图集"""
    serializer_class = TagSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name']
    ordering = ['name']

    def get_queryset(self):
        """获取查询集"""
        return Tag.objects.filter(is_active=True)

    def get_permissions(self):
        """根据操作类型设置权限"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def list(self, request):
        """获取标签列表"""
        queryset = self.get_queryset()

        # 应用过滤
        for backend in list(self.filter_backends):
            queryset = backend().filter_queryset(request, queryset, self)

        # 分页
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = TagSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = TagSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取标签详情"""
        try:
            tag = Tag.objects.get(id=pk, is_active=True)
            serializer = TagSerializer(tag, context={'request': request})
            return Response(serializer.data)
        except Tag.DoesNotExist:
            return Response(
                {"detail": "标签不存在或已禁用"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建标签"""
        serializer = TagSerializer(data=request.data)
        if serializer.is_valid():
            # 创建标签
            tag = Tag(
                id=uuid.uuid4(),
                name=serializer.validated_data['name'],
                slug=serializer.validated_data['slug'],
                description=serializer.validated_data.get('description', ''),
                is_active=serializer.validated_data.get('is_active', True),
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            tag.save()

            serializer = TagSerializer(tag, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新标签"""
        try:
            tag = Tag.objects.get(id=pk)
            serializer = TagSerializer(data=request.data)
            if serializer.is_valid():
                # 更新标签
                for field in ['name', 'slug', 'description', 'is_active']:
                    if field in serializer.validated_data:
                        setattr(tag, field, serializer.validated_data[field])

                tag.updated_at = timezone.now()
                tag.save()

                serializer = TagSerializer(tag, context={'request': request})
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Tag.DoesNotExist:
            return Response(
                {"detail": "标签不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除标签"""
        try:
            tag = Tag.objects.get(id=pk)

            # 检查是否有帖子
            if Post.objects.filter(tags=tag, is_deleted=False).count() > 0:
                return Response(
                    {"detail": "该标签下有帖子，无法删除"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            tag.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Tag.DoesNotExist:
            return Response(
                {"detail": "标签不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['get'])
    def posts(self, request, pk=None):
        """获取标签下的帖子"""
        try:
            tag = Tag.objects.get(id=pk, is_active=True)

            # 获取帖子
            posts = Post.objects.filter(
                tags=tag.name,
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
        except Tag.DoesNotExist:
            return Response(
                {"detail": "标签不存在或已禁用"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'])
    def popular(self, request):
        """获取热门标签"""
        # 获取所有标签
        tags = Tag.objects.filter(is_active=True)

        # 计算每个标签的帖子数量
        tag_post_counts = []
        for tag in tags:
            post_count = Post.objects.filter(
                tags=tag.name,
                is_deleted=False,
                is_public=True,
                status='published'
            ).count()

            tag_post_counts.append({
                'tag': tag,
                'post_count': post_count
            })

        # 按帖子数量排序并取前20个
        tag_post_counts.sort(key=lambda x: x['post_count'], reverse=True)
        popular_tags = [item['tag'] for item in tag_post_counts[:20]]

        serializer = TagSerializer(popular_tags, many=True, context={'request': request})
        return Response(serializer.data)
