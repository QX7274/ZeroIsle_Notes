from django.apps import AppConfig


class AiAssistantConfig(AppConfig):
    """
    AI助手应用配置
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ai_assistant'
    verbose_name = 'AI助手'