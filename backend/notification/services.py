"""
通知服务
提供通知的创建、发送和管理功能
"""

import logging
from django.utils import timezone
from .mongodb_models import Notification
from users.mongodb_models import User

logger = logging.getLogger(__name__)

class NotificationService:
    """通知服务类"""
    
    def create_notification(self, recipient, notification_type, title, message, sender=None, related_object=None):
        """
        创建通知
        
        Args:
            recipient: 接收者（User对象或用户ID）
            notification_type: 通知类型
            title: 通知标题
            message: 通知内容
            sender: 发送者（User对象或用户ID，可选）
            related_object: 关联对象（可选）
            
        Returns:
            Notification: 创建的通知对象
        """
        try:
            # 如果recipient是ID，获取User对象
            if isinstance(recipient, str):
                recipient = User.objects.get(id=recipient)
                
            # 如果sender是ID，获取User对象
            if sender and isinstance(sender, str):
                sender = User.objects.get(id=sender)
                
            # 创建通知
            notification = Notification(
                recipient=recipient,
                notification_type=notification_type,
                title=title,
                message=message,
                sender=sender,
                related_object=related_object,
                created_at=timezone.now()
            )
            notification.save()
            
            logger.info(f"通知创建成功: {notification.id}")
            return notification
        except Exception as e:
            logger.error(f"创建通知失败: {str(e)}")
            raise
    
    def mark_as_read(self, notification_id):
        """
        标记通知为已读
        
        Args:
            notification_id: 通知ID
            
        Returns:
            bool: 是否成功
        """
        try:
            notification = Notification.objects.get(id=notification_id)
            notification.mark_as_read()
            logger.info(f"通知已标记为已读: {notification_id}")
            return True
        except Exception as e:
            logger.error(f"标记通知为已读失败: {str(e)}")
            return False
    
    def mark_all_as_read(self, user_id):
        """
        标记用户所有通知为已读
        
        Args:
            user_id: 用户ID
            
        Returns:
            int: 标记的通知数量
        """
        try:
            user = User.objects.get(id=user_id)
            now = timezone.now()
            result = Notification.objects(recipient=user, is_read=False).update(
                is_read=True,
                read_at=now
            )
            logger.info(f"用户 {user_id} 的所有通知已标记为已读: {result}")
            return result
        except Exception as e:
            logger.error(f"标记所有通知为已读失败: {str(e)}")
            return 0
    
    def get_unread_count(self, user_id):
        """
        获取用户未读通知数量
        
        Args:
            user_id: 用户ID
            
        Returns:
            int: 未读通知数量
        """
        try:
            user = User.objects.get(id=user_id)
            count = Notification.objects(recipient=user, is_read=False).count()
            return count
        except Exception as e:
            logger.error(f"获取未读通知数量失败: {str(e)}")
            return 0
    
    def get_notifications(self, user_id, page=1, page_size=20, notification_type=None, is_read=None):
        """
        获取用户通知列表
        
        Args:
            user_id: 用户ID
            page: 页码
            page_size: 每页数量
            notification_type: 通知类型（可选）
            is_read: 是否已读（可选）
            
        Returns:
            list: 通知列表
            int: 总数量
        """
        try:
            user = User.objects.get(id=user_id)
            
            # 构建查询条件
            query = {'recipient': user}
            if notification_type:
                query['notification_type'] = notification_type
            if is_read is not None:
                query['is_read'] = is_read
                
            # 计算总数
            total = Notification.objects(**query).count()
            
            # 分页查询
            skip = (page - 1) * page_size
            notifications = Notification.objects(**query).order_by('-created_at').skip(skip).limit(page_size)
            
            return list(notifications), total
        except Exception as e:
            logger.error(f"获取通知列表失败: {str(e)}")
            return [], 0
    
    def delete_notification(self, notification_id):
        """
        删除通知
        
        Args:
            notification_id: 通知ID
            
        Returns:
            bool: 是否成功
        """
        try:
            notification = Notification.objects.get(id=notification_id)
            notification.delete()
            logger.info(f"通知已删除: {notification_id}")
            return True
        except Exception as e:
            logger.error(f"删除通知失败: {str(e)}")
            return False
    
    def delete_all_notifications(self, user_id):
        """
        删除用户所有通知
        
        Args:
            user_id: 用户ID
            
        Returns:
            int: 删除的通知数量
        """
        try:
            user = User.objects.get(id=user_id)
            result = Notification.objects(recipient=user).delete()
            logger.info(f"用户 {user_id} 的所有通知已删除: {result}")
            return result
        except Exception as e:
            logger.error(f"删除所有通知失败: {str(e)}")
            return 0
