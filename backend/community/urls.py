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
legacy_router.register(r'posts', legacy_views.CommunityPostViewSet)
legacy_router.register(r'comments', legacy_views.CommentViewSet)
legacy_router.register(r'tags', legacy_views.PostTagViewSet)
legacy_router.register(r'categories', legacy_views.PostCategoryViewSet)
legacy_router.register(r'notifications', legacy_views.NotificationViewSet, basename='legacy-notification')
legacy_router.register(r'follows', legacy_views.FollowViewSet, basename='legacy-follow')

urlpatterns = [
    # API路由
    path('', include(router.urls)),

    # 兼容旧版API
    path('legacy/', include(legacy_router.urls)),
]
