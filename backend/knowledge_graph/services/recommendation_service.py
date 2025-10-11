"""
知识图谱推荐服务
提供基于知识图谱的推荐功能
"""

import logging
from typing import Dict, List, Any, Optional
from collections import defaultdict
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from django.conf import settings

from .neo4j_service import Neo4jService
from .extraction_service import ExtractionService
from notes.mongodb_models import Note

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
        self.extraction_service = ExtractionService()
    
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
    
    def recommend_by_content(self, note_id: str, user, limit: int = 10) -> List[Dict[str, Any]]:
        """
        基于内容的推荐
        
        Args:
            note_id: 笔记ID
            user: 用户对象
            limit: 返回结果数量限制
            
        Returns:
            推荐笔记列表
        """
        try:
            # 获取当前笔记
            current_note = Note.objects.get(id=note_id, user=user, is_deleted=False)
            current_text = f"{current_note.title} {current_note.content}"
            
            # 获取用户的所有笔记
            all_notes = Note.objects.filter(user=user, is_deleted=False).exclude(id=note_id)
            
            if not all_notes:
                return []
            
            # 构建文本列表
            texts = [current_text] + [f"{note.title} {note.content}" for note in all_notes]
            
            # 使用TF-IDF计算相似度
            vectorizer = TfidfVectorizer(max_features=100, stop_words=list(self.extraction_service.stopwords))
            tfidf_matrix = vectorizer.fit_transform(texts)
            
            # 计算余弦相似度
            similarities = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
            
            # 获取最相似的笔记索引
            similar_indices = similarities.argsort()[-limit:][::-1]
            
            # 构建推荐结果
            recommendations = []
            for idx in similar_indices:
                note = list(all_notes)[idx]
                recommendations.append({
                    'id': str(note.id),
                    'title': note.title,
                    'similarity': float(similarities[idx]),
                    'created_at': note.created_at.isoformat() if note.created_at else None
                })
            
            return recommendations
            
        except Note.DoesNotExist:
            logger.warning(f"笔记 {note_id} 不存在")
            return []
        except Exception as e:
            logger.error(f"基于内容的推荐失败: {str(e)}")
            return []
    
    def recommend_knowledge_gaps(self, user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """
        识别知识缺口
        
        Args:
            user_id: 用户ID
            limit: 返回结果数量限制
            
        Returns:
            知识缺口列表
        """
        # 查找用户知识图谱中的孤立节点或弱连接区域
        query = """
        MATCH (n {user_id: $user_id})
        WITH n, size((n)--()) as degree
        WHERE degree < 2
        RETURN n.id as id, n.name as name, labels(n)[0] as type, degree
        ORDER BY degree ASC
        LIMIT $limit
        """
        
        result = self.neo4j_service.run_query(query, {
            "user_id": user_id,
            "limit": limit
        })
        
        return result
    
    def recommend_learning_sequence(self, topic: str, user_id: int) -> List[Dict[str, Any]]:
        """
        生成学习序列
        
        Args:
            topic: 主题
            user_id: 用户ID
            
        Returns:
            学习序列
        """
        # 找到与主题相关的所有概念
        query = """
        MATCH (c:Concept {user_id: $user_id})
        WHERE c.name CONTAINS $topic OR c.description CONTAINS $topic
        RETURN c.id as id, c.name as name
        """
        
        concepts = self.neo4j_service.run_query(query, {
            "topic": topic,
            "user_id": user_id
        })
        
        if not concepts:
            return []
        
        # 构建学习序列（基于概念间的依赖关系）
        sequence = []
        visited = set()
        
        def build_sequence(concept_id, depth=0):
            if concept_id in visited or depth > 5:
                return
            
            visited.add(concept_id)
            
            # 找到前置概念（prerequisite）
            prereq_query = """
            MATCH (c:Concept {id: $concept_id})<-[:PREREQUISITE]-(prereq:Concept {user_id: $user_id})
            RETURN prereq.id as id, prereq.name as name
            """
            
            prereqs = self.neo4j_service.run_query(prereq_query, {
                "concept_id": concept_id,
                "user_id": user_id
            })
            
            # 递归添加前置概念
            for prereq in prereqs:
                build_sequence(prereq['id'], depth + 1)
            
            # 添加当前概念
            concept_query = """
            MATCH (c:Concept {id: $concept_id})
            RETURN c.id as id, c.name as name, c.description as description
            """
            
            concept_data = self.neo4j_service.run_query(concept_query, {
                "concept_id": concept_id
            })
            
            if concept_data:
                sequence.append(concept_data[0])
        
        # 从第一个概念开始构建序列
        if concepts:
            build_sequence(concepts[0]['id'])
        
        return sequence
