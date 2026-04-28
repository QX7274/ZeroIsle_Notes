"""
搜索模块URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SearchViewSet,
    SearchIndexViewSet,
    SearchQueryViewSet,
    SearchSuggestionViewSet
)
from .views.search import SearchConfigurationView
from .views.semantic_search_views import (
    SemanticSearchView,
    HybridSearchView,
    VectorIndexView,
    VectorStatsView,
    SimilarDocumentsView
)
from . import views as legacy_views

# 创建路由器
router = DefaultRouter()
router.register(r'search', SearchViewSet, basename='search')
router.register(r'indices', SearchIndexViewSet, basename='search-index')
router.register(r'queries', SearchQueryViewSet, basename='search-query')
router.register(r'suggestions', SearchSuggestionViewSet, basename='search-suggestion')

# 兼容旧版API
legacy_urls = [
    path('text/', legacy_views.SearchViewSet.as_view({'post': 'text'}), name='search-text'),
    path('voice/', legacy_views.SearchViewSet.as_view({'post': 'voice'}), name='search-voice'),
    path('image/', legacy_views.SearchViewSet.as_view({'post': 'image'}), name='search-image'),
    path('knowledge-graph/', legacy_views.SearchViewSet.as_view({'post': 'knowledge_graph'}), name='search-knowledge-graph'),
    path('history/', legacy_views.SearchViewSet.as_view({'get': 'history'}), name='search-history'),
    path('clear-history/', legacy_views.SearchViewSet.as_view({'delete': 'clear_history'}), name='search-clear-history'),
]

# 语义搜索API
semantic_urls = [
    path('semantic/', SemanticSearchView.as_view(), name='semantic-search'),
    path('hybrid/', HybridSearchView.as_view(), name='hybrid-search'),
    path('vector/index/', VectorIndexView.as_view(), name='vector-index'),
    path('vector/stats/', VectorStatsView.as_view(), name='vector-stats'),
    path('similar/<str:document_id>/', SimilarDocumentsView.as_view(), name='similar-documents'),
]

urlpatterns = [
    # API路由
    path('', include(router.urls)),

    # 兼容旧版API
    *legacy_urls,
    
    # 语义搜索API
    *semantic_urls,

    # 搜索配置管理API
    path('config/', SearchConfigurationView.as_view(), name='search-config'),
]

