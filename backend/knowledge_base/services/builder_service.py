"""
知识库构建服务
提供知识库的自动构建和导入功能
"""

import logging
import uuid
import json
import re
from django.utils import timezone
from typing import List, Dict, Optional

from knowledge_base.mongodb_models import KnowledgeBase, KnowledgeBaseImport
from knowledge_graph.mongodb_models import KnowledgeNode, KnowledgeEdge
from knowledge_graph.services.extraction_service import ExtractionService
from knowledge_graph.services.knowledge_graph_builder_service import KnowledgeGraphBuilderService
from notes.mongodb_models import Note

logger = logging.getLogger(__name__)


class KnowledgeBaseBuilderService:
    """
    知识库构建服务
    负责从各种来源构建和导入知识库
    """
    
    def __init__(self):
        """初始化服务"""
        self.extraction_service = ExtractionService()
        self.graph_builder = KnowledgeGraphBuilderService()
    
    def build_from_notes(self, kb_id: uuid.UUID, user, note_ids: List[uuid.UUID] = None,
                        extract_concepts: bool = True) -> Dict:
        """
        从笔记构建知识库
        
        Args:
            kb_id: 知识库ID
            user: 用户对象
            note_ids: 笔记ID列表，如果为None则使用用户的所有笔记
            extract_concepts: 是否提取概念
            
        Returns:
            Dict: 构建结果统计
        """
        try:
            kb = KnowledgeBase.objects.get(id=kb_id)
            
            # 获取笔记
            if note_ids:
                notes = Note.objects.filter(
                    id__in=note_ids,
                    user=user,
                    is_deleted=False
                )
            else:
                notes = Note.objects.filter(
                    user=user,
                    is_deleted=False
                )
            
            nodes_created = 0
            edges_created = 0
            
            # 处理每个笔记
            for note in notes:
                result = self._process_note(kb, note, extract_concepts)
                nodes_created += result['nodes_created']
                edges_created += result['edges_created']
            
            # 更新知识库统计
            kb.note_count = len(notes)
            kb.node_count = KnowledgeNode.objects.filter(
                properties__knowledge_base_id=str(kb_id),
                is_deleted=False
            ).count()
            kb.edge_count = KnowledgeEdge.objects.filter(
                properties__knowledge_base_id=str(kb_id),
                is_deleted=False
            ).count()
            kb.updated_at = timezone.now()
            kb.save()
            
            result = {
                'success': True,
                'notes_processed': len(notes),
                'nodes_created': nodes_created,
                'edges_created': edges_created,
                'total_nodes': kb.node_count,
                'total_edges': kb.edge_count
            }
            
            logger.info(f"从笔记构建知识库成功: {kb.name}, 处理了 {len(notes)} 个笔记")
            return result
            
        except KnowledgeBase.DoesNotExist:
            logger.error(f"知识库不存在: {kb_id}")
            return {'success': False, 'error': '知识库不存在'}
        except Exception as e:
            logger.error(f"从笔记构建知识库失败: {e}")
            return {'success': False, 'error': str(e)}
    
    def import_from_markdown(self, kb_id: uuid.UUID, user, markdown_content: str,
                            source_name: str = '') -> Dict:
        """
        从Markdown内容导入知识库
        
        Args:
            kb_id: 知识库ID
            user: 用户对象
            markdown_content: Markdown内容
            source_name: 来源名称
            
        Returns:
            Dict: 导入结果
        """
        try:
            kb = KnowledgeBase.objects.get(id=kb_id)
            
            # 创建导入记录
            import_record = KnowledgeBaseImport(
                id=uuid.uuid4(),
                knowledge_base=kb,
                user=user,
                source_type='file',
                source_name=source_name or 'Markdown导入',
                status='processing',
                started_at=timezone.now()
            )
            import_record.save()
            
            try:
                # 解析Markdown结构
                sections = self._parse_markdown(markdown_content)
                
                nodes_created = 0
                edges_created = 0
                
                # 为每个章节创建节点
                parent_nodes = {}  # 用于跟踪父节点
                
                for section in sections:
                    level = section['level']
                    title = section['title']
                    content = section['content']
                    
                    # 创建节点
                    node = KnowledgeNode(
                        id=uuid.uuid4(),
                        user=user,
                        title=title,
                        description=content[:500] if content else '',
                        type='concept',
                        properties={
                            'knowledge_base_id': str(kb_id),
                            'source': 'markdown_import',
                            'level': level,
                            'full_content': content
                        },
                        created_at=timezone.now(),
                        updated_at=timezone.now()
                    )
                    node.save()
                    nodes_created += 1
                    
                    # 记录当前层级的节点
                    parent_nodes[level] = node
                    
                    # 如果有父节点，创建层级关系
                    if level > 1:
                        parent_level = level - 1
                        while parent_level >= 1:
                            if parent_level in parent_nodes:
                                parent_node = parent_nodes[parent_level]
                                
                                # 创建父子关系边
                                edge = KnowledgeEdge(
                                    id=uuid.uuid4(),
                                    user=user,
                                    source=parent_node,
                                    target=node,
                                    type='has_subsection',
                                    label='包含',
                                    properties={
                                        'knowledge_base_id': str(kb_id)
                                    },
                                    created_at=timezone.now(),
                                    updated_at=timezone.now()
                                )
                                edge.save()
                                edges_created += 1
                                break
                            parent_level -= 1
                    
                    # 提取内容中的概念和关系
                    if content:
                        extraction_result = self.extraction_service.extract_from_note(
                            type('Note', (), {'id': uuid.uuid4(), 'title': title, 'content': content})()
                        )
                        
                        # 为提取的概念创建节点和关系
                        for concept in extraction_result.get('concepts', [])[:5]:  # 限制每个章节最多5个概念
                            concept_node = self._get_or_create_concept_node(
                                kb_id, user, concept['name'], ''
                            )
                            
                            # 创建章节-概念关系
                            edge = KnowledgeEdge(
                                id=uuid.uuid4(),
                                user=user,
                                source=node,
                                target=concept_node,
                                type='mentions',
                                label='提及',
                                properties={
                                    'knowledge_base_id': str(kb_id),
                                    'weight': concept.get('score', 1.0)
                                },
                                created_at=timezone.now(),
                                updated_at=timezone.now()
                            )
                            edge.save()
                            edges_created += 1
                
                # 更新导入记录
                import_record.status = 'completed'
                import_record.nodes_created = nodes_created
                import_record.edges_created = edges_created
                import_record.completed_at = timezone.now()
                import_record.save()
                
                # 更新知识库统计
                kb.node_count = KnowledgeNode.objects.filter(
                    properties__knowledge_base_id=str(kb_id),
                    is_deleted=False
                ).count()
                kb.edge_count = KnowledgeEdge.objects.filter(
                    properties__knowledge_base_id=str(kb_id),
                    is_deleted=False
                ).count()
                kb.updated_at = timezone.now()
                kb.save()
                
                result = {
                    'success': True,
                    'import_id': str(import_record.id),
                    'nodes_created': nodes_created,
                    'edges_created': edges_created,
                    'sections_processed': len(sections)
                }
                
                logger.info(f"从Markdown导入知识库成功: {kb.name}")
                return result
                
            except Exception as e:
                # 更新导入记录为失败
                import_record.status = 'failed'
                import_record.error_message = str(e)
                import_record.completed_at = timezone.now()
                import_record.save()
                raise
                
        except KnowledgeBase.DoesNotExist:
            logger.error(f"知识库不存在: {kb_id}")
            return {'success': False, 'error': '知识库不存在'}
        except Exception as e:
            logger.error(f"从Markdown导入知识库失败: {e}")
            return {'success': False, 'error': str(e)}
    
    def _process_note(self, kb: KnowledgeBase, note: Note, extract_concepts: bool) -> Dict:
        """处理单个笔记"""
        nodes_created = 0
        edges_created = 0
        
        # 使用图谱构建服务处理笔记
        result = self.graph_builder.build_graph_from_note(note, extract_concepts)
        
        if 'error' not in result:
            # 更新所有创建的节点和边，添加知识库ID
            self._tag_with_kb_id(note.user, str(kb.id))
            
            # 统计创建的节点和边
            nodes_created = len(result.get('concept_nodes', [])) + 1  # +1 for note node
            edges_created = len(result.get('tag_nodes', [])) + len(result.get('concept_nodes', []))
        
        return {
            'nodes_created': nodes_created,
            'edges_created': edges_created
        }
    
    def _tag_with_kb_id(self, user, kb_id: str):
        """为最近创建的节点和边添加知识库ID标记"""
        # 获取最近1分钟内创建的节点和边
        recent_time = timezone.now() - timezone.timedelta(minutes=1)
        
        nodes = KnowledgeNode.objects.filter(
            user=user,
            created_at__gte=recent_time,
            is_deleted=False
        )
        
        for node in nodes:
            if 'knowledge_base_id' not in node.properties:
                node.properties['knowledge_base_id'] = kb_id
                node.save()
        
        edges = KnowledgeEdge.objects.filter(
            user=user,
            created_at__gte=recent_time,
            is_deleted=False
        )
        
        for edge in edges:
            if 'knowledge_base_id' not in edge.properties:
                edge.properties['knowledge_base_id'] = kb_id
                edge.save()
    
    def _parse_markdown(self, markdown_content: str) -> List[Dict]:
        """解析Markdown内容为结构化章节"""
        sections = []
        lines = markdown_content.split('\n')
        
        current_section = None
        
        for line in lines:
            # 匹配标题
            heading_match = re.match(r'^(#{1,6})\s+(.+)$', line)
            
            if heading_match:
                # 保存之前的章节
                if current_section:
                    sections.append(current_section)
                
                # 创建新章节
                level = len(heading_match.group(1))
                title = heading_match.group(2).strip()
                
                current_section = {
                    'level': level,
                    'title': title,
                    'content': ''
                }
            elif current_section:
                # 添加内容到当前章节
                current_section['content'] += line + '\n'
        
        # 保存最后一个章节
        if current_section:
            sections.append(current_section)
        
        return sections
    
    def _get_or_create_concept_node(self, kb_id: uuid.UUID, user, name: str, 
                                   description: str) -> KnowledgeNode:
        """获取或创建概念节点"""
        # 查找现有节点
        node = KnowledgeNode.objects.filter(
            user=user,
            type='concept',
            title=name,
            properties__knowledge_base_id=str(kb_id),
            is_deleted=False
        ).first()
        
        if node:
            return node
        
        # 创建新节点
        node = KnowledgeNode(
            id=uuid.uuid4(),
            user=user,
            title=name,
            description=description,
            type='concept',
            properties={
                'knowledge_base_id': str(kb_id)
            },
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        node.save()
        
        return node

