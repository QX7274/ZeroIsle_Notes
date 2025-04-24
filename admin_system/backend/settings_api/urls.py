from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SystemSettingViewSet, AnnouncementViewSet

# 创建路由器并注册视图集
router = DefaultRouter()
router.register(r'system', SystemSettingViewSet)
router.register(r'announcements', AnnouncementViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
