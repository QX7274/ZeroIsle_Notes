"""
笔记模板视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.models import NoteTemplate
from notes.serializers import NoteTemplateSerializer
from common.permissions import IsOwnerOrReadOnly
import logging

logger = logging.getLogger(__name__)

class NoteTemplateViewSet(viewsets.ModelViewSet):
    """
    笔记模板视图集
    """
    serializer_class = NoteTemplateSerializer
    permission_classes = [IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        category = self.request.query_params.get('category')
        if category:
            return NoteTemplate.objects.filter(user=user, category=category)
        return NoteTemplate.objects.filter(user=user)
    
    def perform_create(self, serializer):
        """创建模板时设置创建时间和用户"""
        serializer.save(
            user=self.request.user,
            created_at=timezone.now()
        )
    
    @action(detail=True, methods=['post'])
    def apply(self, request, pk=None):
        """应用模板"""
        template = self.get_object()
        try:
            note_id = request.data.get('note_id')
            if not note_id:
                return Response(
                    {'error': '缺少note_id参数'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 创建新笔记
            note = template.note
            note.pk = None
            note.id = note_id
            note.save()
            
            return Response({
                'message': '模板应用成功',
                'note_id': note.id
            })
        except Exception as e:
            logger.error(f"应用模板失败: {str(e)}")
            return Response(
                {'error': '应用模板失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def categories(self, request):
        """获取模板分类"""
        try:
            categories = NoteTemplate.objects.filter(
                user=request.user
            ).values_list('category', flat=True).distinct()
            return Response({'categories': list(categories)})
        except Exception as e:
            logger.error(f"获取模板分类失败: {str(e)}")
            return Response(
                {'error': '获取模板分类失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def public_templates(self, request):
        """获取公共模板"""
        try:
            templates = NoteTemplate.objects.filter(is_public=True)
            return Response(
                NoteTemplateSerializer(templates, many=True).data
            )
        except Exception as e:
            logger.error(f"获取公共模板失败: {str(e)}")
            return Response(
                {'error': '获取公共模板失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 