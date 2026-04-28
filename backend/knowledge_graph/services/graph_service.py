"""
图谱服务
"""

import logging
import networkx as nx
import uuid
from django.utils import timezone
from knowledge_graph.mongodb_models import KnowledgeNode, KnowledgeEdge, KnowledgeGraph
from .neo4j_service import Neo4jService

logger = logging.getLogger('backend')

class GraphService:
    """
    图谱服务类
    处理知识图谱的业务逻辑
    """

    def __init__(self):
        """初始化"""
        self.neo4j_service = Neo4jService()

    def create_node(self, data, user):
        """创建知识节点 (Neo4j 降级安全)"""
        # 1. 在MongoDB中创建节点
        try:
            node = KnowledgeNode(
                id=uuid.uuid4(),
                title=data['title'],
                description=data.get('description', ''),
                type=data.get('type', 'concept'),
                user=user,
                note=data.get('note'),
                properties=data.get('properties', {}),
            )
            node.save()
            logger.info(f"节点已在 MongoDB 中创建: {node.id}")
        except Exception as e:
            logger.error(f"在 MongoDB 中创建节点失败: {e}")
            raise  # MongoDB ailed, abort

        # 2. 尝试在Neo4j中创建节点
        try:
            node_payload = {
                'id': str(node.id),
                'title': node.title,
                'description': node.description,
                'type': node.type,
                'user_id': str(node.user.id),
                'note_id': str(node.note.id) if node.note else None,
                'properties': node.properties,
                'created_at': node.created_at.isoformat(),
                'updated_at': node.updated_at.isoformat()
            }
            self.neo4j_service.create_node(node_payload)
            logger.info(f"节点已同步到 Neo4j: {node.id}")
        except Exception as e:
            logger.error(f"同步节点到 Neo4j 失败: {e}。将任务添加到补偿队列。")
            # 降级：将操作记录到同步队列
            from .mongodb_models import GraphSyncQueue
            GraphSyncQueue.objects.create(
                operation='create_node',
                payload=node_payload,
                last_error=str(e)
            )

        return node

    def create_edge(self, data, user):
        """创建知识边 (Neo4j 降级安全)"""
        # 1. 在MongoDB中创建边
        try:
            source_node = KnowledgeNode.objects.get(id=data['source_id'], user=user)
            target_node = KnowledgeNode.objects.get(id=data['target_id'], user=user)

            edge = KnowledgeEdge(
                id=uuid.uuid4(),
                source=source_node,
                target=target_node,
                type=data.get('type', 'related'),
                label=data.get('label', ''),
                weight=data.get('weight', 1.0),
                properties=data.get('properties', {}),
                user=user
            )
            edge.save()
            logger.info(f"边已在 MongoDB 中创建: {edge.id}")
        except KnowledgeNode.DoesNotExist:
            logger.error(f"创建知识边失败: 节点不存在 (source: {data.get('source_id')}, target: {data.get('target_id')})")
            raise ValueError("节点不存在")
        except Exception as e:
            logger.error(f"在 MongoDB 中创建边失败: {e}")
            raise # MongoDB failed, abort

        # 2. 尝试在Neo4j中创建关系
        try:
            edge_payload = {
                'id': str(edge.id),
                'source_id': str(source_node.id),
                'target_id': str(target_node.id),
                'type': edge.type,
                'label': edge.label,
                'weight': edge.weight,
                'properties': edge.properties,
                'user_id': str(edge.user.id),
                'created_at': edge.created_at.isoformat(),
                'updated_at': edge.updated_at.isoformat()
            }
            self.neo4j_service.create_relationship(edge_payload)
            logger.info(f"边已同步到 Neo4j: {edge.id}")
        except Exception as e:
            logger.error(f"同步边到 Neo4j 失败: {e}。将任务添加到补偿队列。")
            # 降级：将操作记录到同步队列
            from .mongodb_models import GraphSyncQueue
            GraphSyncQueue.objects.create(
                operation='create_edge',
                payload=edge_payload,
                last_error=str(e)
            )

        return edge

    def create_graph(self, data, user):
        """
        创建知识图谱

        Args:
            data: 图谱数据
            user: 用户对象

        Returns:
            KnowledgeGraph: 创建的图谱
        """
        try:
            # 创建图谱
            graph = KnowledgeGraph(
                id=uuid.uuid4(),
                name=data['name'],
                description=data.get('description', ''),
                settings=data.get('settings', {}),
                user=user,
                is_public=data.get('is_public', False),
                created_at=timezone.now(),
                updated_at=timezone.now()
            )

            # 添加节点
            nodes = []
            if 'node_ids' in data:
                nodes = list(KnowledgeNode.objects.filter(
                    id__in=data['node_ids'],
                    user=user,
                    is_deleted=False
                ))
                graph.nodes = nodes

            # 添加边
            edges = []
            if 'edge_ids' in data:
                edges = list(KnowledgeEdge.objects.filter(
                    id__in=data['edge_ids'],
                    user=user,
                    is_deleted=False
                ))
                graph.edges = edges

            graph.save()

            return graph
        except Exception as e:
            logger.error(f"创建知识图谱失败: {e}")
            raise

    def get_graph_data(self, graph_id, user):
        """
        获取图谱数据

        Args:
            graph_id: 图谱ID
            user: 用户对象

        Returns:
            dict: 图谱数据
        """
        try:
            # 获取图谱
            graph = KnowledgeGraph.objects.get(id=graph_id)

            # 检查权限
            if graph.user != user and not graph.is_public:
                raise ValueError("无权访问此图谱")

            # 获取节点和边
            nodes = graph.nodes.all()
            edges = graph.edges.all()

            # 构建图谱数据
            graph_data = {
                'id': graph.id,
                'name': graph.name,
                'description': graph.description,
                'settings': graph.settings,
                'created_at': graph.created_at,
                'updated_at': graph.updated_at,
                'is_public': graph.is_public,
                'nodes': [],
                'edges': []
            }

            # 添加节点数据
            for node in nodes:
                graph_data['nodes'].append({
                    'id': node.id,
                    'title': node.title,
                    'description': node.description,
                    'type': node.type,
                    'x': node.x,
                    'y': node.y,
                    'color': node.color,
                    'size': node.size,
                    'icon': node.icon,
                    'properties': node.properties
                })

            # 添加边数据
            for edge in edges:
                graph_data['edges'].append({
                    'id': edge.id,
                    'source': edge.source_id,
                    'target': edge.target_id,
                    'type': edge.type,
                    'label': edge.label,
                    'description': edge.description,
                    'weight': edge.weight,
                    'color': edge.color,
                    'properties': edge.properties
                })

            return graph_data
        except KnowledgeGraph.DoesNotExist:
            logger.error(f"获取图谱数据失败: 图谱不存在 (ID: {graph_id})")
            raise ValueError("图谱不存在")
        except Exception as e:
            logger.error(f"获取图谱数据失败: {e}")
            raise

    def analyze_graph(self, graph_id, user):
        """
        分析图谱

        Args:
            graph_id: 图谱ID
            user: 用户对象

        Returns:
            dict: 分析结果
        """
        try:
            # 获取图谱数据
            graph_data = self.get_graph_data(graph_id, user)

            # 创建NetworkX图
            G = nx.DiGraph()

            # 添加节点
            for node in graph_data['nodes']:
                G.add_node(node['id'], **node)

            # 添加边
            for edge in graph_data['edges']:
                G.add_edge(edge['source'], edge['target'], **edge)

            # 计算中心性指标
            degree_centrality = nx.degree_centrality(G)
            betweenness_centrality = nx.betweenness_centrality(G)
            closeness_centrality = nx.closeness_centrality(G)

            # 计算社区
            communities = list(nx.algorithms.community.greedy_modularity_communities(G.to_undirected()))
            community_map = {}
            for i, community in enumerate(communities):
                for node in community:
                    community_map[node] = i

            # 构建分析结果
            analysis_result = {
                'graph_id': graph_id,
                'node_count': len(graph_data['nodes']),
                'edge_count': len(graph_data['edges']),
                'density': nx.density(G),
                'is_connected': nx.is_weakly_connected(G),
                'average_clustering': nx.average_clustering(G.to_undirected()),
                'communities': len(communities),
                'nodes': []
            }

            # 添加节点分析数据
            for node in graph_data['nodes']:
                node_id = node['id']
                analysis_result['nodes'].append({
                    'id': node_id,
                    'title': node['title'],
                    'degree_centrality': degree_centrality.get(node_id, 0),
                    'betweenness_centrality': betweenness_centrality.get(node_id, 0),
                    'closeness_centrality': closeness_centrality.get(node_id, 0),
                    'community': community_map.get(node_id, -1)
                })

            return analysis_result
        except Exception as e:
            logger.error(f"分析图谱失败: {e}")
            raise


    def get_nodes_with_aggregation(self, user, node_types=None, aggregate=False, threshold=1000, hide_isolated=False):
        """
        获取节点列表，支持聚合和孤点隐藏

        Args:
            user: Mongo用户对象
            node_types: 可选，节点类型过滤列表
            aggregate: 是否启用聚合
            threshold: 触发聚合的阈值
            hide_isolated: 是否隐藏孤立节点（度为0）

        Returns:
            dict: {
                'nodes': [...],
                'aggregation_info': {
                    'original_count': int,
                    'aggregated_count': int,
                    'strategy': str
                }
            }
        """
        # 查询节点和边
        nodes_qs = KnowledgeNode.objects.filter(user=user, is_deleted=False)
        if node_types:
            nodes_qs = nodes_qs.filter(type__in=node_types)
        edges_qs = KnowledgeEdge.objects.filter(user=user, is_deleted=False)

        original_count = nodes_qs.count()

        # 计算度数
        degree_map = {}
        for e in edges_qs:
            degree_map[str(e.source.id)] = degree_map.get(str(e.source.id), 0) + 1
            degree_map[str(e.target.id)] = degree_map.get(str(e.target.id), 0) + 1

        # 过滤孤点
        if hide_isolated:
            nodes_qs = [n for n in nodes_qs if degree_map.get(str(n.id), 0) > 0]
        else:
            nodes_qs = list(nodes_qs)

        # 是否需要聚合
        if aggregate and len(nodes_qs) > int(threshold):
            # 按类型聚合
            groups = {}
            for n in nodes_qs:
                key = n.type
                if key not in groups:
                    groups[key] = []
                groups[key].append(n)

            aggregated_nodes = []
            for key, items in groups.items():
                aggregated_nodes.append({
                    'id': f'agg_{key}',
                    'label': f'{key} ({len(items)})',
                    'type': key,
                    'is_aggregated': True,
                    'child_nodes': [str(nn.id) for nn in items],
                    'child_count': len(items)
                })

            return {
                'nodes': aggregated_nodes,
                'aggregation_info': {
                    'original_count': original_count,
                    'aggregated_count': len(aggregated_nodes),
                    'strategy': 'by_type'
                }
            }

        # 不聚合，直接返回节点列表
        nodes_data = [{
            'id': str(n.id),
            'label': n.title,
            'type': n.type,
            'properties': n.properties or {},
        } for n in nodes_qs]

        return {
            'nodes': nodes_data,
            'aggregation_info': {
                'original_count': original_count,
                'aggregated_count': len(nodes_data),
                'strategy': 'none'
            }
        }
