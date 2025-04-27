"""
提醒模块URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from reminder.views import (
    ReminderViewSet,
    ReminderNotificationViewSet
)

# 创建路由器
router = DefaultRouter()
router.register(r'reminders', ReminderViewSet, basename='reminder')
router.register(r'notifications', ReminderNotificationViewSet, basename='reminder-notification')

# 兼容旧版API
# 暂时注释掉旧版API，以解决导入错误
# 后续需要逐步迁移这些API到视图集中
legacy_urls = [
    # path('upcoming/', get_upcoming_reminders, name='upcoming_reminders'),
    # path('complete/<uuid:pk>/', mark_reminder_complete, name='mark_reminder_complete'),
    # path('from-note/', create_reminder_from_note, name='create_reminder_from_note'),
]

urlpatterns = [
    # 路由器URL
    path('', include(router.urls)),

    # 兼容旧版API
    *legacy_urls,
]