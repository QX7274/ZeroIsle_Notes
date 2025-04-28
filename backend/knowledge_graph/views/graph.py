"""
知识图谱视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
import jieba
import jieba.analyse

from knowledge_graph.mongodb_models import KnowledgeNode, KnowledgeEdge
from knowledge_graph.serializers import (
    KnowledgeNodeListSerializer,
    KnowledgeEdgeListSerializer
)
from knowledge_graph.utils import find_shortest_path, find_related_concepts, analyze_knowledge_structure
from knowledge_graph.services import GraphService, Neo4jService

class KnowledgeGraphViewSet(viewsets.ViewSet):
    """
    知识图谱视图集
    """
    permission_classes = [IsAuthenticated]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.graph_service = GraphService()
        self.neo4j_service = Neo4jService()

    def list(self, request):
        """
        获取完整知识图谱
        """
        user = request.user

        # 获取过滤参数
        node_types = request.query_params.getlist('node_types', [])
        edge_types = request.query_params.getlist('edge_types', [])
        use_neo4j = request.query_params.get('use_neo4j', 'false').lower() == 'true'

        if use_neo4j:
            # 使用Neo4j获取图谱数据
            try:
                graph_data = self.neo4j_service.get_graph_for_user(user.id)
                return Response(graph_data)
            except Exception as e:
                # 如果Neo4j查询失败，回退到Django ORM
                pass

        # 使用MongoDB查询
        # 查询节点
        nodes_query = KnowledgeNode.objects.filter(user=user, is_deleted=False)
        if node_types:
            nodes_query = nodes_query.filter(type__in=node_types)

        # 查询边
        edges_query = KnowledgeEdge.objects.filter(user=user, is_deleted=False)
        if edge_types:
            edges_query = edges_query.filter(type__in=edge_types)

        # 序列化数据
        nodes = KnowledgeNodeListSerializer(nodes_query, many=True).data
        edges = KnowledgeEdgeListSerializer(edges_query, many=True).data

        return Response({
            'nodes': nodes,
            'edges': edges
        })

    @action(detail=False, methods=['post'])
    def find_path(self, request):
        """
        查找两个知识点之间的路径
        """
        source_id = request.data.get('source_id')
        target_id = request.data.get('target_id')

        if not source_id or not target_id:
            return Response(
                {'error': '必须提供源节点和目标节点ID'},
                status=status.HTTP_400_BAD_REQUEST
            )

        path = find_shortest_path(request.user, source_id, target_id)

        if path is None:
            return Response(
                {'error': '未找到连接路径'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response({'path': path})

    @action(detail=False, methods=['get'])
    def analyze(self, request):
        """
        分析知识结构
        """
        use_neo4j = request.query_params.get('use_neo4j', 'false').lower() == 'true'

        if use_neo4j:
            try:
                analytics = self.neo4j_service.get_analytics(request.user.id)
                return Response(analytics)
            except Exception as e:
                # 如果Neo4j查询失败，回退到Django分析
                pass

        # 使用Django ORM分析
        analysis = analyze_knowledge_structure(request.user)
        return Response(analysis)

    @action(detail=False, methods=['post'])
    def generate_tags(self, request):
        """
        生成标签
        """
        text = request.data.get('text', '')
        title = request.data.get('title', '')
        count = int(request.data.get('count', 5))

        if not text:
            return Response(
                {'error': '必须提供文本内容'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 使用jieba提取关键词
        if title:
            # 标题权重加倍
            text = title + " " + title + " " + text

        # 使用TF-IDF算法提取关键词
        tags = jieba.analyse.extract_tags(text, topK=count)

        return Response({'tags': tags})

    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        搜索知识节点
        """
        query = request.query_params.get('query', '')
        if not query:
            return Response(
                {'error': '必须提供搜索关键词'},
                status=status.HTTP_400_BAD_REQUEST
            )

        nodes = KnowledgeNode.objects.filter(
            user=request.user,
            is_deleted=False
        ).filter(
            title__icontains=query
        )

        serializer = KnowledgeNodeListSerializer(nodes, many=True)
        return Response(serializer.data)
