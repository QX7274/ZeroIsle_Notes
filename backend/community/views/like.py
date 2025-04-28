"""
点赞视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
import uuid
from django.utils import timezone

from community.mongodb_models import Like, Post, Comment
from users.mongodb_models import User
from community.serializers import LikeSerializer
from community.services import LikeService
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class LikeViewSet(viewsets.ViewSet):
    """点赞视图集"""
    serializer_class = LikeSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['content_type', 'is_active']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        """获取查询集"""
        return Like.objects.filter(user=self.request.user)

    def list(self, request):
        """获取点赞列表"""
        queryset = self.get_queryset()

        # 应用过滤
        for backend in list(self.filter_backends):
            queryset = backend().filter_queryset(request, queryset, self)

        # 分页
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = LikeSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = LikeSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def toggle(self, request):
        """切换点赞状态"""
        content_type = request.data.get('content_type')
        object_id = request.data.get('object_id')

        if not content_type or not object_id:
            return Response(
                {"detail": "缺少必要参数"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # 获取对象
            obj = None
            if content_type == 'Post':
                obj = Post.objects.get(id=object_id)
            elif content_type == 'Comment':
                obj = Comment.objects.get(id=object_id)
            elif content_type == 'User':
                obj = User.objects.get(id=object_id)

            if not obj:
                return Response(
                    {"detail": "对象不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 切换点赞状态
            like_service = LikeService()
            like, is_active = like_service.toggle_like(request.user, obj)

            return Response({
                'id': str(like.id),
                'object_id': str(object_id),
                'content_type': content_type,
                'is_active': is_active
            })
        except (Post.DoesNotExist, Comment.DoesNotExist, User.DoesNotExist):
            return Response(
                {"detail": "对象不存在"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def by_object(self, request):
        """获取对象的点赞"""
        content_type = request.query_params.get('content_type')
        object_id = request.query_params.get('object_id')

        if not content_type or not object_id:
            return Response(
                {"detail": "缺少必要参数"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 获取点赞
        likes = Like.objects.filter(
            content_type=content_type,
            object_id=object_id,
            is_active=True
        )

        # 分页
        page = self.paginate_queryset(likes)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(likes, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_likes(self, request):
        """获取我的点赞"""
        likes = Like.objects.filter(user=request.user, is_active=True)

        # 过滤内容类型
        content_type = request.query_params.get('content_type')
        if content_type:
            likes = likes.filter(content_type=content_type)

        # 分页
        page = self.paginate_queryset(likes)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(likes, many=True)
        return Response(serializer.data)
