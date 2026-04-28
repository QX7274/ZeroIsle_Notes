"""
知识图谱视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
import jieba
import jieba.analyse
import logging
import uuid
import time

from ..utils.response import KGResponse, PaginationHelper, ErrorCodes

from knowledge_graph.mongodb_models import KnowledgeNode, KnowledgeEdge
from knowledge_graph.serializers import (
    KnowledgeNodeListSerializer,
    KnowledgeEdgeListSerializer
)
from knowledge_graph.utils import find_shortest_path, find_related_concepts, analyze_knowledge_structure
from knowledge_graph.services import GraphService, Neo4jService

logger = logging.getLogger(__name__)

class KnowledgeGraphViewSet(viewsets.ViewSet):
    """
    知识图谱视图集
    """
    permission_classes = [IsAuthenticated]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.graph_service = GraphService()
        self.neo4j_service = Neo4jService()

    def _find_mongo_user(self, django_user):
        """
        查找对应的MongoDB用户
        """
        from users.mongodb_models import User as MongoUser
        import uuid

        # 尝试不同的方式查找用户
        mongo_user = None

        # 1. 如果Django用户有mongo_id字段，优先使用它
        if hasattr(django_user, 'mongo_id') and django_user.mongo_id:
            try:
                mongo_user = MongoUser.objects(id=django_user.mongo_id).first()
                if mongo_user:
                    logger.debug(f"通过mongo_id找到用户: {mongo_user.username}")
                    return mongo_user
            except Exception as e:
                logger.debug(f"通过mongo_id查找用户失败: {str(e)}")

        # 2. 尝试直接使用ID查找
        try:
            mongo_user = MongoUser.objects(id=django_user.id).first()
            if mongo_user:
                logger.debug(f"通过Django ID找到用户: {mongo_user.username}")
                # 如果找到用户，更新Django用户的mongo_id
                if hasattr(django_user, 'mongo_id') and not django_user.mongo_id:
                    django_user.mongo_id = mongo_user.id
                    django_user.save(update_fields=['mongo_id'])
                    logger.debug(f"更新Django用户的mongo_id: {django_user.username} -> {mongo_user.id}")
                return mongo_user
        except Exception as e:
            logger.debug(f"通过Django ID查找用户失败: {str(e)}")

        # 3. 如果通过ID没有找到用户，尝试通过用户名查找
        mongo_user = MongoUser.objects(username=django_user.username).first()
        if mongo_user:
            logger.debug(f"通过用户名找到用户: {mongo_user.username}")
            # 如果找到用户，更新Django用户的mongo_id
            if hasattr(django_user, 'mongo_id') and not django_user.mongo_id:
                django_user.mongo_id = mongo_user.id
                django_user.save(update_fields=['mongo_id'])
                logger.debug(f"更新Django用户的mongo_id: {django_user.username} -> {mongo_user.id}")
            return mongo_user

        logger.error(f"未找到对应的MongoDB用户: {django_user.username}")
        return None

    def list(self, request):
        """
        获取完整知识图谱（统一响应）
        """
        try:
            django_user = request.user
            logger.debug(f"Django用户ID: {django_user.id}, 类型: {type(django_user.id)}")

            mongo_user = self._find_mongo_user(django_user)
            if not mongo_user:
                return KGResponse.error(
                    ErrorCodes.NOT_FOUND,
                    '未找到用户数据',
                    status_code=status.HTTP_404_NOT_FOUND
                )

            logger.debug(f"找到MongoDB用户: {mongo_user.username}, ID: {mongo_user.id}, 类型: {type(mongo_user.id)}")

            # 获取过滤参数
            node_types = request.query_params.getlist('node_types', [])
            edge_types = request.query_params.getlist('edge_types', [])
            use_neo4j = request.query_params.get('use_neo4j', 'false').lower() == 'true'

            if use_neo4j:
                # 使用Neo4j获取图谱数据
                try:
                    # 确保用户ID是字符串格式
                    user_id_str = str(mongo_user.id)
                    logger.debug(f"使用Neo4j获取图谱数据, 用户ID: {user_id_str}")
                    graph_data = self.neo4j_service.get_graph_for_user(user_id_str)
                    return KGResponse.success(graph_data)
                except Exception as e:
                    # 如果Neo4j查询失败，回退到MongoDB查询
                    logger.error(f"Neo4j查询失败: {str(e)}", exc_info=True)
                    pass

            # 使用MongoDB查询
            # 查询节点
            logger.debug(f"使用MongoDB查询知识图谱, 用户: {mongo_user.username}, ID: {mongo_user.id}")
            nodes_query = KnowledgeNode.objects.filter(user=mongo_user, is_deleted=False)
            if node_types:
                nodes_query = nodes_query.filter(type__in=node_types)

            # 查询边
            edges_query = KnowledgeEdge.objects.filter(user=mongo_user, is_deleted=False)
            if edge_types:
                edges_query = edges_query.filter(type__in=edge_types)

            # 序列化数据
            nodes = KnowledgeNodeListSerializer(nodes_query, many=True).data
            edges = KnowledgeEdgeListSerializer(edges_query, many=True).data

            logger.debug(f"成功获取知识图谱, 节点数: {len(nodes)}, 边数: {len(edges)}")

            return KGResponse.success({
                'nodes': nodes,
                'edges': edges
            })
        except Exception as e:
            logger.error(f"获取知识图谱失败: {str(e)}", exc_info=True)
            return KGResponse.error(
                ErrorCodes.INTERNAL,
                '获取知识图谱失败',
                details={'message': str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def find_path(self, request):
        """
        查找两个知识点之间的路径
        """
        try:
            # 获取Django用户
            django_user = request.user
            logger.debug(f"Django用户ID: {django_user.id}, 类型: {type(django_user.id)}")

            # 查找对应的MongoDB用户
            mongo_user = self._find_mongo_user(django_user)
            if not mongo_user:
                return KGResponse.error(
                    ErrorCodes.NOT_FOUND,
                    '未找到用户数据',
                    status_code=status.HTTP_404_NOT_FOUND
                )

            source_id = request.data.get('source_id')
            target_id = request.data.get('target_id')

            if not source_id or not target_id:
                return KGResponse.error(
                    ErrorCodes.INVALID_PARAM,
                    '必须提供源节点和目标节点ID',
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            logger.debug(f"查找路径, 源节点: {source_id}, 目标节点: {target_id}, 用户: {mongo_user.username}")
            path = find_shortest_path(mongo_user, source_id, target_id)

            if path is None:
                return KGResponse.error(
                    ErrorCodes.NOT_FOUND,
                    '未找到连接路径',
                    status_code=status.HTTP_404_NOT_FOUND
                )

            return KGResponse.success({'path': path})
        except Exception as e:
            logger.error(f"查找路径失败: {str(e)}", exc_info=True)
            return KGResponse.error(
                ErrorCodes.INTERNAL,
                '查找路径失败',
                details={'message': str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def analyze(self, request):
        """
        分析知识结构（统一响应）
        """
        try:
            django_user = request.user
            logger.debug(f"Django用户ID: {django_user.id}, 类型: {type(django_user.id)}")

            mongo_user = self._find_mongo_user(django_user)
            if not mongo_user:
                return KGResponse.error(
                    ErrorCodes.NOT_FOUND,
                    '未找到用户数据',
                    status_code=status.HTTP_404_NOT_FOUND
                )

            use_neo4j = request.query_params.get('use_neo4j', 'false').lower() == 'true'
            logger.debug(f"分析知识结构, 用户: {mongo_user.username}, 使用Neo4j: {use_neo4j}")

            if use_neo4j:
                try:
                    user_id_str = str(mongo_user.id)
                    logger.debug(f"使用Neo4j分析知识结构, 用户ID: {user_id_str}")
                    analytics = self.neo4j_service.get_analytics(user_id_str)
                    return KGResponse.success(analytics)
                except Exception as e:
                    # 如果Neo4j查询失败，回退到MongoDB分析
                    logger.error(f"Neo4j分析失败: {str(e)}", exc_info=True)
                    pass

            # 使用MongoDB分析
            logger.debug(f"使用MongoDB分析知识结构, 用户: {mongo_user.username}")
            analysis = analyze_knowledge_structure(mongo_user)
            return KGResponse.success(analysis)
        except Exception as e:
            logger.error(f"分析知识结构失败: {str(e)}", exc_info=True)
            return KGResponse.error(
                ErrorCodes.INTERNAL,
                '分析知识结构失败',
                details={'message': str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


    @action(detail=False, methods=['get'])
    def nodes(self, request):
        """
        获取节点列表（统一响应 + 阈值聚合 + 孤点隐藏）
        Query params:
          - node_types: 多个?node_types=concept
          - aggregate: true|false （默认 false）
          - threshold: int （默认 1000）
          - hide_isolated: true|false （默认 false）
        """
        try:
            django_user = request.user
            mongo_user = self._find_mongo_user(django_user)
            if not mongo_user:
                return KGResponse.error(
                    ErrorCodes.NOT_FOUND,
                    '未找到用户数据',
                    status_code=status.HTTP_404_NOT_FOUND
                )

            node_types = request.query_params.getlist('node_types')
            aggregate = request.query_params.get('aggregate', 'false').lower() == 'true'
            threshold = int(request.query_params.get('threshold', '1000'))
            hide_isolated = request.query_params.get('hide_isolated', 'false').lower() == 'true'

            result = self.graph_service.get_nodes_with_aggregation(
                user=mongo_user,
                node_types=node_types if node_types else None,
                aggregate=aggregate,
                threshold=threshold,
                hide_isolated=hide_isolated
            )
            return KGResponse.success(result)
        except Exception as e:
            logger.error(f"获取节点列表失败: {str(e)}", exc_info=True)
            return KGResponse.error(
                ErrorCodes.INTERNAL,
                '获取节点列表失败',
                details={'message': str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def generate_tags(self, request):
        """
        生成标签
        """
        text = request.data.get('text', '')
        title = request.data.get('title', '')
        count = int(request.data.get('count', 5))

        if not text:
            return KGResponse.error(
                ErrorCodes.INVALID_PARAM,
                '必须提供文本内容',
                status_code=status.HTTP_400_BAD_REQUEST
            )

        # 使用jieba提取关键词
        if title:
            # 标题权重加倍
            text = title + " " + title + " " + text

        # 使用TF-IDF算法提取关键词
        tags = jieba.analyse.extract_tags(text, topK=count)

        return KGResponse.success({'tags': tags})

    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        搜索知识节点
        """
        try:
            # 获取Django用户
            django_user = request.user
            logger.debug(f"Django用户ID: {django_user.id}, 类型: {type(django_user.id)}")

            # 查找对应的MongoDB用户
            mongo_user = self._find_mongo_user(django_user)
            if not mongo_user:
                return KGResponse.error(
                    ErrorCodes.NOT_FOUND,
                    '未找到用户数据',
                    status_code=status.HTTP_404_NOT_FOUND

                )
            query = request.query_params.get('query', '')
            if not query:
                return KGResponse.error(
                    ErrorCodes.INVALID_PARAM,
                    '必须提供搜索关键词',
                    status_code=status.HTTP_400_BAD_REQUEST
                )

            logger.debug(f"搜索知识节点, 关键词: {query}, 用户: {mongo_user.username}")
            queryset = KnowledgeNode.objects.filter(
                user=mongo_user,
                is_deleted=False
            ).filter(title__icontains=query)

            # 分页参数校验
            params = PaginationHelper.validate_and_get_params(request)
            if not params:
                return KGResponse.error(
                    ErrorCodes.INVALID_PARAM,
                    '分页参数不合法',
                    status_code=status.HTTP_400_BAD_REQUEST
                )
            page = params['page']
            page_size = params['page_size']
            offset = (page - 1) * page_size
            items = queryset[offset:offset + page_size]

            serializer = KnowledgeNodeListSerializer(items, many=True)
            pagination_meta = PaginationHelper.get_pagination_meta(queryset, page, page_size)
            return KGResponse.success(serializer.data, pagination=pagination_meta)
        except Exception as e:
            logger.error(f"搜索知识节点失败: {str(e)}", exc_info=True)
            return KGResponse.error(
                ErrorCodes.INTERNAL,
                '搜索知识节点失败',
                details={'message': str(e)},
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
