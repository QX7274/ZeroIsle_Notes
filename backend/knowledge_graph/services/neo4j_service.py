"""
Neo4j服务
"""

import logging
from py2neo import Graph, Node, Relationship
from django.conf import settings

logger = logging.getLogger('backend')

class Neo4jService:
    """
    Neo4j服务类
    处理与Neo4j图数据库的交互
    """
    
    def __init__(self):
        """初始化Neo4j连接"""
        try:
            self.graph = Graph(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
            )
            logger.info("Neo4j连接成功")
        except Exception as e:
            logger.error(f"Neo4j连接失败: {e}")
            self.graph = None
    
    def create_node(self, data):
        """
        创建节点
        
        Args:
            data: 节点数据
            
        Returns:
            Node: 创建的Neo4j节点
        """
        if not self.graph:
            logger.error("Neo4j未连接")
            return None
        
        try:
            # 创建节点
            node = Node(
                "KnowledgeNode",
                id=str(data['id']),
                title=data['title'],
                description=data.get('description', ''),
                type=data.get('type', 'concept'),
                user_id=str(data['user_id']),
                note_id=str(data['note_id']) if data.get('note_id') else None,
                created_at=data.get('created_at'),
                updated_at=data.get('updated_at')
            )
            
            # 添加属性
            if 'properties' in data and isinstance(data['properties'], dict):
                for key, value in data['properties'].items():
                    node[key] = value
            
            # 保存节点
            self.graph.create(node)
            logger.info(f"Neo4j节点创建成功: {data['id']}")
            
            return node
        except Exception as e:
            logger.error(f"Neo4j创建节点失败: {e}")
            raise
    
    def create_relationship(self, data):
        """
        创建关系
        
        Args:
            data: 关系数据
            
        Returns:
            Relationship: 创建的Neo4j关系
        """
        if not self.graph:
            logger.error("Neo4j未连接")
            return None
        
        try:
            # 查询源节点和目标节点
            source_node = self.graph.nodes.match(
                "KnowledgeNode", 
                id=str(data['source_id'])
            ).first()
            
            target_node = self.graph.nodes.match(
                "KnowledgeNode", 
                id=str(data['target_id'])
            ).first()
            
            if not source_node or not target_node:
                logger.error(f"Neo4j节点不存在: source={data['source_id']}, target={data['target_id']}")
                return None
            
            # 创建关系
            relationship = Relationship(
                source_node, 
                data['type'].upper(), 
                target_node,
                id=str(data['id']),
                label=data.get('label', ''),
                weight=data.get('weight', 1.0),
                user_id=str(data['user_id']),
                created_at=data.get('created_at'),
                updated_at=data.get('updated_at')
            )
            
            # 添加属性
            if 'properties' in data and isinstance(data['properties'], dict):
                for key, value in data['properties'].items():
                    relationship[key] = value
            
            # 保存关系
            self.graph.create(relationship)
            logger.info(f"Neo4j关系创建成功: {data['id']}")
            
            return relationship
        except Exception as e:
            logger.error(f"Neo4j创建关系失败: {e}")
            raise
    
    def get_node(self, node_id):
        """
        获取节点
        
        Args:
            node_id: 节点ID
            
        Returns:
            Node: Neo4j节点
        """
        if not self.graph:
            logger.error("Neo4j未连接")
            return None
        
        try:
            node = self.graph.nodes.match(
                "KnowledgeNode", 
                id=str(node_id)
            ).first()
            
            return node
        except Exception as e:
            logger.error(f"Neo4j获取节点失败: {e}")
            return None
    
    def get_relationship(self, relationship_id):
        """
        获取关系
        
        Args:
            relationship_id: 关系ID
            
        Returns:
            Relationship: Neo4j关系
        """
        if not self.graph:
            logger.error("Neo4j未连接")
            return None
        
        try:
            # 使用Cypher查询
            query = """
            MATCH ()-[r]-() 
            WHERE r.id = $id 
            RETURN r
            """
            
            result = self.graph.run(query, id=str(relationship_id)).data()
            
            if result:
                return result[0]['r']
            return None
        except Exception as e:
            logger.error(f"Neo4j获取关系失败: {e}")
            return None
    
    def get_related_nodes(self, node_id, depth=1):
        """
        获取相关节点
        
        Args:
            node_id: 节点ID
            depth: 深度
            
        Returns:
            list: 相关节点列表
        """
        if not self.graph:
            logger.error("Neo4j未连接")
            return []
        
        try:
            # 使用Cypher查询
            query = """
            MATCH (n:KnowledgeNode {id: $id})-[r*1..%d]-(related)
            RETURN DISTINCT related
            """ % depth
            
            result = self.graph.run(query, id=str(node_id)).data()
            
            return [record['related'] for record in result]
        except Exception as e:
            logger.error(f"Neo4j获取相关节点失败: {e}")
            return []
    
    def find_path(self, source_id, target_id, max_depth=3):
        """
        查找路径
        
        Args:
            source_id: 源节点ID
            target_id: 目标节点ID
            max_depth: 最大深度
            
        Returns:
            list: 路径列表
        """
        if not self.graph:
            logger.error("Neo4j未连接")
            return []
        
        try:
            # 使用Cypher查询
            query = """
            MATCH p = shortestPath((source:KnowledgeNode {id: $source_id})-[*1..%d]-(target:KnowledgeNode {id: $target_id}))
            RETURN p
            """ % max_depth
            
            result = self.graph.run(
                query, 
                source_id=str(source_id),
                target_id=str(target_id)
            ).data()
            
            return [record['p'] for record in result]
        except Exception as e:
            logger.error(f"Neo4j查找路径失败: {e}")
            return []
    
    def run_cypher(self, query, params=None):
        """
        执行Cypher查询
        
        Args:
            query: Cypher查询语句
            params: 查询参数
            
        Returns:
            list: 查询结果
        """
        if not self.graph:
            logger.error("Neo4j未连接")
            return []
        
        try:
            result = self.graph.run(query, parameters=params or {}).data()
            return result
        except Exception as e:
            logger.error(f"Neo4j执行Cypher查询失败: {e}")
            return []
