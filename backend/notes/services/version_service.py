"""
笔记版本服务（优化版）
- 统一业务逻辑
- 实现版本创建、恢复和软删除
- 保证数据一致性（当前版本标记、原子性）
"""

import logging
from datetime import timedelta
from django.utils import timezone
from mongoengine.errors import NotUniqueError
from notes.mongodb_models import NoteVersion, Note
from users.mongodb_models import User

logger = logging.getLogger(__name__)

class VersionService:
    """
    笔记版本服务类
    封装版本相关的业务逻辑
    """

    @staticmethod
    def can_manage_versions(user, note):
        """
        检查用户是否可以管理版本（创建、恢复、删除）
        - 只有笔记的所有者可以管理版本
        """
        if not user or not note:
            return False
        return note.user == user

    @staticmethod
    def get_versions_for_note(note, user):
        """
        获取笔记的版本列表
        """
        if not VersionService.can_manage_versions(user, note):
            raise PermissionError("您没有权限查看此笔记的版本")
        return NoteVersion.objects(note=note, is_deleted=False).order_by('-version_number')

    @staticmethod
    def get_next_version_number(note):
        """
        获取下一个可用的版本号
        """
        last_version = NoteVersion.objects(note=note).order_by('-version_number').first()
        return (last_version.version_number + 1) if last_version else 1

    @staticmethod
    def create_version(note, user, description, is_auto_save=False):
        """
        创建新版本
        """
        if not VersionService.can_manage_versions(user, note):
            raise PermissionError("您没有权限创建版本")

        version_number = VersionService.get_next_version_number(note)
        
        new_version = NoteVersion(
            note=note,
            user=user,
            title=note.title,
            content=note.content,
            description=description,
            version_number=version_number,
            is_auto_save=is_auto_save,
            is_current=not is_auto_save, # 自动保存不设为当前版本
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        
        # 如果不是自动保存，则将旧的当前版本标记为非当前
        if not is_auto_save:
            NoteVersion.objects(note=note, is_current=True).update(set__is_current=False)
        
        new_version.save()
        
        logger.info(f"为笔记 {note.id} 创建了新版本 {version_number}")
        return new_version

    @staticmethod
    def restore_version(version_to_restore, user):
        """
        从指定版本恢复笔记
        - 这会创建一个新的版本，并将笔记内容更新为所选版本的内容
        """
        note = version_to_restore.note
        if not VersionService.can_manage_versions(user, note):
            raise PermissionError("您没有权限恢复此版本")

        if version_to_restore.is_deleted:
            raise ValueError("不能从已删除的版本恢复")

        # 更新笔记内容
        note.title = version_to_restore.title
        note.content = version_to_restore.content
        note.save()

        # 创建一个新的版本来记录这次恢复操作
        version_number = VersionService.get_next_version_number(note)
        description = f"从版本 {version_to_restore.version_number} 恢复"
        
        new_version = NoteVersion(
            note=note,
            user=user,
            title=note.title,
            content=note.content,
            description=description,
            version_number=version_number,
            is_auto_save=False,
            is_current=True,
            restored_from=version_to_restore,
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        
        # 将所有其他版本设为非当前
        NoteVersion.objects(note=note, is_current=True).update(set__is_current=False)
        new_version.save()
        
        logger.info(f"笔记 {note.id} 已从版本 {version_to_restore.version_number} 恢复")
        return new_version

    @staticmethod
    def delete_version(version, user):
        """
        软删除版本
        """
        if not VersionService.can_manage_versions(user, version.note):
            raise PermissionError("您没有权限删除此版本")

        if version.is_current:
            raise ValueError("不能删除当前版本")

        version.soft_delete(user)
        logger.info(f"版本 {version.id} 已被软删除")
        return version

    @staticmethod
    def get_latest_auto_save(note, user, within_minutes=30):
        """
        获取指定时间范围内的最新自动保存版本
        """
        if not VersionService.can_manage_versions(user, note):
            # No permission error here, just return None as it's a 'get' operation
            return None

        time_threshold = timezone.now() - timedelta(minutes=within_minutes)

        return NoteVersion.objects(
            note=note,
            user=user,
            is_auto_save=True,
            is_deleted=False,
            created_at__gte=time_threshold
        ).order_by('-created_at').first()
