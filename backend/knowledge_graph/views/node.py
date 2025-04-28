"""
知识节点视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
import uuid
from django.utils import timezone
from mongoengine.queryset.visitor import Q

from knowledge_graph.mongodb_models import KnowledgeNode, KnowledgeEdge
from knowledge_graph.serializers import (
    KnowledgeNodeSerializer,
    KnowledgeNodeListSerializer,
    KnowledgeEdgeListSerializer
)
from knowledge_graph.utils import find_related_concepts
from knowledge_graph.services import Neo4jService

class KnowledgeNodeViewSet(viewsets.ViewSet):
    """
    知识节点视图集
    """
    serializer_class = KnowledgeNodeSerializer
    permission_classes = [IsAuthenticated]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.neo4j_service = Neo4jService()

    def list(self, request):
        """获取节点列表"""
        nodes = KnowledgeNode.objects.filter(user=request.user, is_deleted=False)
        serializer = KnowledgeNodeListSerializer(nodes, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个节点详情"""
        try:
            node = KnowledgeNode.objects.get(id=pk, is_deleted=False)
            # 检查权限
            if node.user != request.user and not node.is_public:
                return Response(
                    {"detail": "您没有权限查看此节点"},
                    status=status.HTTP_403_FORBIDDEN
                )
            serializer = KnowledgeNodeSerializer(node)
            return Response(serializer.data)
        except KnowledgeNode.DoesNotExist:
            return Response(
                {"detail": "节点不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建节点"""
        serializer = KnowledgeNodeSerializer(data=request.data)
        if serializer.is_valid():
            # 创建节点
            node = KnowledgeNode(
                id=uuid.uuid4(),
                user=request.user,
                title=serializer.validated_data['title'],
                description=serializer.validated_data.get('description', ''),
                type=serializer.validated_data.get('type', 'concept'),
                note=serializer.validated_data.get('note'),
                x=serializer.validated_data.get('x', 0),
                y=serializer.validated_data.get('y', 0),
                color=serializer.validated_data.get('color'),
                size=serializer.validated_data.get('size', 20),
                icon=serializer.validated_data.get('icon'),
                properties=serializer.validated_data.get('properties', {}),
                is_public=serializer.validated_data.get('is_public', False),
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            node.save()

            # 同步到Neo4j
            try:
                self.neo4j_service.create_node({
                    'id': node.id,
                    'title': node.title,
                    'description': node.description,
                    'type': node.type,
                    'user_id': node.user.id,
                    'note_id': node.note.id if node.note else None,
                    'created_at': node.created_at.isoformat(),
                    'updated_at': node.updated_at.isoformat()
                })
            except Exception as e:
                # 如果Neo4j操作失败，不影响数据库操作
                pass

            serializer = KnowledgeNodeSerializer(node)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新节点"""
        try:
            node = KnowledgeNode.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = KnowledgeNodeSerializer(node, data=request.data)
            if serializer.is_valid():
                # 更新节点
                for field in ['title', 'description', 'type', 'note', 'x', 'y', 'color', 'size', 'icon', 'properties', 'is_public']:
                    if field in serializer.validated_data:
                        setattr(node, field, serializer.validated_data[field])

                node.updated_at = timezone.now()
                node.save()

                # 同步到Neo4j
                try:
                    self.neo4j_service.update_node({
                        'id': node.id,
                        'title': node.title,
                        'description': node.description,
                        'type': node.type,
                        'user_id': node.user.id,
                        'note_id': node.note.id if node.note else None,
                        'created_at': node.created_at.isoformat(),
                        'updated_at': node.updated_at.isoformat()
                    })
                except Exception as e:
                    # 如果Neo4j操作失败，不影响数据库操作
                    pass

                serializer = KnowledgeNodeSerializer(node)
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except KnowledgeNode.DoesNotExist:
            return Response(
                {"detail": "节点不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除节点"""
        try:
            node = KnowledgeNode.objects.get(id=pk, user=request.user, is_deleted=False)
            node_id = node.id

            # 软删除节点
            node.delete()

            # 同步到Neo4j
            try:
                self.neo4j_service.delete_node(node_id)
            except Exception as e:
                # 如果Neo4j操作失败，不影响数据库操作
                pass

            return Response(status=status.HTTP_204_NO_CONTENT)
        except KnowledgeNode.DoesNotExist:
            return Response(
                {"detail": "节点不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['get'])
    def related(self, request, pk=None):
        """
        获取相关节点
        """
        try:
            node = KnowledgeNode.objects.get(id=pk, is_deleted=False)
            # 检查权限
            if node.user != request.user and not node.is_public:
                return Response(
                    {"detail": "您没有权限查看此节点"},
                    status=status.HTTP_403_FORBIDDEN
                )

            # 获取与当前节点相关的所有边
            related_edges = KnowledgeEdge.objects.filter(
                Q(source=node) | Q(target=node),
                user=request.user,
                is_deleted=False
            )

            # 获取相关节点ID
            related_node_ids = set()
            for edge in related_edges:
                if edge.source.id == node.id:
                    related_node_ids.add(edge.target.id)
                else:
                    related_node_ids.add(edge.source.id)

            # 查询相关节点
            related_nodes = KnowledgeNode.objects.filter(id__in=related_node_ids, is_deleted=False)

            # 序列化数据
            nodes_data = KnowledgeNodeListSerializer(related_nodes, many=True).data
            edges_data = KnowledgeEdgeListSerializer(related_edges, many=True).data

            return Response({
                'nodes': nodes_data,
                'edges': edges_data
            })
        except KnowledgeNode.DoesNotExist:
            return Response(
                {"detail": "节点不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['get'])
    def related_concepts(self, request, pk=None):
        """
        获取相关概念
        """
        try:
            node = KnowledgeNode.objects.get(id=pk, is_deleted=False)
            # 检查权限
            if node.user != request.user and not node.is_public:
                return Response(
                    {"detail": "您没有权限查看此节点"},
                    status=status.HTTP_403_FORBIDDEN
                )

            max_depth = int(request.query_params.get('max_depth', 2))

            related = find_related_concepts(request.user, node.id, max_depth=max_depth)

            return Response(related)
        except KnowledgeNode.DoesNotExist:
            return Response(
                {"detail": "节点不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
