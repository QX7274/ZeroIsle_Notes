"""
知识连接视图
"""

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from knowledge_graph.models import KnowledgeEdge
from knowledge_graph.serializers import KnowledgeEdgeSerializer
from knowledge_graph.services import Neo4jService

class KnowledgeEdgeViewSet(viewsets.ModelViewSet):
    """
    知识连接视图集
    """
    serializer_class = KnowledgeEdgeSerializer
    permission_classes = [IsAuthenticated]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.neo4j_service = Neo4jService()

    def get_queryset(self):
        return KnowledgeEdge.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        edge = serializer.save(user=self.request.user)

        # 同步到Neo4j
        try:
            self.neo4j_service.create_relation({
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
            self.neo4j_service.delete_relation(relation_data)
        except Exception as e:
            # 如果Neo4j操作失败，不影响数据库操作
            pass
