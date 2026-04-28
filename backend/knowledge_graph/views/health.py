"""
知识图谱健康检查视图
"""

import logging
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from ..services.neo4j_service import Neo4jService

logger = logging.getLogger('backend')

@require_http_methods(["GET"])
def neo4j_health_check(request):
    """检查 Neo4j 服务的连接状态。"""
    try:
        neo4j_service = Neo4jService()
        status = neo4j_service.check_connection()
        status_code = 200 if status.get('ok') else 503
        
        return JsonResponse(status, status=status_code)
    except Exception as e:
        logger.error(f"Neo4j health check endpoint failed unexpectedly: {e}")
        return JsonResponse({
            'ok': False,
            'error': 'Health check endpoint failed',
            'details': str(e)
        }, status=500)

