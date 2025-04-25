"""
知识节点视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q

from knowledge_graph.models import KnowledgeNode, KnowledgeEdge
from knowledge_graph.serializers import (
    KnowledgeNodeSerializer,
    KnowledgeNodeListSerializer,
    KnowledgeEdgeListSerializer
)
from knowledge_graph.utils import find_related_concepts
from knowledge_graph.services import Neo4jService

class KnowledgeNodeViewSet(viewsets.ModelViewSet):
    """
    知识节点视图集
    """
    serializer_class = KnowledgeNodeSerializer
    permission_classes = [IsAuthenticated]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.neo4j_service = Neo4jService()

    def get_queryset(self):
        return KnowledgeNode.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        node = serializer.save(user=self.request.user)

        # 同步到Neo4j
        try:
            self.neo4j_service.create_node({
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
            self.neo4j_service.update_node({
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
            self.neo4j_service.delete_node(node_id)
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
