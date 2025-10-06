"""
笔记模块视图初始化文件
导入所有视图以便在其他地方直接从notes.views导入
"""

# 使用MongoDB Realm视图替代SQLite视图
from .realm_note import RealmNoteViewSet as NoteViewSet
from .realm_category import RealmCategoryViewSet as CategoryViewSet
from .realm_tag import RealmTagViewSet as TagViewSet

# 保留其他视图
try:
    from .attachment import NoteAttachmentViewSet
    from .version import NoteVersionViewSet
    from .share import NoteShareViewSet
    from .comment import NoteCommentViewSet
    from .collaboration import NoteCollaborationViewSet
    from .template import NoteTemplateViewSet
    from .backup import NoteBackupViewSet
    from .reminder import NoteReminderViewSet
    from .notification import NotificationViewSet

    from .ocr import OCRModelViewSet, OCRTrainingDataViewSet
    from .whisper import WhisperModelViewSet, WhisperTrainingDataViewSet
except ImportError:
    pass
