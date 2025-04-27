"""
知识图谱分析服务
提供知识图谱的分析功能
"""

import logging
from typing import Dict, List, Any, Optional
from django.conf import settings

from .neo4j_service import Neo4jService

logger = logging.getLogger(__name__)


class AnalysisService:
    """
    知识图谱分析服务
    提供知识图谱的分析功能
    """
    
    def __init__(self):
        """
        初始化分析服务
        """
        self.neo4j_service = Neo4jService()
    
    def get_node_statistics(self, user_id: int) -> Dict[str, Any]:
        """
        获取节点统计信息
        
        Args:
            user_id: 用户ID
            
        Returns:
            节点统计信息
        """
        query = """
        MATCH (n)
        WHERE n.user_id = $user_id
        RETURN 
            count(n) as total_nodes,
            sum(CASE WHEN labels(n)[0] = 'Concept' THEN 1 ELSE 0 END) as concept_count,
            sum(CASE WHEN labels(n)[0] = 'Entity' THEN 1 ELSE 0 END) as entity_count,
            sum(CASE WHEN labels(n)[0] = 'Event' THEN 1 ELSE 0 END) as event_count,
            sum(CASE WHEN labels(n)[0] = 'Note' THEN 1 ELSE 0 END) as note_count
        """
        
        result = self.neo4j_service.run_query(query, {"user_id": user_id})
        if not result:
            return {
                "total_nodes": 0,
                "concept_count": 0,
                "entity_count": 0,
                "event_count": 0,
                "note_count": 0
            }
        
        return result[0]
    
    def get_relationship_statistics(self, user_id: int) -> Dict[str, Any]:
        """
        获取关系统计信息
        
        Args:
            user_id: 用户ID
            
        Returns:
            关系统计信息
        """
        query = """
        MATCH (n)-[r]->(m)
        WHERE n.user_id = $user_id AND m.user_id = $user_id
        RETURN 
            count(r) as total_relationships,
            count(DISTINCT type(r)) as relationship_types,
            collect(DISTINCT type(r)) as relationship_type_names
        """
        
        result = self.neo4j_service.run_query(query, {"user_id": user_id})
        if not result:
            return {
                "total_relationships": 0,
                "relationship_types": 0,
                "relationship_type_names": []
            }
        
        return result[0]
    
    def get_central_nodes(self, user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """
        获取中心节点
        
        Args:
            user_id: 用户ID
            limit: 返回结果数量限制
            
        Returns:
            中心节点列表
        """
        query = """
        MATCH (n)
        WHERE n.user_id = $user_id
        WITH n, size((n)--()) as degree
        ORDER BY degree DESC
        LIMIT $limit
        RETURN n.id as id, n.name as name, labels(n)[0] as type, degree
        """
        
        result = self.neo4j_service.run_query(query, {"user_id": user_id, "limit": limit})
        return result
    
    def get_path_between_nodes(self, start_node_id: str, end_node_id: str, user_id: int, max_depth: int = 4) -> List[Dict[str, Any]]:
        """
        获取两个节点之间的路径
        
        Args:
            start_node_id: 起始节点ID
            end_node_id: 结束节点ID
            user_id: 用户ID
            max_depth: 最大深度
            
        Returns:
            路径列表
        """
        query = """
        MATCH path = shortestPath((start)-[*1..{max_depth}]-(end))
        WHERE start.id = $start_node_id AND end.id = $end_node_id
        AND start.user_id = $user_id AND end.user_id = $user_id
        RETURN path
        LIMIT 1
        """
        
        query = query.format(max_depth=max_depth)
        result = self.neo4j_service.run_query(query, {
            "start_node_id": start_node_id,
            "end_node_id": end_node_id,
            "user_id": user_id
        })
        
        if not result:
            return []
        
        # 处理路径结果
        path_data = []
        path = result[0].get("path")
        
        if path:
            # 提取节点
            nodes = []
            for node in path.nodes:
                node_data = dict(node)
                node_data["type"] = list(node.labels)[0]
                nodes.append(node_data)
            
            # 提取关系
            relationships = []
            for rel in path.relationships:
                rel_data = {
                    "id": rel.id,
                    "type": rel.type,
                    "start_node": rel.start_node.id,
                    "end_node": rel.end_node.id,
                    "properties": dict(rel)
                }
                relationships.append(rel_data)
            
            path_data = {
                "nodes": nodes,
                "relationships": relationships
            }
        
        return path_data
    
    def get_subgraph(self, node_id: str, user_id: int, depth: int = 2) -> Dict[str, Any]:
        """
        获取子图
        
        Args:
            node_id: 节点ID
            user_id: 用户ID
            depth: 深度
            
        Returns:
            子图数据
        """
        query = """
        MATCH path = (n)-[*0..{depth}]-(m)
        WHERE n.id = $node_id AND n.user_id = $user_id AND m.user_id = $user_id
        RETURN path
        """
        
        query = query.format(depth=depth)
        result = self.neo4j_service.run_query(query, {
            "node_id": node_id,
            "user_id": user_id
        })
        
        if not result:
            return {"nodes": [], "relationships": []}
        
        # 处理子图结果
        nodes = {}
        relationships = {}
        
        for record in result:
            path = record.get("path")
            
            if path:
                # 提取节点
                for node in path.nodes:
                    if node.id not in nodes:
                        node_data = dict(node)
                        node_data["type"] = list(node.labels)[0]
                        nodes[node.id] = node_data
                
                # 提取关系
                for rel in path.relationships:
                    if rel.id not in relationships:
                        rel_data = {
                            "id": rel.id,
                            "type": rel.type,
                            "start_node": rel.start_node.id,
                            "end_node": rel.end_node.id,
                            "properties": dict(rel)
                        }
                        relationships[rel.id] = rel_data
        
        return {
            "nodes": list(nodes.values()),
            "relationships": list(relationships.values())
        }
    
    def get_related_notes(self, node_id: str, user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """
        获取相关笔记
        
        Args:
            node_id: 节点ID
            user_id: 用户ID
            limit: 返回结果数量限制
            
        Returns:
            相关笔记列表
        """
        query = """
        MATCH (n)-[r]-(note:Note)
        WHERE n.id = $node_id AND n.user_id = $user_id AND note.user_id = $user_id
        RETURN note.id as id, note.title as title, note.created_at as created_at, type(r) as relationship_type
        LIMIT $limit
        """
        
        result = self.neo4j_service.run_query(query, {
            "node_id": node_id,
            "user_id": user_id,
            "limit": limit
        })
        
        return result
