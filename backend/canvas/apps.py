from django.apps import AppConfig


class CanvasConfig(AppConfig):
    """
    无限画布应用配置
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'canvas'
    verbose_name = '无限画布'