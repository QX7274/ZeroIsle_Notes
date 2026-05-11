"""
图谱关系推理服务
提供基于图结构的智能推理功能
"""

import logging
from typing import List, Dict, Optional, Tuple, Any

try:
    from .neo4j_service import Neo4jService
except Exception:
    Neo4jService = Any

logger = logging.getLogger('backend')


class InferenceService:
    """
    知识图谱推理服务
    
    提供以下推理能力：
    - 传递性关系推理 (A->B, B->C => A->C)
    - 相似节点发现
    - 连接建议
    - 路径发现
    - 中心性分析
    """
    
    def __init__(self, neo4j_service: Optional[Neo4jService] = None):
        """
        初始化推理服务
        
        Args:
            neo4j_service: Neo4j服务实例，如不提供则使用单例
        """
        self.neo4j = neo4j_service or Neo4jService.get_instance()
    
    def infer_transitive_relations(
        self, 
        node_id: str, 
        relation_type: str = "RELATED_TO",
        max_depth: int = 2
    ) -> List[Dict]:
        """
        传递性关系推理
        
        如果 A->B 且 B->C，推断 A 与 C 也存在潜在关系
        
        Args:
            node_id: 起始节点ID
            relation_type: 关系类型
            max_depth: 最大推理深度
            
        Returns:
            list: 推断的潜在关系列表
        """
        if not self.neo4j.is_connected():
            logger.error("Neo4j未连接，无法执行推理")
            return []
        
        try:
            # 参数兜底：避免 max_depth < 2 造成无效路径范围（*2..1）
            safe_max_depth = max(2, int(max_depth))

            # 查找通过中间节点连接的终端节点（不直接连接）
            query = f"""
            MATCH (start:KnowledgeNode {{id: $node_id}})
            MATCH path = (start)-[:{relation_type}*2..{safe_max_depth}]-(end:KnowledgeNode)
            WHERE NOT (start)-[:{relation_type}]-(end)
            AND start <> end
            WITH end, length(path) as distance, 
                 [n IN nodes(path) | n.title] as path_titles
            RETURN DISTINCT end.id as id, end.title as title, 
                   end.type as type, distance,
                   path_titles as intermediate_path
            ORDER BY distance
            LIMIT 20
            """
            
            result = self.neo4j.graph.run(query, node_id=str(node_id)).data()
            
            inferred_relations = []
            for record in result:
                inferred_relations.append({
                    'target_id': record['id'],
                    'target_title': record['title'],
                    'target_type': record['type'],
                    'distance': record['distance'],
                    'intermediate_path': record['intermediate_path'],
                    'confidence': 1.0 / record['distance'],  # 距离越短置信度越高
                    'inference_type': 'transitive'
                })
            
            logger.info(f"传递性推理完成: 节点{node_id} 发现 {len(inferred_relations)} 个潜在关系")
            return inferred_relations
            
        except Exception as e:
            logger.error(f"传递性推理失败: {e}")
            return []
    
    def find_similar_nodes(
        self, 
        node_id: str, 
        threshold: float = 0.5,
        limit: int = 10
    ) -> List[Dict]:
        """
        基于图结构发现相似节点
        
        相似度基于共同邻居和节点属性计算
        
        Args:
            node_id: 节点ID
            threshold: 相似度阈值 (0-1)
            limit: 返回结果数量限制
            
        Returns:
            list: 相似节点列表
        """
        if not self.neo4j.is_connected():
            logger.error("Neo4j未连接，无法查找相似节点")
            return []
        
        try:
            # 使用Jaccard相似度算法
            query = """
            MATCH (n:KnowledgeNode {id: $node_id})
            MATCH (other:KnowledgeNode)
            WHERE n <> other AND n.user_id = other.user_id
            
            // 计算共同邻居
            OPTIONAL MATCH (n)-[]-(neighbor)-[]-(other)
            WITH n, other, count(DISTINCT neighbor) as common_neighbors
            
            // 计算各自的邻居总数
            OPTIONAL MATCH (n)-[]-(n_neighbor)
            WITH n, other, common_neighbors, count(DISTINCT n_neighbor) as n_neighbors
            
            OPTIONAL MATCH (other)-[]-(o_neighbor)
            WITH n, other, common_neighbors, n_neighbors, count(DISTINCT o_neighbor) as o_neighbors
            
            // 计算Jaccard相似度
            WITH other, common_neighbors, n_neighbors, o_neighbors,
                 CASE WHEN (n_neighbors + o_neighbors - common_neighbors) > 0 
                      THEN toFloat(common_neighbors) / (n_neighbors + o_neighbors - common_neighbors)
                      ELSE 0 
                 END as similarity
            
            WHERE similarity >= $threshold
            
            // 类型相同额外加分
            MATCH (source:KnowledgeNode {id: $node_id})
            WITH other, similarity,
                 CASE WHEN source.type = other.type THEN similarity + 0.1 ELSE similarity END as adjusted_similarity
            
            RETURN other.id as id, other.title as title, other.type as type,
                   adjusted_similarity as similarity, common_neighbors
            ORDER BY adjusted_similarity DESC
            LIMIT $limit
            """
            
            result = self.neo4j.graph.run(
                query, 
                node_id=str(node_id),
                threshold=threshold,
                limit=limit
            ).data()
            
            similar_nodes = []
            for record in result:
                similar_nodes.append({
                    'id': record['id'],
                    'title': record['title'],
                    'type': record['type'],
                    'similarity': round(record['similarity'], 3),
                    'common_neighbors': record['common_neighbors']
                })
            
            logger.info(f"相似节点查找完成: 节点{node_id} 发现 {len(similar_nodes)} 个相似节点")
            return similar_nodes
            
        except Exception as e:
            logger.error(f"查找相似节点失败: {e}")
            return []
    
    def suggest_connections(
        self, 
        node_id: str,
        user_id: str,
        limit: int = 5
    ) -> List[Dict]:
        """
        智能连接建议
        
        基于以下因素推荐可能的连接：
        - 共同邻居
        - 类型匹配
        - 时间相近性
        - 内容相似性（如有）
        
        Args:
            node_id: 节点ID
            user_id: 用户ID
            limit: 返回结果数量限制
            
        Returns:
            list: 建议的连接列表
        """
        if not self.neo4j.is_connected():
            logger.error("Neo4j未连接，无法生成连接建议")
            return []
        
        try:
            query = """
            MATCH (n:KnowledgeNode {id: $node_id, user_id: $user_id})
            MATCH (candidate:KnowledgeNode {user_id: $user_id})
            WHERE n <> candidate
            AND NOT (n)-[]-(candidate)  // 排除已连接的节点
            
            // 通过一个中间节点连接的节点（二度关系）
            OPTIONAL MATCH (n)-[]-(bridge)-[]-(candidate)
            WHERE bridge <> n AND bridge <> candidate
            WITH n, candidate, count(DISTINCT bridge) as bridge_count
            
            // 评分系统
            WITH candidate,
                 bridge_count * 10 as bridge_score,
                 CASE WHEN n.type = candidate.type THEN 5 ELSE 0 END as type_score
            
            WITH candidate, (bridge_score + type_score) as total_score
            WHERE total_score > 0
            
            RETURN candidate.id as id, 
                   candidate.title as title,
                   candidate.type as type,
                   candidate.description as description,
                   total_score as score
            ORDER BY total_score DESC
            LIMIT $limit
            """
            
            result = self.neo4j.graph.run(
                query,
                node_id=str(node_id),
                user_id=str(user_id),
                limit=limit
            ).data()
            
            suggestions = []
            for record in result:
                suggestions.append({
                    'id': record['id'],
                    'title': record['title'],
                    'type': record['type'],
                    'description': record['description'] or '',
                    'score': record['score'],
                    'reason': self._get_suggestion_reason(record['score'])
                })
            
            logger.info(f"连接建议生成完成: 节点{node_id} 生成 {len(suggestions)} 个建议")
            return suggestions
            
        except Exception as e:
            logger.error(f"生成连接建议失败: {e}")
            return []
    
    def analyze_node_centrality(
        self, 
        user_id: str, 
        limit: int = 10
    ) -> List[Dict]:
        """
        节点中心性分析
        
        识别知识网络中的核心概念
        
        Args:
            user_id: 用户ID
            limit: 返回结果数量限制
            
        Returns:
            list: 按中心性排序的节点列表
        """
        if not self.neo4j.is_connected():
            logger.error("Neo4j未连接，无法分析中心性")
            return []
        
        try:
            # 度中心性 - 连接数量
            query = """
            MATCH (n:KnowledgeNode {user_id: $user_id})-[r]-(connected)
            WITH n, count(DISTINCT connected) as degree
            RETURN n.id as id, 
                   n.title as title, 
                   n.type as type,
                   degree
            ORDER BY degree DESC
            LIMIT $limit
            """
            
            result = self.neo4j.graph.run(
                query,
                user_id=str(user_id),
                limit=limit
            ).data()
            
            centrality_data = []
            max_degree = result[0]['degree'] if result else 1
            
            for record in result:
                centrality_data.append({
                    'id': record['id'],
                    'title': record['title'],
                    'type': record['type'],
                    'degree': record['degree'],
                    'normalized_centrality': round(record['degree'] / max_degree, 3),
                    'is_hub': record['degree'] >= max_degree * 0.5
                })
            
            logger.info(f"中心性分析完成: 用户{user_id} 分析了 {len(centrality_data)} 个节点")
            return centrality_data
            
        except Exception as e:
            logger.error(f"节点中心性分析失败: {e}")
            return []
    
    def detect_communities(self, user_id: str) -> List[Dict]:
        """
        社区检测
        
        发现知识图谱中的主题群组
        
        Args:
            user_id: 用户ID
            
        Returns:
            list: 社区列表，每个社区包含节点和主题
        """
        if not self.neo4j.is_connected():
            logger.error("Neo4j未连接，无法检测社区")
            return []
        
        try:
            # 使用连通分量作为简单的社区检测
            query = """
            MATCH (n:KnowledgeNode {user_id: $user_id})
            CALL {
                WITH n
                MATCH (n)-[*1..3]-(connected:KnowledgeNode {user_id: $user_id})
                RETURN collect(DISTINCT connected.id) + [n.id] as community_nodes
            }
            WITH community_nodes
            WHERE size(community_nodes) > 1
            RETURN DISTINCT community_nodes
            ORDER BY size(community_nodes) DESC
            LIMIT 10
            """
            
            # 注意：此查询可能需要根据Neo4j版本调整
            # 对于较老版本，可能需要使用不同的语法
            result = self.neo4j.graph.run(query, user_id=str(user_id)).data()
            
            communities = []
            for i, record in enumerate(result):
                node_ids = record['community_nodes']
                communities.append({
                    'community_id': i + 1,
                    'size': len(node_ids),
                    'node_ids': node_ids
                })
            
            return communities
            
        except Exception as e:
            logger.error(f"社区检测失败: {e}")
            return []
    
    def _get_suggestion_reason(self, score: int) -> str:
        """根据得分生成建议理由"""
        if score >= 20:
            return "高度相关 - 存在多个共同关联"
        elif score >= 10:
            return "中度相关 - 存在共同关联"
        elif score >= 5:
            return "可能相关 - 类型相似"
        else:
            return "轻度相关"


# 创建全局实例获取函数
def get_inference_service() -> InferenceService:
    """获取推理服务实例"""
    return InferenceService()
