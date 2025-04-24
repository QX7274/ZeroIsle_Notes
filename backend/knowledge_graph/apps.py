from django.apps import AppConfig


class KnowledgeGraphConfig(AppConfig):
    """
    知识图谱应用配置
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'knowledge_graph'
    verbose_name = '知识图谱'