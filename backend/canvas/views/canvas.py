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
from canvas.services.export_service import CanvasExportService
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

    @action(detail=True, methods=['get'])
    def export(self, request, pk=None):
        """
        导出画布
        支持的格式: json, png, svg, pdf
        """
        canvas = self.get_object()
        format = request.query_params.get('format', 'json').lower()

        # 创建导出服务
        export_service = CanvasExportService()

        try:
            if format == 'json':
                # 导出为JSON
                return export_service.export_to_json(canvas)
            elif format == 'png':
                # 导出为PNG
                return export_service.export_to_png(canvas)
            elif format == 'svg':
                # 导出为SVG
                return export_service.export_to_svg(canvas)
            elif format == 'pdf':
                # 导出为PDF
                return export_service.export_to_pdf(canvas)
            else:
                return Response({
                    'error': f'不支持的导出格式: {format}'
                }, status=status.HTTP_400_BAD_REQUEST)
        except ImportError as e:
            return Response({
                'error': f'导出失败: {str(e)}'
            }, status=status.HTTP_501_NOT_IMPLEMENTED)
        except Exception as e:
            return Response({
                'error': f'导出失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def import_canvas(self, request):
        """
        导入画布
        支持的格式: json
        """
        import json
        from django.db import transaction

        try:
            file = request.FILES.get('file')
            if not file:
                return Response({
                    'error': '未提供文件'
                }, status=status.HTTP_400_BAD_REQUEST)

            # 检查文件类型
            if not file.name.endswith('.json'):
                return Response({
                    'error': '仅支持导入JSON格式的画布'
                }, status=status.HTTP_400_BAD_REQUEST)

            # 解析JSON
            try:
                data = json.loads(file.read().decode('utf-8'))
            except json.JSONDecodeError:
                return Response({
                    'error': 'JSON格式错误'
                }, status=status.HTTP_400_BAD_REQUEST)

            # 验证数据结构
            if 'canvas' not in data or 'elements' not in data or 'connections' not in data:
                return Response({
                    'error': '画布数据结构不完整'
                }, status=status.HTTP_400_BAD_REQUEST)

            # 开始事务
            with transaction.atomic():
                # 创建画布
                canvas_data = data['canvas']
                canvas_data.pop('id', None)  # 移除ID，使用新ID
                canvas_data['user'] = request.user

                canvas = Canvas.objects.create(**canvas_data)

                # 创建元素
                elements_map = {}  # 旧ID到新ID的映射
                for element_data in data['elements']:
                    old_id = element_data.pop('id', None)
                    element_data['canvas'] = canvas
                    element = canvas.elements.create(**element_data)
                    if old_id:
                        elements_map[old_id] = str(element.id)

                # 创建连接
                for connection_data in data['connections']:
                    connection_data.pop('id', None)
                    connection_data['canvas'] = canvas

                    # 更新源和目标ID
                    if 'source' in connection_data and connection_data['source'] in elements_map:
                        connection_data['source'] = elements_map[connection_data['source']]
                    if 'target' in connection_data and connection_data['target'] in elements_map:
                        connection_data['target'] = elements_map[connection_data['target']]

                    canvas.connections.create(**connection_data)

            return Response({
                'message': '画布导入成功',
                'canvas_id': str(canvas.id)
            })

        except Exception as e:
            return Response({
                'error': f'导入画布失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
