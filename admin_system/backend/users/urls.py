from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserProfileViewSet, UserActivityViewSet

# 创建路由器并注册视图集
router = DefaultRouter()
router.register(r'profiles', UserProfileViewSet)
router.register(r'activities', UserActivityViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
