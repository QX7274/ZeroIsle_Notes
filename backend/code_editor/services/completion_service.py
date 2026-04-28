"""
代码补全服务
提供代码补全功能
"""

import logging
import re
from code.utils.languages import LANGUAGE_CONFIG

logger = logging.getLogger('backend')

class CompletionService:
    """代码补全服务类"""
    
    def __init__(self):
        """初始化补全服务"""
        self.language_configs = LANGUAGE_CONFIG
    
    def get_completions(self, code, language, cursor_position=None, max_suggestions=5):
        """
        获取代码补全建议
        
        Args:
            code: 代码内容
            language: 编程语言
            cursor_position: 光标位置
            max_suggestions: 最大建议数量
            
        Returns:
            list: 补全建议列表
        """
        try:
            # 获取语言配置
            lang_config = self.language_configs.get(language.lower())
            if not lang_config:
                logger.warning(f"不支持的语言: {language}")
                return []
            
            # 如果未提供光标位置，使用代码长度
            if cursor_position is None:
                cursor_position = len(code)
            
            # 获取光标前的代码
            code_before_cursor = code[:cursor_position]
            
            # 获取基于语言的补全建议
            completions = self._get_language_completions(code_before_cursor, lang_config)
            
            # 获取基于上下文的补全建议
            context_completions = self._get_context_completions(code, code_before_cursor, language)
            
            # 合并补全建议
            all_completions = completions + context_completions
            
            # 去重
            unique_completions = []
            seen_texts = set()
            for completion in all_completions:
                if completion['text'] not in seen_texts:
                    unique_completions.append(completion)
                    seen_texts.add(completion['text'])
            
            # 限制建议数量
            return unique_completions[:max_suggestions]
        except Exception as e:
            logger.error(f"获取代码补全建议失败: {e}")
            return []
    
    def _get_language_completions(self, code_before_cursor, lang_config):
        """
        获取基于语言的补全建议
        
        Args:
            code_before_cursor: 光标前的代码
            lang_config: 语言配置
            
        Returns:
            list: 补全建议列表
        """
        completions = []
        
        # 使用语言配置中的补全模式
        for completion in lang_config.get('completions', []):
            # 检查是否匹配
            pattern = completion.get('pattern')
            if pattern and re.search(pattern, code_before_cursor):
                completions.append({
                    'text': completion.get('text', ''),
                    'display_text': completion.get('display_text', completion.get('text', '')),
                    'description': completion.get('description', ''),
                    'source': 'language'
                })
        
        return completions
    
    def _get_context_completions(self, code, code_before_cursor, language):
        """
        获取基于上下文的补全建议
        
        Args:
            code: 完整代码
            code_before_cursor: 光标前的代码
            language: 编程语言
            
        Returns:
            list: 补全建议列表
        """
        completions = []
        
        # 提取变量名
        variables = self._extract_variables(code, language)
        
        # 提取函数名
        functions = self._extract_functions(code, language)
        
        # 提取类名
        classes = self._extract_classes(code, language)
        
        # 获取最后一个标记
        last_token = self._get_last_token(code_before_cursor)
        
        # 如果最后一个标记是空的，返回空列表
        if not last_token:
            return completions
        
        # 添加变量补全
        for var in variables:
            if var.startswith(last_token):
                completions.append({
                    'text': var[len(last_token):],
                    'display_text': var,
                    'description': '变量',
                    'source': 'context'
                })
        
        # 添加函数补全
        for func in functions:
            if func.startswith(last_token):
                completions.append({
                    'text': func[len(last_token):] + '()',
                    'display_text': func,
                    'description': '函数',
                    'source': 'context'
                })
        
        # 添加类补全
        for cls in classes:
            if cls.startswith(last_token):
                completions.append({
                    'text': cls[len(last_token):],
                    'display_text': cls,
                    'description': '类',
                    'source': 'context'
                })
        
        return completions
    
    def _extract_variables(self, code, language):
        """
        提取代码中的变量名
        
        Args:
            code: 代码内容
            language: 编程语言
            
        Returns:
            list: 变量名列表
        """
        variables = []
        
        if language.lower() == 'python':
            # 匹配Python变量赋值
            for match in re.finditer(r'(\w+)\s*=', code):
                variables.append(match.group(1))
        elif language.lower() in ['javascript', 'typescript']:
            # 匹配JavaScript/TypeScript变量声明
            for match in re.finditer(r'(?:var|let|const)\s+(\w+)', code):
                variables.append(match.group(1))
        elif language.lower() == 'java':
            # 匹配Java变量声明
            for match in re.finditer(r'(?:\w+)\s+(\w+)\s*[=;]', code):
                variables.append(match.group(1))
        
        return variables
    
    def _extract_functions(self, code, language):
        """
        提取代码中的函数名
        
        Args:
            code: 代码内容
            language: 编程语言
            
        Returns:
            list: 函数名列表
        """
        functions = []
        
        if language.lower() == 'python':
            # 匹配Python函数定义
            for match in re.finditer(r'def\s+(\w+)\s*\(', code):
                functions.append(match.group(1))
        elif language.lower() in ['javascript', 'typescript']:
            # 匹配JavaScript/TypeScript函数定义
            for match in re.finditer(r'function\s+(\w+)\s*\(', code):
                functions.append(match.group(1))
            # 匹配箭头函数
            for match in re.finditer(r'const\s+(\w+)\s*=\s*\([^)]*\)\s*=>', code):
                functions.append(match.group(1))
        elif language.lower() == 'java':
            # 匹配Java方法定义
            for match in re.finditer(r'(?:public|private|protected)?\s+(?:static)?\s+\w+\s+(\w+)\s*\(', code):
                functions.append(match.group(1))
        
        return functions
    
    def _extract_classes(self, code, language):
        """
        提取代码中的类名
        
        Args:
            code: 代码内容
            language: 编程语言
            
        Returns:
            list: 类名列表
        """
        classes = []
        
        if language.lower() == 'python':
            # 匹配Python类定义
            for match in re.finditer(r'class\s+(\w+)', code):
                classes.append(match.group(1))
        elif language.lower() in ['javascript', 'typescript']:
            # 匹配JavaScript/TypeScript类定义
            for match in re.finditer(r'class\s+(\w+)', code):
                classes.append(match.group(1))
        elif language.lower() == 'java':
            # 匹配Java类定义
            for match in re.finditer(r'(?:public|private|protected)?\s+class\s+(\w+)', code):
                classes.append(match.group(1))
        
        return classes
    
    def _get_last_token(self, code):
        """
        获取代码中最后一个标记
        
        Args:
            code: 代码内容
            
        Returns:
            str: 最后一个标记
        """
        # 匹配最后一个标记
        match = re.search(r'[\w.]+$', code)
        if match:
            return match.group(0)
        return ''

# 创建补全服务实例
completion_service = CompletionService()

def get_completions(code, language, cursor_position=None, max_suggestions=5):
    """
    获取代码补全建议
    
    Args:
        code: 代码内容
        language: 编程语言
        cursor_position: 光标位置
        max_suggestions: 最大建议数量
        
    Returns:
        list: 补全建议列表
    """
    return completion_service.get_completions(code, language, cursor_position, max_suggestions)
