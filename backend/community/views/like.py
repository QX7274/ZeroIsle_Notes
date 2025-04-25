"""
点赞视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.contenttypes.models import ContentType

from community.models import Like
from community.serializers import LikeSerializer
from community.services import LikeService
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class LikeViewSet(viewsets.ReadOnlyModelViewSet):
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
    
    @action(detail=False, methods=['post'])
    def toggle(self, request):
        """切换点赞状态"""
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
            
            # 切换点赞状态
            like_service = LikeService()
            like, is_active = like_service.toggle_like(request.user, obj)
            
            return Response({
                'id': like.id,
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
    def by_object(self, request):
        """获取对象的点赞"""
        content_type_id = request.query_params.get('content_type_id')
        object_id = request.query_params.get('object_id')
        
        if not content_type_id or not object_id:
            return Response(
                {"detail": "缺少必要参数"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 获取点赞
        likes = Like.objects.filter(
            content_type_id=content_type_id,
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
        content_type_id = request.query_params.get('content_type_id')
        if content_type_id:
            likes = likes.filter(content_type_id=content_type_id)
        
        # 分页
        page = self.paginate_queryset(likes)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(likes, many=True)
        return Response(serializer.data)
