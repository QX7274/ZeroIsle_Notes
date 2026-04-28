"""
文本处理服务
"""

import logging
import openai
from django.conf import settings

logger = logging.getLogger('backend')


class TextProcessingService:
    """
    文本处理服务类
    提供文本处理相关功能
    """
    
    def __init__(self):
        """初始化"""
        self.api_key = settings.OPENAI_API_KEY
        openai.api_key = self.api_key
    
    def generate_meeting_summary(self, text, summary_type='detailed', language='zh', segments=None):
        """
        生成会议纪要 - 增强版

        Args:
            text: 会议转录文本
            summary_type: 摘要类型 (detailed, brief, action_focused)
            language: 输出语言 (zh, en)
            segments: 时间戳分段信息（可选）

        Returns:
            dict: 会议纪要结果
        """
        try:
            # 根据摘要类型构建不同的提示词
            if summary_type == 'brief':
                task_description = "生成一份简洁的会议摘要，突出最重要的内容"
            elif summary_type == 'action_focused':
                task_description = "重点关注会议中的行动项、任务分配和决策"
            else:  # detailed
                task_description = "生成一份详细的会议纪要"

            # 构建提示词
            if language == 'en':
                prompt = f"""
                Please {task_description} based on the following meeting transcript, including:
                1. Meeting Summary: Brief overview of the main content and purpose
                2. Key Points: Main viewpoints and decisions discussed
                3. Action Items: Tasks, assignees, and deadlines
                4. Participants: All participants mentioned
                5. Decisions: Important decisions made
                6. Topics: Main topics discussed

                Meeting Transcript:
                {text}
                """
                system_content = "You are a professional meeting minutes assistant, skilled at extracting key information from meeting transcripts and generating structured meeting minutes."
            else:
                prompt = f"""
                请{task_description}，根据以下会议转录内容，包括以下部分：
                1. 会议摘要：简要概括会议的主要内容和目的
                2. 关键要点：列出会议中讨论的主要观点和决定
                3. 行动项：列出会议中确定的任务、负责人和截止日期
                4. 参会人员：识别会议中提到的所有参与者
                5. 决策事项：列出会议中做出的重要决定
                6. 讨论主题：列出会议讨论的主要话题

                会议转录内容：
                {text}
                """
                system_content = "你是一个专业的会议纪要生成助手，擅长从会议转录中提取关键信息并生成结构化的会议纪要。"

            # 调用GPT生成会议纪要
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo-16k",  # 使用更大的上下文窗口
                messages=[
                    {"role": "system", "content": system_content},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=2000
            )

            # 解析生成的会议纪要
            summary_text = response.choices[0].message.content

            # 提取各部分内容
            summary = ""
            key_points = []
            action_items = []
            participants = []
            decisions = []
            topics = []

            # 解析结构化内容
            sections = summary_text.split('\n\n')
            for section in sections:
                section_lower = section.lower()

                if '会议摘要' in section or '摘要' in section or 'meeting summary' in section_lower or 'summary' in section_lower:
                    lines = section.split('\n')
                    if len(lines) > 1:
                        summary = '\n'.join(lines[1:]).strip()
                    elif '：' in section or ':' in section:
                        summary = section.split('：' if '：' in section else ':', 1)[1].strip()

                elif '关键' in section or '要点' in section or 'key points' in section_lower:
                    points = section.split('\n')
                    for point in points[1:]:
                        if point.strip() and any(marker in point for marker in ['•', '-', '*', '.']):
                            cleaned = point.strip()
                            for marker in ['•', '-', '*']:
                                cleaned = cleaned.lstrip(marker).strip()
                            if cleaned and cleaned[0].isdigit():
                                cleaned = cleaned.split('.', 1)[1].strip() if '.' in cleaned else cleaned
                            if cleaned:
                                key_points.append(cleaned)

                elif '行动项' in section or '任务' in section or 'action items' in section_lower:
                    items = section.split('\n')
                    for item in items[1:]:
                        if item.strip() and any(marker in item for marker in ['•', '-', '*', '.']):
                            cleaned = item.strip()
                            for marker in ['•', '-', '*']:
                                cleaned = cleaned.lstrip(marker).strip()
                            if cleaned and cleaned[0].isdigit():
                                cleaned = cleaned.split('.', 1)[1].strip() if '.' in cleaned else cleaned
                            if cleaned:
                                action_items.append(cleaned)

                elif '参会人员' in section or '参与者' in section or 'participants' in section_lower:
                    people = section.split('\n')
                    for person in people[1:]:
                        if person.strip() and any(marker in person for marker in ['•', '-', '*', '.']):
                            cleaned = person.strip()
                            for marker in ['•', '-', '*']:
                                cleaned = cleaned.lstrip(marker).strip()
                            if cleaned and cleaned[0].isdigit():
                                cleaned = cleaned.split('.', 1)[1].strip() if '.' in cleaned else cleaned
                            if cleaned:
                                participants.append(cleaned)

                elif '决策' in section or 'decisions' in section_lower:
                    items = section.split('\n')
                    for item in items[1:]:
                        if item.strip() and any(marker in item for marker in ['•', '-', '*', '.']):
                            cleaned = item.strip()
                            for marker in ['•', '-', '*']:
                                cleaned = cleaned.lstrip(marker).strip()
                            if cleaned and cleaned[0].isdigit():
                                cleaned = cleaned.split('.', 1)[1].strip() if '.' in cleaned else cleaned
                            if cleaned:
                                decisions.append(cleaned)

                elif '主题' in section or '话题' in section or 'topics' in section_lower:
                    items = section.split('\n')
                    for item in items[1:]:
                        if item.strip() and any(marker in item for marker in ['•', '-', '*', '.']):
                            cleaned = item.strip()
                            for marker in ['•', '-', '*']:
                                cleaned = cleaned.lstrip(marker).strip()
                            if cleaned and cleaned[0].isdigit():
                                cleaned = cleaned.split('.', 1)[1].strip() if '.' in cleaned else cleaned
                            if cleaned:
                                topics.append(cleaned)

            return {
                'summary': summary,
                'key_points': key_points,
                'action_items': action_items,
                'participants': participants,
                'decisions': decisions,
                'topics': topics,
                'full_text': summary_text
            }

        except Exception as e:
            logger.error(f"生成会议纪要失败: {e}")
            return {
                'error': str(e),
                'summary': '',
                'key_points': [],
                'action_items': [],
                'participants': [],
                'decisions': [],
                'topics': []
            }
