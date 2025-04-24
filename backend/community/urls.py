"""社区URL配置"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'posts', views.CommunityPostViewSet)
router.register(r'comments', views.CommentViewSet)
router.register(r'tags', views.PostTagViewSet)
router.register(r'categories', views.PostCategoryViewSet)
router.register(r'notifications', views.NotificationViewSet, basename='notification')
router.register(r'follows', views.FollowViewSet, basename='follow')

urlpatterns = [
    path('', include(router.urls)),
]
