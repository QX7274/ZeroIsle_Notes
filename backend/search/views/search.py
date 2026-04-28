"""
搜索视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
import logging

from search.services import SearchService, SuggestionService
from search.serializers.search_query import SearchQuerySerializer
from common.utils import validate_uploaded_file

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
        use_vector = request.query_params.get('use_vector', 'false').lower() == 'true'

        # 空查询统一返回 400
        if not query:
            return Response({'error': '搜索关键词不能为空'}, status=status.HTTP_400_BAD_REQUEST)

        # 获取过滤条件
        filters = {}

        if 'type' in request.query_params:
            filters['index_type'] = request.query_params.get('type').split(',')

        if 'public' in request.query_params:
            filters['is_public'] = request.query_params.get('public').lower() == 'true'

        # 时间范围过滤（可选）
        if 'updated_after' in request.query_params:
            filters['updated_after'] = request.query_params.get('updated_after')
        if 'updated_before' in request.query_params:
            filters['updated_before'] = request.query_params.get('updated_before')

        # 排序（updated_desc | updated_asc）
        if 'sort' in request.query_params:
            filters['sort'] = request.query_params.get('sort')

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
        """获取热门搜索（支持时间窗口与最小计数）"""
        limit = int(request.query_params.get('limit', 10))
        window = request.query_params.get('window')  # e.g., '7d', '30d', '12h'
        min_count = int(request.query_params.get('min_count', 1))

        popular_searches = self.search_service.get_popular_searches(
            limit=limit,
            window=window,
            min_count=min_count
        )

        return Response(popular_searches)

    @action(detail=False, methods=['post'])
    def clear_history(self, request):
        """清除搜索历史（需要确认参数）"""
        confirm = str(request.data.get('confirm', 'false')).lower() == 'true'
        if not confirm:
            return Response(
                {'detail': '请确认执行清除操作：confirm=true'},
                status=status.HTTP_400_BAD_REQUEST
            )

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
        """添加搜索建议（全局建议仅管理员可创建；文本将被规范化）"""
        text = request.data.get('text')
        is_global = bool(request.data.get('is_global', False))

        if not text:
            return Response(
                {'detail': '建议文本不能为空'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 权限控制：全局建议仅管理员
        if is_global and not getattr(request.user, 'is_staff', False):
            return Response(
                {'detail': '无权限创建全局建议'},
                status=status.HTTP_403_FORBIDDEN
            )

        result = self.suggestion_service.add_suggestion(
            text=text,
            user=None if is_global else request.user,
            is_global=is_global
        )

        if not result:
            return Response(
                {'detail': '建议文本无效或过长（需包含有效字符，长度<=100）'},
                status=status.HTTP_400_BAD_REQUEST
            )

        suggestion, created = result

        return Response({
            'id': str(suggestion.id),
            'text': suggestion.text,
            'frequency': suggestion.frequency,
            'is_global': suggestion.is_global,
            'created': created
        })

    @action(detail=False, methods=['post'])
    def delete_suggestion(self, request):
        """删除搜索建议（全局建议仅管理员可删除）"""
        suggestion_id = request.data.get('id')

        if not suggestion_id:
            return Response(
                {'detail': '建议ID不能为空'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 管理员可删除任意建议（包含全局）；普通用户仅可删除自己的建议
        is_admin = getattr(request.user, 'is_staff', False)
        success = self.suggestion_service.delete_suggestion(
            suggestion_id=suggestion_id,
            user=None if is_admin else request.user
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
                use_vector=options.get('use_vector', False)
            )

            # 记录搜索历史
            self.search_service.add_search_history(
                user=request.user,
                query=query,
                search_type='text',
                result_count=results.get('total', 0)
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
        """语音搜索 - 支持多种语音识别引擎"""
        try:
            audio_file = request.FILES.get('audio')
            audio_base64 = request.data.get('audio_base64')
            options = request.data.get('options', {})
            language = request.data.get('language', 'zh')
            engine = request.data.get('engine', 'whisper')  # whisper, xunfei, baidu

            # 基础校验：文件大小/类型 或 base64 长度
            if audio_file:
                ok, err = validate_uploaded_file(audio_file, ['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg'], max_size_mb=25)
                if not ok:
                    return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)
            elif audio_base64:
                # 粗略限制 base64 长度（~25MB 原始 => ~33MB base64）
                if len(audio_base64) > 35_000_000:
                    return Response({'error': '音频数据过大，最大允许 25MB'}, status=status.HTTP_400_BAD_REQUEST)

            if not audio_file and not audio_base64:
                return Response(
                    {'error': '未提供音频文件或音频数据'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 保存临时音频文件
            import tempfile
            import base64

            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
                if audio_file:
                    for chunk in audio_file.chunks():
                        temp_file.write(chunk)
                else:
                    audio_data = base64.b64decode(audio_base64)
                    temp_file.write(audio_data)
                temp_file_path = temp_file.name

            # 使用统一的语音识别服务
            from voice_recognition.services import WhisperService

            try:
                # 不再需要根据引擎选择服务，WhisperService内部会处理模式选择
                unified_service = WhisperService()
                recognition_result = unified_service.transcribe(
                    audio_file_path=temp_file_path,
                    language=language,
                    # engine 参数可以作为提示传递，但由服务决定如何使用
                    model=engine if engine != 'whisper' else 'whisper-1'
                )
            finally:
                # 删除临时文件
                import os
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)

            if recognition_result.get('status') == 'failed':
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
                use_vector=options.get('use_vector', False)
            )

            # 记录搜索历史
            self.search_service.add_search_history(
                user=request.user,
                query=query,
                search_type='voice',
                result_count=results.get('total', 0)
            )

            # 返回结果，包含识别的文本和详细信息
            return Response({
                'recognized_text': query,
                'recognition_engine': engine,
                'language': language,
                'confidence': recognition_result.get('confidence', 0),
                'duration': recognition_result.get('duration', 0),
                'segments': recognition_result.get('segments', []),
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
        """图像搜索 - 支持OCR和图像理解"""
        try:
            image_file = request.FILES.get('image')
            image_base64 = request.data.get('image_base64')
            options = request.data.get('options', {})
            task = request.data.get('task', 'describe')  # describe, extract_text, identify_objects, analyze
            custom_prompt = request.data.get('prompt', '')

            if not image_file and not image_base64:
                return Response(
                    {'error': '未提供图像文件或图像数据'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 保存临时图像文件并分析
            import tempfile, base64, os
            temp_file_path = None
            try:
                # 上传校验
                if image_file:
                    ok, err = validate_uploaded_file(image_file, ['jpg', 'jpeg', 'png', 'webp'], max_size_mb=10)
                    if not ok:
                        return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)
                elif image_base64:
                    # 粗略限制 base64 长度（~10MB 原图 => ~13MB base64）
                    if len(image_base64) > 14_000_000:
                        return Response({'error': '图像数据过大，最大允许 10MB'}, status=status.HTTP_400_BAD_REQUEST)

                with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
                    if image_file:
                        for chunk in image_file.chunks():
                            temp_file.write(chunk)
                    else:
                        image_data = base64.b64decode(image_base64)
                        temp_file.write(image_data)
                    temp_file_path = temp_file.name

                # 调用图像分析服务提取内容
                from ai_assistant.services import ImageAnalysisService
                image_service = ImageAnalysisService()
                analysis_result = image_service.analyze_image(
                    file_path=temp_file_path,
                    task=task,
                    prompt=custom_prompt
                )
            finally:
                # 删除临时文件
                if temp_file_path and os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)

            if not analysis_result or 'result' not in analysis_result:
                return Response(
                    {'error': '图像分析失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 获取分析的文本描述
            query = analysis_result.get('result', '')

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
                use_vector=options.get('use_vector', False)
            )

            # 记录搜索历史
            self.search_service.add_search_history(
                user=request.user,
                query=f"[图像搜索-{task}] {query[:50]}...",
                search_type='image',
                result_count=results.get('total', 0)
            )

            # 返回结果，包含图像分析结果
            return Response({
                'image_analysis': {
                    'task': task,
                    'result': query,
                    'description': query
                },
                'search_query': query,
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

from rest_framework.views import APIView
from rest_framework.permissions import IsAdminUser
from search.mongodb_models import SearchConfiguration
from search.serializers.search_configuration import SearchConfigurationSerializer

class SearchConfigurationView(APIView):
    """
    管理搜索配置的视图
    仅限管理员访问。
    """
    permission_classes = [IsAdminUser]

    def get(self, request, *args, **kwargs):
        """获取当前的搜索配置。"""
        config = SearchConfiguration.get_config()
        serializer = SearchConfigurationSerializer(config)
        return Response(serializer.data)

    def put(self, request, *args, **kwargs):
        """更新搜索配置。"""
        config = SearchConfiguration.get_config()
        serializer = SearchConfigurationSerializer(config, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

