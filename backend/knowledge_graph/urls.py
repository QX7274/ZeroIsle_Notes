"""
知识图谱模块URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from knowledge_graph.views import (
    KnowledgeGraphViewSet,
    KnowledgeNodeViewSet,
    KnowledgeEdgeViewSet
)
from knowledge_graph.views.mongo_views import (
    MongoKnowledgeGraphViewSet,
    MongoKnowledgeNodeViewSet,
    MongoKnowledgeEdgeViewSet
)
from knowledge_graph.views.auto_classification_views import (
    auto_classify_note,
    suggest_tags,
    extract_keywords,
    find_similar_notes,
    integrate_with_existing_notes,
    build_knowledge_graph,
    build_knowledge_graph_for_user,
    analyze_note_connections,
    suggest_related_content
)
from knowledge_graph.views.task import (
    create_build_task,
    get_task_status,
    list_tasks
)
from knowledge_graph.views.recommendation import (
    suggest_edges as suggest_edges_view,
    accept_suggestions as accept_suggestions_view,
    ignore_suggestions as ignore_suggestions_view,
)
from knowledge_graph.views.health import neo4j_health_check
from knowledge_graph.views.export_import_views import (
    export_knowledge_graph,
    import_knowledge_graph,
    export_statistics,
)


# 创建路由器
router = DefaultRouter()
router.register(r'nodes', KnowledgeNodeViewSet, basename='knowledge-node')
router.register(r'edges', KnowledgeEdgeViewSet, basename='knowledge-edge')

# 创建MongoDB路由器
mongo_router = DefaultRouter()
mongo_router.register(r'nodes', MongoKnowledgeNodeViewSet, basename='mongo-knowledge-node')
mongo_router.register(r'edges', MongoKnowledgeEdgeViewSet, basename='mongo-knowledge-edge')
mongo_router.register(r'graphs', MongoKnowledgeGraphViewSet, basename='mongo-knowledge-graph')

# API路径
api_urls = [
    path('', KnowledgeGraphViewSet.as_view({'get': 'list'}), name='knowledge-graph'),
    path('find-path/', KnowledgeGraphViewSet.as_view({'post': 'find_path'}), name='knowledge-graph-find-path'),
    path('analyze/', KnowledgeGraphViewSet.as_view({'get': 'analyze'}), name='knowledge-graph-analyze'),
    path('search/', KnowledgeGraphViewSet.as_view({'get': 'search'}), name='knowledge-graph-search'),
    path('nodes/', KnowledgeGraphViewSet.as_view({'get': 'nodes'}), name='knowledge-graph-nodes'),
    path('health/', neo4j_health_check, name='neo4j-health-check'),
    path('generate-tags/', KnowledgeGraphViewSet.as_view({'post': 'generate_tags'}), name='knowledge-graph-generate-tags'),
]

# 节点相关路径
node_urls = [
    path('<int:pk>/related-concepts/', KnowledgeNodeViewSet.as_view({'get': 'related_concepts'}), name='knowledge-node-related-concepts'),
    path('<int:pk>/related/', KnowledgeNodeViewSet.as_view({'get': 'related'}), name='knowledge-node-related'),
]

# 自动分类和知识图谱构建API路径
auto_classification_urls = [
    path('auto-classify/', auto_classify_note, name='auto-classify-note'),
    path('suggest-tags/', suggest_tags, name='suggest-tags'),
    path('extract-keywords/', extract_keywords, name='extract-keywords'),
    path('find-similar-notes/', find_similar_notes, name='find-similar-notes'),
    path('integrate-notes/', integrate_with_existing_notes, name='integrate-notes'),
    path('build-graph/', build_knowledge_graph, name='build-graph'),
    path('build-user-graph/', build_knowledge_graph_for_user, name='build-user-graph'),
    path('analyze-connections/', analyze_note_connections, name='analyze-connections'),
    path('suggest-related-content/', suggest_related_content, name='suggest-related-content'),
    # 推荐与候选边
    path('suggest-edges/', suggest_edges_view, name='suggest-edges'),
    path('accept-suggestions/', accept_suggestions_view, name='accept-suggestions'),
    path('ignore-suggestions/', ignore_suggestions_view, name='ignore-suggestions'),
]

# 任务管理API路径
task_urls = [
    path('build/', create_build_task, name='create-build-task'),
    path('<str:task_id>/status/', get_task_status, name='get-task-status'),
    path('list/', list_tasks, name='list-tasks'),
]

# 导入导出API路径
export_import_urls = [
    path('export/', export_knowledge_graph, name='export-knowledge-graph'),
    path('import/', import_knowledge_graph, name='import-knowledge-graph'),
    path('statistics/', export_statistics, name='export-statistics'),
]

urlpatterns = [
    # 路由器URL
    path('', include(router.urls)),

    # API URL
    path('graph/', include(api_urls)),

    # 节点相关URL
    path('nodes/', include(node_urls)),

    # 自动分类和知识图谱构建URL
    path('auto/', include(auto_classification_urls)),

    # 任务管理URL
    path('task/', include(task_urls)),

    # 导入导出URL
    path('io/', include(export_import_urls)),

    # MongoDB API URL
    path('mongo/', include(mongo_router.urls)),

    # 兼容旧版API
    path('links/', include(router.urls[1:2])),  # 兼容旧版links路由
    path('knowledge-graph/', include(api_urls)),  # 兼容旧版knowledge-graph路由
]