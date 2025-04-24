from django.contrib import admin
from .models import KnowledgeNode, KnowledgeEdge


@admin.register(KnowledgeNode)
class KnowledgeNodeAdmin(admin.ModelAdmin):
    """
    知识节点管理
    """
    list_display = ('id', 'title', 'type', 'user', 'created_at', 'updated_at')
    list_filter = ('type', 'user', 'created_at')
    search_fields = ('title', 'description')
    date_hierarchy = 'created_at'


@admin.register(KnowledgeEdge)
class KnowledgeEdgeAdmin(admin.ModelAdmin):
    """
    知识连接管理
    """
    list_display = ('id', 'source', 'target', 'type', 'user', 'created_at')
    list_filter = ('type', 'user', 'created_at')
    search_fields = ('label', 'description')
    date_hierarchy = 'created_at'