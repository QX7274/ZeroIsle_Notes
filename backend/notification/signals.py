"""
通知模块信号处理器
用于监听其他模块的事件并创建通知
"""

import logging
from django.dispatch import receiver
from django.db.models.signals import post_save
from .services import NotificationService

logger = logging.getLogger(__name__)

# 这里可以添加各种信号处理器，监听其他模块的事件并创建通知
# 例如：
# @receiver(post_save, sender=SomeModel)
# def handle_some_model_save(sender, instance, created, **kwargs):
#     if created:
#         # 创建通知
#         notification_service.create_notification(...)
