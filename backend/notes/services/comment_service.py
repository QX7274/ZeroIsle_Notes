"""
笔记评论服务（优化版）
- 统一业务逻辑
- 实现软删除
- 权限策略抽象
- 原子操作
"""

import logging
from django.utils import timezone
from notes.mongodb_models import NoteComment, Note
from users.mongodb_models import User

logger = logging.getLogger(__name__)

class CommentService:
    """
    笔记评论服务类
    封装评论相关的业务逻辑
    """

    @staticmethod
    def can_view_comments(user, note):
        """
        检查用户是否可以查看评论
        - 笔记是公开的
        - 用户是笔记的所有者
        - TODO: 将来扩展到协作者和分享者
        """
        if note.is_public:
            return True
        if user and note.user == user:
            return True
        return False

    @staticmethod
    def can_create_comment(user, note):
        """
        检查用户是否可以创建评论
        - 笔记是公开的
        - 用户是笔记的所有者
        - TODO: 将来扩展到协作者和分享者
        """
        if not user:
            return False
        return CommentService.can_view_comments(user, note)

    @staticmethod
    def can_edit_comment(user, comment):
        """
        检查用户是否可以编辑或删除评论
        - 用户是评论的创建者
        - TODO: 将来扩展到笔记所有者或管理员
        """
        if not user:
            return False
        return comment.user == user

    @staticmethod
    def get_comments_for_note(note, user=None):
        """
        获取笔记的评论列表
        """
        if not CommentService.can_view_comments(user, note):
            return NoteComment.objects.none() # 返回空QuerySet
        
        return NoteComment.objects(note=note, is_deleted=False).order_by('-created_at')

    @staticmethod
    def get_user_comments(user):
        """
        获取用户的所有评论
        """
        return NoteComment.objects(user=user, is_deleted=False).order_by('-created_at')

    @staticmethod
    def create_comment(note, user, content, parent=None, request_meta=None):
        """
        创建新评论
        """
        if not CommentService.can_create_comment(user, note):
            raise PermissionError("用户无权在此笔记上发表评论")
        
        # 验证内容
        if not content or len(content) > 2000:
            raise ValueError("评论内容不能为空或超过2000个字符")
        
        # 验证父评论
        if parent and (parent.note != note or parent.is_deleted):
            raise ValueError("无效的父评论")
        
        comment = NoteComment(
            note=note,
            user=user,
            content=content,
            parent=parent,
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        
        # 添加审计信息
        if request_meta:
            comment.ip_address = request_meta.get('REMOTE_ADDR', 'unknown')
            comment.user_agent = request_meta.get('HTTP_USER_AGENT', 'unknown')[:255]
        
        comment.save()
        
        # TODO: 触发通知
        
        logger.info(f"用户 {user.id} 在笔记 {note.id} 上创建了评论 {comment.id}")
        return comment

    @staticmethod
    def update_comment(comment, user, content):
        """
        更新评论
        """
        if not CommentService.can_edit_comment(user, comment):
            raise PermissionError("用户无权编辑此评论")
        
        # 验证内容
        if not content or len(content) > 2000:
            raise ValueError("评论内容不能为空或超过2000个字符")
        
        comment.content = content
        comment.save()
        
        logger.info(f"用户 {user.id} 更新了评论 {comment.id}")
        return comment

    @staticmethod
    def delete_comment(comment, user):
        """
        软删除评论
        """
        if not CommentService.can_edit_comment(user, comment):
            raise PermissionError("用户无权删除此评论")
        
        comment.soft_delete(user)
        logger.info(f"用户 {user.id} 软删除了评论 {comment.id}")
        return comment

    @staticmethod
    def like_comment(comment):
        """
        点赞评论
        """
        comment.increment_likes()
        return comment

    @staticmethod
    def unlike_comment(comment):
        """
        取消点赞评论
        """
        comment.decrement_likes()
        return comment

