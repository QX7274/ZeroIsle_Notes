"""笔记应用URL配置"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    NoteViewSet, CategoryViewSet, TagViewSet, NoteShareViewSet,
    NoteVersionViewSet, NoteAttachmentViewSet, NoteSyncViewSet,
    NoteCommentViewSet, NoteCollaborationViewSet, NoteTemplateViewSet,
    NoteBackupViewSet, NoteReminderViewSet, NotificationViewSet,
    HandwritingViewSet, OCRModelViewSet, OCRTrainingDataViewSet,
    WhisperModelViewSet, WhisperTrainingDataViewSet
)
from .views.annotation import AnnotationViewSet
from .views.drawing_path import DrawingPathViewSet

router = DefaultRouter()
router.register(r'notes', NoteViewSet, basename='note')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'tags', TagViewSet, basename='tag')
router.register(r'shares', NoteShareViewSet, basename='share')
router.register(r'versions', NoteVersionViewSet, basename='version')
router.register(r'attachments', NoteAttachmentViewSet, basename='attachment')
router.register(r'syncs', NoteSyncViewSet, basename='sync')
router.register(r'comments', NoteCommentViewSet, basename='comment')
router.register(r'collaborations', NoteCollaborationViewSet, basename='collaboration')
router.register(r'templates', NoteTemplateViewSet, basename='template')
router.register(r'backups', NoteBackupViewSet, basename='backup')
router.register(r'reminders', NoteReminderViewSet, basename='reminder')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'handwriting', HandwritingViewSet, basename='handwriting')
router.register(r'ocr-models', OCRModelViewSet, basename='ocr-model')
router.register(r'ocr-training-data', OCRTrainingDataViewSet, basename='ocr-training-data')
router.register(r'whisper-models', WhisperModelViewSet, basename='whisper-model')
router.register(r'whisper-training-data', WhisperTrainingDataViewSet, basename='whisper-training-data')
router.register(r'annotations', AnnotationViewSet, basename='annotation')
router.register(r'drawing-paths', DrawingPathViewSet, basename='drawing-path')

urlpatterns = [
    path('', include(router.urls)),
]