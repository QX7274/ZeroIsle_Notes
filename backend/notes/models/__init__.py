"""
笔记模块模型初始化文件
导入所有模型以便在其他地方直接从notes.models导入
"""

from .note import Note
from .category import Category
from .tag import Tag
from .attachment import NoteAttachment
from .version import NoteVersion
from .share import NoteShare
from .comment import NoteComment
from .collaboration import NoteCollaboration
from .template import NoteTemplate
from .backup import NoteBackup
from .reminder import NoteReminder
from .notification import Notification
from .handwriting import Handwriting, HandwritingShare
from .ocr import OCRModel, OCRTrainingData
from .whisper import WhisperModel, WhisperTrainingData
