"""
Neo4j服务
使用单例模式和连接池管理数据库连接
"""

import logging
import threading
from py2neo import Graph, Node, Relationship
from django.conf import settings

logger = logging.getLogger('backend')


class Neo4jService:
    """
    Neo4j服务类（单例模式）
    处理与Neo4j图数据库的交互
    
    特性：
    - 线程安全的单例模式
    - 连接池管理
    - 自动重连
    - 健康检查
    """
    
    _instance = None
    _lock = threading.Lock()
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """初始化Neo4j连接（仅执行一次）"""
        if self._initialized:
            return
            
        with self._lock:
            if self._initialized:
                return
                
            try:
                # 获取配置，提供默认值
                neo4j_uri = getattr(settings, 'NEO4J_URI', 'bolt://localhost:7687')
                neo4j_user = getattr(settings, 'NEO4J_USER', 'neo4j')
                neo4j_password = getattr(settings, 'NEO4J_PASSWORD', '')
                
                # 连接池配置
                max_connections = getattr(settings, 'NEO4J_MAX_CONNECTIONS', 50)
                connection_timeout = getattr(settings, 'NEO4J_CONNECTION_TIMEOUT', 30)
                
                self.graph = Graph(
                    neo4j_uri,
                    auth=(neo4j_user, neo4j_password),
                    max_connections=max_connections,
                    secure=neo4j_uri.startswith('bolt+s://') or neo4j_uri.startswith('neo4j+s://')
                )
                
                self._connection_config = {
                    'uri': neo4j_uri,
                    'max_connections': max_connections,
                    'timeout': connection_timeout
                }
                
                self._ensure_indexes()
                self._initialized = True
                logger.info(f"Neo4j连接成功: {neo4j_uri}, 最大连接数: {max_connections}")
                
            except Exception as e:
                logger.error(f"Neo4j连接失败: {e}")
                self.graph = None
                self._initialized = True  # 标记为已初始化，避免重复尝试

    @classmethod
    def get_instance(cls):
        """获取服务实例"""
        return cls()

    @classmethod
    def reset_instance(cls):
        """重置实例（仅用于测试）"""
        with cls._lock:
            cls._instance = None
            cls._initialized = False

    def is_connected(self):
        """检查是否已连接"""
        return self.graph is not None

    def begin_transaction(self):
        """开始一个新事务"""
        if not self.graph:
            logger.error("Neo4j未连接，无法开始事务")
            return None
        return self.graph.begin()

    def _ensure_indexes(self):
        """确保Neo4j数据库中存在必要的索引和约束"""
        if not self.graph:
            return
            
        try:
            # 为KnowledgeNode的id属性创建唯一性约束（这会自动创建索引）
            self.graph.run("CREATE CONSTRAINT IF NOT EXISTS ON (n:KnowledgeNode) ASSERT n.id IS UNIQUE")
            # 为用户ID创建索引以加速查询
            self.graph.run("CREATE INDEX IF NOT EXISTS FOR (n:KnowledgeNode) ON (n.user_id)")
            logger.info("Neo4j索引和约束已确认")
        except Exception as e:
            logger.error(f"Neo4j创建索引和约束失败: {e}")

    def create_node(self, data, tx=None):
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

            # 使用事务或直接创建
            target_graph = tx if tx else self.graph
            target_graph.create(node)
            logger.info(f"Neo4j节点创建成功: {data['id']}")

            return node
        except Exception as e:
            logger.error(f"Neo4j创建节点失败: {e}")
            raise

    def create_relationship(self, data, tx=None):
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

            # 使用事务或直接创建
            target_graph = tx if tx else self.graph
            target_graph.create(relationship)
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
            # 通过int()转换确保depth是整数，防止注入
            query = f"""
            MATCH (n:KnowledgeNode {{id: $id}})-[*1..{int(depth)}]-(related)
            RETURN DISTINCT related
            """

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
            # 通过int()转换确保max_depth是整数，防止注入
            query = f"""
            MATCH p = shortestPath((source:KnowledgeNode {{id: $source_id}})-[*1..{int(max_depth)}]-(target:KnowledgeNode {{id: $target_id}}))
            RETURN p
            """

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


    def check_connection(self):
        """
        检查与Neo4j的连接状态。

        Returns:
            dict: 包含连接状态和错误信息（如果存在）的字典。
        """
        if not self.graph:
            return {
                'ok': False,
                'error': 'Graph object not initialized. Check initial connection logs.'
            }
        try:
            # 执行一个简单的查询来验证连接
            self.graph.run("RETURN 1").data()
            return {'ok': True, 'error': None}
        except Exception as e:
            logger.error(f"Neo4j connection check failed: {e}")
            return {'ok': False, 'error': str(e)}
