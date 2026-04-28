"""
模型初始化文件
将MongoDB模型导出为标准模型名，保持兼容性
"""

from ..mongodb_models.note import Note
from ..mongodb_models.note_version import NoteVersion
from ..mongodb_models.note_share import NoteShare
from ..mongodb_models.category import Category
from ..mongodb_models.tag import Tag
from ..mongodb_models.drawing_path import DrawingPath
from ..mongodb_models.note_attachment import NoteAttachment

__all__ = [
    'Note',
    'NoteVersion',
    'NoteShare',
    'Category',
    'Tag',
    'DrawingPath',
    'NoteAttachment',
]
