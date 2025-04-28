"""
关注服务
"""

import logging
import uuid
from django.utils import timezone
from community.mongodb_models import Follow
from users.mongodb_models import User

logger = logging.getLogger('backend')

class FollowService:
    """
    关注服务类
    处理关注相关的业务逻辑
    """

    def toggle_follow(self, user, content_object):
        """
        切换关注状态

        Args:
            user: 用户对象
            content_object: 内容对象

        Returns:
            tuple: (Follow, bool) - 关注对象和是否激活
        """
        try:
            # 确定内容类型
            if isinstance(content_object, User):
                content_type = 'User'
            else:
                content_type = content_object.__class__.__name__

            # 查找现有关注
            follow = Follow.objects.filter(
                user=user,
                content_type=content_type,
                object_id=str(content_object.id)
            ).first()

            created = False

            if not follow:
                # 创建新关注
                follow = Follow(
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
                follow.is_active = not follow.is_active
                follow.updated_at = timezone.now()

            # 保存关注
            follow.save()

            # 创建通知
            if follow.is_active:
                self._create_follow_notification(follow, content_object)

            return follow, follow.is_active
        except Exception as e:
            logger.error(f"切换关注状态失败: {e}")
            raise

    def get_followers(self, content_object, active_only=True):
        """
        获取关注者列表

        Args:
            content_object: 内容对象
            active_only: 是否只获取激活的关注

        Returns:
            QuerySet: 关注查询集
        """
        try:
            # 确定内容类型
            if isinstance(content_object, User):
                content_type = 'User'
            else:
                content_type = content_object.__class__.__name__

            # 构建查询条件
            queryset = Follow.objects.filter(
                content_type=content_type,
                object_id=str(content_object.id)
            )

            if active_only:
                queryset = queryset.filter(is_active=True)

            return queryset
        except Exception as e:
            logger.error(f"获取关注者列表失败: {e}")
            raise

    def get_following(self, user, content_type=None, active_only=True):
        """
        获取用户关注的内容

        Args:
            user: 用户对象
            content_type: 内容类型
            active_only: 是否只获取激活的关注

        Returns:
            QuerySet: 关注查询集
        """
        try:
            # 构建查询条件
            queryset = Follow.objects.filter(user=user)

            if content_type:
                queryset = queryset.filter(content_type=content_type)

            if active_only:
                queryset = queryset.filter(is_active=True)

            return queryset
        except Exception as e:
            logger.error(f"获取用户关注的内容失败: {e}")
            raise

    def is_following(self, user, content_object):
        """
        检查用户是否关注

        Args:
            user: 用户对象
            content_object: 内容对象

        Returns:
            bool: 是否关注
        """
        try:
            # 确定内容类型
            if isinstance(content_object, User):
                content_type = 'User'
            else:
                content_type = content_object.__class__.__name__

            # 检查是否存在激活的关注
            return Follow.objects.filter(
                user=user,
                content_type=content_type,
                object_id=str(content_object.id),
                is_active=True
            ).count() > 0
        except Exception as e:
            logger.error(f"检查用户是否关注失败: {e}")
            return False

    def _create_follow_notification(self, follow, content_object):
        """
        创建关注通知

        Args:
            follow: 关注对象
            content_object: 内容对象

        Returns:
            bool: 是否成功
        """
        try:
            from .notification_service import NotificationService

            # 获取内容对象的用户
            if isinstance(content_object, User):
                # 关注的是用户
                recipient = content_object

                # 不要通知自己
                if recipient == follow.user:
                    return False

                # 创建通知
                notification_service = NotificationService()
                notification_service.create_notification(
                    recipient=recipient,
                    notification_type='follow',
                    title=f"{follow.user.username} 关注了你",
                    message=f"{follow.user.username} 开始关注你了",
                    sender=follow.user,
                    content_type='User',
                    object_id=str(follow.user.id)
                )

                return True

            return False
        except Exception as e:
            logger.error(f"创建关注通知失败: {e}")
            return False
