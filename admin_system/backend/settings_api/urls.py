from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SystemSettingViewSet, AnnouncementViewSet, SystemBackupViewSet

# 创建路由器并注册视图集
router = DefaultRouter()
router.register(r'system', SystemSettingViewSet, basename='system-setting')
router.register(r'announcements', AnnouncementViewSet, basename='announcement')
router.register(r'backups', SystemBackupViewSet, basename='system-backup')

urlpatterns = [
    path('', include(router.urls)),
]
