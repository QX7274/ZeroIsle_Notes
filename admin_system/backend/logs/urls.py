from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AdminOperationLogViewSet, SystemLogViewSet

# 创建路由器并注册视图集
router = DefaultRouter()
router.register(r'operations', AdminOperationLogViewSet)
router.register(r'system', SystemLogViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
