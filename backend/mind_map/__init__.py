"""
思维导图模块初始化文件
"""

# 从MongoDB模型导入
from .mongodb_models import MindMap, MindMapNode, MindMapEdge, MindMapTemplate

default_app_config = 'mind_map.apps.MindMapConfig'
