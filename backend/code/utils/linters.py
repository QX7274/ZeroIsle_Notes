"""
代码检查工具
提供各种编程语言的代码检查功能
"""

import os
import subprocess
import tempfile
import re
import logging
from .languages import LANGUAGE_CONFIG

logger = logging.getLogger('backend')

class CodeLinter:
    """代码检查器基类"""
    
    def __init__(self, language):
        """
        初始化检查器
        
        Args:
            language: 编程语言
        """
        self.language = language.lower()
        self.config = LANGUAGE_CONFIG.get(self.language)
        if not self.config:
            raise ValueError(f"不支持的语言: {language}")
    
    def lint_code(self, code, rules=None):
        """
        检查代码
        
        Args:
            code: 代码内容
            rules: 规则列表
            
        Returns:
            list: 检查结果列表
        """
        raise NotImplementedError("子类必须实现此方法")
    
    def is_available(self):
        """
        检查检查器是否可用
        
        Returns:
            bool: 是否可用
        """
        raise NotImplementedError("子类必须实现此方法")

class CommandLineLinter(CodeLinter):
    """命令行检查器"""
    
    def lint_code(self, code, rules=None):
        """
        使用命令行工具检查代码
        
        Args:
            code: 代码内容
            rules: 规则列表
            
        Returns:
            list: 检查结果列表
        """
        # 获取检查命令
        lint_command = self.config.get('lint_command')
        if not lint_command:
            logger.warning(f"语言 {self.language} 没有配置检查命令")
            return []
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(suffix=f".{self.config['extension']}", delete=False) as temp_file:
            temp_file.write(code.encode('utf-8'))
            temp_file_path = temp_file.name
        
        try:
            # 添加规则参数（如果有）
            if rules:
                rules_str = ' '.join(rules)
                lint_command = lint_command.format(file=temp_file_path, rules=rules_str)
            else:
                lint_command = lint_command.format(file=temp_file_path, rules='')
            
            # 执行检查命令
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
            return self.parse_output(output, error)
        except subprocess.TimeoutExpired:
            logger.error(f"检查代码超时: {self.language}")
            process.kill()
            return []
        except Exception as e:
            logger.error(f"检查代码失败: {e}")
            return []
        finally:
            # 清理临时文件
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
    
    def parse_output(self, output, error):
        """
        解析检查输出
        
        Args:
            output: 标准输出
            error: 标准错误
            
        Returns:
            list: 检查结果列表
        """
        # 默认实现，子类应重写此方法
        issues = []
        
        # 合并输出和错误
        combined_output = output + "\n" + error
        
        # 简单解析，查找行号和消息
        for line in combined_output.splitlines():
            match = re.search(r'line\s+(\d+)', line, re.IGNORECASE)
            if match:
                line_num = int(match.group(1))
                issues.append({
                    'line': line_num,
                    'column': 1,
                    'message': line.strip(),
                    'severity': 'warning'
                })
        
        return issues
    
    def is_available(self):
        """
        检查命令行检查器是否可用
        
        Returns:
            bool: 是否可用
        """
        lint_command = self.config.get('lint_command', '').split()[0]
        if not lint_command:
            return False
        
        try:
            # 检查命令是否存在
            subprocess.run(
                f"which {lint_command}",
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            return True
        except Exception:
            return False

class PythonLinter(CommandLineLinter):
    """Python代码检查器"""
    
    def __init__(self):
        super().__init__('python')
    
    def parse_output(self, output, error):
        """
        解析pylint输出
        
        Args:
            output: 标准输出
            error: 标准错误
            
        Returns:
            list: 检查结果列表
        """
        issues = []
        
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
        
        return issues

class JavaScriptLinter(CommandLineLinter):
    """JavaScript代码检查器"""
    
    def __init__(self):
        super().__init__('javascript')
    
    def parse_output(self, output, error):
        """
        解析eslint输出
        
        Args:
            output: 标准输出
            error: 标准错误
            
        Returns:
            list: 检查结果列表
        """
        issues = []
        
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
        
        return issues

class TypeScriptLinter(JavaScriptLinter):
    """TypeScript代码检查器"""
    
    def __init__(self):
        super().__init__()
        self.language = 'typescript'
        self.config = LANGUAGE_CONFIG.get(self.language)

class JavaLinter(CommandLineLinter):
    """Java代码检查器"""
    
    def __init__(self):
        super().__init__('java')

class CppLinter(CommandLineLinter):
    """C++代码检查器"""
    
    def __init__(self):
        super().__init__('cpp')
    
    def parse_output(self, output, error):
        """
        解析cppcheck输出
        
        Args:
            output: 标准输出
            error: 标准错误
            
        Returns:
            list: 检查结果列表
        """
        issues = []
        
        # 解析cppcheck输出
        for line in error.splitlines():
            match = re.match(r'(.+?):(\d+):(\d+): (.+?): (.+)', line)
            if match:
                file_path, line_num, col_num, severity, message = match.groups()
                issues.append({
                    'line': int(line_num),
                    'column': int(col_num),
                    'code': '',
                    'message': message,
                    'severity': severity.lower()
                })
        
        return issues

class GoLinter(CommandLineLinter):
    """Go代码检查器"""
    
    def __init__(self):
        super().__init__('go')

class RubyLinter(CommandLineLinter):
    """Ruby代码检查器"""
    
    def __init__(self):
        super().__init__('ruby')

class PhpLinter(CommandLineLinter):
    """PHP代码检查器"""
    
    def __init__(self):
        super().__init__('php')

class RustLinter(CommandLineLinter):
    """Rust代码检查器"""
    
    def __init__(self):
        super().__init__('rust')

class SwiftLinter(CommandLineLinter):
    """Swift代码检查器"""
    
    def __init__(self):
        super().__init__('swift')

# 检查器映射
LINTERS = {
    'python': PythonLinter,
    'javascript': JavaScriptLinter,
    'typescript': TypeScriptLinter,
    'java': JavaLinter,
    'cpp': CppLinter,
    'go': GoLinter,
    'ruby': RubyLinter,
    'php': PhpLinter,
    'rust': RustLinter,
    'swift': SwiftLinter
}

def get_linter(language):
    """
    获取指定语言的检查器
    
    Args:
        language: 编程语言
        
    Returns:
        CodeLinter: 检查器实例
    """
    linter_class = LINTERS.get(language.lower())
    if not linter_class:
        raise ValueError(f"不支持的语言: {language}")
    
    return linter_class()

def lint_code(code, language, rules=None):
    """
    检查代码
    
    Args:
        code: 代码内容
        language: 编程语言
        rules: 规则列表
        
    Returns:
        list: 检查结果列表
    """
    try:
        linter = get_linter(language)
        return linter.lint_code(code, rules)
    except Exception as e:
        logger.error(f"检查代码失败: {e}")
        return []
