"""
提醒模块URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from reminder.views import (
    ReminderViewSet,
    ReminderNotificationViewSet
)
from reminder.views.mongo_views import (
    MongoReminderViewSet,
    MongoReminderNotificationViewSet
)
from reminder.views.calendar_integration_views import (
    ReminderCalendarIntegrationView,
    MongoReminderCalendarIntegrationView,
    sync_reminder_to_calendar,
    remove_reminder_from_calendar,
    import_from_calendar,
    export_to_calendar
)
from reminder.views.actions import ReminderActionView


# 创建路由器
router = DefaultRouter()
router.register(r'reminders', ReminderViewSet, basename='reminder')
router.register(r'notifications', ReminderNotificationViewSet, basename='reminder-notification')

# MongoDB路由器
mongo_router = DefaultRouter()
mongo_router.register(r'mongo/reminders', MongoReminderViewSet, basename='mongo-reminder')
mongo_router.register(r'mongo/notifications', MongoReminderNotificationViewSet, basename='mongo-reminder-notification')

urlpatterns = [
    # 路由器URL
    path('', include(router.urls)),
    # MongoDB路由器URL
    path('', include(mongo_router.urls)),

    # 分类API
    path('categories/', MongoReminderViewSet.as_view({'get': 'categories'}), name='reminder-categories'),

    # 标签API
    path('tags/', MongoReminderViewSet.as_view({'get': 'tags'}), name='reminder-tags'),

    # 统计API
    path('statistics/', MongoReminderViewSet.as_view({'get': 'statistics'}), name='reminder-statistics'),

    # 日历API
    path('calendar/', MongoReminderViewSet.as_view({'get': 'calendar'}), name='reminder-calendar'),

    # 导入/导出API
    path('export/', MongoReminderViewSet.as_view({'get': 'export'}), name='reminder-export'),
    path('import/', MongoReminderViewSet.as_view({'post': 'import_data'}), name='reminder-import'),

    # 日历集成API
    path('reminders/<int:pk>/calendar-integration/', ReminderCalendarIntegrationView.as_view(), name='reminder-calendar-integration'),
    path('mongo/reminders/<str:pk>/calendar-integration/', MongoReminderCalendarIntegrationView.as_view(), name='mongo-reminder-calendar-integration'),
    path('reminders/<int:pk>/sync-to-calendar/', sync_reminder_to_calendar, name='reminder-sync-to-calendar'),
    path('reminders/<int:pk>/remove-from-calendar/', remove_reminder_from_calendar, name='reminder-remove-from-calendar'),
    path('import-from-calendar/', import_from_calendar, name='reminder-import-from-calendar'),
    path('export-to-calendar/', export_to_calendar, name='reminder-export-to-calendar'),

    # 每日摘要API

    # Reminder instance actions
    path('reminders/<uuid:pk>/complete/', ReminderActionView.as_view({'post': 'complete'}), name='reminder-complete'),
    path('reminders/<uuid:pk>/cancel/', ReminderActionView.as_view({'post': 'cancel'}), name='reminder-cancel'),
    path('reminders/<uuid:pk>/delay/', ReminderActionView.as_view({'post': 'delay'}), name='reminder-delay'),

    path('daily-summary/', MongoReminderViewSet.as_view({'get': 'daily_summary'}), name='reminder-daily-summary'),
]