"""
帖子视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
import uuid
from django.utils import timezone
from mongoengine.queryset.visitor import Q

from community.mongodb_models import Post, Like, Follow
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
                (Q(user=user)) |
                (Q(is_public=True) & Q(status='published'))
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
            queryset = queryset.filter(tags=tag)

        # 添加用户过滤
        user_id = self.request.query_params.get('user')
        if user_id:
            if user.is_authenticated and str(user.id) == user_id:
                # 查看自己的帖子，可以看到所有状态
                queryset = queryset.filter(user=user_id)
            else:
                # 查看他人的帖子，只能看到公开已发布的
                queryset = queryset.filter(
                    user=user_id,
                    is_public=True,
                    status='published'
                )

        return queryset

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

    def retrieve(self, request, pk=None):
        """获取帖子详情"""
        try:
            post = Post.objects.get(id=pk, is_deleted=False)

            # 检查权限
            if not post.is_public and post.user != request.user:
                return Response(
                    {"detail": "您没有权限查看此帖子"},
                    status=status.HTTP_403_FORBIDDEN
                )

            # 增加浏览次数
            post.view_count += 1
            post.save()

            serializer = self.get_serializer(post)
            return Response(serializer.data)
        except Post.DoesNotExist:
            return Response(
                {"detail": "帖子不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """点赞帖子"""
        try:
            post = Post.objects.get(id=pk, is_deleted=False)

            # 检查是否已点赞
            existing_like = Like.objects.filter(
                user=request.user,
                content_type='Post',
                object_id=str(post.id),
                is_active=True
            ).first()

            if existing_like:
                # 取消点赞
                existing_like.is_active = False
                existing_like.save()
                post.like_count = max(0, post.like_count - 1)
                post.save()
                is_liked = False
            else:
                # 添加点赞
                like = Like(
                    id=uuid.uuid4(),
                    user=request.user,
                    content_type='Post',
                    object_id=str(post.id),
                    is_active=True,
                    created_at=timezone.now(),
                    updated_at=timezone.now()
                )
                like.save()
                post.like_count += 1
                post.save()
                is_liked = True

            return Response({
                'id': str(post.id),
                'like_count': post.like_count,
                'is_liked': is_liked
            })
        except Post.DoesNotExist:
            return Response(
                {"detail": "帖子不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def follow(self, request, pk=None):
        """关注作者"""
        try:
            post = Post.objects.get(id=pk, is_deleted=False)

            # 不能关注自己
            if post.user == request.user:
                return Response(
                    {"detail": "不能关注自己"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 检查是否已关注
            existing_follow = Follow.objects.filter(
                user=request.user,
                content_type='User',
                object_id=str(post.user.id),
                is_active=True
            ).first()

            if existing_follow:
                # 取消关注
                existing_follow.is_active = False
                existing_follow.save()
                is_followed = False
            else:
                # 添加关注
                follow = Follow(
                    id=uuid.uuid4(),
                    user=request.user,
                    content_type='User',
                    object_id=str(post.user.id),
                    is_active=True,
                    created_at=timezone.now(),
                    updated_at=timezone.now()
                )
                follow.save()
                is_followed = True

            return Response({
                'user_id': str(post.user.id),
                'is_followed': is_followed
            })
        except Post.DoesNotExist:
            return Response(
                {"detail": "帖子不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

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

    def create(self, request):
        """创建帖子"""
        serializer = PostCreateSerializer(data=request.data)
        if serializer.is_valid():
            # 创建帖子
            post = Post(
                id=uuid.uuid4(),
                user=request.user,
                title=serializer.validated_data['title'],
                content=serializer.validated_data['content'],
                excerpt=serializer.validated_data.get('excerpt', ''),
                status=serializer.validated_data.get('status', 'published'),
                category=serializer.validated_data.get('category'),
                tags=serializer.validated_data.get('tags', []),
                cover_image=serializer.validated_data.get('cover_image', ''),
                allow_comments=serializer.validated_data.get('allow_comments', True),
                is_public=serializer.validated_data.get('is_public', True),
                created_at=timezone.now(),
                updated_at=timezone.now()
            )

            # 如果状态是已发布，设置发布时间
            if post.status == 'published':
                post.published_at = timezone.now()

            # 如果没有摘要，自动生成
            if not post.excerpt and post.content:
                post.excerpt = post.content[:200]

            post.save()

            serializer = PostDetailSerializer(post, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新帖子"""
        try:
            post = Post.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = PostUpdateSerializer(post, data=request.data)
            if serializer.is_valid():
                # 更新帖子
                for field in ['title', 'content', 'excerpt', 'status', 'category', 'tags', 'cover_image', 'allow_comments', 'is_public']:
                    if field in serializer.validated_data:
                        setattr(post, field, serializer.validated_data[field])

                # 如果状态从草稿变为已发布，设置发布时间
                if post.status == 'published' and not post.published_at:
                    post.published_at = timezone.now()

                # 如果没有摘要，自动生成
                if not post.excerpt and post.content:
                    post.excerpt = post.content[:200]

                post.updated_at = timezone.now()
                post.save()

                serializer = PostDetailSerializer(post, context={'request': request})
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Post.DoesNotExist:
            return Response(
                {"detail": "帖子不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除帖子"""
        try:
            post = Post.objects.get(id=pk, user=request.user, is_deleted=False)
            post.is_deleted = True
            post.deleted_at = timezone.now()
            post.save()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Post.DoesNotExist:
            return Response(
                {"detail": "帖子不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
