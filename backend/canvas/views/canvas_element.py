"""
画布元素视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from mongoengine.queryset.visitor import Q

from canvas.mongodb_models import CanvasElement, Canvas
from canvas.serializers import CanvasElementSerializer
from canvas.services import CanvasElementService
from common.permissions import IsOwnerOrReadOnly
from common.pagination import StandardResultsSetPagination

class CanvasElementViewSet(viewsets.ModelViewSet):
    """
    画布元素视图集
    """
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    serializer_class = CanvasElementSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['canvas', 'element_type']
    ordering_fields = ['z_index', 'created_at', 'updated_at']
    ordering = ['z_index']

    def get_queryset(self):
        user = self.request.user
        # 获取用户自己的画布和公开画布的ID
        canvas_ids = [str(canvas.id) for canvas in Canvas.objects.filter(
            Q(user=user) | Q(is_public=True)
        )]
        # 返回这些画布中的元素
        return CanvasElement.objects.filter(canvas_id__in=canvas_ids)

    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """
        批量更新元素
        """
        elements_data = request.data.get('elements', [])
        canvas_element_service = CanvasElementService()
        updated_elements = canvas_element_service.bulk_update_elements(
            elements_data=elements_data,
            user=request.user
        )

        return Response(updated_elements)

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """
        批量创建元素
        """
        elements_data = request.data.get('elements', [])
        canvas_id = request.data.get('canvas_id')

        if not canvas_id:
            return Response(
                {'error': '缺少画布ID'},
                status=status.HTTP_400_BAD_REQUEST
            )

        canvas_element_service = CanvasElementService()
        created_elements = canvas_element_service.bulk_create_elements(
            elements_data=elements_data,
            canvas_id=canvas_id,
            user=request.user
        )

        return Response(created_elements, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        """
        批量删除元素
        """
        element_ids = request.data.get('element_ids', [])

        if not element_ids:
            return Response(
                {'error': '缺少元素ID列表'},
                status=status.HTTP_400_BAD_REQUEST
            )

        canvas_element_service = CanvasElementService()
        deleted_count = canvas_element_service.bulk_delete_elements(
            element_ids=element_ids,
            user=request.user
        )

        return Response({'deleted_count': deleted_count})
