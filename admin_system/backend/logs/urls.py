from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AdminOperationLogViewSet, SystemLogViewSet, LogAnalyticsView

# 创建路由器并注册视图集
router = DefaultRouter()
router.register(r'admin-logs', AdminOperationLogViewSet)
router.register(r'system-logs', SystemLogViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('analytics/', LogAnalyticsView.as_view(), name='log-analytics'),
]
