from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NoteCategoryViewSet, TagViewSet, ContentReportViewSet

# 创建路由器并注册视图集
router = DefaultRouter()
router.register(r'categories', NoteCategoryViewSet)
router.register(r'tags', TagViewSet)
router.register(r'reports', ContentReportViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
