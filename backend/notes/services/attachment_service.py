"""
笔记附件服务（优化版）
- 统一业务逻辑
- 实现GridFS文件存储
- 文件验证（大小、MIME类型）
- 流式下载
"""

import logging
from django.conf import settings
from django.utils.text import get_valid_filename
from notes.mongodb_models import NoteAttachment, Note
from users.mongodb_models import User

import uuid
from common.services.storage_service import storage_service

logger = logging.getLogger(__name__)

# 从settings中获取配置，如果未设置则使用默认值
MAX_ATTACHMENT_SIZE = getattr(settings, 'MAX_ATTACHMENT_SIZE', 50 * 1024 * 1024) # 默认50MB
ALLOWED_MIME_TYPES = getattr(settings, 'ALLOWED_MIME_TYPES', [
    'image/jpeg', 'image/png', 'image/gif',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'audio/mpeg', 'audio/wav',
    'video/mp4'
])

class AttachmentService:
    """
    笔记附件服务类
    封装附件相关的业务逻辑
    """

    @staticmethod
    def can_view_attachment(user, note):
        """
        检查用户是否可以查看附件
        """
        if note.is_public:
            return True
        if user and note.user == user:
            return True
        # TODO: 集成自分享和协作模块的权限
        return False

    @staticmethod
    def can_manage_attachment(user, attachment):
        """
        检查用户是否可以管理（编辑、删除）附件
        """
        if not user:
            return False
        return attachment.user == user

    @staticmethod
    def get_attachments_for_note(note, user=None):
        """
        获取笔记的附件列表
        """
        if not AttachmentService.can_view_attachment(user, note):
            return NoteAttachment.objects.none()
        return NoteAttachment.objects(note=note, is_deleted=False)

    @staticmethod
    def upload_attachment(note, user, file_obj):
        """
        Uploads and creates a new attachment, prioritizing object storage.
        """
        # Validate file size and MIME type
        if file_obj.size > MAX_ATTACHMENT_SIZE:
            raise ValueError(f"文件大小超过限制 ({MAX_ATTACHMENT_SIZE // 1024 // 1024}MB)")
        file_type = file_obj.content_type
        if file_type not in ALLOWED_MIME_TYPES:
            raise ValueError(f"不支持的文件类型: {file_type}")

        safe_filename = get_valid_filename(file_obj.name)

        attachment = NoteAttachment(
            note=note,
            user=user,
            file_name=safe_filename,
            file_type=file_type,
            file_size=file_obj.size
        )

        # Prefer object storage if configured
        if storage_service._s3:
            attachment_id = attachment.id or uuid.uuid4()
            attachment.id = attachment_id
            storage_key = f"attachments/{attachment_id}/{safe_filename}"
            file_content = file_obj.read()
            storage_service.save_bytes(file_content, storage_key, content_type=file_type)
            attachment.storage_key = storage_key
            # Do not save to GridFS
            attachment.file = None
        else:
            # Fallback to GridFS
            attachment.file.put(file_obj, content_type=file_type, filename=safe_filename)

        attachment.save()

        # TODO: Asynchronously generate thumbnails, especially for images

        logger.info(f"用户 {user.id} 为笔记 {note.id} 上传了附件 {attachment.id}")
        return attachment

    @staticmethod
    def update_attachment_file(attachment, user, file_obj):
        """
        替换附件文件
        """
        if not AttachmentService.can_manage_attachment(user, attachment):
            raise PermissionError("用户无权修改此附件")

        # 验证文件大小和类型
        if file_obj.size > MAX_ATTACHMENT_SIZE:
            raise ValueError(f"文件大小超过限制 ({MAX_ATTACHMENT_SIZE // 1024 // 1024}MB)")
        file_type = file_obj.content_type
        if file_type not in ALLOWED_MIME_TYPES:
            raise ValueError(f"不支持的文件类型: {file_type}")

        safe_filename = get_valid_filename(file_obj.name)

        # 替换GridFS中的文件
        attachment.file.replace(file_obj, content_type=file_type, filename=safe_filename)

        # 更新元数据
        attachment.file_name = safe_filename
        attachment.file_type = file_type
        attachment.file_size = file_obj.size
        attachment.save()

        logger.info(f"用户 {user.id} 替换了附件 {attachment.id} 的文件")
        return attachment

    @staticmethod
    def update_attachment_meta(attachment, user, file_name):
        """
        更新附件元数据（如文件名）
        """
        if not AttachmentService.can_manage_attachment(user, attachment):
            raise PermissionError("用户无权修改此附件")

        if not file_name:
            raise ValueError("文件名不能为空")

        # 清理文件名以防止路径遍历等问题
        safe_filename = get_valid_filename(file_name)
        attachment.file_name = safe_filename
        attachment.save()

        logger.info(f"用户 {user.id} 更新了附件 {attachment.id} 的元数据")
        return attachment

    @staticmethod
    def delete_attachment(attachment, user):
        """
        软删除附件
        """
        if not AttachmentService.can_manage_attachment(user, attachment):
            raise PermissionError("用户无权删除此附件")

        attachment.soft_delete(user)
        logger.info(f"用户 {user.id} 软删除了附件 {attachment.id}")
        return attachment

