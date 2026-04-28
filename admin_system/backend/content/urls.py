from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    NoteCategoryViewSet,
    TagViewSet,
    ContentReportViewSet,
    NoteViewSet,
    CommentViewSet,
    AttachmentViewSet
)

# 创建路由器并注册视图集
router = DefaultRouter()
router.register(r'categories', NoteCategoryViewSet, basename='note-category')
router.register(r'tags', TagViewSet, basename='tag')
router.register(r'reports', ContentReportViewSet, basename='content-report')
router.register(r'notes', NoteViewSet, basename='note')
router.register(r'comments', CommentViewSet, basename='comment')
router.register(r'attachments', AttachmentViewSet, basename='attachment')

urlpatterns = [
    path('', include(router.urls)),
]
