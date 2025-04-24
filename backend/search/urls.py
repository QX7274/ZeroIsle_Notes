from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SearchViewSet

# 创建路由器
router = DefaultRouter()

# 搜索路由
search_urls = [
    path('text/', SearchViewSet.as_view({'post': 'text'}), name='search-text'),
    path('voice/', SearchViewSet.as_view({'post': 'voice'}), name='search-voice'),
    path('image/', SearchViewSet.as_view({'post': 'image'}), name='search-image'),
    path('knowledge-graph/', SearchViewSet.as_view({'post': 'knowledge_graph'}), name='search-knowledge-graph'),
    path('history/', SearchViewSet.as_view({'get': 'history'}), name='search-history'),
    path('clear-history/', SearchViewSet.as_view({'delete': 'clear_history'}), name='search-clear-history'),
]

urlpatterns = [
    path('', include(search_urls)),
]
