"""
搜索视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
import logging

from search.services import SearchService, SuggestionService
from search.serializers import SearchQuerySerializer

# 配置日志
logger = logging.getLogger(__name__)

class SearchViewSet(viewsets.ViewSet):
    """搜索视图集"""
    permission_classes = [IsAuthenticated]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.search_service = SearchService()
        self.suggestion_service = SuggestionService()

    @action(detail=False, methods=['get'])
    def query(self, request):
        """执行搜索查询"""
        # 获取查询参数
        query = request.query_params.get('q', '')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        use_vector = request.query_params.get('use_vector', 'true').lower() == 'true'

        # 获取过滤条件
        filters = {}

        if 'type' in request.query_params:
            filters['index_type'] = request.query_params.get('type').split(',')

        if 'public' in request.query_params:
            filters['is_public'] = request.query_params.get('public').lower() == 'true'

        # 执行搜索
        results = self.search_service.search(
            query=query,
            user=request.user,
            filters=filters,
            page=page,
            page_size=page_size,
            use_vector=use_vector
        )

        return Response(results)

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """获取最近搜索"""
        limit = int(request.query_params.get('limit', 10))

        recent_searches = self.search_service.get_recent_searches(
            user=request.user,
            limit=limit
        )

        return Response(recent_searches)

    @action(detail=False, methods=['get'])
    def popular(self, request):
        """获取热门搜索"""
        limit = int(request.query_params.get('limit', 10))

        popular_searches = self.search_service.get_popular_searches(
            limit=limit
        )

        return Response(popular_searches)

    @action(detail=False, methods=['post'])
    def clear_history(self, request):
        """清除搜索历史"""
        deleted = self.search_service.clear_search_history(
            user=request.user
        )

        return Response({
            'deleted': deleted
        })

    @action(detail=False, methods=['get'])
    def suggestions(self, request):
        """获取搜索建议"""
        prefix = request.query_params.get('prefix', '')
        limit = int(request.query_params.get('limit', 10))
        include_global = request.query_params.get('include_global', 'true').lower() == 'true'

        suggestions = self.suggestion_service.get_suggestions(
            prefix=prefix,
            user=request.user,
            limit=limit,
            include_global=include_global
        )

        return Response(suggestions)

    @action(detail=False, methods=['post'])
    def add_suggestion(self, request):
        """添加搜索建议"""
        text = request.data.get('text')
        is_global = request.data.get('is_global', False)

        if not text:
            return Response(
                {'detail': '建议文本不能为空'},
                status=status.HTTP_400_BAD_REQUEST
            )

        suggestion = self.suggestion_service.add_suggestion(
            text=text,
            user=request.user if not is_global else None,
            is_global=is_global
        )

        return Response({
            'id': suggestion.id,
            'text': suggestion.text,
            'frequency': suggestion.frequency,
            'is_global': suggestion.is_global
        })

    @action(detail=False, methods=['post'])
    def delete_suggestion(self, request):
        """删除搜索建议"""
        suggestion_id = request.data.get('id')

        if not suggestion_id:
            return Response(
                {'detail': '建议ID不能为空'},
                status=status.HTTP_400_BAD_REQUEST
            )

        success = self.suggestion_service.delete_suggestion(
            suggestion_id=suggestion_id,
            user=request.user
        )

        if success:
            return Response({'detail': '删除成功'})
        else:
            return Response(
                {'detail': '删除失败，建议不存在或无权删除'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['post'])
    def text(self, request):
        """文本搜索"""
        try:
            query = request.data.get('query', '')
            options = request.data.get('options', {})

            if not query:
                return Response(
                    {'error': '搜索关键词不能为空'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 构建过滤条件
            filters = {}
            if 'type' in options:
                filters['index_type'] = options['type']
            if 'public' in options:
                filters['is_public'] = options['public']

            # 执行搜索
            results = self.search_service.search(
                query=query,
                user=request.user,
                filters=filters,
                page=options.get('page', 1),
                page_size=options.get('page_size', 20),
                use_vector=options.get('use_vector', True)
            )

            # 记录搜索历史
            self.search_service.add_search_history(
                user=request.user,
                query=query,
                search_type='text',
                result_count=len(results.get('results', []))
            )

            return Response(results)
        except Exception as e:
            logger.error(f"文本搜索错误: {str(e)}")
            return Response(
                {'error': f'搜索失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def voice(self, request):
        """语音搜索"""
        try:
            audio_file = request.FILES.get('audio')
            options = request.data.get('options', {})

            if not audio_file:
                return Response(
                    {'error': '未提供音频文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 调用语音识别服务转换为文本
            from voice_recognition.services import VoiceRecognitionService
            voice_service = VoiceRecognitionService()

            recognition_result = voice_service.recognize_speech(audio_file)

            if not recognition_result.get('success'):
                return Response(
                    {'error': recognition_result.get('error', '语音识别失败')},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 获取识别的文本
            query = recognition_result.get('text', '')

            if not query:
                return Response(
                    {'error': '未能识别出有效的搜索关键词'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 构建过滤条件
            filters = {}
            if 'type' in options:
                filters['index_type'] = options['type']
            if 'public' in options:
                filters['is_public'] = options['public']

            # 执行搜索
            results = self.search_service.search(
                query=query,
                user=request.user,
                filters=filters,
                page=options.get('page', 1),
                page_size=options.get('page_size', 20),
                use_vector=options.get('use_vector', True)
            )

            # 记录搜索历史
            self.search_service.add_search_history(
                user=request.user,
                query=query,
                search_type='voice',
                result_count=len(results.get('results', []))
            )

            # 返回结果，包含识别的文本
            return Response({
                'recognized_text': query,
                **results
            })
        except Exception as e:
            logger.error(f"语音搜索错误: {str(e)}")
            return Response(
                {'error': f'搜索失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def image(self, request):
        """图像搜索"""
        try:
            image_file = request.FILES.get('image')
            options = request.data.get('options', {})

            if not image_file:
                return Response(
                    {'error': '未提供图像文件'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 调用图像分析服务提取内容
            from ai_assistant.services import ImageAnalysisService
            image_service = ImageAnalysisService()

            analysis_result = image_service.analyze_image(image_file)

            if not analysis_result.get('success'):
                return Response(
                    {'error': analysis_result.get('error', '图像分析失败')},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 获取分析的文本描述
            query = analysis_result.get('description', '')

            if not query:
                return Response(
                    {'error': '未能从图像中提取有效的搜索内容'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 构建过滤条件
            filters = {}
            if 'type' in options:
                filters['index_type'] = options['type']
            if 'public' in options:
                filters['is_public'] = options['public']

            # 执行搜索
            results = self.search_service.search(
                query=query,
                user=request.user,
                filters=filters,
                page=options.get('page', 1),
                page_size=options.get('page_size', 20),
                use_vector=options.get('use_vector', True)
            )

            # 记录搜索历史
            self.search_service.add_search_history(
                user=request.user,
                query=f"[图像搜索] {query[:50]}...",
                search_type='image',
                result_count=len(results.get('results', []))
            )

            # 返回结果，包含图像分析结果
            return Response({
                'image_analysis': analysis_result,
                **results
            })
        except Exception as e:
            logger.error(f"图像搜索错误: {str(e)}")
            return Response(
                {'error': f'搜索失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def knowledge_graph(self, request):
        """知识图谱搜索"""
        try:
            query = request.data.get('query', '')
            options = request.data.get('options', {})

            if not query:
                return Response(
                    {'error': '搜索关键词不能为空'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 调用知识图谱服务
            from knowledge_graph.services import KnowledgeGraphService
            kg_service = KnowledgeGraphService()

            # 执行知识图谱搜索
            kg_results = kg_service.search(
                query=query,
                user=request.user,
                max_results=options.get('max_results', 20),
                include_edges=options.get('include_edges', True)
            )

            # 记录搜索历史
            self.search_service.add_search_history(
                user=request.user,
                query=query,
                search_type='knowledge_graph',
                result_count=len(kg_results.get('nodes', []))
            )

            return Response(kg_results)
        except Exception as e:
            logger.error(f"知识图谱搜索错误: {str(e)}")
            return Response(
                {'error': f'搜索失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def history(self, request):
        """获取搜索历史"""
        try:
            limit = int(request.query_params.get('limit', 20))

            history = self.search_service.get_search_history(
                user=request.user,
                limit=limit
            )

            return Response(history)
        except Exception as e:
            logger.error(f"获取搜索历史错误: {str(e)}")
            return Response(
                {'error': f'获取搜索历史失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
