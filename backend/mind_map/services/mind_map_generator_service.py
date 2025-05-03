"""
思维导图生成服务
提供从文本内容自动生成思维导图的功能
"""

import logging
import re
import uuid
from typing import Dict, List, Any, Optional
from django.utils import timezone

from mind_map.mongodb_models import MindMap, MindMapNode, MindMapEdge
from notes.mongodb_models import Note
from ai_assistant.services import TextProcessingService

logger = logging.getLogger(__name__)

class MindMapGeneratorService:
    """思维导图生成服务"""

    def __init__(self):
        """初始化服务"""
        self.text_processing_service = TextProcessingService()

    def generate_from_text(self, text: str, user, title: str = None, options: Dict = None) -> Dict:
        """
        从文本生成思维导图

        Args:
            text: 源文本
            user: 用户对象
            title: 思维导图标题（可选）
            options: 生成选项

        Returns:
            生成的思维导图数据
        """
        try:
            if not text:
                raise ValueError("文本内容不能为空")

            # 设置默认选项
            if options is None:
                options = {}

            layout_type = options.get('layout_type', 'tree')
            theme = options.get('theme', 'default')
            max_depth = options.get('max_depth', 3)
            max_children = options.get('max_children', 7)

            # 如果文本较短，直接使用简单解析
            if len(text) < 500:
                mind_map_data = self._parse_text_simple(text, max_depth, max_children)
            else:
                # 使用AI服务生成思维导图结构
                mind_map_data = self._generate_with_ai(text, max_depth, max_children)

            # 创建思维导图对象
            mind_map = MindMap(
                id=str(uuid.uuid4()),
                user=user,
                title=title or "思维导图",
                description=f"从文本自动生成的思维导图",
                layout_type=layout_type,
                theme=theme,
                nodes=[],
                edges=[],
                created_at=timezone.now(),
                updated_at=timezone.now()
            )

            # 添加节点和边
            self._build_mind_map_structure(mind_map, mind_map_data)

            # 保存思维导图
            mind_map.save()

            return {
                'id': mind_map.id,
                'title': mind_map.title,
                'nodes': [self._node_to_dict(node) for node in mind_map.nodes],
                'edges': [self._edge_to_dict(edge) for edge in mind_map.edges]
            }
        except Exception as e:
            logger.error(f"生成思维导图失败: {e}")
            raise

    def generate_from_note(self, note_id: str, user, options: Dict = None) -> Dict:
        """
        从笔记生成思维导图

        Args:
            note_id: 笔记ID
            user: 用户对象
            options: 生成选项

        Returns:
            生成的思维导图数据
        """
        try:
            # 获取笔记
            note = Note.objects.get(id=note_id, user=user)

            # 生成思维导图
            result = self.generate_from_text(
                text=note.content,
                user=user,
                title=f"{note.title} - 思维导图",
                options=options
            )

            # 更新关联笔记ID
            mind_map = MindMap.objects.get(id=result['id'])
            mind_map.note_id = note_id
            mind_map.save()

            return result
        except Note.DoesNotExist:
            logger.error(f"笔记不存在: {note_id}")
            raise ValueError(f"笔记不存在: {note_id}")
        except Exception as e:
            logger.error(f"从笔记生成思维导图失败: {e}")
            raise

    def _parse_text_simple(self, text: str, max_depth: int = 3, max_children: int = 7) -> Dict:
        """
        简单解析文本生成思维导图结构

        Args:
            text: 源文本
            max_depth: 最大深度
            max_children: 每个节点的最大子节点数

        Returns:
            思维导图结构数据
        """
        # 清理文本
        text = text.strip()

        # 按段落分割
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]

        # 提取标题作为根节点
        root_title = paragraphs[0] if paragraphs else "思维导图"
        if len(root_title) > 50:
            root_title = root_title[:47] + "..."

        # 创建根节点
        root_node = {
            'id': str(uuid.uuid4()),
            'title': root_title,
            'children': []
        }

        # 处理段落作为一级节点
        for i, paragraph in enumerate(paragraphs[1:max_children+1]):
            # 提取段落第一句作为节点标题
            sentences = re.split(r'[.。!！?？;；]', paragraph)
            title = sentences[0].strip() if sentences else f"节点 {i+1}"
            if len(title) > 30:
                title = title[:27] + "..."

            # 创建一级节点
            child_node = {
                'id': str(uuid.uuid4()),
                'title': title,
                'content': paragraph,
                'children': []
            }

            # 处理段落中的句子作为二级节点
            if max_depth > 1:
                for j, sentence in enumerate(sentences[1:max_children+1]):
                    if sentence.strip():
                        # 创建二级节点
                        grandchild_node = {
                            'id': str(uuid.uuid4()),
                            'title': sentence.strip(),
                            'children': []
                        }
                        child_node['children'].append(grandchild_node)

            root_node['children'].append(child_node)

        return root_node

    def _generate_with_ai(self, text: str, max_depth: int = 3, max_children: int = 7) -> Dict:
        """
        使用AI服务生成思维导图结构 - 增强版

        改进：
        1. 更智能的文本预处理和摘要
        2. 优化提示词，提高生成质量
        3. 增强错误处理和回退机制
        4. 添加节点关系和层级优化

        Args:
            text: 源文本
            max_depth: 最大深度
            max_children: 每个节点的最大子节点数

        Returns:
            思维导图结构数据
        """
        try:
            # 文本预处理 - 增强版
            # 1. 移除多余空白和特殊字符
            cleaned_text = re.sub(r'\s+', ' ', text).strip()
            cleaned_text = re.sub(r'[^\w\s\u4e00-\u9fff.,;:!?，。；：！？《》""''()（）\[\]【】]', '', cleaned_text)

            # 2. 智能文本截取
            if len(cleaned_text) > 4000:
                # 首先尝试提取关键段落
                paragraphs = re.split(r'\n+', cleaned_text)

                # 提取可能包含重要信息的段落
                important_paragraphs = []

                # 添加第一段（通常包含介绍或摘要）
                if paragraphs and len(paragraphs[0]) > 20:
                    important_paragraphs.append(paragraphs[0])

                # 查找包含关键词的段落
                keywords = ['总结', '概述', '结论', '重点', '关键', '核心', '主要', '特点', '特征', '定义']
                for paragraph in paragraphs:
                    if any(keyword in paragraph for keyword in keywords) and len(paragraph) > 20:
                        important_paragraphs.append(paragraph)

                # 如果找到了重要段落，使用它们
                if len(important_paragraphs) >= 3:
                    # 限制每个段落的长度
                    max_para_length = 800
                    limited_paragraphs = [p[:max_para_length] for p in important_paragraphs[:5]]
                    text_for_ai = "\n\n".join(limited_paragraphs)
                else:
                    # 否则使用文本的不同部分
                    text_for_ai = (
                        cleaned_text[:1200] +
                        "\n...\n" +
                        cleaned_text[len(cleaned_text)//2-600:len(cleaned_text)//2+600] +
                        "\n...\n" +
                        cleaned_text[-1200:]
                    )
            else:
                text_for_ai = cleaned_text

            # 构建增强版提示词
            prompt = f"""
            请将以下文本内容整理为结构清晰、层次分明的思维导图，以JSON格式返回。

            详细要求：
            1. 核心要点：
               - 提取最核心的主题作为根节点，确保能概括整个文本的核心内容
               - 最多{max_depth}层深度，层级结构必须清晰合理
               - 每个节点最多{max_children}个子节点，确保子节点之间有明确的区分和逻辑关系

            2. 节点设计：
               - 节点标题简洁明了，不超过30个字符
               - 同级节点应该属于同一类别或主题，保持概念层级的一致性
               - 节点之间应有明确的从属或并列关系
               - 为关键节点添加"content"属性，包含该节点的详细解释或补充信息

            3. 节点类型：
               - 为特别重要的节点添加"type":"important"属性
               - 为包含定义或解释的节点添加"type":"note"属性
               - 为包含数据或统计信息的节点添加"type":"data"属性
               - 为包含结论或总结的节点添加"type":"conclusion"属性

            4. 结构优化：
               - 确保思维导图结构平衡，避免某一分支过深或过浅
               - 相关概念应该放在相邻位置或同一分支下
               - 概念应该从抽象到具体，从整体到部分有序排列
               - 确保每个分支的逻辑完整性和独立性

            JSON格式示例：
            {{
                "id": "root",
                "title": "核心主题",
                "content": "对核心主题的简要说明",
                "children": [
                    {{
                        "id": "1",
                        "title": "一级主题1",
                        "type": "important",
                        "content": "重要的一级主题说明",
                        "children": [
                            {{
                                "id": "1-1",
                                "title": "二级主题1-1",
                                "type": "note",
                                "content": "这是一个解释性内容",
                                "children": []
                            }},
                            {{
                                "id": "1-2",
                                "title": "二级主题1-2",
                                "type": "data",
                                "content": "包含数据的内容",
                                "children": []
                            }}
                        ]
                    }},
                    {{
                        "id": "2",
                        "title": "一级主题2",
                        "type": "conclusion",
                        "content": "总结性内容",
                        "children": []
                    }}
                ]
            }}

            文本内容：
            {text_for_ai}

            请确保返回的JSON格式正确，不要包含任何额外的解释或说明。
            """

            # 调用AI服务 - 使用更专业的系统提示词
            response = self.text_processing_service.process_text(
                text=prompt,
                task='custom',
                system_prompt="""你是一个专业的思维导图生成专家，擅长将复杂文本内容提炼为结构化的思维导图。
                你具有以下专业能力：
                1. 精准识别文本的核心主题和关键概念
                2. 构建逻辑严密、层次分明的知识结构
                3. 提取文本中的重要信息并合理分类
                4. 确保概念间的关系清晰且有意义

                在生成思维导图时，你会：
                1. 首先理解文本的整体内容和核心主旨
                2. 识别主要概念和次要概念，建立层级关系
                3. 确保每个节点都简洁明了地表达一个概念
                4. 保证节点之间的逻辑关联性和层级合理性
                5. 为不同类型的信息设置适当的节点类型

                你只返回格式正确的JSON数据，不包含任何其他解释或说明。
                """
            )

            # 解析JSON结果 - 增强错误处理
            import json
            try:
                # 尝试直接解析
                try:
                    result = json.loads(response['result'])
                except json.JSONDecodeError:
                    # 如果直接解析失败，尝试提取JSON部分
                    # 使用更强大的正则表达式匹配JSON
                    json_match = re.search(r'```json\s*([\s\S]*?)\s*```|```\s*([\s\S]*?)\s*```|({[\s\S]*})', response['result'])
                    if json_match:
                        # 获取匹配到的组中非None的值
                        json_str = next(filter(None, json_match.groups()))
                        result = json.loads(json_str)
                    else:
                        # 尝试修复常见的JSON错误
                        fixed_json = self._attempt_json_fix(response['result'])
                        if fixed_json:
                            result = json.loads(fixed_json)
                        else:
                            raise json.JSONDecodeError("无法提取或修复JSON", response['result'], 0)

                # 确保每个节点都有唯一ID
                self._ensure_node_ids(result)

                # 确保节点结构完整
                self._validate_and_fix_node_structure(result, max_depth, max_children)

                # 优化思维导图结构
                self._optimize_mind_map_structure(result, max_depth, max_children)

                return result
            except json.JSONDecodeError as e:
                logger.warning(f"AI返回的结果不是有效的JSON格式: {e}")
                # 回退到简单解析
                return self._parse_text_simple(text, max_depth, max_children)
        except Exception as e:
            logger.error(f"使用AI生成思维导图失败: {e}")
            # 回退到简单解析
            return self._parse_text_simple(text, max_depth, max_children)

    def _attempt_json_fix(self, text: str) -> Optional[str]:
        """
        尝试修复常见的JSON格式错误

        Args:
            text: 可能包含JSON的文本

        Returns:
            修复后的JSON字符串，如果无法修复则返回None
        """
        try:
            # 1. 尝试提取可能的JSON部分
            # 查找第一个{和最后一个}
            start_idx = text.find('{')
            end_idx = text.rfind('}')

            if start_idx == -1 or end_idx == -1 or start_idx > end_idx:
                return None

            json_text = text[start_idx:end_idx+1]

            # 2. 修复常见错误
            # 修复未转义的引号
            json_text = re.sub(r'(?<!\\)"(?=.*?[^\\]")', r'\"', json_text)

            # 修复缺少逗号的问题
            json_text = re.sub(r'}\s*{', '},{', json_text)

            # 修复多余的逗号
            json_text = re.sub(r',\s*}', '}', json_text)
            json_text = re.sub(r',\s*]', ']', json_text)

            # 尝试解析修复后的JSON
            import json
            json.loads(json_text)

            return json_text
        except Exception:
            return None

    def _optimize_mind_map_structure(self, node: Dict, max_depth: int = 3, max_children: int = 7, current_depth: int = 0) -> None:
        """
        优化思维导图结构，确保平衡和逻辑性

        Args:
            node: 节点数据
            max_depth: 最大深度
            max_children: 每个节点的最大子节点数
            current_depth: 当前深度
        """
        # 如果超过最大深度，将子节点移到当前节点
        if current_depth >= max_depth and 'children' in node and node['children']:
            # 将子节点的内容合并到当前节点
            child_contents = []
            for child in node['children']:
                if 'title' in child:
                    child_contents.append(child['title'])

            if child_contents:
                node['content'] = (node.get('content', '') + ' - ' +
                                  '; '.join(child_contents)).strip()

            # 清空子节点
            node['children'] = []
            return

        # 如果子节点过多，合并相似节点或保留最重要的节点
        if 'children' in node and len(node['children']) > max_children:
            # 按重要性排序子节点
            def get_node_importance(child):
                # 重要节点优先
                if child.get('type') == 'important':
                    return 3
                # 有内容的节点其次
                elif 'content' in child and child['content']:
                    return 2
                # 有子节点的节点再次
                elif 'children' in child and child['children']:
                    return 1
                # 普通节点最后
                else:
                    return 0

            # 排序子节点
            node['children'].sort(key=get_node_importance, reverse=True)

            # 保留前max_children个节点
            node['children'] = node['children'][:max_children]

        # 递归处理子节点
        if 'children' in node:
            for child in node['children']:
                self._optimize_mind_map_structure(child, max_depth, max_children, current_depth + 1)

    def _validate_and_fix_node_structure(self, node: Dict, max_depth: int = 3, max_children: int = 7, current_depth: int = 0) -> None:
        """
        验证并修复节点结构 - 增强版

        Args:
            node: 节点数据
            max_depth: 最大深度
            max_children: 每个节点的最大子节点数
            current_depth: 当前深度
        """
        # 确保节点有标题
        if 'title' not in node or not node['title']:
            node['title'] = '未命名节点'

        # 确保标题不超过30个字符
        if len(node['title']) > 30:
            node['title'] = node['title'][:27] + '...'

        # 确保内容字段存在
        if 'content' not in node:
            node['content'] = ''

        # 如果内容太长，截断它
        if len(node.get('content', '')) > 500:
            node['content'] = node['content'][:497] + '...'

        # 确保有children字段
        if 'children' not in node:
            node['children'] = []

        # 如果超过最大深度，不再递归
        if current_depth >= max_depth:
            return

        # 如果子节点过多，只保留前max_children个
        if len(node['children']) > max_children:
            node['children'] = node['children'][:max_children]

        # 递归处理子节点
        for child in node['children']:
            self._validate_and_fix_node_structure(child, max_depth, max_children, current_depth + 1)

    def _ensure_node_ids(self, node: Dict) -> None:
        """
        确保每个节点都有唯一ID

        Args:
            node: 节点数据
        """
        if 'id' not in node or not node['id']:
            node['id'] = str(uuid.uuid4())

        if 'children' in node:
            for child in node['children']:
                self._ensure_node_ids(child)

    def _build_mind_map_structure(self, mind_map: MindMap, node_data: Dict, parent_id: str = None, level: int = 0) -> None:
        """
        构建思维导图结构

        Args:
            mind_map: 思维导图对象
            node_data: 节点数据
            parent_id: 父节点ID
            level: 当前层级
        """
        # 创建节点
        node = MindMapNode(
            id=node_data['id'],
            parent_id=parent_id,
            title=node_data['title'],
            content=node_data.get('content', ''),
            note=node_data.get('note', ''),
            color=self._get_color_by_level(level),
            shape='rectangle',
            font_size=self._get_font_size_by_level(level),
            font_weight='bold' if level == 0 else 'normal',
            order=0,
            is_collapsed=False,
            created_at=timezone.now(),
            updated_at=timezone.now()
        )

        # 添加节点
        mind_map.nodes.append(node)

        # 如果有父节点，创建边
        if parent_id:
            edge = MindMapEdge(
                id=str(uuid.uuid4()),
                source_id=parent_id,
                target_id=node.id,
                style='solid',
                color=self._get_color_by_level(level),
                width=1.0,
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            mind_map.edges.append(edge)

        # 处理子节点
        if 'children' in node_data:
            for i, child_data in enumerate(node_data['children']):
                child_data['order'] = i
                self._build_mind_map_structure(mind_map, child_data, node.id, level + 1)

    def _get_color_by_level(self, level: int) -> str:
        """
        根据层级获取颜色

        Args:
            level: 层级

        Returns:
            颜色代码
        """
        colors = [
            '#1f77b4',  # 蓝色
            '#ff7f0e',  # 橙色
            '#2ca02c',  # 绿色
            '#d62728',  # 红色
            '#9467bd',  # 紫色
            '#8c564b',  # 棕色
            '#e377c2',  # 粉色
            '#7f7f7f',  # 灰色
            '#bcbd22',  # 黄绿色
            '#17becf'   # 青色
        ]
        return colors[level % len(colors)]

    def _get_font_size_by_level(self, level: int) -> int:
        """
        根据层级获取字体大小

        Args:
            level: 层级

        Returns:
            字体大小
        """
        sizes = [18, 16, 14, 12, 12]
        return sizes[min(level, len(sizes) - 1)]

    def _node_to_dict(self, node: MindMapNode) -> Dict:
        """
        将节点对象转换为字典

        Args:
            node: 节点对象

        Returns:
            节点字典
        """
        return {
            'id': node.id,
            'parent_id': node.parent_id,
            'title': node.title,
            'content': node.content,
            'note': node.note,
            'color': node.color,
            'shape': node.shape,
            'font_size': node.font_size,
            'font_weight': node.font_weight,
            'x': node.x,
            'y': node.y,
            'order': node.order,
            'is_collapsed': node.is_collapsed
        }

    def _edge_to_dict(self, edge: MindMapEdge) -> Dict:
        """
        将边对象转换为字典

        Args:
            edge: 边对象

        Returns:
            边字典
        """
        return {
            'id': edge.id,
            'source': edge.source_id,
            'target': edge.target_id,
            'style': edge.style,
            'color': edge.color,
            'width': edge.width,
            'label': edge.label
        }
