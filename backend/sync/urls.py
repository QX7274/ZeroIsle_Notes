"""
数据同步URL配置
"""

from django.urls import path
from .views import (
    SyncDataView, SyncNotesView, SyncRemindersView,
    SyncSettingsView, SyncKeyDataView
)

urlpatterns = [
    # 所有数据同步
    path('data/', SyncDataView.as_view(), name='sync_data'),

    # 关键数据同步（自动同步）
    path('key-data/', SyncKeyDataView.as_view(), name='sync_key_data'),

    # 笔记同步
    path('notes/', SyncNotesView.as_view(), name='sync_notes'),

    # 提醒同步
    path('reminders/', SyncRemindersView.as_view(), name='sync_reminders'),

    # 设置同步
    path('settings/', SyncSettingsView.as_view(), name='sync_settings'),
]
