"""
代码格式化工具
提供各种编程语言的代码格式化功能
"""

import os
import subprocess
import tempfile
import logging
from .languages import LANGUAGE_CONFIG

logger = logging.getLogger('backend')

class CodeFormatter:
    """代码格式化器基类"""
    
    def __init__(self, language):
        """
        初始化格式化器
        
        Args:
            language: 编程语言
        """
        self.language = language.lower()
        self.config = LANGUAGE_CONFIG.get(self.language)
        if not self.config:
            raise ValueError(f"不支持的语言: {language}")
    
    def format_code(self, code, style=None):
        """
        格式化代码
        
        Args:
            code: 代码内容
            style: 格式化风格
            
        Returns:
            str: 格式化后的代码
        """
        raise NotImplementedError("子类必须实现此方法")
    
    def is_available(self):
        """
        检查格式化器是否可用
        
        Returns:
            bool: 是否可用
        """
        raise NotImplementedError("子类必须实现此方法")

class CommandLineFormatter(CodeFormatter):
    """命令行格式化器"""
    
    def format_code(self, code, style=None):
        """
        使用命令行工具格式化代码
        
        Args:
            code: 代码内容
            style: 格式化风格
            
        Returns:
            str: 格式化后的代码
        """
        # 获取格式化命令
        format_command = self.config.get('format_command')
        if not format_command:
            logger.warning(f"语言 {self.language} 没有配置格式化命令")
            return code
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(suffix=f".{self.config['extension']}", delete=False) as temp_file:
            temp_file.write(code.encode('utf-8'))
            temp_file_path = temp_file.name
        
        try:
            # 添加样式参数（如果有）
            if style:
                format_command = format_command.format(file=temp_file_path, style=style)
            else:
                format_command = format_command.format(file=temp_file_path, style='')
            
            # 执行格式化命令
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
            
            # 如果有错误，记录警告
            if error:
                logger.warning(f"格式化代码警告: {error}")
            
            # 读取格式化后的代码
            formatted_code = output
            if not formatted_code and os.path.exists(temp_file_path):
                with open(temp_file_path, 'r', encoding='utf-8') as f:
                    formatted_code = f.read()
            
            return formatted_code or code
        except subprocess.TimeoutExpired:
            logger.error(f"格式化代码超时: {self.language}")
            process.kill()
            return code
        except Exception as e:
            logger.error(f"格式化代码失败: {e}")
            return code
        finally:
            # 清理临时文件
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
    
    def is_available(self):
        """
        检查命令行格式化器是否可用
        
        Returns:
            bool: 是否可用
        """
        format_command = self.config.get('format_command', '').split()[0]
        if not format_command:
            return False
        
        try:
            # 检查命令是否存在
            subprocess.run(
                f"which {format_command}",
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            return True
        except Exception:
            return False

class PythonFormatter(CommandLineFormatter):
    """Python代码格式化器"""
    
    def __init__(self):
        super().__init__('python')
    
    def format_code(self, code, style=None):
        """
        格式化Python代码
        
        Args:
            code: 代码内容
            style: 格式化风格
            
        Returns:
            str: 格式化后的代码
        """
        # 如果指定了样式，使用yapf
        if style and self.is_yapf_available():
            with tempfile.NamedTemporaryFile(suffix=".py", delete=False) as temp_file:
                temp_file.write(code.encode('utf-8'))
                temp_file_path = temp_file.name
            
            try:
                # 执行yapf命令
                process = subprocess.Popen(
                    f"yapf --style={style} {temp_file_path}",
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                
                output, error = process.communicate(timeout=10)
                
                if error:
                    logger.warning(f"yapf格式化警告: {error}")
                
                return output or super().format_code(code, style)
            except Exception as e:
                logger.error(f"yapf格式化失败: {e}")
                return super().format_code(code, style)
            finally:
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
        
        # 默认使用black
        return super().format_code(code, style)
    
    def is_yapf_available(self):
        """
        检查yapf是否可用
        
        Returns:
            bool: 是否可用
        """
        try:
            subprocess.run(
                "which yapf",
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            return True
        except Exception:
            return False

class JavaScriptFormatter(CommandLineFormatter):
    """JavaScript代码格式化器"""
    
    def __init__(self):
        super().__init__('javascript')

class TypeScriptFormatter(CommandLineFormatter):
    """TypeScript代码格式化器"""
    
    def __init__(self):
        super().__init__('typescript')

class JavaFormatter(CommandLineFormatter):
    """Java代码格式化器"""
    
    def __init__(self):
        super().__init__('java')

class CppFormatter(CommandLineFormatter):
    """C++代码格式化器"""
    
    def __init__(self):
        super().__init__('cpp')

class GoFormatter(CommandLineFormatter):
    """Go代码格式化器"""
    
    def __init__(self):
        super().__init__('go')

class RubyFormatter(CommandLineFormatter):
    """Ruby代码格式化器"""
    
    def __init__(self):
        super().__init__('ruby')

class PhpFormatter(CommandLineFormatter):
    """PHP代码格式化器"""
    
    def __init__(self):
        super().__init__('php')

class RustFormatter(CommandLineFormatter):
    """Rust代码格式化器"""
    
    def __init__(self):
        super().__init__('rust')

class SwiftFormatter(CommandLineFormatter):
    """Swift代码格式化器"""
    
    def __init__(self):
        super().__init__('swift')

# 格式化器映射
FORMATTERS = {
    'python': PythonFormatter,
    'javascript': JavaScriptFormatter,
    'typescript': TypeScriptFormatter,
    'java': JavaFormatter,
    'cpp': CppFormatter,
    'go': GoFormatter,
    'ruby': RubyFormatter,
    'php': PhpFormatter,
    'rust': RustFormatter,
    'swift': SwiftFormatter
}

def get_formatter(language):
    """
    获取指定语言的格式化器
    
    Args:
        language: 编程语言
        
    Returns:
        CodeFormatter: 格式化器实例
    """
    formatter_class = FORMATTERS.get(language.lower())
    if not formatter_class:
        raise ValueError(f"不支持的语言: {language}")
    
    return formatter_class()

def format_code(code, language, style=None):
    """
    格式化代码
    
    Args:
        code: 代码内容
        language: 编程语言
        style: 格式化风格
        
    Returns:
        str: 格式化后的代码
    """
    try:
        formatter = get_formatter(language)
        return formatter.format_code(code, style)
    except Exception as e:
        logger.error(f"格式化代码失败: {e}")
        return code
