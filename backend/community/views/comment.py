"""
评论视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from community.models import Comment
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

class CommentViewSet(viewsets.ModelViewSet):
    """评论视图集"""
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['post', 'parent', 'is_pinned']
    search_fields = ['content']
    ordering_fields = ['created_at', 'like_count']
    ordering = ['-is_pinned', '-created_at']
    
    def get_queryset(self):
        """获取查询集"""
        return Comment.objects.filter(is_deleted=False).select_related('user', 'post', 'parent')
    
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
    
    def perform_create(self, serializer):
        """创建评论时设置用户"""
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """点赞评论"""
        comment = self.get_object()
        
        # 切换点赞状态
        like_service = LikeService()
        like, is_active = like_service.toggle_like(request.user, comment)
        
        return Response({
            'id': comment.id,
            'like_count': comment.like_count,
            'is_liked': is_active
        })
    
    @action(detail=True, methods=['get'])
    def replies(self, request, pk=None):
        """获取评论回复"""
        comment = self.get_object()
        
        # 获取回复
        replies = Comment.objects.filter(parent=comment, is_deleted=False)
        
        # 分页
        page = self.paginate_queryset(replies)
        
        if page is not None:
            serializer = CommentListSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        
        serializer = CommentListSerializer(replies, many=True, context={'request': request})
        return Response(serializer.data)
    
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
