"""
群组模块URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GroupViewSet, GroupInvitationViewSet, SharedScreenViewSet

# 创建路由器
router = DefaultRouter()
router.register(r'groups', GroupViewSet, basename='group')
router.register(r'invitations', GroupInvitationViewSet, basename='invitation')
router.register(r'shared-screens', SharedScreenViewSet, basename='shared-screen')

urlpatterns = [
    path('', include(router.urls)),
]
