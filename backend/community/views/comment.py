"""
评论视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from community.mongodb_models import Comment
from community.serializers import (
    CommentSerializer,
    CommentListSerializer,
    CommentDetailSerializer,
    CommentCreateSerializer,
    CommentUpdateSerializer
)
from community.services import CommentService, LikeService
from common.permissions import IsOwnerOrReadOnly
from common.pagination import StandardResultsSetPagination

class CommentViewSet(viewsets.ViewSet):
    """评论视图集"""
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    pagination_class = StandardResultsSetPagination
    ordering = ['-is_pinned', '-created_at']

    def get_serializer(self, *args, **kwargs):
        """兼容 ViewSet 的简易序列化器获取。"""
        kwargs.setdefault('context', {'request': self.request})
        serializer_class = self.get_serializer_class()
        return serializer_class(*args, **kwargs)

    def paginate_queryset(self, queryset):
        """为普通 ViewSet 补齐分页能力。"""
        paginator = self.pagination_class()
        self._paginator = paginator
        return paginator.paginate_queryset(queryset, self.request, view=self)

    def get_paginated_response(self, data):
        """返回统一分页结构。"""
        return self._paginator.get_paginated_response(data)

    def get_queryset(self):
        """获取查询集"""
        queryset = Comment.objects.filter(is_deleted=False)

        post_id = self.request.query_params.get('post') or self.request.query_params.get('post_id')
        if post_id:
            queryset = queryset.filter(post_id=post_id)

        parent_id = self.request.query_params.get('parent')
        if parent_id:
            queryset = queryset.filter(parent_id=parent_id)
        elif self.request.query_params.get('parent__isnull') in {'true', 'True', '1'}:
            queryset = queryset.filter(parent__isnull=True)

        is_pinned = self.request.query_params.get('is_pinned')
        if is_pinned is not None:
            normalized = str(is_pinned).strip().lower()
            if normalized in {'true', '1', 'yes'}:
                queryset = queryset.filter(is_pinned=True)
            elif normalized in {'false', '0', 'no'}:
                queryset = queryset.filter(is_pinned=False)

        return queryset.order_by(*self.ordering)

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return CommentListSerializer
        elif self.action == 'retrieve':
            return CommentDetailSerializer
        elif self.action == 'create':
            return CommentCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return CommentUpdateSerializer
        return self.serializer_class

    def list(self, request):
        """获取评论列表"""
        queryset = self.get_queryset()

        # 分页
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = CommentListSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = CommentListSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取评论详情"""
        try:
            comment = Comment.objects.get(id=pk, is_deleted=False)
            serializer = CommentDetailSerializer(comment, context={'request': request})
            return Response(serializer.data)
        except Comment.DoesNotExist:
            return Response(
                {"detail": "评论不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建评论"""
        serializer = CommentCreateSerializer(data=request.data)
        if serializer.is_valid():
            # 创建评论
            comment_service = CommentService()
            comment = comment_service.create_comment(
                user=request.user,
                post_id=serializer.validated_data['post_id'],
                content=serializer.validated_data['content'],
                parent_id=serializer.validated_data.get('parent_id')
            )

            serializer = CommentDetailSerializer(comment, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新评论"""
        try:
            comment = Comment.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = CommentUpdateSerializer(data=request.data)
            if serializer.is_valid():
                comment.content = serializer.validated_data['content']
                comment.updated_at = timezone.now()
                comment.save()

                serializer = CommentDetailSerializer(comment, context={'request': request})
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Comment.DoesNotExist:
            return Response(
                {"detail": "评论不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除评论"""
        try:
            comment = Comment.objects.get(id=pk, user=request.user, is_deleted=False)
            comment.is_deleted = True
            comment.deleted_at = timezone.now()
            comment.save()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Comment.DoesNotExist:
            return Response(
                {"detail": "评论不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """点赞评论"""
        try:
            comment = Comment.objects.get(id=pk, is_deleted=False)

            # 切换点赞状态
            like_service = LikeService()
            like, is_active = like_service.toggle_like(request.user, comment)

            return Response({
                'id': str(comment.id),
                'like_count': comment.like_count,
                'is_liked': is_active
            })
        except Comment.DoesNotExist:
            return Response(
                {"detail": "评论不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['get'])
    def replies(self, request, pk=None):
        """获取评论回复"""
        try:
            comment = Comment.objects.get(id=pk, is_deleted=False)

            # 获取回复
            replies = Comment.objects.filter(parent=comment, is_deleted=False)

            # 分页
            page = self.paginate_queryset(replies)

            if page is not None:
                serializer = CommentListSerializer(page, many=True, context={'request': request})
                return self.get_paginated_response(serializer.data)

            serializer = CommentListSerializer(replies, many=True, context={'request': request})
            return Response(serializer.data)
        except Comment.DoesNotExist:
            return Response(
                {"detail": "评论不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'])
    def by_post(self, request):
        """获取帖子评论"""
        post_id = request.query_params.get('post_id')

        if not post_id:
            return Response(
                {"detail": "缺少post_id参数"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 获取顶级评论
        comments = Comment.objects.filter(
            post_id=post_id,
            parent__isnull=True,
            is_deleted=False
        )

        # 分页
        page = self.paginate_queryset(comments)

        if page is not None:
            serializer = CommentListSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = CommentListSerializer(comments, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my(self, request):
        """获取我的评论"""
        comments = Comment.objects.filter(user=request.user, is_deleted=False)

        # 分页
        page = self.paginate_queryset(comments)

        if page is not None:
            serializer = CommentListSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = CommentListSerializer(comments, many=True, context={'request': request})
        return Response(serializer.data)
