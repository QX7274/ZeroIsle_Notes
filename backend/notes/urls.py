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

router = DefaultRouter()
router.register(r'notes', NoteViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'tags', TagViewSet)
router.register(r'shares', NoteShareViewSet)
router.register(r'versions', NoteVersionViewSet)
router.register(r'attachments', NoteAttachmentViewSet)
router.register(r'syncs', NoteSyncViewSet)
router.register(r'comments', NoteCommentViewSet)
router.register(r'collaborations', NoteCollaborationViewSet)
router.register(r'templates', NoteTemplateViewSet)
router.register(r'backups', NoteBackupViewSet)
router.register(r'reminders', NoteReminderViewSet)
router.register(r'notifications', NotificationViewSet)
router.register(r'handwriting', HandwritingViewSet)
router.register(r'ocr-models', OCRModelViewSet)
router.register(r'ocr-training-data', OCRTrainingDataViewSet)
router.register(r'whisper-models', WhisperModelViewSet)
router.register(r'whisper-training-data', WhisperTrainingDataViewSet)

urlpatterns = [
    path('', include(router.urls)),
]