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

urlpatterns = [
    # API路由
    path('', include(router.urls)),

    # 兼容旧版API
    *legacy_urls,
]
