"""
关注服务
"""

import logging
from django.db import transaction
from django.contrib.contenttypes.models import ContentType
from community.models import Follow

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
            with transaction.atomic():
                # 获取内容类型
                content_type = ContentType.objects.get_for_model(content_object)
                
                # 获取或创建关注
                follow, created = Follow.objects.get_or_create(
                    user=user,
                    content_type=content_type,
                    object_id=str(content_object.id),
                    defaults={'is_active': True}
                )
                
                if not created:
                    # 切换状态
                    follow.is_active = not follow.is_active
                    follow.save()
                
                # 创建通知
                if follow.is_active:
                    self._create_follow_notification(follow)
                
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
            # 获取内容类型
            content_type = ContentType.objects.get_for_model(content_object)
            
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
            # 获取内容类型
            content_type = ContentType.objects.get_for_model(content_object)
            
            # 检查是否存在激活的关注
            return Follow.objects.filter(
                user=user,
                content_type=content_type,
                object_id=str(content_object.id),
                is_active=True
            ).exists()
        except Exception as e:
            logger.error(f"检查用户是否关注失败: {e}")
            return False
    
    def _create_follow_notification(self, follow):
        """
        创建关注通知
        
        Args:
            follow: 关注对象
            
        Returns:
            bool: 是否成功
        """
        try:
            from .notification_service import NotificationService
            
            # 获取内容对象
            content_object = follow.content_object
            
            # 获取内容对象的用户
            if hasattr(content_object, 'username'):
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
                    content_object=follow.user
                )
                
                return True
            
            return False
        except Exception as e:
            logger.error(f"创建关注通知失败: {e}")
            return False
