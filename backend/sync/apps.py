"""
数据同步应用配置
"""

from django.apps import AppConfig


class SyncConfig(AppConfig):
    """
    数据同步应用配置
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'sync'
    verbose_name = '数据同步'
    
    def ready(self):
        """
        应用就绪时执行的操作
        """
        # 导入信号处理器
        import sync.signals
