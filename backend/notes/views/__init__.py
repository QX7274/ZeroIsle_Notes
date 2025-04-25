"""
笔记模块视图初始化文件
导入所有视图以便在其他地方直接从notes.views导入
"""

from .note import NoteViewSet
from .category import CategoryViewSet
from .tag import TagViewSet
from .attachment import NoteAttachmentViewSet
from .version import NoteVersionViewSet
from .share import NoteShareViewSet
from .sync import NoteSyncViewSet
from .comment import NoteCommentViewSet
from .collaboration import NoteCollaborationViewSet
from .template import NoteTemplateViewSet
from .backup import NoteBackupViewSet
from .reminder import NoteReminderViewSet
from .notification import NotificationViewSet
from .handwriting import HandwritingViewSet
from .ocr import OCRModelViewSet, OCRTrainingDataViewSet
from .whisper import WhisperModelViewSet, WhisperTrainingDataViewSet
