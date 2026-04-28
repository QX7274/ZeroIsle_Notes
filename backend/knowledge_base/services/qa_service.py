"""
知识库问答服务
提供基于知识库的智能问答功能
"""

import logging
import uuid
from django.utils import timezone
from typing import List, Dict, Optional

from knowledge_base.mongodb_models import KnowledgeBase, KnowledgeBaseQuery
from knowledge_graph.mongodb_models import KnowledgeNode, KnowledgeEdge
from ai_assistant.services import AIAssistantService
from search.services import SearchService

logger = logging.getLogger(__name__)


class KnowledgeBaseQAService:
    """
    知识库问答服务
    基于知识库内容回答用户问题
    """
    
    def __init__(self):
        """初始化服务"""
        self.ai_service = AIAssistantService()
        self.search_service = SearchService()
    
    def ask_question(self, kb_id: uuid.UUID, user, question: str,
                    context_limit: int = 5, snippets: Optional[List[Dict]] = None) -> Dict:
        """
        向知识库提问
        
        Args:
            kb_id: 知识库ID
            user: 用户对象
            question: 问题
            context_limit: 上下文节点数量限制
            
        Returns:
            Dict: 问答结果
        """
        try:
            kb = KnowledgeBase.objects.get(id=kb_id)
            
            # 1. 若前端提供 snippets（本地TopK片段），优先使用；否则后端基于节点做简单召回
            citations_meta: List[Dict] = []
            if snippets:
                # 构造上下文与引用
                parts = []
                for i, sn in enumerate(snippets, 1):
                    text = (sn.get('text') or '')[:1000]
                    src = sn.get('source', {})
                    parts.append(f"[片段 {i}]\n{text}")
                    citations_meta.append({
                        'title': src.get('title') or f'片段{i}',
                        'anchor': src.get('anchor'),
                        'kind': src.get('type') or 'snippet',
                        'uri': src.get('uri'),
                        'score': None,
                    })
                context = "\n\n".join(parts)
                relevant_nodes = []
            else:
                relevant_nodes = self._search_relevant_nodes(kb_id, question, limit=context_limit)
                if not relevant_nodes:
                    return {
                        'success': True,
                        'response': { 'answer': '抱歉，在知识库中没有找到与您的问题相关的内容。' },
                        'confidence': 0.0,
                        'related_nodes': []
                    }
                context = self._build_context(relevant_nodes)
                citations_meta = [
                    {
                        'title': n['title'],
                        'anchor': None,
                        'kind': n.get('type') or 'node',
                        'score': n.get('relevance'),
                    } for n in relevant_nodes
                ]

            # 2. 使用AI生成答案
            answer_result = self._generate_answer(question, context, kb.name)

            # 3. 保存查询记录
            query_record = KnowledgeBaseQuery(
                id=uuid.uuid4(),
                knowledge_base=kb,
                user=user,
                question=question,
                answer=answer_result['answer'],
                related_nodes=[node['id'] for node in relevant_nodes],
                created_at=timezone.now()
            )
            query_record.save()
            
            result = {
                'success': True,
                'query_id': str(query_record.id),
                'response': {
                    'answer': answer_result['answer'],
                    'citations': citations_meta,
                },
                'confidence': answer_result.get('confidence', 0.8),
                'related_nodes': [
                    {
                        'id': str(node['id']),
                        'title': node['title'],
                        'type': node['type'],
                        'relevance': node.get('relevance', 0.0)
                    }
                    for node in relevant_nodes
                ],
            }
            
            logger.info(f"知识库问答成功: {kb.name}, 问题: {question[:50]}")
            return result
            
        except KnowledgeBase.DoesNotExist:
            logger.error(f"知识库不存在: {kb_id}")
            return {'success': False, 'error': '知识库不存在'}
        except Exception as e:
            logger.error(f"知识库问答失败: {e}")
            return {'success': False, 'error': str(e)}
    
    def rate_answer(self, query_id: uuid.UUID, rating: int, feedback: str = '') -> bool:
        """
        对答案进行评分
        
        Args:
            query_id: 查询ID
            rating: 评分 (1-5)
            feedback: 反馈文本
            
        Returns:
            bool: 是否评分成功
        """
        try:
            query = KnowledgeBaseQuery.objects.get(id=query_id)
            query.rating = rating
            query.feedback = feedback
            query.save()
            
            logger.info(f"答案评分成功: {query_id}, 评分: {rating}")
            return True
            
        except KnowledgeBaseQuery.DoesNotExist:
            logger.error(f"查询记录不存在: {query_id}")
            return False
        except Exception as e:
            logger.error(f"答案评分失败: {e}")
            return False
    
    def get_query_history(self, kb_id: uuid.UUID, user, limit: int = 20) -> List[Dict]:
        """
        获取查询历史
        
        Args:
            kb_id: 知识库ID
            user: 用户对象
            limit: 返回数量限制
            
        Returns:
            List[Dict]: 查询历史列表
        """
        try:
            queries = KnowledgeBaseQuery.objects.filter(
                knowledge_base=kb_id,
                user=user
            ).order_by('-created_at')[:limit]
            
            history = [
                {
                    'id': str(query.id),
                    'question': query.question,
                    'answer': query.answer,
                    'rating': query.rating,
                    'created_at': query.created_at.isoformat()
                }
                for query in queries
            ]
            
            return history
            
        except Exception as e:
            logger.error(f"获取查询历史失败: {e}")
            return []
    
    def _search_relevant_nodes(self, kb_id: uuid.UUID, question: str, 
                              limit: int = 5) -> List[Dict]:
        """搜索相关节点"""
        # 获取知识库中的所有节点
        nodes = KnowledgeNode.objects.filter(
            properties__knowledge_base_id=str(kb_id),
            is_deleted=False
        )
        
        # 使用简单的关键词匹配计算相关度
        import jieba
        question_words = set(jieba.cut(question))
        
        node_scores = []
        for node in nodes:
            # 计算节点与问题的相关度
            node_text = f"{node.title} {node.description}"
            node_words = set(jieba.cut(node_text))
            
            # 计算交集
            common_words = question_words & node_words
            if common_words:
                # 相关度 = 共同词数 / 问题词数
                relevance = len(common_words) / len(question_words)
                
                node_scores.append({
                    'id': node.id,
                    'title': node.title,
                    'description': node.description,
                    'type': node.type,
                    'properties': node.properties,
                    'relevance': relevance
                })
        
        # 按相关度排序
        node_scores.sort(key=lambda x: x['relevance'], reverse=True)
        
        return node_scores[:limit]
    
    def _build_context(self, nodes: List[Dict]) -> str:
        """构建上下文文本"""
        context_parts = []
        
        for i, node in enumerate(nodes, 1):
            context_parts.append(f"[知识点 {i}]")
            context_parts.append(f"标题: {node['title']}")
            
            if node.get('description'):
                context_parts.append(f"内容: {node['description']}")
            
            # 如果有完整内容，也添加进来
            full_content = node.get('properties', {}).get('full_content', '')
            if full_content:
                context_parts.append(f"详细内容: {full_content[:500]}")  # 限制长度
            
            context_parts.append("")  # 空行分隔
        
        return "\n".join(context_parts)
    
    def _generate_answer(self, question: str, context: str, kb_name: str) -> Dict:
        """使用AI生成答案"""
        try:
            # 构建提示词
            prompt = f"""你是一个知识库助手，正在帮助用户从"{kb_name}"知识库中查找信息。

用户问题：
{question}

相关知识库内容：
{context}

请基于以上知识库内容，用简洁、准确的语言回答用户的问题。如果知识库内容不足以完全回答问题，请说明这一点，并提供你能从内容中推断出的信息。

回答："""
            
            # 调用AI服务
            response = self.ai_service.chat(
                messages=[
                    {'role': 'system', 'content': '你是一个专业的知识库助手，擅长从结构化知识中提取和组织信息。'},
                    {'role': 'user', 'content': prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            answer = response.get('content', '抱歉，无法生成答案。')
            
            return {
                'answer': answer,
                'confidence': 0.8  # 可以根据实际情况调整
            }
            
        except Exception as e:
            logger.error(f"生成答案失败: {e}")
            # 回退到简单的答案
            return {
                'answer': f"根据知识库内容，我找到了以下相关信息：\n\n{context[:500]}",
                'confidence': 0.5
            }

