"""
搜索模块视图初始化文件
导入所有视图以便在其他地方直接从search.views导入
"""

from .search import SearchViewSet
from .search_index import SearchIndexViewSet
from .search_query import SearchQueryViewSet
from .search_suggestion import SearchSuggestionViewSet
