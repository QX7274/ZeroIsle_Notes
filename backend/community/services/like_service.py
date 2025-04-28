"""
点赞服务
"""

import logging
import uuid
from django.utils import timezone
from community.mongodb_models import Like, Post, Comment

logger = logging.getLogger('backend')

class LikeService:
    """
    点赞服务类
    处理点赞相关的业务逻辑
    """

    def toggle_like(self, user, content_object):
        """
        切换点赞状态

        Args:
            user: 用户对象
            content_object: 内容对象

        Returns:
            tuple: (Like, bool) - 点赞对象和是否激活
        """
        try:
            # 确定内容类型
            if isinstance(content_object, Post):
                content_type = 'Post'
            elif isinstance(content_object, Comment):
                content_type = 'Comment'
            else:
                content_type = content_object.__class__.__name__

            # 查找现有点赞
            like = Like.objects.filter(
                user=user,
                content_type=content_type,
                object_id=str(content_object.id)
            ).first()

            created = False

            if not like:
                # 创建新点赞
                like = Like(
                    id=uuid.uuid4(),
                    user=user,
                    content_type=content_type,
                    object_id=str(content_object.id),
                    is_active=True,
                    created_at=timezone.now(),
                    updated_at=timezone.now()
                )
                created = True
            else:
                # 切换状态
                like.is_active = not like.is_active
                like.updated_at = timezone.now()

            # 保存点赞
            like.save()

            # 更新内容对象的点赞数
            if hasattr(content_object, 'like_count'):
                if like.is_active:
                    content_object.like_count += 1
                else:
                    content_object.like_count = max(0, content_object.like_count - 1)
                content_object.save()

            # 创建通知
            if like.is_active:
                self._create_like_notification(like, content_object)

            return like, like.is_active
        except Exception as e:
            logger.error(f"切换点赞状态失败: {e}")
            raise

    def get_likes(self, content_object, active_only=True):
        """
        获取点赞列表

        Args:
            content_object: 内容对象
            active_only: 是否只获取激活的点赞

        Returns:
            QuerySet: 点赞查询集
        """
        try:
            # 确定内容类型
            if isinstance(content_object, Post):
                content_type = 'Post'
            elif isinstance(content_object, Comment):
                content_type = 'Comment'
            else:
                content_type = content_object.__class__.__name__

            # 构建查询条件
            queryset = Like.objects.filter(
                content_type=content_type,
                object_id=str(content_object.id)
            )

            if active_only:
                queryset = queryset.filter(is_active=True)

            return queryset
        except Exception as e:
            logger.error(f"获取点赞列表失败: {e}")
            raise

    def is_liked_by_user(self, user, content_object):
        """
        检查用户是否点赞

        Args:
            user: 用户对象
            content_object: 内容对象

        Returns:
            bool: 是否点赞
        """
        try:
            # 确定内容类型
            if isinstance(content_object, Post):
                content_type = 'Post'
            elif isinstance(content_object, Comment):
                content_type = 'Comment'
            else:
                content_type = content_object.__class__.__name__

            # 检查是否存在激活的点赞
            return Like.objects.filter(
                user=user,
                content_type=content_type,
                object_id=str(content_object.id),
                is_active=True
            ).count() > 0
        except Exception as e:
            logger.error(f"检查用户是否点赞失败: {e}")
            return False

    def _create_like_notification(self, like, content_object):
        """
        创建点赞通知

        Args:
            like: 点赞对象
            content_object: 内容对象

        Returns:
            bool: 是否成功
        """
        try:
            from .notification_service import NotificationService

            # 获取内容对象的用户
            if hasattr(content_object, 'user'):
                recipient = content_object.user

                # 不要通知自己
                if recipient == like.user:
                    return False

                # 获取内容类型名称
                content_type_name = like.content_type.lower()

                # 根据内容类型构建通知
                if content_type_name == 'post':
                    title = f"{like.user.username} 点赞了你的帖子"
                    message = f"{like.user.username} 点赞了你的帖子《{content_object.title}》"
                elif content_type_name == 'comment':
                    title = f"{like.user.username} 点赞了你的评论"
                    message = f"{like.user.username} 点赞了你在《{content_object.post.title}》中的评论"
                else:
                    title = f"{like.user.username} 点赞了你的内容"
                    message = f"{like.user.username} 点赞了你的 {content_type_name}"

                # 创建通知
                notification_service = NotificationService()
                notification_service.create_notification(
                    recipient=recipient,
                    notification_type='like',
                    title=title,
                    message=message,
                    sender=like.user,
                    content_type=content_type_name,
                    object_id=str(content_object.id)
                )

                return True

            return False
        except Exception as e:
            logger.error(f"创建点赞通知失败: {e}")
            return False
