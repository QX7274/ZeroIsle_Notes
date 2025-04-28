"""
笔记附件视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.mongodb_models import NoteAttachment, Note
from notes.serializers import NoteAttachmentSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
import uuid

logger = logging.getLogger(__name__)

class NoteAttachmentViewSet(viewsets.ViewSet):
    """
    笔记附件视图集
    """
    serializer_class = NoteAttachmentSerializer
    permission_classes = [IsOwnerOrReadOnly]

    def list(self, request):
        """获取附件列表"""
        user = request.user
        attachments = NoteAttachment.objects.filter(user=user, is_deleted=False)
        serializer = NoteAttachmentSerializer(attachments, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个附件详情"""
        try:
            attachment = NoteAttachment.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = NoteAttachmentSerializer(attachment)
            return Response(serializer.data)
        except NoteAttachment.DoesNotExist:
            return Response(
                {"detail": "附件不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建附件"""
        serializer = NoteAttachmentSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # 获取笔记
            note_id = request.data.get('note')
            try:
                note = Note.objects.get(id=note_id, user=request.user)
            except Note.DoesNotExist:
                return Response(
                    {"detail": "笔记不存在"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 获取文件
            file = request.FILES.get('file')
            if not file:
                return Response(
                    {'error': '未提供文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 创建附件
            attachment = NoteAttachment(
                id=uuid.uuid4(),
                note=note,
                user=request.user,
                file_name=file.name,
                file_type=file.content_type,
                file_size=file.size,
                description=request.data.get('description', ''),
                created_at=timezone.now(),
                updated_at=timezone.now()
            )

            # 保存文件
            attachment.file.put(file, content_type=file.content_type)
            attachment.save()

            serializer = NoteAttachmentSerializer(attachment)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新附件"""
        try:
            attachment = NoteAttachment.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = NoteAttachmentSerializer(attachment, data=request.data, context={'request': request})
            if serializer.is_valid():
                # 更新描述
                attachment.description = request.data.get('description', attachment.description)

                # 更新文件
                file = request.FILES.get('file')
                if file:
                    attachment.file.replace(file, content_type=file.content_type)
                    attachment.file_name = file.name
                    attachment.file_type = file.content_type
                    attachment.file_size = file.size

                attachment.updated_at = timezone.now()
                attachment.save()

                serializer = NoteAttachmentSerializer(attachment)
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except NoteAttachment.DoesNotExist:
            return Response(
                {"detail": "附件不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def partial_update(self, request, pk=None):
        """部分更新附件"""
        try:
            attachment = NoteAttachment.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = NoteAttachmentSerializer(attachment, data=request.data, partial=True, context={'request': request})
            if serializer.is_valid():
                # 更新描述
                if 'description' in request.data:
                    attachment.description = request.data.get('description')

                # 更新文件
                file = request.FILES.get('file')
                if file:
                    attachment.file.replace(file, content_type=file.content_type)
                    attachment.file_name = file.name
                    attachment.file_type = file.content_type
                    attachment.file_size = file.size

                attachment.updated_at = timezone.now()
                attachment.save()

                serializer = NoteAttachmentSerializer(attachment)
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except NoteAttachment.DoesNotExist:
            return Response(
                {"detail": "附件不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除附件"""
        try:
            attachment = NoteAttachment.objects.get(id=pk, user=request.user, is_deleted=False)
            attachment.delete()  # 软删除
            return Response(status=status.HTTP_204_NO_CONTENT)
        except NoteAttachment.DoesNotExist:
            return Response(
                {"detail": "附件不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """下载附件"""
        try:
            attachment = NoteAttachment.objects.get(id=pk, user=request.user, is_deleted=False)
            file_data = attachment.file.read()
            response = Response(file_data, content_type=attachment.file_type)
            response['Content-Disposition'] = f'attachment; filename="{attachment.file_name}"'
            return response
        except NoteAttachment.DoesNotExist:
            return Response(
                {"detail": "附件不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"下载附件失败: {str(e)}")
            return Response(
                {'error': '下载附件失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )