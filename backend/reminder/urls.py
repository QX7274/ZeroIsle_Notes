"""
提醒模块URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from reminder.views import (
    ReminderViewSet,
    ReminderNotificationViewSet
)
from . import views as legacy_views

# 创建路由器
router = DefaultRouter()
router.register(r'reminders', ReminderViewSet, basename='reminder')
router.register(r'notifications', ReminderNotificationViewSet, basename='reminder-notification')

# 兼容旧版API
legacy_urls = [
    path('upcoming/', legacy_views.get_upcoming_reminders, name='upcoming_reminders'),
    path('complete/<uuid:pk>/', legacy_views.mark_reminder_complete, name='mark_reminder_complete'),
    path('from-note/', legacy_views.create_reminder_from_note, name='create_reminder_from_note'),
]

urlpatterns = [
    # 路由器URL
    path('', include(router.urls)),

    # 兼容旧版API
    *legacy_urls,
]