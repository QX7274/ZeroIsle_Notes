"""
日志服务
提供统一的日志记录功能
"""

import os
import logging
import logging.handlers
from datetime import datetime

# 日志级别映射
LOG_LEVELS = {
    'DEBUG': logging.DEBUG,
    'INFO': logging.INFO,
    'WARNING': logging.WARNING,
    'ERROR': logging.ERROR,
    'CRITICAL': logging.CRITICAL
}

class LogService:
    """日志服务类"""
    
    def __init__(self):
        """初始化日志服务"""
        self.initialized = False
        self.logger = None
        self.log_level = LOG_LEVELS.get(os.environ.get('LOG_LEVEL', 'INFO'), logging.INFO)
        self.log_dir = os.environ.get('LOG_DIR', 'logs')
        self.log_file = os.environ.get('LOG_FILE', 'zeroislenotes.log')
        self.max_bytes = int(os.environ.get('LOG_MAX_BYTES', 10 * 1024 * 1024))  # 10MB
        self.backup_count = int(os.environ.get('LOG_BACKUP_COUNT', 5))
        
        # 初始化日志
        self._init_logger()
    
    def _init_logger(self):
        """初始化日志记录器"""
        try:
            # 创建日志目录
            if not os.path.exists(self.log_dir):
                os.makedirs(self.log_dir)
            
            # 创建日志记录器
            self.logger = logging.getLogger('zeroislenotes')
            self.logger.setLevel(self.log_level)
            
            # 清除现有处理器
            if self.logger.handlers:
                self.logger.handlers.clear()
            
            # 创建控制台处理器
            console_handler = logging.StreamHandler()
            console_handler.setLevel(self.log_level)
            console_format = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')
            console_handler.setFormatter(console_format)
            self.logger.addHandler(console_handler)
            
            # 创建文件处理器
            file_path = os.path.join(self.log_dir, self.log_file)
            file_handler = logging.handlers.RotatingFileHandler(
                file_path,
                maxBytes=self.max_bytes,
                backupCount=self.backup_count,
                encoding='utf-8'
            )
            file_handler.setLevel(self.log_level)
            file_format = logging.Formatter('%(asctime)s [%(levelname)s] [%(name)s:%(lineno)d] %(message)s')
            file_handler.setFormatter(file_format)
            self.logger.addHandler(file_handler)
            
            self.initialized = True
            self.logger.info("日志服务初始化成功")
        except Exception as e:
            print(f"日志服务初始化失败: {str(e)}")
            self.initialized = False
    
    def debug(self, message, *args, **kwargs):
        """记录调试日志"""
        if not self.initialized:
            print(f"DEBUG: {message}")
            return
        
        self.logger.debug(message, *args, **kwargs)
    
    def info(self, message, *args, **kwargs):
        """记录信息日志"""
        if not self.initialized:
            print(f"INFO: {message}")
            return
        
        self.logger.info(message, *args, **kwargs)
    
    def warning(self, message, *args, **kwargs):
        """记录警告日志"""
        if not self.initialized:
            print(f"WARNING: {message}")
            return
        
        self.logger.warning(message, *args, **kwargs)
    
    def error(self, message, *args, **kwargs):
        """记录错误日志"""
        if not self.initialized:
            print(f"ERROR: {message}")
            return
        
        self.logger.error(message, *args, **kwargs)
    
    def critical(self, message, *args, **kwargs):
        """记录严重错误日志"""
        if not self.initialized:
            print(f"CRITICAL: {message}")
            return
        
        self.logger.critical(message, *args, **kwargs)
    
    def exception(self, message, *args, **kwargs):
        """记录异常日志"""
        if not self.initialized:
            print(f"EXCEPTION: {message}")
            return
        
        self.logger.exception(message, *args, **kwargs)

# 创建单例实例
log_service = LogService()

# 导出单例实例
__all__ = ['log_service']
