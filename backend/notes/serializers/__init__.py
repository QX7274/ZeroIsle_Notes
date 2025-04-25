"""
笔记模块序列化器初始化文件
导入所有序列化器以便在其他地方直接从notes.serializers导入
"""

from .note import (
    NoteSerializer, 
    NoteListSerializer, 
    NoteDetailSerializer, 
    NoteCreateUpdateSerializer
)
from .category import CategorySerializer
from .tag import TagSerializer
from .attachment import NoteAttachmentSerializer
from .version import NoteVersionSerializer
from .share import NoteShareSerializer, NoteShareCreateSerializer
from .comment import NoteCommentSerializer
from .collaboration import NoteCollaborationSerializer
from .template import NoteTemplateSerializer
from .backup import NoteBackupSerializer
from .reminder import NoteReminderSerializer
from .notification import NotificationSerializer
from .handwriting import HandwritingSerializer, HandwritingShareSerializer
from .ocr import OCRModelSerializer, OCRTrainingDataSerializer
from .whisper import WhisperModelSerializer, WhisperTrainingDataSerializer
