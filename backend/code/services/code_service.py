"""
代码服务
"""

import logging
import time
import subprocess
import tempfile
import os
import re
import difflib
from django.conf import settings

from code.utils.languages import LANGUAGE_CONFIG, get_language_extension, get_language_by_extension

logger = logging.getLogger('backend')

class CodeService:
    """
    代码服务类
    处理代码执行、语言检测、代码补全、格式化和检查等功能
    """
    
    def run_code(self, code, language, input_data=None):
        """
        运行代码
        
        Args:
            code: 代码内容
            language: 编程语言
            input_data: 输入数据
            
        Returns:
            dict: 运行结果
        """
        try:
            start_time = time.time()
            
            # 获取语言配置
            lang_config = LANGUAGE_CONFIG.get(language.lower())
            if not lang_config:
                raise ValueError(f"不支持的语言: {language}")
            
            # 创建临时文件
            with tempfile.NamedTemporaryFile(suffix=f".{lang_config['extension']}", delete=False) as temp_file:
                temp_file.write(code.encode('utf-8'))
                temp_file_path = temp_file.name
            
            # 创建输入文件（如果有输入数据）
            input_file_path = None
            if input_data:
                with tempfile.NamedTemporaryFile(delete=False) as input_file:
                    input_file.write(input_data.encode('utf-8'))
                    input_file_path = input_file.name
            
            # 准备命令
            command = lang_config['run_command'].format(file=temp_file_path)
            
            # 执行命令
            try:
                if input_data:
                    with open(input_file_path, 'r') as input_file:
                        process = subprocess.Popen(
                            command,
                            shell=True,
                            stdin=input_file,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE,
                            text=True
                        )
                else:
                    process = subprocess.Popen(
                        command,
                        shell=True,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True
                    )
                
                # 设置超时时间
                timeout = 10  # 10秒
                output, error = process.communicate(timeout=timeout)
                
                # 计算执行时间
                execution_time = time.time() - start_time
                
                # 估算内存使用（简单实现，实际应使用更准确的方法）
                memory_usage = 0
                
                return {
                    'output': output,
                    'error': error,
                    'execution_time': execution_time,
                    'memory_usage': memory_usage
                }
            except subprocess.TimeoutExpired:
                process.kill()
                return {
                    'output': '',
                    'error': '执行超时',
                    'execution_time': timeout,
                    'memory_usage': 0
                }
            finally:
                # 清理临时文件
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                if input_file_path and os.path.exists(input_file_path):
                    os.unlink(input_file_path)
        except Exception as e:
            logger.error(f"运行代码失败: {e}")
            return {
                'output': '',
                'error': str(e),
                'execution_time': 0,
                'memory_usage': 0
            }
    
    def detect_language(self, code, hint_language=None):
        """
        检测代码语言
        
        Args:
            code: 代码内容
            hint_language: 提示语言
            
        Returns:
            dict: 检测结果
        """
        try:
            # 如果提供了提示语言，先检查是否支持
            if hint_language and hint_language.lower() in LANGUAGE_CONFIG:
                confidence = 0.9  # 较高的置信度
                return {
                    'language': hint_language.lower(),
                    'confidence': confidence,
                    'alternatives': []
                }
            
            # 基于代码特征检测语言
            language_scores = {}
            
            # 检查文件扩展名模式
            for lang, config in LANGUAGE_CONFIG.items():
                # 初始分数
                score = 0
                
                # 检查关键字和语法特征
                for pattern in config.get('patterns', []):
                    if re.search(pattern, code):
                        score += 0.2
                
                # 检查语言特定的导入语句或库
                for import_pattern in config.get('imports', []):
                    if re.search(import_pattern, code):
                        score += 0.3
                
                # 检查语言特定的函数或方法
                for func_pattern in config.get('functions', []):
                    if re.search(func_pattern, code):
                        score += 0.2
                
                # 如果有分数，添加到结果中
                if score > 0:
                    language_scores[lang] = score
            
            # 如果没有检测到任何语言，返回默认值
            if not language_scores:
                return {
                    'language': 'text',
                    'confidence': 0.5,
                    'alternatives': []
                }
            
            # 按分数排序
            sorted_languages = sorted(language_scores.items(), key=lambda x: x[1], reverse=True)
            
            # 获取最高分的语言
            top_language, top_score = sorted_languages[0]
            
            # 构建替代选项
            alternatives = [
                {'language': lang, 'confidence': score}
                for lang, score in sorted_languages[1:4]  # 取前3个替代选项
            ]
            
            return {
                'language': top_language,
                'confidence': top_score,
                'alternatives': alternatives
            }
        except Exception as e:
            logger.error(f"检测代码语言失败: {e}")
            return {
                'language': 'text',
                'confidence': 0.5,
                'alternatives': []
            }
    
    def complete_code(self, code, language, cursor_position=None, max_suggestions=5):
        """
        补全代码
        
        Args:
            code: 代码内容
            language: 编程语言
            cursor_position: 光标位置
            max_suggestions: 最大建议数量
            
        Returns:
            dict: 补全结果
        """
        try:
            # 获取语言配置
            lang_config = LANGUAGE_CONFIG.get(language.lower())
            if not lang_config:
                raise ValueError(f"不支持的语言: {language}")
            
            # 如果未提供光标位置，使用代码长度
            if cursor_position is None:
                cursor_position = len(code)
            
            # 获取光标前的代码
            code_before_cursor = code[:cursor_position]
            
            # 简单的补全逻辑（实际应使用更复杂的算法或模型）
            completions = []
            
            # 基于语言的常用补全
            for completion in lang_config.get('completions', []):
                # 检查是否匹配
                pattern = completion.get('pattern')
                if pattern and re.search(pattern, code_before_cursor):
                    completions.append({
                        'text': completion.get('text', ''),
                        'display_text': completion.get('display_text', completion.get('text', '')),
                        'description': completion.get('description', '')
                    })
            
            # 限制建议数量
            completions = completions[:max_suggestions]
            
            return {
                'completions': completions,
                'language': language.lower()
            }
        except Exception as e:
            logger.error(f"补全代码失败: {e}")
            return {
                'completions': [],
                'language': language.lower()
            }
    
    def format_code(self, code, language, style=None):
        """
        格式化代码
        
        Args:
            code: 代码内容
            language: 编程语言
            style: 格式化风格
            
        Returns:
            dict: 格式化结果
        """
        try:
            # 获取语言配置
            lang_config = LANGUAGE_CONFIG.get(language.lower())
            if not lang_config:
                raise ValueError(f"不支持的语言: {language}")
            
            # 创建临时文件
            with tempfile.NamedTemporaryFile(suffix=f".{lang_config['extension']}", delete=False) as temp_file:
                temp_file.write(code.encode('utf-8'))
                temp_file_path = temp_file.name
            
            # 准备格式化命令
            format_command = lang_config.get('format_command')
            if not format_command:
                # 如果没有格式化命令，返回原始代码
                return {
                    'formatted_code': code,
                    'language': language.lower(),
                    'changes': 0
                }
            
            # 添加样式参数（如果有）
            if style:
                format_command = format_command.format(file=temp_file_path, style=style)
            else:
                format_command = format_command.format(file=temp_file_path, style='')
            
            # 执行格式化命令
            try:
                process = subprocess.Popen(
                    format_command,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                
                # 设置超时时间
                timeout = 10  # 10秒
                output, error = process.communicate(timeout=timeout)
                
                # 如果有错误，返回原始代码
                if error:
                    logger.warning(f"格式化代码警告: {error}")
                
                # 读取格式化后的代码
                formatted_code = output
                if not formatted_code and os.path.exists(temp_file_path):
                    with open(temp_file_path, 'r', encoding='utf-8') as f:
                        formatted_code = f.read()
                
                # 计算更改数量
                changes = sum(1 for _ in difflib.ndiff(code.splitlines(), formatted_code.splitlines()) if _.startswith('+ ') or _.startswith('- '))
                
                return {
                    'formatted_code': formatted_code,
                    'language': language.lower(),
                    'changes': changes
                }
            except subprocess.TimeoutExpired:
                process.kill()
                return {
                    'formatted_code': code,
                    'language': language.lower(),
                    'changes': 0
                }
            finally:
                # 清理临时文件
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
        except Exception as e:
            logger.error(f"格式化代码失败: {e}")
            return {
                'formatted_code': code,
                'language': language.lower(),
                'changes': 0
            }
    
    def lint_code(self, code, language, rules=None):
        """
        检查代码
        
        Args:
            code: 代码内容
            language: 编程语言
            rules: 规则列表
            
        Returns:
            dict: 检查结果
        """
        try:
            # 获取语言配置
            lang_config = LANGUAGE_CONFIG.get(language.lower())
            if not lang_config:
                raise ValueError(f"不支持的语言: {language}")
            
            # 创建临时文件
            with tempfile.NamedTemporaryFile(suffix=f".{lang_config['extension']}", delete=False) as temp_file:
                temp_file.write(code.encode('utf-8'))
                temp_file_path = temp_file.name
            
            # 准备检查命令
            lint_command = lang_config.get('lint_command')
            if not lint_command:
                # 如果没有检查命令，返回空结果
                return {
                    'issues': [],
                    'language': language.lower(),
                    'total_issues': 0
                }
            
            # 添加规则参数（如果有）
            if rules:
                rules_str = ' '.join(rules)
                lint_command = lint_command.format(file=temp_file_path, rules=rules_str)
            else:
                lint_command = lint_command.format(file=temp_file_path, rules='')
            
            # 执行检查命令
            try:
                process = subprocess.Popen(
                    lint_command,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                
                # 设置超时时间
                timeout = 10  # 10秒
                output, error = process.communicate(timeout=timeout)
                
                # 解析检查结果
                issues = []
                
                # 根据语言解析输出
                if language.lower() == 'python':
                    # 解析pylint输出
                    for line in output.splitlines():
                        match = re.match(r'(.+?):(\d+):(\d+): ([A-Z]\d+): (.+)', line)
                        if match:
                            file_path, line_num, col_num, code, message = match.groups()
                            issues.append({
                                'line': int(line_num),
                                'column': int(col_num),
                                'code': code,
                                'message': message,
                                'severity': 'warning' if code.startswith('W') else 'error' if code.startswith('E') else 'info'
                            })
                elif language.lower() in ['javascript', 'typescript']:
                    # 解析eslint输出
                    for line in output.splitlines():
                        match = re.match(r'(.+?):(\d+):(\d+): (.+?) - (.+)', line)
                        if match:
                            file_path, line_num, col_num, severity, message = match.groups()
                            issues.append({
                                'line': int(line_num),
                                'column': int(col_num),
                                'code': '',
                                'message': message,
                                'severity': severity.lower()
                            })
                
                return {
                    'issues': issues,
                    'language': language.lower(),
                    'total_issues': len(issues)
                }
            except subprocess.TimeoutExpired:
                process.kill()
                return {
                    'issues': [],
                    'language': language.lower(),
                    'total_issues': 0
                }
            finally:
                # 清理临时文件
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
        except Exception as e:
            logger.error(f"检查代码失败: {e}")
            return {
                'issues': [],
                'language': language.lower(),
                'total_issues': 0
            }
