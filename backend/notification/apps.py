"""
通知模块应用配置
"""

from django.apps import AppConfig

class NotificationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'notification'
    verbose_name = '通知模块'
    
    def ready(self):
        """应用就绪时执行"""
        # 导入信号处理器
        import notification.signals
