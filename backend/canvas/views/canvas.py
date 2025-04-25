"""
画布视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q

from canvas.models import Canvas
from canvas.serializers import (
    CanvasSerializer, 
    CanvasDetailSerializer, 
    CanvasElementSerializer, 
    CanvasConnectionSerializer
)
from canvas.services import CanvasService
from common.permissions import IsOwnerOrReadOnly
from common.pagination import StandardResultsSetPagination

class CanvasViewSet(viewsets.ModelViewSet):
    """
    画布视图集
    """
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    serializer_class = CanvasSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_public']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'updated_at', 'view_count']
    ordering = ['-updated_at']
    
    def get_queryset(self):
        user = self.request.user
        # 返回用户自己的画布和公开的画布
        return Canvas.objects.filter(Q(user=user) | Q(is_public=True))
    
    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'retrieve' or self.action == 'full_data':
            return CanvasDetailSerializer
        return self.serializer_class
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def increment_view(self, request, pk=None):
        """
        增加画布查看次数
        """
        canvas = self.get_object()
        canvas_service = CanvasService()
        canvas = canvas_service.increment_view_count(canvas)
        return Response({'status': 'view count incremented', 'view_count': canvas.view_count})
    
    @action(detail=True, methods=['get'])
    def full_data(self, request, pk=None):
        """
        获取画布完整数据，包括所有元素和连接
        """
        canvas = self.get_object()
        canvas_data = CanvasSerializer(canvas).data
        elements = CanvasElementSerializer(canvas.elements.all(), many=True).data
        connections = CanvasConnectionSerializer(canvas.connections.all(), many=True).data
        
        return Response({
            'canvas': canvas_data,
            'elements': elements,
            'connections': connections
        })
    
    @action(detail=False, methods=['get'])
    def my(self, request):
        """
        获取当前用户的画布
        """
        queryset = Canvas.objects.filter(user=request.user)
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def public(self, request):
        """
        获取公开的画布
        """
        queryset = Canvas.objects.filter(is_public=True)
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
