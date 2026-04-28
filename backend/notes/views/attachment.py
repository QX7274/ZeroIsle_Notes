"""
笔记附件视图（优化版）
- 使用AttachmentService封装业务逻辑
- 实现软删除、分页和流式下载
- 添加文件验证
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import StreamingHttpResponse
from wsgiref.util import FileWrapper
from common.pagination import StandardResultsSetPagination
from notes.mongodb_models import NoteAttachment, Note
from notes.serializers import NoteAttachmentSerializer
from notes.services.attachment_service import AttachmentService
import logging

logger = logging.getLogger(__name__)

class NoteAttachmentViewSet(viewsets.ViewSet):
    """
    笔记附件视图集（优化版）
    """
    serializer_class = NoteAttachmentSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    # Manual paginator setup for ViewSet
    @property
    def paginator(self):
        if not hasattr(self, '_paginator'):
            if self.pagination_class is None:
                self._paginator = None
            else:
                self._paginator = self.pagination_class()
        return self._paginator

    def paginate_queryset(self, queryset):
        if self.paginator is None:
            return None
        return self.paginator.paginate_queryset(queryset, self.request, view=self)

    def get_paginated_response(self, data):
        assert self.paginator is not None
        return self.paginator.get_paginated_response(data)

    def get_serializer(self, *args, **kwargs):
        serializer_class = self.serializer_class
        kwargs.setdefault('context', {'request': self.request, 'view': self})
        return serializer_class(*args, **kwargs)

    def list(self, request):
        """获取附件列表（使用AttachmentService，支持分页）"""
        note_id = request.query_params.get('note_id')
        if not note_id:
            return Response(
                {"detail": "缺少note_id参数"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            note = Note.objects.get(id=note_id)
            attachments = AttachmentService.get_attachments_for_note(note, request.user)

            # 分页
            page = self.paginate_queryset(attachments)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

            serializer = self.get_serializer(attachments, many=True)
            return Response(serializer.data)
        except Note.DoesNotExist:
            return Response({"detail": "笔记不存在"}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)

    def retrieve(self, request, pk=None):
        """获取单个附件详情（使用AttachmentService）"""
        try:
            attachment = NoteAttachment.objects.get(id=pk, is_deleted=False)
            if not AttachmentService.can_view_attachment(request.user, attachment.note):
                raise PermissionError("您没有权限查看此附件")

            serializer = self.get_serializer(attachment)
            return Response(serializer.data)
        except NoteAttachment.DoesNotExist:
            return Response(
                {"detail": "附件不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)

    def create(self, request):
        """创建附件（使用AttachmentService）"""
        note_id = request.data.get('note')
        file_obj = request.FILES.get('file')

        if not note_id or not file_obj:
            return Response(
                {"detail": "缺少note_id或file参数"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            note = Note.objects.get(id=note_id, user=request.user)

            attachment = AttachmentService.upload_attachment(
                note=note,
                user=request.user,
                file_obj=file_obj
            )

            serializer = self.get_serializer(attachment)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Note.DoesNotExist:
            return Response({"detail": "笔记不存在或无权访问"}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"创建附件失败: {str(e)}")
            return Response(
                {'error': '创建附件失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def update(self, request, pk=None):
        """更新附件（使用AttachmentService）"""
        try:
            attachment = NoteAttachment.objects.get(id=pk, is_deleted=False)
            updated_attachment = None

            # 检查是否有文件更新
            file_obj = request.FILES.get('file')
            if file_obj:
                updated_attachment = AttachmentService.update_attachment_file(
                    attachment=attachment,
                    user=request.user,
                    file_obj=file_obj
                )

            # 检查是否有元数据更新（如文件名）
            file_name = request.data.get('file_name')
            if file_name:
                # 如果文件也更新了，就在已更新的对象上操作
                target_attachment = updated_attachment or attachment
                updated_attachment = AttachmentService.update_attachment_meta(
                    attachment=target_attachment,
                    user=request.user,
                    file_name=file_name
                )

            if not updated_attachment:
                return Response({"detail": "没有提供要更新的数据（file或file_name）"}, status=status.HTTP_400_BAD_REQUEST)

            serializer = self.get_serializer(updated_attachment)
            return Response(serializer.data)

        except NoteAttachment.DoesNotExist:
            return Response({"detail": "附件不存在或已删除"}, status=status.HTTP_404_NOT_FOUND)
        except (ValueError, PermissionError) as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"更新附件失败: {str(e)}")
            return Response({'error': '更新附件失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def partial_update(self, request, pk=None):
        """部分更新附件（代理到update）"""
        return self.update(request, pk)

    def destroy(self, request, pk=None):
        """删除附件（软删除，使用AttachmentService）"""
        try:
            attachment = NoteAttachment.objects.get(id=pk, is_deleted=False)
            AttachmentService.delete_attachment(attachment, request.user)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except NoteAttachment.DoesNotExist:
            return Response(
                {"detail": "附件不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            logger.error(f"删除附件失败: {str(e)}")
            return Response({'error': '删除附件失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _get_file_response(self, attachment, disposition='attachment'):
        """Helper to create a streaming file response."""
        gridfs_file = attachment.file

        # Use FileWrapper for efficient streaming
        response = StreamingHttpResponse(
            FileWrapper(gridfs_file, 8192), # 8KB chunk size
            content_type=attachment.file_type or 'application/octet-stream'
        )
        response['Content-Length'] = attachment.file_size
        response['Content-Disposition'] = f'{disposition}; filename="{attachment.file_name}"'
        return response

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """下载附件（流式传输）"""
        try:
            attachment = NoteAttachment.objects.get(id=pk, is_deleted=False)
            if not AttachmentService.can_view_attachment(request.user, attachment.note):
                raise PermissionError("您没有权限下载此附件")

            return self._get_file_response(attachment, 'attachment')

        except NoteAttachment.DoesNotExist:
            return Response({"detail": "附件不存在或已删除"}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            logger.error(f"下载附件失败: {str(e)}")
            return Response({'error': '下载附件失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def view(self, request, pk=None):
        """直接查看文件（流式传输）"""
        try:
            attachment = NoteAttachment.objects.get(id=pk, is_deleted=False)
            if not AttachmentService.can_view_attachment(request.user, attachment.note):
                raise PermissionError("您没有权限查看此附件")

            return self._get_file_response(attachment, 'inline')

        except NoteAttachment.DoesNotExist:
            return Response({"detail": "附件不存在或已删除"}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as e:
            return Response({"detail": str(e)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            logger.error(f"查看文件失败: {str(e)}")
            return Response({'error': '查看文件失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)