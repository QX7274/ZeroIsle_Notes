from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserProfileViewSet

# 创建路由器并注册视图集
router = DefaultRouter()
router.register(r'profiles', UserProfileViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
