"""无限画布视图"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Canvas, CanvasElement, CanvasConnection
from .serializers import CanvasSerializer, CanvasElementSerializer, CanvasConnectionSerializer


class CanvasViewSet(viewsets.ModelViewSet):
    """
    画布视图集
    """
    permission_classes = [IsAuthenticated]
    serializer_class = CanvasSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_public']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'updated_at', 'view_count']
    ordering = ['-updated_at']
    
    def get_queryset(self):
        user = self.request.user
        # 返回用户自己的画布和公开的画布
        return Canvas.objects.filter(user=user) | Canvas.objects.filter(is_public=True)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def increment_view(self, request, pk=None):
        """
        增加画布查看次数
        """
        canvas = self.get_object()
        canvas.view_count += 1
        canvas.save()
        return Response({'status': 'view count incremented'})
    
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


class CanvasElementViewSet(viewsets.ModelViewSet):
    """
    画布元素视图集
    """
    permission_classes = [IsAuthenticated]
    serializer_class = CanvasElementSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['canvas', 'element_type']
    ordering_fields = ['z_index', 'created_at', 'updated_at']
    ordering = ['z_index']
    
    def get_queryset(self):
        user = self.request.user
        # 返回用户自己的画布中的元素和公开画布中的元素
        return CanvasElement.objects.filter(canvas__user=user) | CanvasElement.objects.filter(canvas__is_public=True)
    
    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """
        批量更新元素
        """
        elements_data = request.data.get('elements', [])
        updated_elements = []
        
        for element_data in elements_data:
            element_id = element_data.pop('id', None)
            if not element_id:
                continue
                
            try:
                element = CanvasElement.objects.get(id=element_id)
                # 确保用户有权限更新此元素
                if element.canvas.user != request.user:
                    continue
                    
                serializer = CanvasElementSerializer(element, data=element_data, partial=True)
                if serializer.is_valid():
                    serializer.save()
                    updated_elements.append(serializer.data)
            except CanvasElement.DoesNotExist:
                pass
        
        return Response(updated_elements)


class CanvasConnectionViewSet(viewsets.ModelViewSet):
    """
    画布连接视图集
    """
    permission_classes = [IsAuthenticated]
    serializer_class = CanvasConnectionSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['canvas', 'connection_type', 'source', 'target']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        # 返回用户自己的画布中的连接和公开画布中的连接
        return CanvasConnection.objects.filter(canvas__user=user) | CanvasConnection.objects.filter(canvas__is_public=True)