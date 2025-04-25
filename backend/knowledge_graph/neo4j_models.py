"""Neo4j图数据库模型"""

from py2neo import Graph, Node, Relationship
from py2neo.ogm import GraphObject, Property, RelatedTo, RelatedFrom
from django.conf import settings
import os


# 获取Neo4j连接配置
NEO4J_URI = os.getenv('NEO4J_URI', 'bolt://localhost:7687')
NEO4J_USER = os.getenv('NEO4J_USER', 'zeroislenotes')
NEO4J_PASSWORD = os.getenv('NEO4J_PASSWORD', '123456')

# 创建图数据库连接
graph = Graph(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


class KnowledgeNode(GraphObject):
    """
    Neo4j知识节点模型
    """
    __primarylabel__ = "KnowledgeNode"
    __primarykey__ = "node_id"
    
    node_id = Property()
    title = Property()
    description = Property()
    node_type = Property()
    user_id = Property()
    note_id = Property()
    created_at = Property()
    updated_at = Property()
    
    # 关系定义
    related_to = RelatedTo("KnowledgeNode", "RELATED_TO")
    contains = RelatedTo("KnowledgeNode", "CONTAINS")
    prerequisite_of = RelatedTo("KnowledgeNode", "PREREQUISITE_OF")
    
    # 反向关系
    related_from = RelatedFrom("KnowledgeNode", "RELATED_TO")
    contained_by = RelatedFrom("KnowledgeNode", "CONTAINS")
    has_prerequisite = RelatedFrom("KnowledgeNode", "PREREQUISITE_OF")


class GraphService:
    """
    图数据库服务类
    """
    def __init__(self):
        self.graph = graph
    
    def create_node(self, node_data):
        """创建知识节点"""
        neo4j_node = KnowledgeNode()
        neo4j_node.node_id = node_data['id']
        neo4j_node.title = node_data['title']
        neo4j_node.description = node_data.get('description', '')
        neo4j_node.node_type = node_data['type']
        neo4j_node.user_id = node_data['user_id']
        neo4j_node.note_id = node_data.get('note_id')
        neo4j_node.created_at = node_data['created_at'].isoformat()
        neo4j_node.updated_at = node_data['updated_at'].isoformat()
        
        self.graph.push(neo4j_node)
        return neo4j_node
    
    def update_node(self, node_data):
        """更新知识节点"""
        neo4j_node = self.get_node_by_id(node_data['id'])
        if not neo4j_node:
            return self.create_node(node_data)
        
        neo4j_node.title = node_data['title']
        neo4j_node.description = node_data.get('description', '')
        neo4j_node.updated_at = node_data['updated_at'].isoformat()
        
        self.graph.push(neo4j_node)
        return neo4j_node
    
    def delete_node(self, node_id):
        """删除知识节点"""
        query = """
        MATCH (n:KnowledgeNode {node_id: $node_id})
        DETACH DELETE n
        """
        self.graph.run(query, node_id=node_id)
    
    def create_relation(self, relation_data):
        """创建知识关系"""
        source_node = self.get_node_by_id(relation_data['source_id'])
        target_node = self.get_node_by_id(relation_data['target_id'])
        
        if not source_node or not target_node:
            return None
        
        relation_type = relation_data['type'].upper()
        
        if relation_type == 'RELATED_TO':
            source_node.related_to.add(target_node, 
                                      {'weight': relation_data['weight']})
        elif relation_type == 'CONTAINS':
            source_node.contains.add(target_node, 
                                    {'weight': relation_data['weight']})
        elif relation_type == 'PREREQUISITE_OF':
            source_node.prerequisite_of.add(target_node, 
                                           {'weight': relation_data['weight']})
        
        self.graph.push(source_node)
        return True
    
    def delete_relation(self, relation_data):
        """删除知识关系"""
        query = """
        MATCH (source:KnowledgeNode {node_id: $source_id})-[r]->(target:KnowledgeNode {node_id: $target_id})
        WHERE type(r) = $relation_type
        DELETE r
        """
        self.graph.run(
            query, 
            source_id=relation_data['source_id'],
            target_id=relation_data['target_id'],
            relation_type=relation_data['type'].upper()
        )
    
    def get_node_by_id(self, node_id):
        """根据ID获取节点"""
        return self.graph.nodes.match("KnowledgeNode", node_id=node_id).first()
    
    def get_graph_for_node(self, node_id, depth=2):
        """获取节点的图谱数据（用于可视化）"""
        query = f"""
        MATCH path = (n:KnowledgeNode {{node_id: $node_id}})-[*1..{depth}]-(related)
        RETURN path
        """
        result = self.graph.run(query, node_id=node_id)
        return result.data()
    
    def get_graph_for_user(self, user_id, limit=100):
        """获取用户的完整知识图谱"""
        query = """
        MATCH (n:KnowledgeNode {user_id: $user_id})
        MATCH path = (n)-[r]-(related:KnowledgeNode {user_id: $user_id})
        RETURN path
        LIMIT $limit
        """
        result = self.graph.run(query, user_id=user_id, limit=limit)
        return result.data()
    
    def search_nodes(self, user_id, query_text, limit=20):
        """搜索知识节点"""
        cypher_query = """
        MATCH (n:KnowledgeNode {user_id: $user_id})
        WHERE n.title CONTAINS $query OR n.description CONTAINS $query
        RETURN n
        LIMIT $limit
        """
        result = self.graph.run(cypher_query, user_id=user_id, query=query_text, limit=limit)
        return [dict(record["n"]) for record in result]
    
    def get_related_nodes(self, node_id, user_id, limit=20):
        """获取相关节点"""
        query = """
        MATCH (n:KnowledgeNode {node_id: $node_id})-[r]-(related:KnowledgeNode {user_id: $user_id})
        RETURN related, type(r) as relation_type
        LIMIT $limit
        """
        result = self.graph.run(query, node_id=node_id, user_id=user_id, limit=limit)
        return [(dict(record["related"]), record["relation_type"]) for record in result]
    
    def get_analytics(self, user_id):
        """获取图谱分析数据"""
        # 节点类型分布
        node_type_query = """
        MATCH (n:KnowledgeNode {user_id: $user_id})
        RETURN n.node_type as type, count(n) as count
        """
        node_type_result = self.graph.run(node_type_query, user_id=user_id)
        node_type_distribution = {record["type"]: record["count"] for record in node_type_result}
        
        # 关系类型分布
        relation_type_query = """
        MATCH (n:KnowledgeNode {user_id: $user_id})-[r]->(m:KnowledgeNode {user_id: $user_id})
        RETURN type(r) as type, count(r) as count
        """
        relation_type_result = self.graph.run(relation_type_query, user_id=user_id)
        relation_type_distribution = {record["type"]: record["count"] for record in relation_type_result}
        
        # 中心节点
        central_nodes_query = """
        MATCH (n:KnowledgeNode {user_id: $user_id})
        WITH n, size((n)--()) as degree
        ORDER BY degree DESC
        LIMIT 5
        RETURN n, degree
        """
        central_nodes_result = self.graph.run(central_nodes_query, user_id=user_id)
        central_nodes = [{"node": dict(record["n"]), "connections": record["degree"]} for record in central_nodes_result]
        
        # 孤立节点
        isolated_nodes_query = """
        MATCH (n:KnowledgeNode {user_id: $user_id})
        WHERE NOT (n)--()
        RETURN n
        LIMIT 10
        """
        isolated_nodes_result = self.graph.run(isolated_nodes_query, user_id=user_id)
        isolated_nodes = [dict(record["n"]) for record in isolated_nodes_result]
        
        # 总节点数和关系数
        counts_query = """
        MATCH (n:KnowledgeNode {user_id: $user_id})
        OPTIONAL MATCH (n)-[r]->(m:KnowledgeNode {user_id: $user_id})
        RETURN count(DISTINCT n) as nodes, count(r) as relations
        """
        counts_result = self.graph.run(counts_query, user_id=user_id).data()[0]
        
        # 平均连接数
        avg_connections = 0
        if counts_result["nodes"] > 0:
            avg_connections = counts_result["relations"] / counts_result["nodes"]
        
        return {
            "overview": {
                "totalNodes": counts_result["nodes"],
                "totalRelations": counts_result["relations"],
                "avgConnections": avg_connections,
                "nodeTypeDistribution": node_type_distribution,
                "relationTypeDistribution": relation_type_distribution
            },
            "insights": {
                "centralNodes": central_nodes,
                "isolatedNodes": isolated_nodes,
                "recommendations": generate_recommendations(
                    central_nodes, 
                    isolated_nodes, 
                    node_type_distribution
                )
            }
        }


def generate_recommendations(central_nodes, isolated_nodes, node_type_distribution):
    """生成知识图谱改进建议"""
    recommendations = []
    
    # 孤立节点建议
    if isolated_nodes:
        recommendations.append(f"您有 {len(isolated_nodes)} 个孤立节点，建议将它们与其他知识点连接起来。")
    
    # 节点类型平衡建议
    node_types = node_type_distribution.keys()
    if 'note' in node_types and 'tag' in node_types and node_type_distribution['note'] > 5 * node_type_distribution['tag']:
        recommendations.append("您的笔记数量远多于标签数量，建议增加更多标签以便更好地组织知识。")
    
    if 'concept' in node_types and node_type_distribution.get('concept', 0) < 3:
        recommendations.append("您的概念节点较少，建议添加更多概念节点来构建更完整的知识体系。")
    
    # 中心节点建议
    if central_nodes:
        most_connected = central_nodes[0]
        recommendations.append(f"节点 '{most_connected['node']['title']}' 是您知识网络的中心，有 {most_connected['connections']} 个连接。考虑围绕它扩展更多相关知识。")
    
    # 通用建议
    recommendations.append("定期回顾和更新您的知识图谱，添加新的连接可以帮助您发现知识间的关联。")
    
    return recommendations
