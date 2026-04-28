"""
推荐与候选边相关视图
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.utils import timezone

from ..services.recommendation_service import RecommendationService
from ..utils.response import KGResponse, ErrorCodes


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def suggest_edges(request):
    """
    获取候选边建议
    GET /api/knowledge-graph/auto/suggest-edges/?node_id=<id>&top_k=10
    """
    node_id = request.query_params.get('node_id')
    top_k = request.query_params.get('top_k', '10')

    try:
        top_k_int = int(top_k)
        if top_k_int < 1 or top_k_int > 100:
            raise ValueError
    except Exception:
        return KGResponse.error(
            ErrorCodes.INVALID_PARAM,
            '参数 top_k 必须是 1~100 的整数',
            status_code=status.HTTP_400_BAD_REQUEST
        )

    if not node_id:
        return KGResponse.error(
            ErrorCodes.INVALID_PARAM,
            '缺少必要参数 node_id',
            status_code=status.HTTP_400_BAD_REQUEST
        )

    service = RecommendationService()
    suggestions = service.suggest_edges(request.user, node_id=node_id, top_k=top_k_int)
    return KGResponse.success(suggestions)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_suggestions(request):
    """
    批量采纳候选边
    POST /api/knowledge-graph/auto/accept-suggestions/
    Body: {"edges": [{source, target, type, confidence, evidence: []}]}
    """
    edges = request.data.get('edges', [])
    if not isinstance(edges, list) or len(edges) == 0:
        return KGResponse.error(
            ErrorCodes.INVALID_PARAM,
            '缺少必要参数 edges (数组)',
            status_code=status.HTTP_400_BAD_REQUEST
        )

    service = RecommendationService()
    result = service.accept_suggestions(request.user, edges)
    return KGResponse.success(result)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ignore_suggestions(request):
    """
    批量忽略候选边
    POST /api/knowledge-graph/auto/ignore-suggestions/
    Body: {"edges": [{source, target, type}]}
    """
    edges = request.data.get('edges', [])
    if not isinstance(edges, list):
        return KGResponse.error(
            ErrorCodes.INVALID_PARAM,
            '参数 edges 必须为数组',
            status_code=status.HTTP_400_BAD_REQUEST
        )

    service = RecommendationService()
    result = service.ignore_suggestions(request.user, edges)
    return KGResponse.success(result)

