"""笔记应用URL配置"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views.realm_note import RealmNoteViewSet
from .views.realm_category import RealmCategoryViewSet
from .views.realm_tag import RealmTagViewSet
from .views.annotation import AnnotationViewSet
from .views.drawing_path import DrawingPathViewSet

# 尝试导入其他视图
try:
    from .views import (
        NoteShareViewSet, NoteVersionViewSet, NoteAttachmentViewSet,
        NoteCommentViewSet, NoteCollaborationViewSet, NoteTemplateViewSet,
        NoteBackupViewSet, NoteReminderViewSet, NotificationViewSet,
        HandwritingViewSet, WhisperModelViewSet, WhisperTrainingDataViewSet
    )
except ImportError:
    pass

router = DefaultRouter()
# 使用MongoDB Realm视图集
router.register(r'notes', RealmNoteViewSet, basename='note')
router.register(r'categories', RealmCategoryViewSet, basename='category')
router.register(r'tags', RealmTagViewSet, basename='tag')
router.register(r'annotations', AnnotationViewSet, basename='annotation')
router.register(r'drawing-paths', DrawingPathViewSet, basename='drawing-path')

# 尝试注册其他视图集
try:
    router.register(r'shares', NoteShareViewSet, basename='share')
    router.register(r'versions', NoteVersionViewSet, basename='version')
    router.register(r'attachments', NoteAttachmentViewSet, basename='attachment')
    router.register(r'comments', NoteCommentViewSet, basename='comment')
    router.register(r'collaborations', NoteCollaborationViewSet, basename='collaboration')
    router.register(r'templates', NoteTemplateViewSet, basename='template')
    router.register(r'backups', NoteBackupViewSet, basename='backup')
    router.register(r'reminders', NoteReminderViewSet, basename='reminder')
    router.register(r'notifications', NotificationViewSet, basename='notification')
    router.register(r'handwriting', HandwritingViewSet, basename='handwriting')
    router.register(r'whisper-models', WhisperModelViewSet, basename='whisper-model')
    router.register(r'whisper-training-data', WhisperTrainingDataViewSet, basename='whisper-training-data')
except NameError:
    pass

urlpatterns = [
    path('', include(router.urls)),
]