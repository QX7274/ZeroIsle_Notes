from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
import jieba
import jieba.analyse

from .models import KnowledgeNode, KnowledgeEdge
from .serializers import (
    KnowledgeNodeSerializer,
    KnowledgeEdgeSerializer,
    KnowledgeGraphSerializer,
    KnowledgeNodeListSerializer,
    KnowledgeEdgeListSerializer
)
from .utils import find_shortest_path, find_related_concepts, analyze_knowledge_structure
from .neo4j_models import GraphService


class KnowledgeGraphViewSet(viewsets.ViewSet):
    """
    知识图谱视图集
    """
    permission_classes = [permissions.IsAuthenticated]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.graph_service = GraphService()

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
                graph_data = self.graph_service.get_graph_for_user(user.id)
                return Response(graph_data)
            except Exception as e:
                # 如果Neo4j查询失败，回退到Django ORM
                pass

        # 使用Django ORM查询
        # 查询节点
        nodes_query = KnowledgeNode.objects.filter(user=user)
        if node_types:
            nodes_query = nodes_query.filter(type__in=node_types)

        # 查询边
        edges_query = KnowledgeEdge.objects.filter(user=user)
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
                analytics = self.graph_service.get_analytics(request.user.id)
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
            Q(user=request.user) &
            (Q(name__icontains=query) |
             Q(description__icontains=query) |
             Q(content__icontains=query))
        )

        serializer = KnowledgeNodeListSerializer(nodes, many=True)
        return Response(serializer.data)


class KnowledgeNodeViewSet(viewsets.ModelViewSet):
    """
    知识节点视图集
    """
    serializer_class = KnowledgeNodeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.graph_service = GraphService()

    def get_queryset(self):
        return KnowledgeNode.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        node = serializer.save(user=self.request.user)

        # 同步到Neo4j
        try:
            self.graph_service.create_node({
                'id': node.id,
                'title': node.title,
                'description': node.description,
                'type': node.type,
                'user_id': node.user.id,
                'note_id': node.note.id if node.note else None,
                'created_at': node.created_at,
                'updated_at': node.updated_at
            })
        except Exception as e:
            # 如果Neo4j操作失败，不影响数据库操作
            pass

        return node

    def perform_update(self, serializer):
        node = serializer.save()

        # 同步到Neo4j
        try:
            self.graph_service.update_node({
                'id': node.id,
                'title': node.title,
                'description': node.description,
                'type': node.type,
                'user_id': node.user.id,
                'note_id': node.note.id if node.note else None,
                'created_at': node.created_at,
                'updated_at': node.updated_at
            })
        except Exception as e:
            # 如果Neo4j操作失败，不影响数据库操作
            pass

        return node

    def perform_destroy(self, instance):
        node_id = instance.id

        # 先删除Django数据库中的节点
        instance.delete()

        # 同步到Neo4j
        try:
            self.graph_service.delete_node(node_id)
        except Exception as e:
            # 如果Neo4j操作失败，不影响数据库操作
            pass

    @action(detail=True, methods=['get'])
    def related(self, request, pk=None):
        """
        获取相关节点
        """
        node = self.get_object()

        # 获取与当前节点相关的所有边
        related_edges = KnowledgeEdge.objects.filter(
            Q(source=node) | Q(target=node),
            user=request.user
        )

        # 获取相关节点ID
        related_node_ids = set()
        for edge in related_edges:
            if edge.source.id == node.id:
                related_node_ids.add(edge.target.id)
            else:
                related_node_ids.add(edge.source.id)

        # 查询相关节点
        related_nodes = KnowledgeNode.objects.filter(id__in=related_node_ids)

        # 序列化数据
        nodes_data = KnowledgeNodeListSerializer(related_nodes, many=True).data
        edges_data = KnowledgeEdgeListSerializer(related_edges, many=True).data

        return Response({
            'nodes': nodes_data,
            'edges': edges_data
        })

    @action(detail=True, methods=['get'])
    def related_concepts(self, request, pk=None):
        """
        获取相关概念
        """
        node = self.get_object()
        max_depth = int(request.query_params.get('max_depth', 2))

        related = find_related_concepts(request.user, node.id, max_depth=max_depth)

        return Response(related)


class KnowledgeEdgeViewSet(viewsets.ModelViewSet):
    """
    知识连接视图集
    """
    serializer_class = KnowledgeEdgeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.graph_service = GraphService()

    def get_queryset(self):
        return KnowledgeEdge.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        edge = serializer.save(user=self.request.user)

        # 同步到Neo4j
        try:
            self.graph_service.create_relation({
                'source_id': edge.source.id,
                'target_id': edge.target.id,
                'type': edge.type,
                'weight': edge.weight,
                'user_id': edge.user.id
            })
        except Exception as e:
            # 如果Neo4j操作失败，不影响数据库操作
            pass

        return edge

    def perform_destroy(self, instance):
        relation_data = {
            'source_id': instance.source.id,
            'target_id': instance.target.id,
            'type': instance.type
        }

        # 先删除Django数据库中的边
        instance.delete()

        # 同步到Neo4j
        try:
            self.graph_service.delete_relation(relation_data)
        except Exception as e:
            # 如果Neo4j操作失败，不影响数据库操作
            pass