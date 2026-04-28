"""
笔记服务
提供笔记相关的业务逻辑
"""

import logging
from django.utils import timezone
from notes.models import Note, NoteVersion

logger = logging.getLogger('backend')

class NoteService:
    """笔记服务类"""
    
    @staticmethod
    def create_note_version(note):
        """
        创建笔记版本
        
        Args:
            note: 笔记对象
        
        Returns:
            NoteVersion: 创建的笔记版本对象
        """
        try:
            version = NoteVersion.objects.create(
                note=note,
                title=note.title,
                content=note.content,
                user=note.user,
                version_number=NoteService._get_next_version_number(note)
            )
            logger.info(f"为笔记 {note.id} 创建了新版本 {version.version_number}")
            return version
        except Exception as e:
            logger.error(f"创建笔记版本失败: {e}")
            raise
    
    @staticmethod
    def _get_next_version_number(note):
        """
        获取下一个版本号
        
        Args:
            note: 笔记对象
        
        Returns:
            int: 下一个版本号
        """
        latest_version = NoteVersion.objects.filter(note=note).order_by('-version_number').first()
        if latest_version:
            return latest_version.version_number + 1
        return 1
    
    @staticmethod
    def restore_version(version_id):
        """
        恢复到指定版本
        
        Args:
            version_id: 版本ID
        
        Returns:
            Note: 更新后的笔记对象
        """
        try:
            version = NoteVersion.objects.get(id=version_id)
            note = version.note
            
            # 先创建当前版本的备份
            NoteService.create_note_version(note)
            
            # 恢复到指定版本
            note.title = version.title
            note.content = version.content
            note.updated_at = timezone.now()
            note.save()
            
            logger.info(f"笔记 {note.id} 已恢复到版本 {version.version_number}")
            return note
        except NoteVersion.DoesNotExist:
            logger.error(f"版本 {version_id} 不存在")
            raise
        except Exception as e:
            logger.error(f"恢复版本失败: {e}")
            raise
    
    @staticmethod
    def share_note(note, email=None, expiry_days=None, can_edit=False):
        """
        分享笔记
        
        Args:
            note: 笔记对象
            email: 接收者邮箱
            expiry_days: 过期天数
            can_edit: 是否可编辑
        
        Returns:
            NoteShare: 创建的分享对象
        """
        from notes.models import NoteShare
        from datetime import timedelta
        
        try:
            expiry_date = None
            if expiry_days:
                expiry_date = timezone.now() + timedelta(days=expiry_days)
                
            share = NoteShare.objects.create(
                note=note,
                user=note.user,
                recipient_email=email,
                can_edit=can_edit,
                expiry_date=expiry_date
            )
            
            logger.info(f"笔记 {note.id} 已分享给 {email or '公开链接'}")
            return share
        except Exception as e:
            logger.error(f"分享笔记失败: {e}")
            raise
