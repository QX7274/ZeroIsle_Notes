"""
语音命令服务
"""

import logging
import re
import openai
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger('backend')


class VoiceCommandService:
    """
    语音命令服务类
    处理语音命令的识别和执行
    """

    def __init__(self):
        """初始化"""
        self.api_key = settings.OPENAI_API_KEY
        openai.api_key = self.api_key

        # 定义命令模式
        self.command_patterns = {
            'search': r'搜索|查找|查询',
            'create_note': r'创建笔记|新建笔记|添加笔记',
            'open_note': r'打开笔记|查看笔记',
            'set_reminder': r'设置提醒|添加提醒|创建提醒',
            'add_tag': r'添加标签|设置标签',
            'navigate': r'跳转到|前往|打开|进入',
        }

    def process_command(self, user, command_text):
        """
        处理语音命令

        Args:
            user: 用户对象
            command_text: 命令文本

        Returns:
            dict: 命令处理结果
        """
        try:
            # 识别命令类型
            command_type, parameters = self._identify_command(command_text)

            # 根据命令类型执行相应操作
            if command_type == 'search':
                result = self._execute_search(user, parameters)
            elif command_type == 'create_note':
                result = self._execute_create_note(user, parameters)
            elif command_type == 'open_note':
                result = self._execute_open_note(user, parameters)
            elif command_type == 'set_reminder':
                result = self._execute_set_reminder(user, parameters)
            elif command_type == 'add_tag':
                result = self._execute_add_tag(user, parameters)
            elif command_type == 'navigate':
                result = self._execute_navigate(user, parameters)
            else:
                result = {
                    'success': False,
                    'message': '无法识别的命令',
                    'result': {}
                }

            return {
                'command': command_type,
                'parameters': parameters,
                'success': result.get('success', False),
                'message': result.get('message', ''),
                'result': result.get('result', {})
            }

        except Exception as e:
            logger.error(f"处理语音命令失败: {e}")
            return {
                'command': 'unknown',
                'parameters': {},
                'success': False,
                'message': f'处理命令时出错: {str(e)}',
                'result': {}
            }

    def _identify_command(self, command_text):
        """
        识别命令类型和参数
        增强版：更准确的命令识别和参数提取

        Args:
            command_text: 命令文本

        Returns:
            tuple: (命令类型, 参数字典)
        """
        try:
            # 使用GPT识别命令意图和参数 - 增强版提示词
            prompt = f"""
            请分析以下中文语音命令，识别其意图和参数：

            命令: {command_text}

            请以JSON格式返回结果，包含以下字段：
            - command_type: 命令类型，可能的值包括:
              * search: 搜索相关内容
              * create_note: 创建笔记
              * open_note: 打开或查看笔记
              * set_reminder: 设置提醒
              * add_tag: 添加标签
              * navigate: 导航到应用的某个部分
              * unknown: 无法识别的命令

            - parameters: 命令参数，根据命令类型包含不同的字段:
              * 对于search: query(搜索关键词), type(搜索类型，如note/all/tag等)
              * 对于create_note: title(标题), content(内容)
              * 对于open_note: title(标题) 或 note_id(笔记ID)
              * 对于set_reminder: title(提醒标题), content(提醒内容), remind_at(提醒时间，如"明天下午3点"或"5分钟后")
              * 对于add_tag: note_id(笔记ID), tags(标签列表)
              * 对于navigate: destination(目标位置，如"首页"、"设置"等)

            请尽可能准确地提取参数，特别是时间相关的参数。如果命令中没有明确提到某个参数，请不要在结果中包含该参数。

            只返回JSON格式的结果，不要有其他文字。
            """

            # 使用更高级的模型和参数
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo-16k",  # 使用更高级的模型
                messages=[
                    {"role": "system", "content": "你是一个专业的中文语音命令解析助手，擅长从自然语言命令中精确提取意图和参数。你理解中文表达习惯和上下文含义。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,  # 保持低温度以获得确定性结果
                max_tokens=800,   # 增加token数量
                top_p=0.95,       # 控制输出多样性
                presence_penalty=0.0,  # 不惩罚新主题
                frequency_penalty=0.0  # 不惩罚重复
            )

            # 解析返回的JSON
            import json
            result_text = response.choices[0].message.content.strip()
            result = json.loads(result_text)

            command_type = result.get('command_type', 'unknown')
            parameters = result.get('parameters', {})

            # 后处理参数 - 处理时间和日期
            if command_type == 'set_reminder' and 'remind_at' in parameters:
                parameters['remind_at'] = self._parse_time_expression(parameters['remind_at'])

            return command_type, parameters

        except Exception as e:
            logger.error(f"使用GPT识别命令失败: {e}")

            # 增强的规则匹配回退方案
            return self._rule_based_command_identification(command_text)

    def _rule_based_command_identification(self, command_text):
        """
        基于规则的命令识别（回退方案）

        Args:
            command_text: 命令文本

        Returns:
            tuple: (命令类型, 参数字典)
        """
        # 默认为未知命令
        command_type = 'unknown'
        parameters = {}

        # 1. 搜索命令
        search_patterns = [
            r'搜索\s*(.+)',
            r'查找\s*(.+)',
            r'查询\s*(.+)',
            r'找一下\s*(.+)',
            r'帮我找\s*(.+)'
        ]

        for pattern in search_patterns:
            match = re.search(pattern, command_text)
            if match:
                command_type = 'search'
                parameters['query'] = match.group(1).strip()

                # 检查搜索类型
                if '笔记' in command_text:
                    parameters['type'] = 'note'
                elif '标签' in command_text:
                    parameters['type'] = 'tag'
                else:
                    parameters['type'] = 'all'

                break

        # 2. 创建笔记命令
        if command_type == 'unknown':
            create_patterns = [
                r'创建(笔记|一个笔记|新笔记)(\s*标题是|\s*叫做|\s*名为|\s*名称是)?\s*["《]?([^"》]+)["》]?',
                r'新建(笔记|一个笔记)(\s*标题是|\s*叫做|\s*名为|\s*名称是)?\s*["《]?([^"》]+)["》]?',
                r'添加(笔记|一个笔记)(\s*标题是|\s*叫做|\s*名为|\s*名称是)?\s*["《]?([^"》]+)["》]?'
            ]

            for pattern in create_patterns:
                match = re.search(pattern, command_text)
                if match:
                    command_type = 'create_note'
                    parameters['title'] = match.group(3).strip()

                    # 尝试提取内容
                    content_match = re.search(r'内容是\s*["《]?([^"》]+)["》]?', command_text)
                    if content_match:
                        parameters['content'] = content_match.group(1).strip()

                    break

        # 3. 打开笔记命令
        if command_type == 'unknown':
            open_patterns = [
                r'打开(笔记|那个笔记)(\s*标题是|\s*叫做|\s*名为|\s*名称是)?\s*["《]?([^"》]+)["》]?',
                r'查看(笔记|那个笔记)(\s*标题是|\s*叫做|\s*名为|\s*名称是)?\s*["《]?([^"》]+)["》]?',
                r'显示(笔记|那个笔记)(\s*标题是|\s*叫做|\s*名为|\s*名称是)?\s*["《]?([^"》]+)["》]?'
            ]

            for pattern in open_patterns:
                match = re.search(pattern, command_text)
                if match:
                    command_type = 'open_note'
                    parameters['title'] = match.group(3).strip()
                    break

        # 4. 设置提醒命令
        if command_type == 'unknown':
            reminder_patterns = [
                r'设置提醒\s*["《]?([^"》]+)["》]?',
                r'添加提醒\s*["《]?([^"》]+)["》]?',
                r'创建提醒\s*["《]?([^"》]+)["》]?',
                r'提醒我\s*["《]?([^"》]+)["》]?'
            ]

            for pattern in reminder_patterns:
                match = re.search(pattern, command_text)
                if match:
                    command_type = 'set_reminder'
                    parameters['title'] = match.group(1).strip()

                    # 尝试提取时间
                    time_patterns = [
                        r'(明天|后天|大后天)?(上午|下午|晚上)?\s*(\d+)[\s:点时](\d+)?分?',
                        r'(\d+)分钟后',
                        r'(\d+)小时后',
                        r'(\d+)天后'
                    ]

                    for time_pattern in time_patterns:
                        time_match = re.search(time_pattern, command_text)
                        if time_match:
                            parameters['remind_at'] = self._parse_time_expression(command_text)
                            break

                    break

        # 5. 导航命令
        if command_type == 'unknown':
            navigate_patterns = [
                r'(跳转到|前往|打开|进入)\s*(.+?)\s*(页面|界面)?',
                r'去\s*(.+?)\s*(页面|界面)'
            ]

            for pattern in navigate_patterns:
                match = re.search(pattern, command_text)
                if match:
                    destination = match.group(2) if pattern.startswith('去') else match.group(2)

                    # 映射常见目标
                    destinations = {
                        '首页': 'Home',
                        '主页': 'Home',
                        '笔记': 'Notes',
                        '笔记列表': 'Notes',
                        '设置': 'Settings',
                        '个人中心': 'Profile',
                        'AI助手': 'AIAssistant',
                        '搜索': 'Search',
                        '提醒': 'Reminders',
                        '社区': 'Community',
                        '画布': 'Canvas'
                    }

                    for key in destinations:
                        if key in destination:
                            command_type = 'navigate'
                            parameters['destination'] = key
                            break

                    if command_type == 'navigate':
                        break

        return command_type, parameters

    def _parse_time_expression(self, time_expr):
        """
        解析时间表达式

        Args:
            time_expr: 时间表达式

        Returns:
            datetime: 解析后的时间对象
        """
        from datetime import datetime, timedelta
        import re

        now = timezone.now()

        # 1. 处理"X分钟后"、"X小时后"、"X天后"
        minutes_match = re.search(r'(\d+)\s*分钟后', time_expr)
        if minutes_match:
            minutes = int(minutes_match.group(1))
            return now + timedelta(minutes=minutes)

        hours_match = re.search(r'(\d+)\s*小时后', time_expr)
        if hours_match:
            hours = int(hours_match.group(1))
            return now + timedelta(hours=hours)

        days_match = re.search(r'(\d+)\s*天后', time_expr)
        if days_match:
            days = int(days_match.group(1))
            return now + timedelta(days=days)

        # 2. 处理"明天"、"后天"、"大后天"
        day_offset = 0
        if '明天' in time_expr:
            day_offset = 1
        elif '后天' in time_expr:
            day_offset = 2
        elif '大后天' in time_expr:
            day_offset = 3

        target_date = now.date() + timedelta(days=day_offset)

        # 3. 处理具体时间
        hour_minute_match = re.search(r'(\d+)[\s:点时](\d+)?分?', time_expr)
        if hour_minute_match:
            hour = int(hour_minute_match.group(1))
            minute = int(hour_minute_match.group(2) or '0')

            # 处理上午/下午/晚上
            if '下午' in time_expr or '晚上' in time_expr:
                if hour < 12:
                    hour += 12

            return datetime.combine(target_date, datetime.min.time().replace(hour=hour, minute=minute))

        # 4. 如果没有具体时间，默认设置为第二天早上9点
        if day_offset > 0:
            return datetime.combine(target_date, datetime.min.time().replace(hour=9, minute=0))

        # 5. 默认为1小时后
        return now + timedelta(hours=1)

    def _execute_search(self, user, parameters):
        """执行搜索命令"""
        try:
            from search.services import SearchService

            query = parameters.get('query', '')
            search_type = parameters.get('type', 'all')

            if not query:
                return {
                    'success': False,
                    'message': '搜索关键词为空',
                    'result': {}
                }

            # 执行搜索
            search_service = SearchService()
            results = search_service.search(
                query=query,
                user=user,
                filters={'type': search_type} if search_type != 'all' else {},
                page=1,
                page_size=10
            )

            return {
                'success': True,
                'message': f'找到 {len(results.get("results", []))} 条结果',
                'result': results
            }

        except Exception as e:
            logger.error(f"执行搜索命令失败: {e}")
            return {
                'success': False,
                'message': f'搜索失败: {str(e)}',
                'result': {}
            }

    def _execute_create_note(self, user, parameters):
        """执行创建笔记命令"""
        try:
            from notes.models import Note

            title = parameters.get('title', f'语音创建的笔记 - {timezone.now().strftime("%Y-%m-%d %H:%M")}')
            content = parameters.get('content', '')

            # 创建笔记
            note = Note.objects.create(
                user=user,
                title=title,
                content=content,
                created_at=timezone.now(),
                updated_at=timezone.now()
            )

            return {
                'success': True,
                'message': '笔记创建成功',
                'result': {
                    'note_id': str(note.id),
                    'title': note.title
                }
            }

        except Exception as e:
            logger.error(f"执行创建笔记命令失败: {e}")
            return {
                'success': False,
                'message': f'创建笔记失败: {str(e)}',
                'result': {}
            }

    def _execute_open_note(self, user, parameters):
        """执行打开笔记命令"""
        try:
            from notes.models import Note

            title = parameters.get('title', '')
            note_id = parameters.get('note_id', '')

            if note_id:
                try:
                    note = Note.objects.get(id=note_id, user=user)
                    return {
                        'success': True,
                        'message': '找到笔记',
                        'result': {
                            'note_id': str(note.id),
                            'title': note.title,
                            'content': note.content
                        }
                    }
                except Note.DoesNotExist:
                    return {
                        'success': False,
                        'message': '未找到指定ID的笔记',
                        'result': {}
                    }

            if title:
                notes = Note.objects.filter(title__icontains=title, user=user)
                if notes.exists():
                    note = notes.first()
                    return {
                        'success': True,
                        'message': '找到笔记',
                        'result': {
                            'note_id': str(note.id),
                            'title': note.title,
                            'content': note.content
                        }
                    }
                else:
                    return {
                        'success': False,
                        'message': '未找到匹配标题的笔记',
                        'result': {}
                    }

            return {
                'success': False,
                'message': '未提供笔记标题或ID',
                'result': {}
            }

        except Exception as e:
            logger.error(f"执行打开笔记命令失败: {e}")
            return {
                'success': False,
                'message': f'打开笔记失败: {str(e)}',
                'result': {}
            }

    def _execute_set_reminder(self, user, parameters):
        """执行设置提醒命令"""
        try:
            from reminder.models import Reminder

            title = parameters.get('title', '')
            content = parameters.get('content', '')
            remind_at = parameters.get('remind_at', None)

            if not title:
                return {
                    'success': False,
                    'message': '提醒标题不能为空',
                    'result': {}
                }

            if not remind_at:
                # 默认设置为1小时后
                remind_at = timezone.now() + timezone.timedelta(hours=1)

            # 创建提醒
            reminder = Reminder.objects.create(
                user=user,
                title=title,
                content=content,
                remind_at=remind_at,
                created_at=timezone.now(),
                updated_at=timezone.now()
            )

            return {
                'success': True,
                'message': '提醒设置成功',
                'result': {
                    'reminder_id': str(reminder.id),
                    'title': reminder.title,
                    'remind_at': reminder.remind_at.isoformat()
                }
            }

        except Exception as e:
            logger.error(f"执行设置提醒命令失败: {e}")
            return {
                'success': False,
                'message': f'设置提醒失败: {str(e)}',
                'result': {}
            }

    def _execute_add_tag(self, user, parameters):
        """执行添加标签命令"""
        try:
            from notes.models import Note, Tag

            note_id = parameters.get('note_id', '')
            tag_names = parameters.get('tags', [])

            if not note_id:
                return {
                    'success': False,
                    'message': '未提供笔记ID',
                    'result': {}
                }

            if not tag_names:
                return {
                    'success': False,
                    'message': '未提供标签名称',
                    'result': {}
                }

            try:
                note = Note.objects.get(id=note_id, user=user)
            except Note.DoesNotExist:
                return {
                    'success': False,
                    'message': '未找到指定ID的笔记',
                    'result': {}
                }

            # 添加标签
            added_tags = []
            for tag_name in tag_names:
                tag, _ = Tag.objects.get_or_create(
                    user=user,
                    name=tag_name
                )
                note.tags.add(tag)
                added_tags.append(tag_name)

            return {
                'success': True,
                'message': f'成功添加标签: {", ".join(added_tags)}',
                'result': {
                    'note_id': str(note.id),
                    'title': note.title,
                    'added_tags': added_tags
                }
            }

        except Exception as e:
            logger.error(f"执行添加标签命令失败: {e}")
            return {
                'success': False,
                'message': f'添加标签失败: {str(e)}',
                'result': {}
            }

    def _execute_navigate(self, user, parameters):
        """执行导航命令"""
        try:
            destination = parameters.get('destination', '')

            if not destination:
                return {
                    'success': False,
                    'message': '未提供导航目标',
                    'result': {}
                }

            # 映射目标到路由
            route_mapping = {
                '首页': 'Home',
                '笔记': 'Notes',
                '笔记列表': 'Notes',
                '新建笔记': 'NoteEdit',
                '设置': 'Settings',
                '个人中心': 'Profile',
                'AI助手': 'AIAssistant',
                '搜索': 'Search',
                '提醒': 'Reminders',
                '社区': 'Community',
                '画布': 'Canvas',
            }

            route = None
            for key, value in route_mapping.items():
                if key in destination:
                    route = value
                    break

            if not route:
                return {
                    'success': False,
                    'message': f'未找到匹配的导航目标: {destination}',
                    'result': {}
                }

            return {
                'success': True,
                'message': f'导航到: {destination}',
                'result': {
                    'route': route,
                    'params': {}
                }
            }

        except Exception as e:
            logger.error(f"执行导航命令失败: {e}")
            return {
                'success': False,
                'message': f'导航失败: {str(e)}',
                'result': {}
            }
