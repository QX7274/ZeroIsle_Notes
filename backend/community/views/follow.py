"""
关注视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.contenttypes.models import ContentType

from community.models import Follow
from community.serializers import FollowSerializer
from community.services import FollowService
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class FollowViewSet(viewsets.ReadOnlyModelViewSet):
    """关注视图集"""
    serializer_class = FollowSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['content_type', 'is_active']
    ordering_fields = ['created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """获取查询集"""
        return Follow.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def toggle(self, request):
        """切换关注状态"""
        content_type_id = request.data.get('content_type_id')
        object_id = request.data.get('object_id')
        
        if not content_type_id or not object_id:
            return Response(
                {"detail": "缺少必要参数"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # 获取内容类型
            content_type = ContentType.objects.get(id=content_type_id)
            
            # 获取对象
            obj = content_type.get_object_for_this_type(id=object_id)
            
            # 切换关注状态
            follow_service = FollowService()
            follow, is_active = follow_service.toggle_follow(request.user, obj)
            
            return Response({
                'id': follow.id,
                'object_id': object_id,
                'content_type_id': content_type_id,
                'is_active': is_active
            })
        except ContentType.DoesNotExist:
            return Response(
                {"detail": "内容类型不存在"},
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
        content_type_id = request.query_params.get('content_type_id')
        object_id = request.query_params.get('object_id')
        
        if not content_type_id or not object_id:
            return Response(
                {"detail": "缺少必要参数"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 获取关注
        follows = Follow.objects.filter(
            content_type_id=content_type_id,
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
        follows = Follow.objects.filter(user=request.user, is_active=True)
        
        # 过滤内容类型
        content_type_id = request.query_params.get('content_type_id')
        if content_type_id:
            follows = follows.filter(content_type_id=content_type_id)
        
        # 分页
        page = self.paginate_queryset(follows)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(follows, many=True)
        return Response(serializer.data)
