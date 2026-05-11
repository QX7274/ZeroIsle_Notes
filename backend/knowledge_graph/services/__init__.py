"""
知识图谱模块服务初始化文件
导入所有服务以便在其他地方直接从knowledge_graph.services导入
"""

# 采用容错导入，避免在最小测试环境中因可选依赖缺失导致整个包不可用
try:
    from .graph_service import GraphService
except Exception:
    GraphService = None

try:
    from .neo4j_service import Neo4jService
except Exception:
    Neo4jService = None

try:
    from .analysis_service import AnalysisService
except Exception:
    AnalysisService = None

try:
    from .recommendation_service import RecommendationService
except Exception:
    RecommendationService = None

try:
    from .inference_service import InferenceService, get_inference_service
except Exception:
    InferenceService = None
    get_inference_service = None

__all__ = [
    'GraphService',
    'Neo4jService',
    'AnalysisService',
    'RecommendationService',
    'InferenceService',
    'get_inference_service',
]

