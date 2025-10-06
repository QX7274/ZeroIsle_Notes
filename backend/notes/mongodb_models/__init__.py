"""
笔记MongoDB模型初始化文件
"""

# 导入所有模型
# 使用惰性导入避免循环导入问题
from .category import Category
from .tag import Tag
from .note import Note
from .note_attachment import NoteAttachment
from .note_version import NoteVersion
from .note_share import NoteShare
from .note_backup import NoteBackup
from .note_reminder import NoteReminder
from .note_comment import NoteComment
from .note_collaboration import NoteCollaboration
from .note_template import NoteTemplate

from .whisper_model import WhisperModel
from .whisper_training_data import WhisperTrainingData

from .annotation import Annotation

# 创建别名
Attachment = NoteAttachment

# 导出所有模型
__all__ = [
    'Category',
    'Tag',
    'Note',
    'NoteAttachment',
    'Attachment',  # 添加别名
    'NoteVersion',
    'NoteShare',
    'NoteBackup',
    'NoteReminder',
    'NoteComment',
    'NoteCollaboration',
    'NoteTemplate',
    'WhisperModel',
    'WhisperTrainingData',

    'Annotation'
]
