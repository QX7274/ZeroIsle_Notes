"""
数据同步信号处理器
"""

import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone

# 设置日志
logger = logging.getLogger(__name__)

# 这里可以添加信号处理器，用于在数据变更时触发同步操作
# 例如：

# @receiver(post_save, sender=Note)
# def handle_note_save(sender, instance, created, **kwargs):
#     """
#     处理笔记保存信号
#     """
#     try:
#         # 记录同步操作
#         from .services.sync_service import SyncService
#         
#         user_id = str(instance.user.id) if instance.user else None
#         if user_id:
#             # 将笔记数据转换为字典
#             note_data = {
#                 '_id': str(instance.id),
#                 'title': instance.title,
#                 'content': instance.content,
#                 'updated_at': instance.updated_at.isoformat(),
#                 '_operation': 'create' if created else 'update'
#             }
#             
#             # 同步到MongoDB
#             SyncService.sync_notes(user_id, [note_data])
#             
#             logger.info(f"笔记同步成功: {instance.id}")
#     except Exception as e:
#         logger.error(f"笔记同步失败: {str(e)}")
# 
# @receiver(post_delete, sender=Note)
# def handle_note_delete(sender, instance, **kwargs):
#     """
#     处理笔记删除信号
#     """
#     try:
#         # 记录同步操作
#         from .services.sync_service import SyncService
#         
#         user_id = str(instance.user.id) if instance.user else None
#         if user_id:
#             # 将笔记数据转换为字典
#             note_data = {
#                 '_id': str(instance.id),
#                 '_operation': 'delete'
#             }
#             
#             # 同步到MongoDB
#             SyncService.sync_notes(user_id, [note_data])
#             
#             logger.info(f"笔记删除同步成功: {instance.id}")
#     except Exception as e:
#         logger.error(f"笔记删除同步失败: {str(e)}")
