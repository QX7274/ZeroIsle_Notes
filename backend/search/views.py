from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q
import os
import tempfile
import speech_recognition as sr
from PIL import Image
import pytesseract
from django.conf import settings

from .models import SearchHistory, SearchResult
from .serializers import (
    SearchHistorySerializer,
    TextSearchSerializer,
    VoiceSearchSerializer,
    ImageSearchSerializer,
    KnowledgeGraphSearchSerializer
)
from notes.models import Note, Tag
from knowledge_graph.models import KnowledgeNode
from .utils import (
    search_notes,
    search_tags,
    search_knowledge_nodes,
    enhance_search_with_knowledge_graph,
    transcribe_audio,
    extract_text_from_image
)


class SearchViewSet(viewsets.ViewSet):
    """
    搜索视图集
    """
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def text(self, request):
        """
        文本搜索
        """
        serializer = TextSearchSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        query = serializer.validated_data['query']
        types = serializer.validated_data['types']
        use_knowledge_graph = serializer.validated_data['use_knowledge_graph']
        limit = serializer.validated_data['limit']
        
        # 创建搜索历史记录
        search_history = SearchHistory.objects.create(
            user=request.user,
            query=query,
            search_type='text'
        )
        
        # 执行搜索
        results = []
        
        if 'note' in types:
            note_results = search_notes(request.user, query, limit)
            results.extend(note_results)
        
        if 'tag' in types:
            tag_results = search_tags(request.user, query, limit)
            results.extend(tag_results)
        
        if 'knowledge' in types:
            knowledge_results = search_knowledge_nodes(request.user, query, limit)
            results.extend(knowledge_results)
        
        # 使用知识图谱增强搜索结果
        if use_knowledge_graph:
            results = enhance_search_with_knowledge_graph(request.user, query, results)
        
        # 按相关度排序
        results = sorted(results, key=lambda x: x['relevance'], reverse=True)[:limit]
        
        # 缓存搜索结果
        for result in results:
            SearchResult.objects.create(
                search_history=search_history,
                result_type=result['type'],
                result_id=result['id'],
                title=result['title'],
                preview=result.get('preview', ''),
                relevance=result['relevance']
            )
        
        return Response({
            'query': query,
            'results': results
        })
    
    @action(detail=False, methods=['post'])
    def voice(self, request):
        """
        语音搜索
        """
        serializer = VoiceSearchSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        audio_file = serializer.validated_data['audio']
        types = serializer.validated_data['types']
        use_knowledge_graph = serializer.validated_data['use_knowledge_graph']
        limit = serializer.validated_data['limit']
        
        # 语音转文本
        try:
            query = transcribe_audio(audio_file)
            if not query:
                return Response(
                    {'error': '无法识别语音内容'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            return Response(
                {'error': f'语音识别失败: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 创建搜索历史记录
        search_history = SearchHistory.objects.create(
            user=request.user,
            query=query,
            search_type='voice'
        )
        
        # 执行文本搜索
        results = []
        
        if 'note' in types:
            note_results = search_notes(request.user, query, limit)
            results.extend(note_results)
        
        if 'tag' in types:
            tag_results = search_tags(request.user, query, limit)
            results.extend(tag_results)
        
        if 'knowledge' in types:
            knowledge_results = search_knowledge_nodes(request.user, query, limit)
            results.extend(knowledge_results)
        
        # 使用知识图谱增强搜索结果
        if use_knowledge_graph:
            results = enhance_search_with_knowledge_graph(request.user, query, results)
        
        # 按相关度排序
        results = sorted(results, key=lambda x: x['relevance'], reverse=True)[:limit]
        
        # 缓存搜索结果
        for result in results:
            SearchResult.objects.create(
                search_history=search_history,
                result_type=result['type'],
                result_id=result['id'],
                title=result['title'],
                preview=result.get('preview', ''),
                relevance=result['relevance']
            )
        
        return Response({
            'query': query,
            'results': results
        })
    
    @action(detail=False, methods=['post'])
    def image(self, request):
        """
        图像搜索
        """
        serializer = ImageSearchSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        image_file = serializer.validated_data['image']
        types = serializer.validated_data['types']
        use_knowledge_graph = serializer.validated_data['use_knowledge_graph']
        limit = serializer.validated_data['limit']
        
        # 图像文本提取
        try:
            query = extract_text_from_image(image_file)
            if not query:
                return Response(
                    {'error': '无法从图像中提取文本'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            return Response(
                {'error': f'图像文本提取失败: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 创建搜索历史记录
        search_history = SearchHistory.objects.create(
            user=request.user,
            query=query,
            search_type='image'
        )
        
        # 执行文本搜索
        results = []
        
        if 'note' in types:
            note_results = search_notes(request.user, query, limit)
            results.extend(note_results)
        
        if 'tag' in types:
            tag_results = search_tags(request.user, query, limit)
            results.extend(tag_results)
        
        if 'knowledge' in types:
            knowledge_results = search_knowledge_nodes(request.user, query, limit)
            results.extend(knowledge_results)
        
        # 使用知识图谱增强搜索结果
        if use_knowledge_graph:
            results = enhance_search_with_knowledge_graph(request.user, query, results)
        
        # 按相关度排序
        results = sorted(results, key=lambda x: x['relevance'], reverse=True)[:limit]
        
        # 缓存搜索结果
        for result in results:
            SearchResult.objects.create(
                search_history=search_history,
                result_type=result['type'],
                result_id=result['id'],
                title=result['title'],
                preview=result.get('preview', ''),
                relevance=result['relevance']
            )
        
        return Response({
            'query': query,
            'results': results
        })
    
    @action(detail=False, methods=['post'])
    def knowledge_graph(self, request):
        """
        知识图谱搜索
        """
        serializer = KnowledgeGraphSearchSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        query = serializer.validated_data['query']
        limit = serializer.validated_data['limit']
        
        # 创建搜索历史记录
        search_history = SearchHistory.objects.create(
            user=request.user,
            query=query,
            search_type='knowledge'
        )
        
        # 执行知识图谱搜索
        results = search_knowledge_nodes(request.user, query, limit)
        
        # 缓存搜索结果
        for result in results:
            SearchResult.objects.create(
                search_history=search_history,
                result_type=result['type'],
                result_id=result['id'],
                title=result['title'],
                preview=result.get('preview', ''),
                relevance=result['relevance']
            )
        
        return Response({
            'query': query,
            'results': results
        })
    
    @action(detail=False, methods=['get'])
    def history(self, request):
        """
        获取搜索历史
        """
        search_history = SearchHistory.objects.filter(user=request.user)
        serializer = SearchHistorySerializer(search_history, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['delete'])
    def clear_history(self, request):
        """
        清除搜索历史
        """
        SearchHistory.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
