"""
语义搜索API视图
提供增强的向量搜索功能接口
"""

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
import logging

from search.services.enhanced_vector_service import get_vector_service, EnhancedVectorService

logger = logging.getLogger('backend')


class SemanticSearchView(APIView):
    """
    语义搜索API
    
    POST /api/search/semantic/
    {
        "query": "搜索查询",
        "top_k": 10,
        "threshold": 0.3
    }
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            query = request.data.get('query', '').strip()
            top_k = request.data.get('top_k', 10)
            threshold = request.data.get('threshold', 0.0)
            
            if not query:
                return Response(
                    {'error': '查询内容不能为空'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 获取向量服务
            vector_service = get_vector_service()
            
            # 执行语义搜索
            results = vector_service.semantic_search(
                query=query,
                top_k=top_k,
                threshold=threshold
            )
            
            return Response({
                'query': query,
                'count': len(results),
                'results': results
            })
            
        except Exception as e:
            logger.error(f"语义搜索失败: {e}")
            return Response(
                {'error': f'搜索失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class HybridSearchView(APIView):
    """
    混合搜索API（关键词 + 语义）
    
    POST /api/search/hybrid/
    {
        "query": "搜索查询",
        "top_k": 10,
        "keyword_weight": 0.6,
        "vector_weight": 0.4
    }
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            query = request.data.get('query', '').strip()
            top_k = request.data.get('top_k', 10)
            keyword_weight = request.data.get('keyword_weight', 0.6)
            vector_weight = request.data.get('vector_weight', 0.4)
            
            if not query:
                return Response(
                    {'error': '查询内容不能为空'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 获取向量服务
            vector_service = get_vector_service()
            
            # 先执行关键词搜索
            from search.services.search_service import SearchService
            search_service = SearchService()
            keyword_results = search_service.search(
                user=request.user,
                query=query,
                search_type='text',
                limit=top_k * 2
            )
            
            # 执行混合搜索
            results = vector_service.hybrid_search(
                query=query,
                keyword_results=keyword_results.get('results', []) if isinstance(keyword_results, dict) else [],
                top_k=top_k,
                keyword_weight=keyword_weight,
                vector_weight=vector_weight
            )
            
            return Response({
                'query': query,
                'count': len(results),
                'results': results,
                'weights': {
                    'keyword': keyword_weight,
                    'vector': vector_weight
                }
            })
            
        except Exception as e:
            logger.error(f"混合搜索失败: {e}")
            return Response(
                {'error': f'搜索失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VectorIndexView(APIView):
    """
    向量索引管理API
    
    POST /api/search/vector/index/
    批量索引文档
    
    DELETE /api/search/vector/index/
    删除文档索引
    
    GET /api/search/vector/stats/
    获取索引统计
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """批量索引文档"""
        try:
            documents = request.data.get('documents', [])
            
            if not documents:
                return Response(
                    {'error': '文档列表不能为空'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 验证文档格式
            for doc in documents:
                if 'id' not in doc or 'title' not in doc:
                    return Response(
                        {'error': '每个文档必须包含id和title字段'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # 获取向量服务并索引
            vector_service = get_vector_service()
            vector_service.index_documents(documents)
            
            return Response({
                'message': f'成功索引 {len(documents)} 个文档',
                'stats': vector_service.get_stats()
            })
            
        except Exception as e:
            logger.error(f"索引文档失败: {e}")
            return Response(
                {'error': f'索引失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def delete(self, request):
        """删除文档索引"""
        try:
            ids = request.data.get('ids', [])
            
            if not ids:
                return Response(
                    {'error': 'ID列表不能为空'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            vector_service = get_vector_service()
            vector_service.delete_documents(ids)
            
            return Response({
                'message': f'成功删除 {len(ids)} 个文档索引',
                'stats': vector_service.get_stats()
            })
            
        except Exception as e:
            logger.error(f"删除索引失败: {e}")
            return Response(
                {'error': f'删除失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VectorStatsView(APIView):
    """向量索引统计API"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """获取索引统计信息"""
        try:
            vector_service = get_vector_service()
            stats = vector_service.get_stats()
            
            return Response(stats)
            
        except Exception as e:
            logger.error(f"获取统计失败: {e}")
            return Response(
                {'error': f'获取失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SimilarDocumentsView(APIView):
    """
    相似文档推荐API
    
    GET /api/search/similar/<document_id>/
    获取与指定文档相似的文档
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, document_id):
        try:
            top_k = int(request.query_params.get('top_k', 5))
            
            # 获取文档内容
            from notes.mongodb_models import Note
            note = Note.objects(id=document_id, user=request.user).first()
            
            if not note:
                return Response(
                    {'error': '文档不存在'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # 构造查询文本
            query_text = f"{note.title} {note.content or ''}"
            
            # 执行语义搜索
            vector_service = get_vector_service()
            results = vector_service.semantic_search(
                query=query_text,
                top_k=top_k + 1  # 多取一个，因为会包含自己
            )
            
            # 排除自身
            results = [r for r in results if r['id'] != str(document_id)][:top_k]
            
            return Response({
                'document_id': str(document_id),
                'similar_documents': results
            })
            
        except Exception as e:
            logger.error(f"获取相似文档失败: {e}")
            return Response(
                {'error': f'获取失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
