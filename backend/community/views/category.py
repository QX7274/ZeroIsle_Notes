"""
分类视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
import uuid
from django.utils import timezone
from mongoengine.queryset.visitor import Q

from community.mongodb_models import Category, Post
from community.serializers import CategorySerializer
from common.pagination import StandardResultsSetPagination

class CategoryViewSet(viewsets.ViewSet):
    """分类视图集"""
    serializer_class = CategorySerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['parent', 'is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['order', 'name']
    ordering = ['order', 'name']

    def get_queryset(self):
        """获取查询集"""
        return Category.objects.filter(is_active=True)

    def get_permissions(self):
        """根据操作类型设置权限"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def list(self, request):
        """获取分类列表"""
        queryset = self.get_queryset()

        # 应用过滤
        for backend in list(self.filter_backends):
            queryset = backend().filter_queryset(request, queryset, self)

        # 分页
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = CategorySerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = CategorySerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取分类详情"""
        try:
            category = Category.objects.get(id=pk, is_active=True)
            serializer = CategorySerializer(category, context={'request': request})
            return Response(serializer.data)
        except Category.DoesNotExist:
            return Response(
                {"detail": "分类不存在或已禁用"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建分类"""
        serializer = CategorySerializer(data=request.data)
        if serializer.is_valid():
            # 创建分类
            category = Category(
                id=uuid.uuid4(),
                name=serializer.validated_data['name'],
                slug=serializer.validated_data['slug'],
                description=serializer.validated_data.get('description', ''),
                icon=serializer.validated_data.get('icon', ''),
                color=serializer.validated_data.get('color', ''),
                parent=serializer.validated_data.get('parent'),
                order=serializer.validated_data.get('order', 0),
                is_active=serializer.validated_data.get('is_active', True),
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            category.save()

            serializer = CategorySerializer(category, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新分类"""
        try:
            category = Category.objects.get(id=pk)
            serializer = CategorySerializer(data=request.data)
            if serializer.is_valid():
                # 更新分类
                for field in ['name', 'slug', 'description', 'icon', 'color', 'parent', 'order', 'is_active']:
                    if field in serializer.validated_data:
                        setattr(category, field, serializer.validated_data[field])

                category.updated_at = timezone.now()
                category.save()

                serializer = CategorySerializer(category, context={'request': request})
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Category.DoesNotExist:
            return Response(
                {"detail": "分类不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除分类"""
        try:
            category = Category.objects.get(id=pk)

            # 检查是否有子分类
            if Category.objects.filter(parent=category).count() > 0:
                return Response(
                    {"detail": "该分类下有子分类，无法删除"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 检查是否有帖子
            if Post.objects.filter(category=category, is_deleted=False).count() > 0:
                return Response(
                    {"detail": "该分类下有帖子，无法删除"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            category.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Category.DoesNotExist:
            return Response(
                {"detail": "分类不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['get'])
    def posts(self, request, pk=None):
        """获取分类下的帖子"""
        try:
            category = Category.objects.get(id=pk, is_active=True)

            # 获取帖子
            posts = Post.objects.filter(
                category=category,
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
        except Category.DoesNotExist:
            return Response(
                {"detail": "分类不存在或已禁用"},
                status=status.HTTP_404_NOT_FOUND
            )
