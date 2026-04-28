"""
代码服务
"""

import logging
import time
import re
import difflib

from code.utils.languages import LANGUAGE_CONFIG

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
            # 导入安全工具和沙箱
            from code.utils.security import check_code_security
            from code.utils.sandbox import run_code_in_sandbox

            # 检查代码安全性
            security_check = check_code_security(code, language)
            if not security_check['is_safe']:
                return {
                    'output': '',
                    'error': f"代码包含潜在的危险操作，无法执行。\n安全警告：\n" +
                             "\n".join([f"- 第{w['line']}行: {w['message']}" for w in security_check['warnings'][:5]]),
                    'execution_time': 0,
                    'memory_usage': 0,
                    'security_warnings': security_check['warnings']
                }

            # 在沙箱中运行代码
            start_time = time.time()
            result = run_code_in_sandbox(code, language, input_data)

            # 添加执行时间（如果沙箱没有提供）
            if not result.get('execution_time'):
                result['execution_time'] = time.time() - start_time

            return result
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
            # 导入格式化工具
            from code.utils.formatters import format_code as format_code_util

            # 使用格式化工具格式化代码
            formatted_code = format_code_util(code, language, style)

            # 计算更改数量
            changes = sum(1 for _ in difflib.ndiff(code.splitlines(), formatted_code.splitlines()) if _.startswith('+ ') or _.startswith('- '))

            return {
                'formatted_code': formatted_code,
                'language': language.lower(),
                'changes': changes
            }
        except Exception as e:
            logger.error(f"格式化代码失败: {e}")
            return {
                'formatted_code': code,
                'language': language.lower(),
                'changes': 0
            }

    def explain_code(self, code, language, detail_level='medium'):
        """
        解释代码

        Args:
            code: 代码内容
            language: 编程语言
            detail_level: 详细程度 (low, medium, high)

        Returns:
            dict: 解释结果
        """
        try:
            # 获取语言配置
            lang_config = LANGUAGE_CONFIG.get(language.lower())
            if not lang_config:
                raise ValueError(f"不支持的语言: {language}")

            # 使用AI服务解释代码
            # 这里应该调用AI服务，但为了简单起见，我们使用一个简单的实现

            # 根据详细程度调整解释内容
            if detail_level == 'low':
                explanation = self._generate_simple_explanation(code, language)
            elif detail_level == 'high':
                explanation = self._generate_detailed_explanation(code, language)
            else:  # medium
                explanation = self._generate_medium_explanation(code, language)

            # 解析代码结构
            structure = self._analyze_code_structure(code, language)

            return {
                'explanation': explanation,
                'structure': structure,
                'language': language.lower(),
                'detail_level': detail_level
            }
        except Exception as e:
            logger.error(f"解释代码失败: {e}")
            return {
                'explanation': '无法解释代码',
                'structure': [],
                'language': language.lower(),
                'detail_level': detail_level
            }

    def generate_example(self, language, concept, complexity='medium'):
        """
        生成代码示例

        Args:
            language: 编程语言
            concept: 概念或功能
            complexity: 复杂度 (low, medium, high)

        Returns:
            dict: 示例结果
        """
        try:
            # 获取语言配置
            lang_config = LANGUAGE_CONFIG.get(language.lower())
            if not lang_config:
                raise ValueError(f"不支持的语言: {language}")

            # 使用AI服务生成代码示例
            # 这里应该调用AI服务，但为了简单起见，我们使用一个简单的实现

            # 根据复杂度生成示例
            if complexity == 'low':
                example = self._generate_simple_example(language, concept)
            elif complexity == 'high':
                example = self._generate_complex_example(language, concept)
            else:  # medium
                example = self._generate_medium_example(language, concept)

            # 生成说明
            explanation = self._generate_example_explanation(language, concept, complexity)

            return {
                'example': example,
                'explanation': explanation,
                'language': language.lower(),
                'concept': concept,
                'complexity': complexity
            }
        except Exception as e:
            logger.error(f"生成代码示例失败: {e}")
            return {
                'example': '无法生成示例',
                'explanation': '生成示例时发生错误',
                'language': language.lower(),
                'concept': concept,
                'complexity': complexity
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
            # 导入检查工具
            from code.utils.linters import lint_code as lint_code_util

            # 使用检查工具检查代码
            issues = lint_code_util(code, language, rules)

            return {
                'issues': issues,
                'language': language.lower(),
                'total_issues': len(issues)
            }
        except Exception as e:
            logger.error(f"检查代码失败: {e}")
            return {
                'issues': [],
                'language': language.lower(),
                'total_issues': 0
            }

    # 辅助方法 - 代码解释
    def _generate_simple_explanation(self, code, language):
        """生成简单的代码解释"""
        # 简单实现，实际应使用AI服务
        return f"这是一段{language}代码，包含了基本的功能实现。"

    def _generate_medium_explanation(self, code, language):
        """生成中等详细的代码解释"""
        # 简单实现，实际应使用AI服务
        lines = code.count('\n') + 1
        return f"这是一段{language}代码，共{lines}行，实现了特定的功能逻辑。代码结构清晰，包含了必要的错误处理。"

    def _generate_detailed_explanation(self, code, language):
        """生成详细的代码解释"""
        # 简单实现，实际应使用AI服务
        lines = code.count('\n') + 1
        functions = len(re.findall(r'(def|function)\s+\w+', code))
        classes = len(re.findall(r'class\s+\w+', code))
        return f"""这是一段{language}代码，共{lines}行，包含了{functions}个函数和{classes}个类。
代码实现了复杂的业务逻辑，包括数据处理、错误处理和性能优化。
代码结构清晰，命名规范，注释充分，易于维护和扩展。"""

    def _analyze_code_structure(self, code, language):
        """分析代码结构"""
        # 简单实现，实际应使用更复杂的分析
        structure = []

        if language.lower() == 'python':
            # 分析Python代码结构
            for match in re.finditer(r'(def|class)\s+(\w+)', code):
                type_name, name = match.groups()
                structure.append({
                    'type': 'function' if type_name == 'def' else 'class',
                    'name': name,
                    'line': code[:match.start()].count('\n') + 1
                })
        elif language.lower() in ['javascript', 'typescript']:
            # 分析JavaScript/TypeScript代码结构
            for match in re.finditer(r'(function|class)\s+(\w+)|const\s+(\w+)\s*=\s*(?:function|\(.*\)\s*=>)', code):
                groups = match.groups()
                if groups[0] == 'function':
                    structure.append({
                        'type': 'function',
                        'name': groups[1],
                        'line': code[:match.start()].count('\n') + 1
                    })
                elif groups[0] == 'class':
                    structure.append({
                        'type': 'class',
                        'name': groups[1],
                        'line': code[:match.start()].count('\n') + 1
                    })
                elif groups[2]:
                    structure.append({
                        'type': 'function',
                        'name': groups[2],
                        'line': code[:match.start()].count('\n') + 1
                    })

        return structure

    # 辅助方法 - 代码示例生成
    def _generate_simple_example(self, language, concept):
        """生成简单的代码示例"""
        # 简单实现，实际应使用AI服务
        if language.lower() == 'python':
            if concept.lower() == 'hello world':
                return 'print("Hello, World!")'
            elif concept.lower() == 'file io':
                return '''# 读取文件
with open("example.txt", "r") as f:
    content = f.read()
    print(content)

# 写入文件
with open("example.txt", "w") as f:
    f.write("Hello, World!")'''
            else:
                return f'# {concept} 示例\nprint("Example for {concept}")'
        elif language.lower() == 'javascript':
            if concept.lower() == 'hello world':
                return 'console.log("Hello, World!");'
            elif concept.lower() == 'file io':
                return '''// 读取文件
const fs = require('fs');
fs.readFile('example.txt', 'utf8', (err, data) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(data);
});

// 写入文件
fs.writeFile('example.txt', 'Hello, World!', (err) => {
  if (err) {
    console.error(err);
  }
});'''
            else:
                return f'// {concept} 示例\nconsole.log("Example for {concept}");'
        else:
            return f'// {language} {concept} 示例'

    def _generate_medium_example(self, language, concept):
        """生成中等复杂度的代码示例"""
        # 简单实现，实际应使用AI服务
        simple_example = self._generate_simple_example(language, concept)
        return f"{simple_example}\n\n// 这是一个更复杂的实现，包含错误处理和更多功能"

    def _generate_complex_example(self, language, concept):
        """生成复杂的代码示例"""
        # 简单实现，实际应使用AI服务
        medium_example = self._generate_medium_example(language, concept)
        return f"{medium_example}\n\n// 这是一个高级实现，包含性能优化和高级特性"

    def _generate_example_explanation(self, language, concept, complexity):
        """生成示例说明"""
        # 简单实现，实际应使用AI服务
        complexity_desc = {
            'low': '简单',
            'medium': '中等复杂度',
            'high': '复杂'
        }.get(complexity, '中等复杂度')

        return f"这是一个{complexity_desc}的{language} {concept}示例，展示了基本用法和常见模式。"
