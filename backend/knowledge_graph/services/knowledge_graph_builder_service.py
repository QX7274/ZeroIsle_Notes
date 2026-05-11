"""
知识图谱构建服务
提供自动构建知识图谱的功能
"""

import logging
import uuid
import re
from django.utils import timezone
from collections import defaultdict

from notes.mongodb_models import Note, Tag, Category
from knowledge_graph.mongodb_models import KnowledgeNode, KnowledgeEdge
from knowledge_graph.services.auto_classification_service import AutoClassificationService
from ai_assistant.services import TextProcessingService

logger = logging.getLogger(__name__)

class KnowledgeGraphBuilderService:
    """
    知识图谱构建服务
    提供自动构建知识图谱的功能
    """
    
    def __init__(self):
        # 初始化服务（容错：允许在最小测试环境下运行）
        try:
            self.auto_classification_service = AutoClassificationService()
        except Exception as e:
            logger.warning(f"初始化 AutoClassificationService 失败，将按降级路径运行: {e}")
            self.auto_classification_service = None

        try:
            self.text_processing_service = TextProcessingService()
        except Exception as e:
            logger.warning(f"初始化 TextProcessingService 失败，将按降级路径运行: {e}")
            self.text_processing_service = None
    
    def build_graph_from_note(self, note, extract_concepts=True):
        """
        从笔记构建知识图谱
        
        Args:
            note: 笔记对象
            extract_concepts: 是否提取概念
            
        Returns:
            dict: 构建结果
        """
        try:
            user = note.user
            
            # 创建笔记节点
            note_node = self._get_or_create_note_node(note)
            
            # 处理标签
            tag_nodes = []
            for tag in note.tags:
                tag_node = self._get_or_create_tag_node(tag)
                tag_nodes.append(tag_node)
                
                # 创建笔记-标签边
                self._create_edge(note_node, tag_node, 'has_tag', user)
            
            # 处理分类
            category_node = None
            if note.category:
                category_node = self._get_or_create_category_node(note.category)
                
                # 创建笔记-分类边
                self._create_edge(note_node, category_node, 'belongs_to', user)
            
            # 提取概念
            concept_nodes = []
            if extract_concepts:
                concepts = self._extract_concepts_from_note(note)
                
                for concept in concepts:
                    concept_node = self._get_or_create_concept_node(
                        name=concept['name'],
                        description=concept.get('description', ''),
                        user=user
                    )
                    concept_nodes.append(concept_node)
                    
                    # 创建笔记-概念边
                    self._create_edge(
                        note_node, 
                        concept_node, 
                        'mentions', 
                        user,
                        properties={'weight': concept.get('weight', 1.0)}
                    )
            
            # 查找相似笔记
            if self.auto_classification_service is not None:
                similar_notes = self.auto_classification_service.find_similar_notes(note, threshold=0.4, limit=5)
            else:
                similar_notes = []

            # 创建相似笔记的关联
            related_note_nodes = []
            for item in similar_notes:
                similar_note = item['note']
                similarity = item['similarity']
                
                # 获取或创建相似笔记节点
                similar_note_node = self._get_or_create_note_node(similar_note)
                related_note_nodes.append(similar_note_node)
                
                # 创建笔记-笔记边
                self._create_edge(
                    note_node,
                    similar_note_node,
                    'related_to',
                    user,
                    properties={'similarity': similarity}
                )
            
            # 构建结果
            result = {
                'note_node': {
                    'id': str(note_node.id),
                    'title': note_node.title
                },
                'tag_nodes': [{'id': str(node.id), 'name': node.title} for node in tag_nodes],
                'category_node': None,
                'concept_nodes': [{'id': str(node.id), 'name': node.title} for node in concept_nodes],
                'related_note_nodes': [{'id': str(node.id), 'title': node.title} for node in related_note_nodes]
            }
            
            if category_node:
                result['category_node'] = {
                    'id': str(category_node.id),
                    'name': category_node.title
                }
            
            return result
        except Exception as e:
            logger.error(f"从笔记构建知识图谱失败: {e}")
            return {'error': str(e)}
    
    def build_graph_from_notes(self, notes, extract_concepts=True):
        """
        从多个笔记构建知识图谱
        
        Args:
            notes: 笔记列表
            extract_concepts: 是否提取概念
            
        Returns:
            dict: 构建结果
        """
        try:
            results = []
            
            for note in notes:
                result = self.build_graph_from_note(note, extract_concepts)
                if 'error' not in result:
                    results.append(result)
            
            return {'results': results}
        except Exception as e:
            logger.error(f"从多个笔记构建知识图谱失败: {e}")
            return {'error': str(e)}
    
    def build_graph_for_user(self, user, limit=100, extract_concepts=True):
        """
        为用户构建完整知识图谱
        
        Args:
            user: 用户对象
            limit: 处理的笔记数量限制
            extract_concepts: 是否提取概念
            
        Returns:
            dict: 构建结果
        """
        try:
            # 获取用户的笔记
            notes = Note.objects.filter(
                user=user,
                is_deleted=False
            ).order_by('-updated_at')[:limit]
            
            # 构建知识图谱
            result = self.build_graph_from_notes(notes, extract_concepts)
            
            # 分析图谱结构
            node_count = KnowledgeNode.objects.filter(user=user, is_deleted=False).count()
            edge_count = KnowledgeEdge.objects.filter(user=user, is_deleted=False).count()
            
            # 添加统计信息
            result['stats'] = {
                'node_count': node_count,
                'edge_count': edge_count,
                'processed_notes': len(notes)
            }
            
            return result
        except Exception as e:
            logger.error(f"为用户构建知识图谱失败: {e}")
            return {'error': str(e)}
    
    def analyze_note_connections(self, note):
        """
        分析笔记的关联
        
        Args:
            note: 笔记对象
            
        Returns:
            dict: 分析结果
        """
        try:
            user = note.user
            
            # 查找笔记节点
            note_node = KnowledgeNode.objects.filter(
                user=user,
                type='note',
                properties__note_id=str(note.id),
                is_deleted=False
            ).first()
            
            if not note_node:
                # 如果节点不存在，先构建图谱
                self.build_graph_from_note(note)
                
                note_node = KnowledgeNode.objects.filter(
                    user=user,
                    type='note',
                    properties__note_id=str(note.id),
                    is_deleted=False
                ).first()
                
                if not note_node:
                    return {'error': '找不到笔记节点'}
            
            # 查找与笔记相关的边
            outgoing_edges = KnowledgeEdge.objects.filter(
                user=user,
                source=note_node,
                is_deleted=False
            )
            
            incoming_edges = KnowledgeEdge.objects.filter(
                user=user,
                target=note_node,
                is_deleted=False
            )
            
            # 分析关联
            connections = {
                'tags': [],
                'categories': [],
                'concepts': [],
                'related_notes': []
            }
            
            # 处理出边
            for edge in outgoing_edges:
                target = edge.target
                
                if target.type == 'tag':
                    connections['tags'].append({
                        'id': str(target.id),
                        'name': target.title,
                        'relation': edge.type
                    })
                elif target.type == 'category':
                    connections['categories'].append({
                        'id': str(target.id),
                        'name': target.title,
                        'relation': edge.type
                    })
                elif target.type == 'concept':
                    connections['concepts'].append({
                        'id': str(target.id),
                        'name': target.title,
                        'description': target.description,
                        'relation': edge.type,
                        'weight': edge.properties.get('weight', 1.0)
                    })
                elif target.type == 'note':
                    connections['related_notes'].append({
                        'id': str(target.id),
                        'title': target.title,
                        'relation': edge.type,
                        'similarity': edge.properties.get('similarity', 0)
                    })
            
            # 处理入边
            for edge in incoming_edges:
                source = edge.source
                
                if source.type == 'note' and edge.type == 'related_to':
                    connections['related_notes'].append({
                        'id': str(source.id),
                        'title': source.title,
                        'relation': 'related_from',
                        'similarity': edge.properties.get('similarity', 0)
                    })
            
            # 按相关度排序
            connections['related_notes'].sort(key=lambda x: x['similarity'], reverse=True)
            connections['concepts'].sort(key=lambda x: x['weight'], reverse=True)
            
            return connections
        except Exception as e:
            logger.error(f"分析笔记关联失败: {e}")
            return {'error': str(e)}
    
    def suggest_related_content(self, note):
        """
        推荐相关内容
        
        Args:
            note: 笔记对象
            
        Returns:
            dict: 推荐结果
        """
        try:
            # 分析笔记关联
            connections = self.analyze_note_connections(note)
            
            if 'error' in connections:
                return connections
            
            # 提取关键概念
            key_concepts = connections['concepts'][:5]
            
            # 查找与这些概念相关的其他笔记
            related_notes = set()
            for concept in key_concepts:
                concept_node = KnowledgeNode.objects.get(id=uuid.UUID(concept['id']))
                
                # 查找与概念相关的笔记
                concept_edges = KnowledgeEdge.objects.filter(
                    user=note.user,
                    target=concept_node,
                    type='mentions',
                    is_deleted=False
                )
                
                for edge in concept_edges:
                    source = edge.source
                    if source.type == 'note' and source.properties.get('note_id') != str(note.id):
                        note_id = source.properties.get('note_id')
                        if note_id:
                            related_notes.add(note_id)
            
            # 获取笔记对象
            recommended_notes = []
            for note_id in related_notes:
                try:
                    related_note = Note.objects.get(id=uuid.UUID(note_id))
                    recommended_notes.append({
                        'id': str(related_note.id),
                        'title': related_note.title,
                        'updated_at': related_note.updated_at.isoformat()
                    })
                except Note.DoesNotExist:
                    continue
            
            # 按更新时间排序
            recommended_notes.sort(key=lambda x: x['updated_at'], reverse=True)
            
            # 推荐标签
            recommended_tags = []
            for concept in key_concepts:
                # 将概念作为标签推荐
                if len(concept['name']) > 1 and concept['name'] not in [tag['name'] for tag in connections['tags']]:
                    recommended_tags.append(concept['name'])
            
            # 构建结果
            result = {
                'recommended_notes': recommended_notes[:10],
                'recommended_tags': recommended_tags[:5]
            }
            
            return result
        except Exception as e:
            logger.error(f"推荐相关内容失败: {e}")
            return {'error': str(e)}
    
    def _get_or_create_note_node(self, note):
        """
        获取或创建笔记节点
        
        Args:
            note: 笔记对象
            
        Returns:
            KnowledgeNode: 节点对象
        """
        # 查找现有节点
        node = KnowledgeNode.objects.filter(
            user=note.user,
            type='note',
            properties__note_id=str(note.id),
            is_deleted=False
        ).first()
        
        if node:
            # 更新节点
            node.title = note.title
            node.description = note.content[:200] if note.content else ''
            node.updated_at = timezone.now()
            node.save()
            return node
        
        # 创建新节点
        node = KnowledgeNode(
            id=uuid.uuid4(),
            user=note.user,
            title=note.title,
            description=note.content[:200] if note.content else '',
            type='note',
            properties={
                'note_id': str(note.id),
                'created_at': note.created_at.isoformat(),
                'updated_at': note.updated_at.isoformat()
            },
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        node.save()
        
        return node
    
    def _get_or_create_tag_node(self, tag):
        """
        获取或创建标签节点
        
        Args:
            tag: 标签对象
            
        Returns:
            KnowledgeNode: 节点对象
        """
        # 查找现有节点
        node = KnowledgeNode.objects.filter(
            user=tag.user,
            type='tag',
            properties__tag_id=str(tag.id),
            is_deleted=False
        ).first()
        
        if node:
            return node
        
        # 创建新节点
        node = KnowledgeNode(
            id=uuid.uuid4(),
            user=tag.user,
            title=tag.name,
            description=f'标签: {tag.name}',
            type='tag',
            properties={
                'tag_id': str(tag.id),
                'color': tag.color
            },
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        node.save()
        
        return node
    
    def _get_or_create_category_node(self, category):
        """
        获取或创建分类节点
        
        Args:
            category: 分类对象
            
        Returns:
            KnowledgeNode: 节点对象
        """
        # 查找现有节点
        node = KnowledgeNode.objects.filter(
            user=category.user,
            type='category',
            properties__category_id=str(category.id),
            is_deleted=False
        ).first()
        
        if node:
            return node
        
        # 创建新节点
        node = KnowledgeNode(
            id=uuid.uuid4(),
            user=category.user,
            title=category.name,
            description=category.description or f'分类: {category.name}',
            type='category',
            properties={
                'category_id': str(category.id),
                'parent_id': str(category.parent.id) if category.parent else None
            },
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        node.save()
        
        # 如果有父分类，创建父子关系
        if category.parent:
            parent_node = self._get_or_create_category_node(category.parent)
            self._create_edge(parent_node, node, 'has_subcategory', category.user)
        
        return node
    
    def _get_or_create_concept_node(self, name, description, user):
        """
        获取或创建概念节点
        
        Args:
            name: 概念名称
            description: 概念描述
            user: 用户对象
            
        Returns:
            KnowledgeNode: 节点对象
        """
        # 查找现有节点
        node = KnowledgeNode.objects.filter(
            user=user,
            type='concept',
            title=name,
            is_deleted=False
        ).first()
        
        if node:
            # 如果描述为空，更新描述
            if not node.description and description:
                node.description = description
                node.updated_at = timezone.now()
                node.save()
            return node
        
        # 创建新节点
        node = KnowledgeNode(
            id=uuid.uuid4(),
            user=user,
            title=name,
            description=description,
            type='concept',
            properties={},
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        node.save()
        
        return node
    
    def _create_edge(self, source, target, edge_type, user, properties=None):
        """
        创建边
        
        Args:
            source: 源节点
            target: 目标节点
            edge_type: 边类型
            user: 用户对象
            properties: 边属性
            
        Returns:
            KnowledgeEdge: 边对象
        """
        if properties is None:
            properties = {}
        
        # 查找现有边
        edge = KnowledgeEdge.objects.filter(
            user=user,
            source=source,
            target=target,
            type=edge_type,
            is_deleted=False
        ).first()
        
        if edge:
            # 更新属性
            edge.properties.update(properties)
            edge.updated_at = timezone.now()
            edge.save()
            return edge
        
        # 创建新边
        edge = KnowledgeEdge(
            id=uuid.uuid4(),
            user=user,
            source=source,
            target=target,
            type=edge_type,
            label=self._get_edge_label(edge_type),
            properties=properties,
            created_at=timezone.now(),
            updated_at=timezone.now()
        )
        edge.save()
        
        return edge
    
    def _get_edge_label(self, edge_type):
        """
        获取边标签
        
        Args:
            edge_type: 边类型
            
        Returns:
            str: 边标签
        """
        labels = {
            'has_tag': '有标签',
            'belongs_to': '属于',
            'mentions': '提及',
            'related_to': '相关',
            'has_subcategory': '有子分类',
            'is_a': '是一个',
            'part_of': '是...的一部分',
            'has_property': '有属性'
        }
        
        return labels.get(edge_type, edge_type)
    
    def _extract_concepts_from_note(self, note):
        """
        从笔记中提取概念
        
        Args:
            note: 笔记对象
            
        Returns:
            list: 概念列表
        """
        try:
            # 获取笔记内容
            title = note.title
            content = note.content
            
            # 使用AI服务提取概念
            try:
                if self.text_processing_service is None:
                    raise RuntimeError('text_processing_service unavailable')

                result = self.text_processing_service.process_text(
                    text=f"{title}\n\n{content[:2000]}",  # 限制长度，避免请求过大
                    task='extract_concepts'
                )
                
                # 解析结果
                concepts_text = result.get('result', '')
                
                # 尝试解析JSON格式
                import json
                try:
                    concepts = json.loads(concepts_text)
                    if isinstance(concepts, list):
                        return concepts
                except:
                    pass
                
                # 回退到正则表达式解析
                concepts = []
                
                # 匹配格式: 概念名称: 描述
                pattern = r'([^:]+):\s*(.+)'
                matches = re.findall(pattern, concepts_text)
                
                for name, description in matches:
                    concepts.append({
                        'name': name.strip(),
                        'description': description.strip(),
                        'weight': 1.0
                    })
                
                return concepts
            except Exception as e:
                logger.warning(f"使用AI服务提取概念失败: {e}")
                
                # 回退到关键词提取
                if self.auto_classification_service is not None:
                    keywords = self.auto_classification_service.extract_keywords(content, title, 10)
                else:
                    # 最小可运行降级：基于分词频次抽取关键词
                    import jieba
                    from collections import Counter
                    tokens = [w.strip() for w in jieba.lcut(f"{title} {content}") if len(w.strip()) >= 2]
                    keywords = [w for w, _ in Counter(tokens).most_common(10)]

                concepts = []
                for keyword in keywords:
                    concepts.append({
                        'name': keyword,
                        'description': '',
                        'weight': 1.0
                    })
                
                return concepts
        except Exception as e:
            logger.error(f"提取概念失败: {e}")
            return []
