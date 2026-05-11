"""
思维导图生成器视图
提供思维导图生成相关的API
"""

import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from mind_map.services.mind_map_generator_service import MindMapGeneratorService

logger = logging.getLogger(__name__)


def _get_generator_service():
    return MindMapGeneratorService()

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_from_text(request):
    """
    从文本生成思维导图
    
    请求体:
    {
        "text": "要生成思维导图的文本内容",
        "title": "思维导图标题（可选）",
        "options": {
            "layout_type": "tree",
            "theme": "default",
            "max_depth": 3,
            "max_children": 7
        }
    }
    """
    try:
        text = request.data.get('text')
        if not text:
            return Response({'error': '文本内容不能为空'}, status=status.HTTP_400_BAD_REQUEST)
        
        title = request.data.get('title')
        options = request.data.get('options', {})
        
        result = _get_generator_service().generate_from_text(
            text=text,
            user=request.user,
            title=title,
            options=options
        )
        
        return Response(result)
    except Exception as e:
        logger.error(f"从文本生成思维导图失败: {str(e)}")
        return Response({'error': f'生成思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_from_note(request, note_id):
    """
    从笔记生成思维导图
    
    请求体:
    {
        "options": {
            "layout_type": "tree",
            "theme": "default",
            "max_depth": 3,
            "max_children": 7
        }
    }
    """
    try:
        options = request.data.get('options', {})
        
        result = _get_generator_service().generate_from_note(
            note_id=note_id,
            user=request.user,
            options=options
        )
        
        return Response(result)
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"从笔记生成思维导图失败: {str(e)}")
        return Response({'error': f'生成思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def expand_node(request):
    """
    扩展思维导图节点
    
    请求体:
    {
        "node": {
            "id": "节点ID",
            "title": "节点标题",
            "content": "节点内容"
        },
        "depth": 1
    }
    """
    try:
        node = request.data.get('node')
        if not node:
            return Response({'error': '节点信息不能为空'}, status=status.HTTP_400_BAD_REQUEST)
        
        depth = request.data.get('depth', 1)
        
        # 调用扩展节点服务
        # 这里需要实现扩展节点的服务方法
        children = []  # 这里应该是调用服务返回的结果
        
        return Response({'children': children})
    except Exception as e:
        logger.error(f"扩展思维导图节点失败: {str(e)}")
        return Response({'error': f'扩展节点失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def optimize_mind_map(request):
    """
    优化思维导图
    
    请求体:
    {
        "mind_map": {
            "nodes": [],
            "edges": []
        },
        "options": {
            "balance": true,
            "simplify": false
        }
    }
    """
    try:
        mind_map = request.data.get('mind_map')
        if not mind_map:
            return Response({'error': '思维导图数据不能为空'}, status=status.HTTP_400_BAD_REQUEST)
        
        options = request.data.get('options', {})
        
        # 调用优化思维导图服务
        # 这里需要实现优化思维导图的服务方法
        optimized_mind_map = mind_map  # 这里应该是调用服务返回的结果
        
        return Response(optimized_mind_map)
    except Exception as e:
        logger.error(f"优化思维导图失败: {str(e)}")
        return Response({'error': f'优化思维导图失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def convert_to_outline(request):
    """
    将思维导图转换为大纲
    
    请求体:
    {
        "mind_map": {
            "nodes": [],
            "edges": []
        }
    }
    """
    try:
        mind_map = request.data.get('mind_map')
        if not mind_map:
            return Response({'error': '思维导图数据不能为空'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 调用转换为大纲服务
        # 这里需要实现转换为大纲的服务方法
        outline = ""  # 这里应该是调用服务返回的结果
        
        return Response({'outline': outline})
    except Exception as e:
        logger.error(f"转换思维导图为大纲失败: {str(e)}")
        return Response({'error': f'转换为大纲失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def export_to_image(request):
    """
    将思维导图导出为图片
    
    请求体:
    {
        "mind_map": {
            "nodes": [],
            "edges": []
        },
        "format": "png"
    }
    """
    try:
        mind_map = request.data.get('mind_map')
        if not mind_map:
            return Response({'error': '思维导图数据不能为空'}, status=status.HTTP_400_BAD_REQUEST)
        
        format = request.data.get('format', 'png')
        
        # 调用导出为图片服务
        # 这里需要实现导出为图片的服务方法
        image_data = ""  # 这里应该是调用服务返回的结果
        
        return Response({'image': image_data})
    except Exception as e:
        logger.error(f"导出思维导图为图片失败: {str(e)}")
        return Response({'error': f'导出为图片失败: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
