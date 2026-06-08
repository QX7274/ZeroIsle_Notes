"""
帖子视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
import uuid
import json
import os
from django.utils import timezone
from django.conf import settings
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
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'content', 'excerpt']
    ordering_fields = ['created_at', 'published_at', 'view_count', 'like_count', 'comment_count']
    ordering = ['-is_pinned', '-published_at', '-created_at']

    def get_queryset(self):
        """获取对当前用户可见的帖子查询集 (重构版)"""
        from community.services.permission_service import CommunityPermissionService

        user = self.request.user
        # 先应用其他过滤器，缩小范围
        base_query = Post.objects.filter(is_deleted=False)
        
        tag = self.request.query_params.get('tag')
        if tag:
            base_query = base_query.filter(tags=tag)

        user_id_filter = self.request.query_params.get('user')
        if user_id_filter:
            base_query = base_query.filter(user=user_id_filter)

        category_filter = self.request.query_params.get('category')
        if category_filter:
            base_query = base_query.filter(category=category_filter)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            base_query = base_query.filter(status=status_filter)

        for boolean_field in ['is_pinned', 'is_featured', 'is_public']:
            raw_value = self.request.query_params.get(boolean_field)
            if raw_value is None:
                continue

            normalized = str(raw_value).strip().lower()
            if normalized in {'true', '1', 'yes'}:
                base_query = base_query.filter(**{boolean_field: True})
            elif normalized in {'false', '0', 'no'}:
                base_query = base_query.filter(**{boolean_field: False})
        
        # 然后在内存中过滤可见性
        # 注意：这在数据量大时性能较差，但确保了逻辑的统一。
        # 优化方向：将 can_view_post 的逻辑尽可能地转换为MongoDB查询。
        visible_posts_ids = [
            post.id for post in base_query if CommunityPermissionService.can_view_post(user, post)
        ]
        
        return Post.objects.filter(id__in=visible_posts_ids)

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

            # 使用集中式权限服务检查权限
            from community.services.permission_service import CommunityPermissionService
            if not CommunityPermissionService.can_view_post(request.user, post):
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
        # 检查是否是multipart/form-data请求
        is_multipart = request.content_type and 'multipart/form-data' in request.content_type

        # 处理表单数据
        if is_multipart:
            # 从表单中获取基本数据
            title = request.data.get('title', '')
            content = request.data.get('content', '')
            excerpt = request.data.get('excerpt', '')
            status_value = request.data.get('status', 'published')
            category_id = request.data.get('category_id')
            allow_comments = request.data.get('allow_comments', 'true').lower() == 'true'
            is_public = request.data.get('is_public', 'true').lower() == 'true'

            # 处理标签
            tags = []
            if 'tags' in request.data:
                if isinstance(request.data.getlist('tags'), list):
                    tags = request.data.getlist('tags')
                else:
                    tags = [request.data.get('tags')]

            # 处理封面图片
            cover_image = ''
            if 'cover_image' in request.FILES:
                cover_file = request.FILES['cover_image']
                # 这里应该有处理和保存图片的逻辑
                # 例如上传到云存储并获取URL
                cover_image = f"/media/community/covers/{cover_file.name}"

                # 保存文件到本地
                import os
                from django.conf import settings

                upload_dir = os.path.join(settings.MEDIA_ROOT, 'community', 'covers')
                os.makedirs(upload_dir, exist_ok=True)

                with open(os.path.join(upload_dir, cover_file.name), 'wb+') as destination:
                    for chunk in cover_file.chunks():
                        destination.write(chunk)

            # 处理附件
            attachments = []
            if 'attachments_meta' in request.data:
                try:
                    attachments_meta = json.loads(request.data.get('attachments_meta', '[]'))
                    attachment_count = int(request.data.get('attachment_count', '0'))

                    for i in range(attachment_count):
                        if f'file_{i}' in request.FILES:
                            file_obj = request.FILES[f'file_{i}']
                            meta = next((m for m in attachments_meta if m.get('index') == i), None)

                            if meta:
                                # 保存文件到本地
                                import os
                                from django.conf import settings

                                upload_dir = os.path.join(settings.MEDIA_ROOT, 'community', 'attachments')
                                os.makedirs(upload_dir, exist_ok=True)

                                file_path = os.path.join(upload_dir, file_obj.name)
                                with open(file_path, 'wb+') as destination:
                                    for chunk in file_obj.chunks():
                                        destination.write(chunk)

                                # 添加附件信息
                                attachments.append({
                                    'name': meta.get('name', file_obj.name),
                                    'type': meta.get('type', file_obj.content_type),
                                    'size': meta.get('size', file_obj.size),
                                    'url': f"/media/community/attachments/{file_obj.name}"
                                })
                except Exception as e:
                    return Response(
                        {'error': f'处理附件时出错: {str(e)}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # 创建帖子
            post = Post(
                id=uuid.uuid4(),
                user=request.user,
                title=title,
                content=content,
                excerpt=excerpt,
                status=status_value,
                category=category_id,
                tags=tags,
                cover_image=cover_image,
                attachments=attachments,
                allow_comments=allow_comments,
                is_public=is_public,
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
        else:
            # 处理JSON数据
            serializer = PostCreateSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            # 处理群组关联
            group_id = serializer.validated_data.get('group')
            group = None
            if group_id:
                from groups.mongodb_models import Group, GroupMember
                try:
                    group = Group.objects.get(id=group_id)
                    # 验证用户是否为该群组成员
                    if not GroupMember.objects.filter(group=group, user=request.user, is_active=True).first():
                        return Response({'detail': '您不是该群组的成员，无法在此发帖'}, status=status.HTTP_403_FORBIDDEN)
                except Group.DoesNotExist:
                    return Response({'detail': '指定的群组不存在'}, status=status.HTTP_400_BAD_REQUEST)

            # 创建帖子
            post = Post(
                id=uuid.uuid4(),
                user=request.user,
                group=group,
                title=serializer.validated_data['title'],
                content=serializer.validated_data['content'],
                excerpt=serializer.validated_data.get('excerpt', ''),
                status=serializer.validated_data.get('status', 'published'),
                category=serializer.validated_data.get('category_id'),
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

                # 处理群组关联更新
                if 'group' in serializer.validated_data:
                    group_id = serializer.validated_data.get('group')
                    if group_id:
                        from groups.mongodb_models import Group, GroupMember
                        try:
                            group = Group.objects.get(id=group_id)
                            if not GroupMember.objects.filter(group=group, user=request.user, is_active=True).first():
                                return Response({'detail': '您不是该群组的成员，无法将帖子移入'}, status=status.HTTP_403_FORBIDDEN)
                            post.group = group
                        except Group.DoesNotExist:
                            return Response({'detail': '指定的群组不存在'}, status=status.HTTP_400_BAD_REQUEST)
                    else:
                        # 如果传入的 group 为 null，则将帖子设为非群组帖子
                        post.group = None

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
