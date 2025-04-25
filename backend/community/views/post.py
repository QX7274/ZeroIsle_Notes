"""
帖子视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count

from community.models import Post
from community.serializers import (
    PostSerializer,
    PostListSerializer,
    PostDetailSerializer,
    PostCreateSerializer,
    PostUpdateSerializer
)
from community.services import PostService, LikeService, FollowService
from common.permissions import IsOwnerOrReadOnly
from common.pagination import StandardResultsSetPagination

class PostViewSet(viewsets.ModelViewSet):
    """帖子视图集"""
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'status', 'is_pinned', 'is_featured', 'is_public']
    search_fields = ['title', 'content', 'excerpt']
    ordering_fields = ['created_at', 'published_at', 'view_count', 'like_count', 'comment_count']
    ordering = ['-is_pinned', '-published_at', '-created_at']
    
    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        
        # 构建查询条件
        if user.is_authenticated:
            # 用户可以查看自己的所有帖子和他人的公开已发布帖子
            queryset = Post.objects.filter(
                is_deleted=False
            ).filter(
                (models.Q(user=user)) |
                (models.Q(is_public=True) & models.Q(status='published'))
            )
        else:
            # 未登录用户只能查看公开已发布帖子
            queryset = Post.objects.filter(
                is_deleted=False,
                is_public=True,
                status='published'
            )
        
        # 添加标签过滤
        tag = self.request.query_params.get('tag')
        if tag:
            queryset = queryset.filter(tags__name=tag)
        
        # 添加用户过滤
        user_id = self.request.query_params.get('user')
        if user_id:
            if user.is_authenticated and str(user.id) == user_id:
                # 查看自己的帖子，可以看到所有状态
                queryset = queryset.filter(user_id=user_id)
            else:
                # 查看他人的帖子，只能看到公开已发布的
                queryset = queryset.filter(
                    user_id=user_id,
                    is_public=True,
                    status='published'
                )
        
        return queryset.select_related('user', 'category').prefetch_related('tags')
    
    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return PostListSerializer
        elif self.action == 'retrieve':
            return PostDetailSerializer
        elif self.action == 'create':
            return PostCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return PostUpdateSerializer
        return self.serializer_class
    
    def perform_create(self, serializer):
        """创建帖子时设置用户"""
        serializer.save(user=self.request.user)
    
    def retrieve(self, request, *args, **kwargs):
        """获取帖子详情"""
        instance = self.get_object()
        
        # 增加浏览次数
        instance.increment_view_count()
        
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """点赞帖子"""
        post = self.get_object()
        
        # 切换点赞状态
        like_service = LikeService()
        like, is_active = like_service.toggle_like(request.user, post)
        
        return Response({
            'id': post.id,
            'like_count': post.like_count,
            'is_liked': is_active
        })
    
    @action(detail=True, methods=['post'])
    def follow(self, request, pk=None):
        """关注作者"""
        post = self.get_object()
        
        # 切换关注状态
        follow_service = FollowService()
        follow, is_active = follow_service.toggle_follow(request.user, post.user)
        
        return Response({
            'user_id': post.user.id,
            'is_followed': is_active
        })
    
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """获取推荐帖子"""
        queryset = self.get_queryset().filter(is_featured=True)
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = PostListSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        
        serializer = PostListSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def popular(self, request):
        """获取热门帖子"""
        queryset = self.get_queryset().order_by('-view_count', '-like_count', '-comment_count')
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = PostListSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        
        serializer = PostListSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def my(self, request):
        """获取我的帖子"""
        queryset = Post.objects.filter(user=request.user, is_deleted=False)
        
        # 过滤状态
        status_param = request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = PostListSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        
        serializer = PostListSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)
