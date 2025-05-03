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
    
    def generate_meeting_summary(self, text):
        """
        生成会议纪要
        
        Args:
            text: 会议转录文本
            
        Returns:
            dict: 会议纪要结果
        """
        try:
            # 构建提示词
            prompt = f"""
            请根据以下会议转录内容，生成一份详细的会议纪要，包括以下部分：
            1. 会议摘要：简要概括会议的主要内容和目的
            2. 关键点：列出会议中讨论的主要观点和决定
            3. 行动项：列出会议中确定的任务、负责人和截止日期
            4. 参会人员：识别会议中提到的所有参与者

            会议转录内容：
            {text}
            """
            
            # 调用GPT生成会议纪要
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "你是一个专业的会议纪要生成助手，擅长从会议转录中提取关键信息并生成结构化的会议纪要。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=1500
            )
            
            # 解析生成的会议纪要
            summary_text = response.choices[0].message.content
            
            # 提取各部分内容
            summary = ""
            key_points = []
            action_items = []
            participants = []
            
            # 简单解析（实际项目中可能需要更复杂的解析逻辑）
            sections = summary_text.split('\n\n')
            for section in sections:
                if '会议摘要' in section or '摘要' in section:
                    summary = section.split('：', 1)[1].strip() if '：' in section else section
                elif '关键点' in section or '要点' in section:
                    points = section.split('\n')
                    for point in points[1:]:  # 跳过标题行
                        if point.strip() and ('•' in point or '-' in point or '.' in point):
                            key_points.append(point.strip().lstrip('•').lstrip('-').lstrip('.').strip())
                elif '行动项' in section or '任务' in section:
                    items = section.split('\n')
                    for item in items[1:]:  # 跳过标题行
                        if item.strip() and ('•' in item or '-' in item or '.' in item):
                            action_items.append(item.strip().lstrip('•').lstrip('-').lstrip('.').strip())
                elif '参会人员' in section or '参与者' in section:
                    people = section.split('\n')
                    for person in people[1:]:  # 跳过标题行
                        if person.strip() and ('•' in person or '-' in person or '.' in person):
                            participants.append(person.strip().lstrip('•').lstrip('-').lstrip('.').strip())
            
            return {
                'summary': summary,
                'key_points': key_points,
                'action_items': action_items,
                'participants': participants,
                'full_text': summary_text
            }
            
        except Exception as e:
            logger.error(f"生成会议纪要失败: {e}")
            return {
                'error': str(e),
                'summary': '',
                'key_points': [],
                'action_items': [],
                'participants': []
            }
