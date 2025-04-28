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

urlpatterns = [
    # 路由器URL
    path('', include(router.urls)),
]