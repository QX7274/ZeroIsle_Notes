"""
关注视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
import uuid
from django.utils import timezone

from community.mongodb_models import Follow
from users.mongodb_models import User
from community.serializers import FollowSerializer
from community.services import FollowService
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class FollowViewSet(viewsets.ViewSet):
    """关注视图集"""
    serializer_class = FollowSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    pagination_class = StandardResultsSetPagination
    ordering = '-created_at'

    def get_serializer(self, *args, **kwargs):
        """兼容 ViewSet 的简易序列化器获取。"""
        kwargs.setdefault('context', {'request': self.request})
        return self.serializer_class(*args, **kwargs)

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
        queryset = Follow.objects.filter(user=self.request.user)

        content_type = self.request.query_params.get('content_type')
        if content_type:
            queryset = queryset.filter(content_type=content_type)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            normalized = str(is_active).strip().lower()
            if normalized in {'true', '1', 'yes'}:
                queryset = queryset.filter(is_active=True)
            elif normalized in {'false', '0', 'no'}:
                queryset = queryset.filter(is_active=False)

        return queryset.order_by(self.ordering)

    def list(self, request):
        """获取关注列表"""
        queryset = self.get_queryset()

        # 分页
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = FollowSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = FollowSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def toggle(self, request):
        """切换关注状态"""
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
            if content_type == 'User':
                obj = User.objects.get(id=object_id)

            if not obj:
                return Response(
                    {"detail": "对象不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 切换关注状态
            follow_service = FollowService()
            follow, is_active = follow_service.toggle_follow(request.user, obj)

            return Response({
                'id': str(follow.id),
                'object_id': str(object_id),
                'content_type': content_type,
                'is_active': is_active
            })
        except User.DoesNotExist:
            return Response(
                {"detail": "用户不存在"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def followers(self, request):
        """获取关注者"""
        content_type = request.query_params.get('content_type')
        object_id = request.query_params.get('object_id')

        if not content_type or not object_id:
            return Response(
                {"detail": "缺少必要参数"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 获取关注
        follows = Follow.objects.filter(
            content_type=content_type,
            object_id=object_id,
            is_active=True
        )

        # 分页
        page = self.paginate_queryset(follows)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(follows, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def following(self, request):
        """获取我关注的"""
        target_user_id = request.query_params.get('user_id')
        follows = Follow.objects.filter(is_active=True)

        if target_user_id:
            follows = follows.filter(object_id=target_user_id, content_type='User')
        else:
            follows = follows.filter(user=request.user)

        # 过滤内容类型
        content_type = request.query_params.get('content_type')
        if content_type:
            follows = follows.filter(content_type=content_type)

        follows = follows.order_by(self.ordering)

        # 分页
        page = self.paginate_queryset(follows)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(follows, many=True)
        return Response(serializer.data)
