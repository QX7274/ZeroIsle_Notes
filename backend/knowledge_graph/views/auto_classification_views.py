"""
自动分类视图
提供自动分类和知识图谱构建相关的API
"""

import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from notes.mongodb_models import Note, Tag, Category
from knowledge_graph.services.auto_classification_service import AutoClassificationService
from knowledge_graph.services.knowledge_graph_builder_service import KnowledgeGraphBuilderService

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auto_classify_note(request):
    """
    自动分类笔记
    """
    try:
        # 获取请求参数
        note_id = request.data.get('note_id')
        
        if not note_id:
            return Response(
                {'error': '必须提供笔记ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 获取笔记
        try:
            note = Note.objects.get(id=note_id, user=request.user)
        except Note.DoesNotExist:
            return Response(
                {'error': '笔记不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 初始化服务
        service = AutoClassificationService()
        
        # 自动分类
        result = service.classify_note(note)
        
        return Response(result)
    except Exception as e:
        logger.error(f"自动分类笔记失败: {e}")
        return Response(
            {'error': f'自动分类笔记失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def suggest_tags(request):
    """
    推荐标签
    """
    try:
        # 获取请求参数
        note_id = request.data.get('note_id')
        count = int(request.data.get('count', 10))
        
        if not note_id:
            return Response(
                {'error': '必须提供笔记ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 获取笔记
        try:
            note = Note.objects.get(id=note_id, user=request.user)
        except Note.DoesNotExist:
            return Response(
                {'error': '笔记不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 获取已有标签
        existing_tags = list(note.tags)
        
        # 初始化服务
        service = AutoClassificationService()
        
        # 推荐标签
        tags = service.suggest_tags(note, existing_tags, count)
        
        return Response({'tags': tags})
    except Exception as e:
        logger.error(f"推荐标签失败: {e}")
        return Response(
            {'error': f'推荐标签失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def extract_keywords(request):
    """
    提取关键词
    """
    try:
        # 获取请求参数
        text = request.data.get('text', '')
        title = request.data.get('title', '')
        count = int(request.data.get('count', 10))
        
        if not text:
            return Response(
                {'error': '必须提供文本内容'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 初始化服务
        service = AutoClassificationService()
        
        # 提取关键词
        keywords = service.extract_keywords(text, title, count)
        
        return Response({'keywords': keywords})
    except Exception as e:
        logger.error(f"提取关键词失败: {e}")
        return Response(
            {'error': f'提取关键词失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def find_similar_notes(request):
    """
    查找相似笔记
    """
    try:
        # 获取请求参数
        note_id = request.data.get('note_id')
        threshold = float(request.data.get('threshold', 0.3))
        limit = int(request.data.get('limit', 10))
        
        if not note_id:
            return Response(
                {'error': '必须提供笔记ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 获取笔记
        try:
            note = Note.objects.get(id=note_id, user=request.user)
        except Note.DoesNotExist:
            return Response(
                {'error': '笔记不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 初始化服务
        service = AutoClassificationService()
        
        # 查找相似笔记
        similar_notes = service.find_similar_notes(note, threshold, limit)
        
        # 构建响应
        result = []
        for item in similar_notes:
            similar_note = item['note']
            result.append({
                'id': str(similar_note.id),
                'title': similar_note.title,
                'similarity': item['similarity'],
                'updated_at': similar_note.updated_at.isoformat()
            })
        
        return Response({'similar_notes': result})
    except Exception as e:
        logger.error(f"查找相似笔记失败: {e}")
        return Response(
            {'error': f'查找相似笔记失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def integrate_with_existing_notes(request):
    """
    将新笔记整合到现有笔记体系中
    """
    try:
        # 获取请求参数
        note_id = request.data.get('note_id')
        
        if not note_id:
            return Response(
                {'error': '必须提供笔记ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 获取笔记
        try:
            note = Note.objects.get(id=note_id, user=request.user)
        except Note.DoesNotExist:
            return Response(
                {'error': '笔记不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 初始化服务
        auto_classification_service = AutoClassificationService()
        
        # 查找相似笔记
        similar_notes = auto_classification_service.find_similar_notes(note, threshold=0.3, limit=10)
        
        # 整合到现有笔记体系
        result = auto_classification_service.integrate_with_existing_notes(note, similar_notes)
        
        return Response(result)
    except Exception as e:
        logger.error(f"整合笔记失败: {e}")
        return Response(
            {'error': f'整合笔记失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def build_knowledge_graph(request):
    """
    构建知识图谱
    """
    try:
        # 获取请求参数
        note_id = request.data.get('note_id')
        extract_concepts = request.data.get('extract_concepts', True)
        
        if not note_id:
            return Response(
                {'error': '必须提供笔记ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 获取笔记
        try:
            note = Note.objects.get(id=note_id, user=request.user)
        except Note.DoesNotExist:
            return Response(
                {'error': '笔记不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 初始化服务
        service = KnowledgeGraphBuilderService()
        
        # 构建知识图谱
        result = service.build_graph_from_note(note, extract_concepts)
        
        return Response(result)
    except Exception as e:
        logger.error(f"构建知识图谱失败: {e}")
        return Response(
            {'error': f'构建知识图谱失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def build_knowledge_graph_for_user(request):
    """
    为用户构建完整知识图谱
    """
    try:
        # 获取请求参数
        limit = int(request.data.get('limit', 100))
        extract_concepts = request.data.get('extract_concepts', True)
        
        # 初始化服务
        service = KnowledgeGraphBuilderService()
        
        # 构建知识图谱
        result = service.build_graph_for_user(request.user, limit, extract_concepts)
        
        return Response(result)
    except Exception as e:
        logger.error(f"为用户构建知识图谱失败: {e}")
        return Response(
            {'error': f'为用户构建知识图谱失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def analyze_note_connections(request):
    """
    分析笔记的关联
    """
    try:
        # 获取请求参数
        note_id = request.data.get('note_id')
        
        if not note_id:
            return Response(
                {'error': '必须提供笔记ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 获取笔记
        try:
            note = Note.objects.get(id=note_id, user=request.user)
        except Note.DoesNotExist:
            return Response(
                {'error': '笔记不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 初始化服务
        service = KnowledgeGraphBuilderService()
        
        # 分析笔记关联
        result = service.analyze_note_connections(note)
        
        return Response(result)
    except Exception as e:
        logger.error(f"分析笔记关联失败: {e}")
        return Response(
            {'error': f'分析笔记关联失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def suggest_related_content(request):
    """
    推荐相关内容
    """
    try:
        # 获取请求参数
        note_id = request.data.get('note_id')
        
        if not note_id:
            return Response(
                {'error': '必须提供笔记ID'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 获取笔记
        try:
            note = Note.objects.get(id=note_id, user=request.user)
        except Note.DoesNotExist:
            return Response(
                {'error': '笔记不存在'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # 初始化服务
        service = KnowledgeGraphBuilderService()
        
        # 推荐相关内容
        result = service.suggest_related_content(note)
        
        return Response(result)
    except Exception as e:
        logger.error(f"推荐相关内容失败: {e}")
        return Response(
            {'error': f'推荐相关内容失败: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
