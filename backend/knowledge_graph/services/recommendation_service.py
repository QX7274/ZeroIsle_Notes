"""
知识图谱推荐服务
提供基于知识图谱的推荐功能
"""

import logging
from typing import Dict, List, Any, Optional
from django.conf import settings

from .neo4j_service import Neo4jService

logger = logging.getLogger(__name__)


class RecommendationService:
    """
    知识图谱推荐服务
    提供基于知识图谱的推荐功能
    """
    
    def __init__(self):
        """
        初始化推荐服务
        """
        self.neo4j_service = Neo4jService()
    
    def recommend_related_concepts(self, node_id: str, user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """
        推荐相关概念
        
        Args:
            node_id: 节点ID
            user_id: 用户ID
            limit: 返回结果数量限制
            
        Returns:
            相关概念列表
        """
        query = """
        MATCH (n)-[r]-(m:Concept)
        WHERE n.id = $node_id AND n.user_id = $user_id AND m.user_id = $user_id
        RETURN m.id as id, m.name as name, m.description as description, type(r) as relationship_type
        LIMIT $limit
        """
        
        result = self.neo4j_service.run_query(query, {
            "node_id": node_id,
            "user_id": user_id,
            "limit": limit
        })
        
        return result
    
    def recommend_similar_nodes(self, node_id: str, user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """
        推荐相似节点
        
        Args:
            node_id: 节点ID
            user_id: 用户ID
            limit: 返回结果数量限制
            
        Returns:
            相似节点列表
        """
        # 基于共同邻居的相似度计算
        query = """
        MATCH (n)-[r1]-(common)-[r2]-(m)
        WHERE n.id = $node_id AND n.user_id = $user_id AND m.user_id = $user_id
        AND n <> m AND labels(n) = labels(m)
        WITH m, count(common) as common_neighbors
        ORDER BY common_neighbors DESC
        LIMIT $limit
        RETURN m.id as id, m.name as name, labels(m)[0] as type, common_neighbors
        """
        
        result = self.neo4j_service.run_query(query, {
            "node_id": node_id,
            "user_id": user_id,
            "limit": limit
        })
        
        return result
    
    def recommend_notes_for_concept(self, concept_id: str, user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """
        为概念推荐笔记
        
        Args:
            concept_id: 概念ID
            user_id: 用户ID
            limit: 返回结果数量限制
            
        Returns:
            推荐笔记列表
        """
        # 查找与概念相关但尚未直接连接的笔记
        query = """
        MATCH (concept:Concept {id: $concept_id, user_id: $user_id})
        MATCH (note:Note {user_id: $user_id})
        WHERE NOT (concept)-[]-(note)
        WITH concept, note
        MATCH (concept)-[r1]-(common)-[r2]-(note)
        WITH note, count(common) as relevance
        ORDER BY relevance DESC
        LIMIT $limit
        RETURN note.id as id, note.title as title, note.created_at as created_at, relevance
        """
        
        result = self.neo4j_service.run_query(query, {
            "concept_id": concept_id,
            "user_id": user_id,
            "limit": limit
        })
        
        return result
    
    def recommend_concepts_for_note(self, note_id: str, user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """
        为笔记推荐概念
        
        Args:
            note_id: 笔记ID
            user_id: 用户ID
            limit: 返回结果数量限制
            
        Returns:
            推荐概念列表
        """
        # 查找与笔记相关但尚未直接连接的概念
        query = """
        MATCH (note:Note {id: $note_id, user_id: $user_id})
        MATCH (concept:Concept {user_id: $user_id})
        WHERE NOT (note)-[]-(concept)
        WITH note, concept
        MATCH (note)-[r1]-(common)-[r2]-(concept)
        WITH concept, count(common) as relevance
        ORDER BY relevance DESC
        LIMIT $limit
        RETURN concept.id as id, concept.name as name, concept.description as description, relevance
        """
        
        result = self.neo4j_service.run_query(query, {
            "note_id": note_id,
            "user_id": user_id,
            "limit": limit
        })
        
        return result
    
    def recommend_learning_path(self, start_concept_id: str, end_concept_id: str, user_id: int) -> List[Dict[str, Any]]:
        """
        推荐学习路径
        
        Args:
            start_concept_id: 起始概念ID
            end_concept_id: 目标概念ID
            user_id: 用户ID
            
        Returns:
            学习路径
        """
        # 查找从起始概念到目标概念的最短路径
        query = """
        MATCH path = shortestPath((start:Concept)-[*]-(end:Concept))
        WHERE start.id = $start_concept_id AND end.id = $end_concept_id
        AND start.user_id = $user_id AND end.user_id = $user_id
        RETURN path
        """
        
        result = self.neo4j_service.run_query(query, {
            "start_concept_id": start_concept_id,
            "end_concept_id": end_concept_id,
            "user_id": user_id
        })
        
        if not result:
            return []
        
        # 处理路径结果
        path_data = []
        path = result[0].get("path")
        
        if path:
            # 提取节点
            for node in path.nodes:
                node_data = {
                    "id": node.get("id"),
                    "name": node.get("name"),
                    "type": list(node.labels)[0]
                }
                path_data.append(node_data)
        
        return path_data
    
    def recommend_exploration(self, user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """
        推荐探索
        
        Args:
            user_id: 用户ID
            limit: 返回结果数量限制
            
        Returns:
            推荐探索列表
        """
        # 查找用户最近访问的节点
        query = """
        MATCH (n {user_id: $user_id})
        WHERE exists(n.last_accessed)
        WITH n
        ORDER BY n.last_accessed DESC
        LIMIT 5
        WITH collect(n) as recent_nodes
        UNWIND recent_nodes as recent
        MATCH (recent)-[r]-(m {user_id: $user_id})
        WHERE NOT m IN recent_nodes
        WITH m, count(r) as relevance
        ORDER BY relevance DESC
        LIMIT $limit
        RETURN m.id as id, m.name as name, labels(m)[0] as type, relevance
        """
        
        result = self.neo4j_service.run_query(query, {
            "user_id": user_id,
            "limit": limit
        })
        
        return result
