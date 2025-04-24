from django.apps import AppConfig


class ReminderConfig(AppConfig):
    """
    提醒系统应用配置
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'reminder'
    verbose_name = '提醒系统'