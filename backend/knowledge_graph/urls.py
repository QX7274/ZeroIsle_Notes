from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import KnowledgeGraphViewSet, KnowledgeNodeViewSet, KnowledgeEdgeViewSet

# 创建路由器
router = DefaultRouter()
router.register(r'nodes', KnowledgeNodeViewSet, basename='knowledge-node')
router.register(r'links', KnowledgeEdgeViewSet, basename='knowledge-edge')

# 新路由配置
knowledge_graph_urls = [
    path('', KnowledgeGraphViewSet.as_view({'get': 'list'}), name='knowledge-graph'),
    path('find_path/', KnowledgeGraphViewSet.as_view({'post': 'find_path'}), name='knowledge-graph-find-path'),
    path('analyze/', KnowledgeGraphViewSet.as_view({'get': 'analyze'}), name='knowledge-graph-analyze'),
    path('search/', KnowledgeGraphViewSet.as_view({'get': 'search'}), name='knowledge-graph-search'),
    path('generate-tags/', KnowledgeGraphViewSet.as_view({'post': 'generate_tags'}), name='knowledge-graph-generate-tags'),
    path('nodes/<int:pk>/related_concepts/', KnowledgeNodeViewSet.as_view({'get': 'related_concepts'}), name='knowledge-node-related-concepts'),
    path('nodes/<int:pk>/related/', KnowledgeNodeViewSet.as_view({'get': 'related'}), name='knowledge-node-related'),
    path('nodes/', include(router.urls[0:1])),  # 只包含nodes路由
    path('relations/', include(router.urls[1:2])),  # 只包含links路由(重命名为relations)
]

urlpatterns = [
    path('knowledge-graph/', include(knowledge_graph_urls)),
    path('', include(router.urls)),  # 保持原有路由不变
]