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

# 创建路由器
router = DefaultRouter()
router.register(r'nodes', KnowledgeNodeViewSet, basename='knowledge-node')
router.register(r'edges', KnowledgeEdgeViewSet, basename='knowledge-edge')

# API路径
api_urls = [
    path('', KnowledgeGraphViewSet.as_view({'get': 'list'}), name='knowledge-graph'),
    path('find-path/', KnowledgeGraphViewSet.as_view({'post': 'find_path'}), name='knowledge-graph-find-path'),
    path('analyze/', KnowledgeGraphViewSet.as_view({'get': 'analyze'}), name='knowledge-graph-analyze'),
    path('search/', KnowledgeGraphViewSet.as_view({'get': 'search'}), name='knowledge-graph-search'),
    path('generate-tags/', KnowledgeGraphViewSet.as_view({'post': 'generate_tags'}), name='knowledge-graph-generate-tags'),
]

# 节点相关路径
node_urls = [
    path('<int:pk>/related-concepts/', KnowledgeNodeViewSet.as_view({'get': 'related_concepts'}), name='knowledge-node-related-concepts'),
    path('<int:pk>/related/', KnowledgeNodeViewSet.as_view({'get': 'related'}), name='knowledge-node-related'),
]

urlpatterns = [
    # 路由器URL
    path('', include(router.urls)),

    # API URL
    path('graph/', include(api_urls)),

    # 节点相关URL
    path('nodes/', include(node_urls)),

    # 兼容旧版API
    path('links/', include(router.urls[1:2])),  # 兼容旧版links路由
    path('knowledge-graph/', include(api_urls)),  # 兼容旧版knowledge-graph路由
]