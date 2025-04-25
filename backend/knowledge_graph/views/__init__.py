"""
知识图谱模块视图初始化文件
导入所有视图以便在其他地方直接从knowledge_graph.views导入
"""

from .graph import KnowledgeGraphViewSet
from .node import KnowledgeNodeViewSet
from .edge import KnowledgeEdgeViewSet
