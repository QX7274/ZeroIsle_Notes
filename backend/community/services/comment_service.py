"""
评论服务
"""

import logging
import uuid
from django.utils import timezone
from community.mongodb_models import Comment, Post

logger = logging.getLogger('backend')

class CommentService:
    """
    评论服务类
    处理评论相关的业务逻辑
    """

    def create_comment(self, user, post_id, content, parent_id=None):
        """
        创建评论

        Args:
            user: 用户对象
            post_id: 帖子ID
            content: 评论内容
            parent_id: 父评论ID

        Returns:
            Comment: 创建的评论
        """
        try:
            # 获取帖子
            try:
                post = Post.objects.get(id=post_id, is_deleted=False)
            except Post.DoesNotExist:
                raise Post.DoesNotExist(f"帖子不存在: {post_id}")

            # 检查帖子是否允许评论
            if not post.allow_comments:
                raise ValueError("该帖子不允许评论")

            # 获取父评论
            parent = None
            if parent_id:
                try:
                    parent = Comment.objects.get(id=parent_id, post=post, is_deleted=False)
                except Comment.DoesNotExist:
                    raise Comment.DoesNotExist(f"父评论不存在: {parent_id}")

            # 创建评论
            comment = Comment(
                id=uuid.uuid4(),
                user=user,
                post=post,
                parent=parent,
                content=content,
                created_at=timezone.now(),
                updated_at=timezone.now()
            )

            # 保存评论
            comment.save()

            # 更新帖子评论数
            post.comment_count += 1
            post.save()

            # 创建通知
            self._create_comment_notification(comment)

            return comment
        except Post.DoesNotExist:
            logger.error(f"帖子不存在: {post_id}")
            raise
        except Comment.DoesNotExist:
            logger.error(f"父评论不存在: {parent_id}")
            raise
        except Exception as e:
            logger.error(f"创建评论失败: {e}")
            raise

    def update_comment(self, comment, content):
        """
        更新评论

        Args:
            comment: 评论对象
            content: 评论内容

        Returns:
            Comment: 更新的评论
        """
        try:
            # 更新评论内容
            comment.content = content
            comment.save()

            return comment
        except Exception as e:
            logger.error(f"更新评论失败: {e}")
            raise

    def delete_comment(self, comment):
        """
        删除评论

        Args:
            comment: 评论对象

        Returns:
            bool: 是否成功
        """
        try:
            # 软删除评论
            comment.delete()

            return True
        except Exception as e:
            logger.error(f"删除评论失败: {e}")
            raise

    def get_comment_by_id(self, comment_id, user=None):
        """
        根据ID获取评论

        Args:
            comment_id: 评论ID
            user: 用户对象

        Returns:
            Comment: 评论对象
        """
        try:
            # 获取评论
            comment = Comment.objects.get(id=comment_id, is_deleted=False)

            # 检查权限
            if user and user != comment.user and user != comment.post.user:
                # 检查帖子是否公开
                if not comment.post.is_public or comment.post.status != 'published':
                    raise Comment.DoesNotExist(f"评论不存在或无权访问: {comment_id}")

            return comment
        except Comment.DoesNotExist:
            logger.error(f"评论不存在: {comment_id}")
            raise
        except Exception as e:
            logger.error(f"获取评论失败: {e}")
            raise

    def get_comments(self, post_id, parent_id=None, user=None, page=1, page_size=20):
        """
        获取评论列表

        Args:
            post_id: 帖子ID
            parent_id: 父评论ID
            user: 用户对象
            page: 页码
            page_size: 每页大小

        Returns:
            tuple: (评论列表, 总数)
        """
        try:
            # 获取帖子
            post = Post.objects.get(id=post_id)

            # 检查权限
            if user and user != post.user:
                # 检查帖子是否公开
                if not post.is_public or post.status != 'published':
                    raise Post.DoesNotExist(f"帖子不存在或无权访问: {post_id}")

            # 构建查询条件
            queryset = Comment.objects.filter(post=post, is_deleted=False)

            if parent_id:
                # 获取回复
                queryset = queryset.filter(parent_id=parent_id)
            else:
                # 获取顶级评论
                queryset = queryset.filter(parent=None)

            # 获取总数
            total = queryset.count()

            # 分页
            start = (page - 1) * page_size
            end = start + page_size

            # 排序并获取结果
            comments = queryset.order_by('-is_pinned', '-created_at')[start:end]

            return comments, total
        except Post.DoesNotExist:
            logger.error(f"帖子不存在: {post_id}")
            raise
        except Exception as e:
            logger.error(f"获取评论列表失败: {e}")
            raise

    def _create_comment_notification(self, comment):
        """
        创建评论通知

        Args:
            comment: 评论对象

        Returns:
            bool: 是否成功
        """
        try:
            from .notification_service import NotificationService

            notification_service = NotificationService()

            # 如果是回复，通知被回复的评论作者
            if comment.parent:
                # 不要通知自己
                if comment.parent.user != comment.user:
                    notification_service.create_notification(
                        recipient=comment.parent.user,
                        notification_type='reply',
                        title=f"{comment.user.username} 回复了你的评论",
                        message=f"{comment.user.username} 回复了你在《{comment.post.title}》中的评论: {comment.content[:50]}...",
                        sender=comment.user,
                        content_type='Comment',
                        object_id=str(comment.id)
                    )

            # 通知帖子作者
            if comment.post.user != comment.user:
                notification_service.create_notification(
                    recipient=comment.post.user,
                    notification_type='comment',
                    title=f"{comment.user.username} 评论了你的帖子",
                    message=f"{comment.user.username} 评论了你的帖子《{comment.post.title}》: {comment.content[:50]}...",
                    sender=comment.user,
                    content_type='Comment',
                    object_id=str(comment.id)
                )

            return True
        except Exception as e:
            logger.error(f"创建评论通知失败: {e}")
            return False
