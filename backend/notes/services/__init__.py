"""
笔记模块服务初始化文件
导入所有服务以便在其他地方直接从notes.services导入
"""

from .note_service import NoteService
# from .sync_service import SyncService
# from .backup_service import BackupService
# from .ocr_service import OCRService
# from .whisper_service import WhisperService
from .redis_service import RedisService
