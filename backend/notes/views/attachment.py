"""
笔记附件视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from notes.models import NoteAttachment
from notes.serializers import NoteAttachmentSerializer
from common.permissions import IsOwnerOrReadOnly
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class NoteAttachmentViewSet(viewsets.ModelViewSet):
    """
    笔记附件视图集
    """
    serializer_class = NoteAttachmentSerializer
    permission_classes = [IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        return NoteAttachment.objects.filter(note__user=user)
    
    def perform_create(self, serializer):
        """创建附件时设置上传时间和用户"""
        file = self.request.FILES.get('file')
        if not file:
            return Response(
                {'error': '未提供文件'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 生成文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{timestamp}_{file.name}"
        
        # 保存文件
        try:
            path = default_storage.save(f'attachments/{filename}', ContentFile(file.read()))
            serializer.save(
                file_path=path,
                file_name=file.name,
                file_size=file.size,
                file_type=file.content_type,
                uploaded_at=timezone.now()
            )
        except Exception as e:
            logger.error(f"保存附件失败: {str(e)}")
            return Response(
                {'error': '保存附件失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """下载附件"""
        attachment = self.get_object()
        try:
            file = default_storage.open(attachment.file_path)
            response = Response(file.read(), content_type=attachment.file_type)
            response['Content-Disposition'] = f'attachment; filename="{attachment.file_name}"'
            return response
        except Exception as e:
            logger.error(f"下载附件失败: {str(e)}")
            return Response(
                {'error': '下载附件失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def perform_destroy(self, instance):
        """删除附件时同时删除文件"""
        try:
            if instance.file_path:
                default_storage.delete(instance.file_path)
            instance.delete()
        except Exception as e:
            logger.error(f"删除附件失败: {str(e)}")
            raise 