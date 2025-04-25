"""
画布连接视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q

from canvas.models import CanvasConnection
from canvas.serializers import CanvasConnectionSerializer
from canvas.services import CanvasConnectionService
from common.permissions import IsOwnerOrReadOnly
from common.pagination import StandardResultsSetPagination

class CanvasConnectionViewSet(viewsets.ModelViewSet):
    """
    画布连接视图集
    """
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    serializer_class = CanvasConnectionSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['canvas', 'connection_type', 'source', 'target']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        # 返回用户自己的画布中的连接和公开画布中的连接
        return CanvasConnection.objects.filter(
            Q(canvas__user=user) | Q(canvas__is_public=True)
        )
    
    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """
        批量更新连接
        """
        connections_data = request.data.get('connections', [])
        canvas_connection_service = CanvasConnectionService()
        updated_connections = canvas_connection_service.bulk_update_connections(
            connections_data=connections_data,
            user=request.user
        )
        
        return Response(updated_connections)
    
    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """
        批量创建连接
        """
        connections_data = request.data.get('connections', [])
        canvas_id = request.data.get('canvas_id')
        
        if not canvas_id:
            return Response(
                {'error': '缺少画布ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        canvas_connection_service = CanvasConnectionService()
        created_connections = canvas_connection_service.bulk_create_connections(
            connections_data=connections_data,
            canvas_id=canvas_id,
            user=request.user
        )
        
        return Response(created_connections, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        """
        批量删除连接
        """
        connection_ids = request.data.get('connection_ids', [])
        
        if not connection_ids:
            return Response(
                {'error': '缺少连接ID列表'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        canvas_connection_service = CanvasConnectionService()
        deleted_count = canvas_connection_service.bulk_delete_connections(
            connection_ids=connection_ids,
            user=request.user
        )
        
        return Response({'deleted_count': deleted_count})
