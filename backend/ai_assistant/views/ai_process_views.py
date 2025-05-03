"""
AI处理视图
提供笔记中AI工具的API端点
"""

import logging
from django.http import JsonResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..services.text_processing_service import TextProcessingService

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_ai(request):
    """
    AI处理API
    处理用户的文本，执行各种AI处理任务
    """
    user = request.user
    data = request.data

    # 获取请求参数
    text = data.get('text', '')
    tool = data.get('tool', 'summarize')

    if not text:
        return Response(
            {'error': '文本不能为空'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 初始化文本处理服务
    text_service = TextProcessingService()

    try:
        # 执行文本处理任务
        result = text_service.process_text(
            text=text,
            task=tool
        )

        # 返回结果
        return Response(result)

    except Exception as e:
        logger.error(f"AI处理错误: {str(e)}")
        return Response(
            {'error': f'处理文本时出错: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
