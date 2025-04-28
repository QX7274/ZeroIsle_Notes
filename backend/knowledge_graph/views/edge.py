"""
知识连接视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
import uuid
from django.utils import timezone

from knowledge_graph.mongodb_models import KnowledgeEdge, KnowledgeNode
from knowledge_graph.serializers import KnowledgeEdgeSerializer
from knowledge_graph.services import Neo4jService

class KnowledgeEdgeViewSet(viewsets.ViewSet):
    """
    知识连接视图集
    """
    serializer_class = KnowledgeEdgeSerializer
    permission_classes = [IsAuthenticated]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.neo4j_service = Neo4jService()

    def list(self, request):
        """获取边列表"""
        edges = KnowledgeEdge.objects.filter(user=request.user, is_deleted=False)
        serializer = KnowledgeEdgeSerializer(edges, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个边详情"""
        try:
            edge = KnowledgeEdge.objects.get(id=pk, is_deleted=False)
            # 检查权限
            if edge.user != request.user and not edge.is_public:
                return Response(
                    {"detail": "您没有权限查看此连接"},
                    status=status.HTTP_403_FORBIDDEN
                )
            serializer = KnowledgeEdgeSerializer(edge)
            return Response(serializer.data)
        except KnowledgeEdge.DoesNotExist:
            return Response(
                {"detail": "连接不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建边"""
        serializer = KnowledgeEdgeSerializer(data=request.data)
        if serializer.is_valid():
            # 获取源节点和目标节点
            try:
                source_node = KnowledgeNode.objects.get(id=serializer.validated_data['source'], is_deleted=False)
                target_node = KnowledgeNode.objects.get(id=serializer.validated_data['target'], is_deleted=False)

                # 检查节点是否属于当前用户
                if source_node.user != request.user or target_node.user != request.user:
                    return Response(
                        {"detail": "无法连接其他用户的节点"},
                        status=status.HTTP_403_FORBIDDEN
                    )

                # 创建边
                edge = KnowledgeEdge(
                    id=uuid.uuid4(),
                    user=request.user,
                    source=source_node,
                    target=target_node,
                    type=serializer.validated_data.get('type', 'related'),
                    label=serializer.validated_data.get('label', ''),
                    description=serializer.validated_data.get('description', ''),
                    weight=serializer.validated_data.get('weight', 1.0),
                    color=serializer.validated_data.get('color'),
                    properties=serializer.validated_data.get('properties', {}),
                    is_public=serializer.validated_data.get('is_public', False),
                    created_at=timezone.now(),
                    updated_at=timezone.now()
                )
                edge.save()

                # 同步到Neo4j
                try:
                    self.neo4j_service.create_relation({
                        'id': edge.id,
                        'source_id': edge.source.id,
                        'target_id': edge.target.id,
                        'type': edge.type,
                        'weight': edge.weight,
                        'user_id': edge.user.id,
                        'created_at': edge.created_at.isoformat(),
                        'updated_at': edge.updated_at.isoformat()
                    })
                except Exception as e:
                    # 如果Neo4j操作失败，不影响数据库操作
                    pass

                serializer = KnowledgeEdgeSerializer(edge)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except KnowledgeNode.DoesNotExist:
                return Response(
                    {"detail": "源节点或目标节点不存在或已删除"},
                    status=status.HTTP_404_NOT_FOUND
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新边"""
        try:
            edge = KnowledgeEdge.objects.get(id=pk, user=request.user, is_deleted=False)
            serializer = KnowledgeEdgeSerializer(edge, data=request.data)
            if serializer.is_valid():
                # 更新边
                for field in ['type', 'label', 'description', 'weight', 'color', 'properties', 'is_public']:
                    if field in serializer.validated_data:
                        setattr(edge, field, serializer.validated_data[field])

                edge.updated_at = timezone.now()
                edge.save()

                # 同步到Neo4j
                try:
                    self.neo4j_service.update_relation({
                        'id': edge.id,
                        'source_id': edge.source.id,
                        'target_id': edge.target.id,
                        'type': edge.type,
                        'weight': edge.weight,
                        'user_id': edge.user.id,
                        'created_at': edge.created_at.isoformat(),
                        'updated_at': edge.updated_at.isoformat()
                    })
                except Exception as e:
                    # 如果Neo4j操作失败，不影响数据库操作
                    pass

                serializer = KnowledgeEdgeSerializer(edge)
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except KnowledgeEdge.DoesNotExist:
            return Response(
                {"detail": "连接不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除边"""
        try:
            edge = KnowledgeEdge.objects.get(id=pk, user=request.user, is_deleted=False)

            relation_data = {
                'id': edge.id,
                'source_id': edge.source.id,
                'target_id': edge.target.id,
                'type': edge.type
            }

            # 软删除边
            edge.delete()

            # 同步到Neo4j
            try:
                self.neo4j_service.delete_relation(relation_data)
            except Exception as e:
                # 如果Neo4j操作失败，不影响数据库操作
                pass

            return Response(status=status.HTTP_204_NO_CONTENT)
        except KnowledgeEdge.DoesNotExist:
            return Response(
                {"detail": "连接不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
