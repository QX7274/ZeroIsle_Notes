"""
图谱服务
"""

import logging
import networkx as nx
from django.db import transaction
from knowledge_graph.models import KnowledgeNode, KnowledgeEdge, KnowledgeGraph
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
        """
        创建知识节点
        
        Args:
            data: 节点数据
            user: 用户对象
            
        Returns:
            KnowledgeNode: 创建的节点
        """
        try:
            with transaction.atomic():
                # 创建节点
                node = KnowledgeNode.objects.create(
                    title=data['title'],
                    description=data.get('description', ''),
                    type=data.get('type', 'concept'),
                    user=user,
                    note_id=data.get('note_id'),
                    x=data.get('x', 0),
                    y=data.get('y', 0),
                    color=data.get('color'),
                    size=data.get('size', 20),
                    icon=data.get('icon'),
                    properties=data.get('properties', {}),
                    is_public=data.get('is_public', False)
                )
                
                # 同步到Neo4j
                try:
                    self.neo4j_service.create_node({
                        'id': node.id,
                        'title': node.title,
                        'description': node.description,
                        'type': node.type,
                        'user_id': node.user.id,
                        'note_id': node.note.id if node.note else None,
                        'properties': node.properties,
                        'created_at': node.created_at.isoformat(),
                        'updated_at': node.updated_at.isoformat()
                    })
                except Exception as e:
                    logger.error(f"同步节点到Neo4j失败: {e}")
                
                return node
        except Exception as e:
            logger.error(f"创建知识节点失败: {e}")
            raise
    
    def create_edge(self, data, user):
        """
        创建知识边
        
        Args:
            data: 边数据
            user: 用户对象
            
        Returns:
            KnowledgeEdge: 创建的边
        """
        try:
            with transaction.atomic():
                # 获取源节点和目标节点
                source_node = KnowledgeNode.objects.get(id=data['source_id'])
                target_node = KnowledgeNode.objects.get(id=data['target_id'])
                
                # 检查节点是否属于当前用户
                if source_node.user != user or target_node.user != user:
                    raise ValueError("无法连接其他用户的节点")
                
                # 创建边
                edge = KnowledgeEdge.objects.create(
                    source=source_node,
                    target=target_node,
                    type=data.get('type', 'related'),
                    label=data.get('label', ''),
                    description=data.get('description', ''),
                    weight=data.get('weight', 1.0),
                    color=data.get('color'),
                    properties=data.get('properties', {}),
                    user=user,
                    is_public=data.get('is_public', False)
                )
                
                # 同步到Neo4j
                try:
                    self.neo4j_service.create_relationship({
                        'id': edge.id,
                        'source_id': source_node.id,
                        'target_id': target_node.id,
                        'type': edge.type,
                        'label': edge.label,
                        'weight': edge.weight,
                        'properties': edge.properties,
                        'user_id': edge.user.id,
                        'created_at': edge.created_at.isoformat(),
                        'updated_at': edge.updated_at.isoformat()
                    })
                except Exception as e:
                    logger.error(f"同步边到Neo4j失败: {e}")
                
                return edge
        except KnowledgeNode.DoesNotExist:
            logger.error("创建知识边失败: 节点不存在")
            raise ValueError("节点不存在")
        except Exception as e:
            logger.error(f"创建知识边失败: {e}")
            raise
    
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
            with transaction.atomic():
                # 创建图谱
                graph = KnowledgeGraph.objects.create(
                    name=data['name'],
                    description=data.get('description', ''),
                    settings=data.get('settings', {}),
                    user=user,
                    is_public=data.get('is_public', False)
                )
                
                # 添加节点
                if 'node_ids' in data:
                    nodes = KnowledgeNode.objects.filter(
                        id__in=data['node_ids'],
                        user=user
                    )
                    graph.nodes.add(*nodes)
                
                # 添加边
                if 'edge_ids' in data:
                    edges = KnowledgeEdge.objects.filter(
                        id__in=data['edge_ids'],
                        user=user
                    )
                    graph.edges.add(*edges)
                
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
