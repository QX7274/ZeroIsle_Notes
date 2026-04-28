"""
增强通知偏好设置服务
提供通知偏好管理、免打扰时段、通知分类优先级等功能
"""

import logging
from datetime import datetime, time, timedelta
from typing import Dict, List, Optional, Any
from django.utils import timezone
from mongoengine import Document, StringField, BooleanField, DictField, ListField
from mongoengine import ReferenceField, DateTimeField, IntField, EmbeddedDocument, EmbeddedDocumentField
import uuid

from users.mongodb_models import User

logger = logging.getLogger(__name__)


class DoNotDisturbSchedule(EmbeddedDocument):
    """
    免打扰时间段
    """
    enabled = BooleanField(default=False, verbose_name='是否启用')
    start_time = StringField(default='22:00', verbose_name='开始时间')  # HH:MM 格式
    end_time = StringField(default='08:00', verbose_name='结束时间')  # HH:MM 格式
    days_of_week = ListField(IntField(), default=lambda: [0, 1, 2, 3, 4, 5, 6], verbose_name='生效日期')  # 0=周一


class NotificationChannelSettings(EmbeddedDocument):
    """
    通知渠道设置
    """
    push = BooleanField(default=True, verbose_name='推送通知')
    in_app = BooleanField(default=True, verbose_name='应用内通知')
    email = BooleanField(default=False, verbose_name='邮件通知')
    sms = BooleanField(default=False, verbose_name='短信通知')


class NotificationPreferences(Document):
    """
    用户通知偏好设置文档
    """
    user = ReferenceField(User, required=True, unique=True, verbose_name='用户')
    
    # 全局开关
    global_enabled = BooleanField(default=True, verbose_name='全局通知开关')
    
    # 免打扰设置
    do_not_disturb = EmbeddedDocumentField(DoNotDisturbSchedule, default=DoNotDisturbSchedule)
    
    # 各类型通知设置
    type_settings = DictField(default=lambda: {
        'system': {'enabled': True, 'priority': 'high', 'channels': {'push': True, 'in_app': True}},
        'note': {'enabled': True, 'priority': 'medium', 'channels': {'push': True, 'in_app': True}},
        'comment': {'enabled': True, 'priority': 'medium', 'channels': {'push': True, 'in_app': True}},
        'share': {'enabled': True, 'priority': 'medium', 'channels': {'push': True, 'in_app': True}},
        'collaboration': {'enabled': True, 'priority': 'high', 'channels': {'push': True, 'in_app': True}},
        'reminder': {'enabled': True, 'priority': 'high', 'channels': {'push': True, 'in_app': True, 'email': True}},
        'like': {'enabled': True, 'priority': 'low', 'channels': {'push': False, 'in_app': True}},
        'reply': {'enabled': True, 'priority': 'medium', 'channels': {'push': True, 'in_app': True}},
        'follow': {'enabled': True, 'priority': 'low', 'channels': {'push': False, 'in_app': True}},
        'mention': {'enabled': True, 'priority': 'high', 'channels': {'push': True, 'in_app': True}},
    }, verbose_name='类型设置')
    
    # 静默时间段（用于单次静默）
    muted_until = DateTimeField(verbose_name='静默到期时间')
    
    # 设置更新时间
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'notification_preferences',
        'indexes': [
            {'fields': ['user'], 'unique': True},
        ]
    }
    
    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)


class NotificationPreferencesService:
    """
    通知偏好设置服务
    
    使用方法:
        service = NotificationPreferencesService()
        
        # 获取用户偏好
        prefs = service.get_preferences(user)
        
        # 检查是否应该发送通知
        should_send = service.should_send_notification(user, 'comment', 'push')
        
        # 设置免打扰
        service.set_do_not_disturb(user, enabled=True, start='22:00', end='08:00')
        
        # 临时静默
        service.mute_notifications(user, duration_minutes=60)
    """
    
    def get_preferences(self, user: User) -> NotificationPreferences:
        """
        获取用户通知偏好，如不存在则创建默认偏好
        
        Args:
            user: 用户对象
            
        Returns:
            NotificationPreferences: 偏好设置对象
        """
        prefs = NotificationPreferences.objects(user=user).first()
        if not prefs:
            prefs = NotificationPreferences(user=user)
            prefs.save()
            logger.info(f"为用户 {user.id} 创建默认通知偏好")
        return prefs
    
    def update_preferences(self, user: User, updates: Dict[str, Any]) -> NotificationPreferences:
        """
        更新用户通知偏好
        
        Args:
            user: 用户对象
            updates: 要更新的字段字典
            
        Returns:
            NotificationPreferences: 更新后的偏好设置
        """
        prefs = self.get_preferences(user)
        
        for key, value in updates.items():
            if hasattr(prefs, key):
                setattr(prefs, key, value)
        
        prefs.save()
        logger.info(f"更新用户 {user.id} 的通知偏好")
        return prefs
    
    def update_type_settings(
        self, 
        user: User, 
        notification_type: str, 
        enabled: Optional[bool] = None,
        priority: Optional[str] = None,
        channels: Optional[Dict[str, bool]] = None
    ) -> NotificationPreferences:
        """
        更新特定类型的通知设置
        
        Args:
            user: 用户对象
            notification_type: 通知类型
            enabled: 是否启用
            priority: 优先级 (high/medium/low)
            channels: 渠道设置
            
        Returns:
            NotificationPreferences: 更新后的偏好设置
        """
        prefs = self.get_preferences(user)
        
        if notification_type not in prefs.type_settings:
            prefs.type_settings[notification_type] = {
                'enabled': True,
                'priority': 'medium',
                'channels': {'push': True, 'in_app': True}
            }
        
        settings = prefs.type_settings[notification_type]
        
        if enabled is not None:
            settings['enabled'] = enabled
        if priority is not None:
            settings['priority'] = priority
        if channels is not None:
            settings['channels'].update(channels)
        
        prefs.type_settings[notification_type] = settings
        prefs.save()
        
        logger.info(f"更新用户 {user.id} 的 {notification_type} 通知设置")
        return prefs
    
    def should_send_notification(
        self, 
        user: User, 
        notification_type: str, 
        channel: str = 'push'
    ) -> bool:
        """
        检查是否应该向用户发送指定类型的通知
        
        Args:
            user: 用户对象
            notification_type: 通知类型
            channel: 通知渠道
            
        Returns:
            bool: 是否应该发送
        """
        prefs = self.get_preferences(user)
        
        # 检查全局开关
        if not prefs.global_enabled:
            return False
        
        # 检查临时静默
        if prefs.muted_until and prefs.muted_until > timezone.now():
            return False
        
        # 检查免打扰时段
        if self._is_in_do_not_disturb(prefs):
            # 高优先级通知仍然发送
            type_settings = prefs.type_settings.get(notification_type, {})
            if type_settings.get('priority') != 'high':
                return False
        
        # 检查类型设置
        type_settings = prefs.type_settings.get(notification_type, {})
        if not type_settings.get('enabled', True):
            return False
        
        # 检查渠道设置
        channels = type_settings.get('channels', {})
        if not channels.get(channel, True):
            return False
        
        return True
    
    def _is_in_do_not_disturb(self, prefs: NotificationPreferences) -> bool:
        """
        检查当前是否在免打扰时段内
        """
        dnd = prefs.do_not_disturb
        if not dnd or not dnd.enabled:
            return False
        
        now = timezone.localtime(timezone.now())
        current_time = now.time()
        current_weekday = now.weekday()
        
        # 检查是否在生效的星期几
        if current_weekday not in dnd.days_of_week:
            return False
        
        try:
            start = datetime.strptime(dnd.start_time, '%H:%M').time()
            end = datetime.strptime(dnd.end_time, '%H:%M').time()
            
            # 处理跨午夜的情况
            if start <= end:
                # 同一天内
                return start <= current_time <= end
            else:
                # 跨午夜
                return current_time >= start or current_time <= end
                
        except ValueError as e:
            logger.error(f"解析免打扰时间失败: {e}")
            return False
    
    def set_do_not_disturb(
        self,
        user: User,
        enabled: bool,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        days_of_week: Optional[List[int]] = None
    ) -> NotificationPreferences:
        """
        设置免打扰时段
        
        Args:
            user: 用户对象
            enabled: 是否启用
            start_time: 开始时间 (HH:MM)
            end_time: 结束时间 (HH:MM)
            days_of_week: 生效的星期几 (0=周一)
            
        Returns:
            NotificationPreferences: 更新后的偏好设置
        """
        prefs = self.get_preferences(user)
        
        if not prefs.do_not_disturb:
            prefs.do_not_disturb = DoNotDisturbSchedule()
        
        prefs.do_not_disturb.enabled = enabled
        
        if start_time is not None:
            prefs.do_not_disturb.start_time = start_time
        if end_time is not None:
            prefs.do_not_disturb.end_time = end_time
        if days_of_week is not None:
            prefs.do_not_disturb.days_of_week = days_of_week
        
        prefs.save()
        logger.info(f"更新用户 {user.id} 的免打扰设置: enabled={enabled}")
        return prefs
    
    def mute_notifications(self, user: User, duration_minutes: int) -> NotificationPreferences:
        """
        临时静默通知
        
        Args:
            user: 用户对象
            duration_minutes: 静默时长（分钟）
            
        Returns:
            NotificationPreferences: 更新后的偏好设置
        """
        prefs = self.get_preferences(user)
        prefs.muted_until = timezone.now() + timedelta(minutes=duration_minutes)
        prefs.save()
        
        logger.info(f"用户 {user.id} 的通知已静默 {duration_minutes} 分钟")
        return prefs
    
    def unmute_notifications(self, user: User) -> NotificationPreferences:
        """
        取消静默
        
        Args:
            user: 用户对象
            
        Returns:
            NotificationPreferences: 更新后的偏好设置
        """
        prefs = self.get_preferences(user)
        prefs.muted_until = None
        prefs.save()
        
        logger.info(f"用户 {user.id} 的通知静默已取消")
        return prefs
    
    def get_preferences_summary(self, user: User) -> Dict[str, Any]:
        """
        获取用户偏好摘要（用于API响应）
        
        Args:
            user: 用户对象
            
        Returns:
            dict: 偏好摘要
        """
        prefs = self.get_preferences(user)
        
        is_muted = prefs.muted_until and prefs.muted_until > timezone.now()
        is_dnd = self._is_in_do_not_disturb(prefs)
        
        return {
            'global_enabled': prefs.global_enabled,
            'is_muted': is_muted,
            'muted_until': prefs.muted_until.isoformat() if is_muted else None,
            'is_do_not_disturb': is_dnd,
            'do_not_disturb': {
                'enabled': prefs.do_not_disturb.enabled if prefs.do_not_disturb else False,
                'start_time': prefs.do_not_disturb.start_time if prefs.do_not_disturb else '22:00',
                'end_time': prefs.do_not_disturb.end_time if prefs.do_not_disturb else '08:00',
                'days_of_week': prefs.do_not_disturb.days_of_week if prefs.do_not_disturb else [],
            },
            'type_settings': prefs.type_settings,
        }


# 创建全局服务实例
_notification_prefs_service = None


def get_notification_prefs_service() -> NotificationPreferencesService:
    """获取通知偏好服务实例"""
    global _notification_prefs_service
    if _notification_prefs_service is None:
        _notification_prefs_service = NotificationPreferencesService()
    return _notification_prefs_service
