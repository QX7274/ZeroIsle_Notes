"""
搜索模块模型初始化文件
导入所有模型以便在其他地方直接从search.models导入
"""

# 从MongoDB模型导入
from ..mongodb_models import SearchIndex, SearchQuery, SearchResult, SearchSuggestion
