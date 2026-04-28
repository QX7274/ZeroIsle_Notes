"""
社区模块URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PostViewSet,
    CommentViewSet,
    CategoryViewSet,
    TagViewSet,
    LikeViewSet,
    FollowViewSet,
    NotificationViewSet
)
from . import views as legacy_views

# 创建路由器
router = DefaultRouter()
router.register(r'posts', PostViewSet, basename='post')
router.register(r'comments', CommentViewSet, basename='comment')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'tags', TagViewSet, basename='tag')
router.register(r'likes', LikeViewSet, basename='like')
router.register(r'follows', FollowViewSet, basename='follow')
router.register(r'notifications', NotificationViewSet, basename='notification')

# 兼容旧版API
legacy_router = DefaultRouter()
# 使用现有视图集注册到 legacy 路由，保持兼容
legacy_router.register(r'posts', PostViewSet, basename='legacy-post')
legacy_router.register(r'comments', CommentViewSet, basename='legacy-comment')
legacy_router.register(r'tags', TagViewSet, basename='legacy-tag')
legacy_router.register(r'categories', CategoryViewSet, basename='legacy-category')
legacy_router.register(r'notifications', NotificationViewSet, basename='legacy-notification')
legacy_router.register(r'likes', LikeViewSet, basename='legacy-like')
legacy_router.register(r'follows', FollowViewSet, basename='legacy-follow')

urlpatterns = [
    # API路由
    path('', include(router.urls)),

    # 兼容旧版API
    path('legacy/', include(legacy_router.urls)),
]
