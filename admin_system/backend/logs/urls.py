from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AdminOperationLogViewSet,
    LogAnalyticsView,
    LogBackupViewSet,
    LogExportHistoryViewSet,
    SystemLogViewSet,
)

# 创建路由器并注册视图集
router = DefaultRouter()
router.register(r'admin-logs', AdminOperationLogViewSet, basename='admin-operation-log')
router.register(r'system-logs', SystemLogViewSet, basename='system-log')
router.register(r'export-history', LogExportHistoryViewSet, basename='log-export-history')
# 日志备份：前端 /logs/export 页面（已挂载）依赖，此前后端完全没有该路由。
router.register(r'backup', LogBackupViewSet, basename='log-backup')

urlpatterns = [
    path('', include(router.urls)),
    path('analytics/', LogAnalyticsView.as_view(), name='log-analytics'),
]
