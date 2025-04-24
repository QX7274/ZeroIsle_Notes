"""社区视图"""

from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import F
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import (
    CommunityPost, PostTag, PostCategory, PostAttachment,
    Comment, Like, Favorite, Follow, Notification
)
from .serializers import (
    CommunityPostListSerializer, CommunityPostDetailSerializer, CommunityPostCreateSerializer,
    CommentSerializer, CommentCreateSerializer, PostTagSerializer, PostCategorySerializer,
    LikeSerializer, FavoriteSerializer, FollowSerializer, NotificationSerializer
)


class IsAuthorOrReadOnly(permissions.BasePermission):
    """
    自定义权限：只允许作者编辑对象
    """
    def has_object_permission(self, request, view, obj):
        # 读取权限允许任何请求
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # 写入权限只允许作者
        return obj.author == request.user


class CommunityPostViewSet(viewsets.ModelViewSet):
    """社区帖子视图集"""
    queryset = CommunityPost.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'content', 'author__username', 'tags__name']
    ordering_fields = ['created_at', 'updated_at', 'view_count', 'like_count', 'comment_count', 'download_count']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'create' or self.action == 'update' or self.action == 'partial_update':
            return CommunityPostCreateSerializer
        elif self.action == 'retrieve':
            return CommunityPostDetailSerializer
        return CommunityPostListSerializer
    
    def get_queryset(self):
        queryset = CommunityPost.objects.all()
        
        # 过滤非公开帖子
        if self.request.user.is_authenticated:
            queryset = queryset.filter(is_public=True) | queryset.filter(author=self.request.user)
        else:
            queryset = queryset.filter(is_public=True)
        
        # 按标签过滤
        tag = self.request.query_params.get('tag')
        if tag:
            queryset = queryset.filter(tags__name=tag)
        
        # 按分类过滤
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category__name=category)
        
        # 按作者过滤
        author = self.request.query_params.get('author')
        if author:
            queryset = queryset.filter(author__username=author)
        
        # 只看精选
        featured = self.request.query_params.get('featured')
        if featured and featured.lower() == 'true':
            queryset = queryset.filter(is_featured=True)
        
        return queryset
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # 增加查看次数
        instance.view_count = F('view_count') + 1
        instance.save(update_fields=['view_count'])
        instance.refresh_from_db()
        
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """点赞帖子"""
        post = self.get_object()
        user = request.user
        
        # 检查是否已点赞
        like, created = Like.objects.get_or_create(user=user, post=post)
        
        if created:
            # 增加点赞计数
            post.like_count = F('like_count') + 1
            post.save(update_fields=['like_count'])
            post.refresh_from_db()
            
            # 创建通知
            if post.author != user:
                Notification.objects.create(
                    recipient=post.author,
                    sender=user,
                    type='like',
                    post=post,
                    content=f"{user.username} 点赞了你的帖子 '{post.title}'"
                )
            
            return Response({'status': 'liked', 'like_count': post.like_count})
        else:
            # 取消点赞
            like.delete()
            post.like_count = F('like_count') - 1
            post.save(update_fields=['like_count'])
            post.refresh_from_db()
            return Response({'status': 'unliked', 'like_count': post.like_count})
    
    @action(detail=True, methods=['post'])
    def favorite(self, request, pk=None):
        """收藏帖子"""
        post = self.get_object()
        user = request.user
        
        # 检查是否已收藏
        favorite, created = Favorite.objects.get_or_create(user=user, post=post)
        
        if created:
            # 创建通知
            if post.author != user:
                Notification.objects.create(
                    recipient=post.author,
                    sender=user,
                    type='favorite',
                    post=post,
                    content=f"{user.username} 收藏了你的帖子 '{post.title}'"
                )
            
            return Response({'status': 'favorited'})
        else:
            # 取消收藏
            favorite.delete()
            return Response({'status': 'unfavorited'})
    
    @action(detail=False, methods=['get'])
    def my_posts(self, request):
        """获取当前用户的帖子"""
        queryset = self.get_queryset().filter(author=request.user)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def my_favorites(self, request):
        """获取当前用户收藏的帖子"""
        queryset = self.get_queryset().filter(favorites__user=request.user)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class CommentViewSet(viewsets.ModelViewSet):
    """评论视图集"""
    queryset = Comment.objects.all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]
    
    def get_serializer_class(self):
        if self.action == 'create' or self.action == 'update' or self.action == 'partial_update':
            return CommentCreateSerializer
        return CommentSerializer
    
    def get_queryset(self):
        queryset = Comment.objects.all()
        
        # 按帖子过滤
        post_id = self.request.query_params.get('post')
        if post_id:
            queryset = queryset.filter(post_id=post_id)
        
        # 按父评论过滤
        parent_id = self.request.query_params.get('parent')
        if parent_id:
            if parent_id == 'null':
                queryset = queryset.filter(parent=None)
            else:
                queryset = queryset.filter(parent_id=parent_id)
        
        return queryset
    
    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """点赞评论"""
        comment = self.get_object()
        user = request.user
        
        # 检查是否已点赞
        like, created = Like.objects.get_or_create(user=user, comment=comment)
        
        if created:
            # 增加点赞计数
            comment.like_count = F('like_count') + 1
            comment.save(update_fields=['like_count'])
            comment.refresh_from_db()
            
            # 创建通知
            if comment.author != user:
                Notification.objects.create(
                    recipient=comment.author,
                    sender=user,
                    type='like',
                    comment=comment,
                    content=f"{user.username} 点赞了你的评论"
                )
            
            return Response({'status': 'liked', 'like_count': comment.like_count})
        else:
            # 取消点赞
            like.delete()
            comment.like_count = F('like_count') - 1
            comment.save(update_fields=['like_count'])
            comment.refresh_from_db()
            return Response({'status': 'unliked', 'like_count': comment.like_count})


class PostTagViewSet(viewsets.ReadOnlyModelViewSet):
    """帖子标签视图集"""
    queryset = PostTag.objects.all()
    serializer_class = PostTagSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']


class PostCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """帖子分类视图集"""
    queryset = PostCategory.objects.all()
    serializer_class = PostCategorySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """通知视图集"""
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)
    
    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """标记为已读"""
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response({'status': 'marked as read'})
    
    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        """标记所有为已读"""
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'all marked as read'})


class FollowViewSet(viewsets.ModelViewSet):
    """关注视图集"""
    serializer_class = FollowSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Follow.objects.filter(follower=self.request.user)
    
    def create(self, request, *args, **kwargs):
        followed_id = request.data.get('followed')
        if not followed_id:
            return Response({'error': '必须提供被关注者ID'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 不能关注自己
        if int(followed_id) == request.user.id:
            return Response({'error': '不能关注自己'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 检查是否已关注
        if Follow.objects.filter(follower=request.user, followed_id=followed_id).exists():
            return Response({'error': '已经关注该用户'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(follower=request.user)
        
        # 创建通知
        Notification.objects.create(
            recipient_id=followed_id,
            sender=request.user,
            type='follow',
            content=f"{request.user.username} 关注了你"
        )
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'])
    def followers(self, request):
        """获取关注我的用户"""
        followers = Follow.objects.filter(followed=request.user)
        page = self.paginate_queryset(followers)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(followers, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def following(self, request):
        """获取我关注的用户"""
        following = Follow.objects.filter(follower=request.user)
        page = self.paginate_queryset(following)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(following, many=True)
        return Response(serializer.data)
