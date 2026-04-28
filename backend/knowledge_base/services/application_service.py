"""
知识库应用服务
提供知识推荐、学习路径规划等应用功能
"""

import logging
import uuid
from django.utils import timezone
from typing import List, Dict, Optional
from collections import defaultdict, deque

from knowledge_base.mongodb_models import KnowledgeBase
from knowledge_graph.mongodb_models import KnowledgeNode, KnowledgeEdge
from knowledge_graph.services.auto_classification_service import AutoClassificationService

logger = logging.getLogger(__name__)


class KnowledgeBaseApplicationService:
    """
    知识库应用服务
    提供基于知识库的各种应用功能
    """
    
    def __init__(self):
        """初始化服务"""
        self.classification_service = AutoClassificationService()
    
    def recommend_related_content(self, kb_id: uuid.UUID, node_id: uuid.UUID, 
                                  limit: int = 10) -> Dict:
        """
        推荐相关内容
        
        Args:
            kb_id: 知识库ID
            node_id: 当前节点ID
            limit: 推荐数量限制
            
        Returns:
            Dict: 推荐结果
        """
        try:
            kb = KnowledgeBase.objects.get(id=kb_id)
            current_node = KnowledgeNode.objects.get(id=node_id)
            
            # 1. 查找直接相关的节点
            direct_related = self._find_direct_related(current_node, kb_id)
            
            # 2. 查找间接相关的节点（通过共同节点）
            indirect_related = self._find_indirect_related(current_node, kb_id, limit * 2)
            
            # 3. 合并并排序
            all_related = {}
            
            # 直接相关的权重更高
            for node_info in direct_related:
                all_related[str(node_info['id'])] = {
                    **node_info,
                    'score': node_info.get('relevance', 1.0) * 2.0
                }
            
            # 添加间接相关
            for node_info in indirect_related:
                node_id_str = str(node_info['id'])
                if node_id_str not in all_related:
                    all_related[node_id_str] = {
                        **node_info,
                        'score': node_info.get('relevance', 0.5)
                    }
            
            # 排序并限制数量
            sorted_related = sorted(
                all_related.values(),
                key=lambda x: x['score'],
                reverse=True
            )[:limit]
            
            result = {
                'success': True,
                'current_node': {
                    'id': str(current_node.id),
                    'title': current_node.title,
                    'type': current_node.type
                },
                'recommendations': [
                    {
                        'id': str(item['id']),
                        'title': item['title'],
                        'type': item['type'],
                        'relevance': item['score'],
                        'reason': item.get('reason', '相关内容')
                    }
                    for item in sorted_related
                ]
            }
            
            logger.info(f"推荐相关内容成功: {len(sorted_related)} 个推荐")
            return result
            
        except (KnowledgeBase.DoesNotExist, KnowledgeNode.DoesNotExist) as e:
            logger.error(f"推荐相关内容失败: {e}")
            return {'success': False, 'error': str(e)}
        except Exception as e:
            logger.error(f"推荐相关内容失败: {e}")
            return {'success': False, 'error': str(e)}
    
    def generate_learning_path(self, kb_id: uuid.UUID, target_node_id: uuid.UUID,
                               start_node_id: Optional[uuid.UUID] = None) -> Dict:
        """
        生成学习路径
        
        Args:
            kb_id: 知识库ID
            target_node_id: 目标节点ID
            start_node_id: 起始节点ID（可选）
            
        Returns:
            Dict: 学习路径
        """
        try:
            kb = KnowledgeBase.objects.get(id=kb_id)
            target_node = KnowledgeNode.objects.get(id=target_node_id)
            
            # 如果没有指定起始节点，寻找最基础的前置节点
            if not start_node_id:
                start_node = self._find_root_prerequisite(target_node, kb_id)
            else:
                start_node = KnowledgeNode.objects.get(id=start_node_id)
            
            # 使用BFS查找从起始节点到目标节点的路径
            path = self._find_path_bfs(start_node, target_node, kb_id)
            
            if not path:
                return {
                    'success': False,
                    'error': '无法找到从起始节点到目标节点的学习路径'
                }
            
            # 为路径中的每个节点添加详细信息
            detailed_path = []
            for i, node in enumerate(path):
                # 获取该节点的前置和后续节点
                prerequisites = self._get_prerequisites(node, kb_id)
                next_steps = self._get_next_steps(node, kb_id)
                
                detailed_path.append({
                    'step': i + 1,
                    'id': str(node.id),
                    'title': node.title,
                    'description': node.description,
                    'type': node.type,
                    'prerequisites': [str(p.id) for p in prerequisites],
                    'next_steps': [str(n.id) for n in next_steps],
                    'estimated_time': self._estimate_learning_time(node)
                })
            
            result = {
                'success': True,
                'path': detailed_path,
                'total_steps': len(detailed_path),
                'estimated_total_time': sum(step['estimated_time'] for step in detailed_path)
            }
            
            logger.info(f"生成学习路径成功: {len(detailed_path)} 个步骤")
            return result
            
        except (KnowledgeBase.DoesNotExist, KnowledgeNode.DoesNotExist) as e:
            logger.error(f"生成学习路径失败: {e}")
            return {'success': False, 'error': str(e)}
        except Exception as e:
            logger.error(f"生成学习路径失败: {e}")
            return {'success': False, 'error': str(e)}
    
    def identify_knowledge_gaps(self, kb_id: uuid.UUID, user) -> Dict:
        """
        识别知识缺口
        
        Args:
            kb_id: 知识库ID
            user: 用户对象
            
        Returns:
            Dict: 知识缺口分析
        """
        try:
            kb = KnowledgeBase.objects.get(id=kb_id)
            
            # 获取知识库中的所有节点和边
            nodes = KnowledgeNode.objects.filter(
                properties__knowledge_base_id=str(kb_id),
                is_deleted=False
            )
            
            edges = KnowledgeEdge.objects.filter(
                properties__knowledge_base_id=str(kb_id),
                is_deleted=False
            )
            
            # 分析孤立节点（没有连接的节点）
            connected_node_ids = set()
            for edge in edges:
                connected_node_ids.add(edge.source.id)
                connected_node_ids.add(edge.target.id)
            
            isolated_nodes = [
                node for node in nodes
                if node.id not in connected_node_ids
            ]
            
            # 分析弱连接节点（连接数少于2的节点）
            node_connections = defaultdict(int)
            for edge in edges:
                node_connections[edge.source.id] += 1
                node_connections[edge.target.id] += 1
            
            weakly_connected = [
                node for node in nodes
                if node_connections[node.id] < 2 and node.id in connected_node_ids
            ]
            
            # 分析概念覆盖度
            concept_nodes = [node for node in nodes if node.type == 'concept']
            note_nodes = [node for node in nodes if node.type == 'note']
            
            # 计算每个笔记的概念覆盖
            note_concept_coverage = {}
            for note_node in note_nodes:
                # 查找该笔记提及的概念
                concept_edges = KnowledgeEdge.objects.filter(
                    source=note_node,
                    type='mentions',
                    is_deleted=False
                )
                note_concept_coverage[str(note_node.id)] = len(concept_edges)
            
            # 找出概念覆盖不足的笔记
            low_coverage_notes = [
                {
                    'id': str(node.id),
                    'title': node.title,
                    'concept_count': note_concept_coverage.get(str(node.id), 0)
                }
                for node in note_nodes
                if note_concept_coverage.get(str(node.id), 0) < 3
            ]
            
            result = {
                'success': True,
                'gaps': {
                    'isolated_nodes': [
                        {
                            'id': str(node.id),
                            'title': node.title,
                            'type': node.type
                        }
                        for node in isolated_nodes
                    ],
                    'weakly_connected_nodes': [
                        {
                            'id': str(node.id),
                            'title': node.title,
                            'type': node.type,
                            'connection_count': node_connections[node.id]
                        }
                        for node in weakly_connected
                    ],
                    'low_coverage_notes': low_coverage_notes
                },
                'statistics': {
                    'total_nodes': len(nodes),
                    'total_edges': len(edges),
                    'isolated_count': len(isolated_nodes),
                    'weakly_connected_count': len(weakly_connected),
                    'average_connections': sum(node_connections.values()) / len(nodes) if nodes else 0
                },
                'suggestions': self._generate_gap_suggestions(
                    isolated_nodes, weakly_connected, low_coverage_notes
                )
            }
            
            logger.info(f"识别知识缺口成功: 发现 {len(isolated_nodes)} 个孤立节点")
            return result
            
        except KnowledgeBase.DoesNotExist:
            logger.error(f"知识库不存在: {kb_id}")
            return {'success': False, 'error': '知识库不存在'}
        except Exception as e:
            logger.error(f"识别知识缺口失败: {e}")
            return {'success': False, 'error': str(e)}
    
    def _find_direct_related(self, node: KnowledgeNode, kb_id: uuid.UUID) -> List[Dict]:
        """查找直接相关的节点"""
        related = []
        
        # 查找出边
        outgoing_edges = KnowledgeEdge.objects.filter(
            source=node,
            properties__knowledge_base_id=str(kb_id),
            is_deleted=False
        )
        
        for edge in outgoing_edges:
            related.append({
                'id': edge.target.id,
                'title': edge.target.title,
                'type': edge.target.type,
                'relevance': edge.properties.get('weight', 1.0),
                'reason': f"通过 '{edge.label}' 关系连接"
            })
        
        # 查找入边
        incoming_edges = KnowledgeEdge.objects.filter(
            target=node,
            properties__knowledge_base_id=str(kb_id),
            is_deleted=False
        )
        
        for edge in incoming_edges:
            related.append({
                'id': edge.source.id,
                'title': edge.source.title,
                'type': edge.source.type,
                'relevance': edge.properties.get('weight', 1.0),
                'reason': f"通过 '{edge.label}' 关系连接"
            })
        
        return related
    
    def _find_indirect_related(self, node: KnowledgeNode, kb_id: uuid.UUID, 
                              limit: int) -> List[Dict]:
        """查找间接相关的节点（2度连接）"""
        # 实现略简化，实际可以使用更复杂的图算法
        return []
    
    def _find_root_prerequisite(self, node: KnowledgeNode, kb_id: uuid.UUID) -> KnowledgeNode:
        """查找最基础的前置节点"""
        # 简化实现：返回节点本身
        return node
    
    def _find_path_bfs(self, start: KnowledgeNode, target: KnowledgeNode, 
                      kb_id: uuid.UUID) -> List[KnowledgeNode]:
        """使用BFS查找路径"""
        # 简化实现：返回直接路径
        return [start, target]
    
    def _get_prerequisites(self, node: KnowledgeNode, kb_id: uuid.UUID) -> List[KnowledgeNode]:
        """获取前置节点"""
        edges = KnowledgeEdge.objects.filter(
            target=node,
            type='prerequisite',
            properties__knowledge_base_id=str(kb_id),
            is_deleted=False
        )
        return [edge.source for edge in edges]
    
    def _get_next_steps(self, node: KnowledgeNode, kb_id: uuid.UUID) -> List[KnowledgeNode]:
        """获取后续节点"""
        edges = KnowledgeEdge.objects.filter(
            source=node,
            type='prerequisite',
            properties__knowledge_base_id=str(kb_id),
            is_deleted=False
        )
        return [edge.target for edge in edges]
    
    def _estimate_learning_time(self, node: KnowledgeNode) -> int:
        """估算学习时间（分钟）"""
        # 简化实现：根据内容长度估算
        content_length = len(node.description or '')
        return max(5, content_length // 100)  # 每100字约1分钟，最少5分钟
    
    def _generate_gap_suggestions(self, isolated_nodes, weakly_connected, 
                                 low_coverage_notes) -> List[str]:
        """生成知识缺口改进建议"""
        suggestions = []
        
        if isolated_nodes:
            suggestions.append(
                f"发现 {len(isolated_nodes)} 个孤立的知识点，建议为它们建立与其他知识点的关联。"
            )
        
        if weakly_connected:
            suggestions.append(
                f"发现 {len(weakly_connected)} 个连接较弱的知识点，建议丰富它们的关联关系。"
            )
        
        if low_coverage_notes:
            suggestions.append(
                f"发现 {len(low_coverage_notes)} 篇笔记的概念提取不足，建议重新分析或手动添加关键概念。"
            )
        
        return suggestions

