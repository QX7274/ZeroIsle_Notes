"""
代码沙箱工具
提供安全的代码执行环境
"""

import os
import subprocess
import tempfile
import time
import signal
import resource
import logging
import uuid
from .languages import LANGUAGE_CONFIG

logger = logging.getLogger('backend')

# 默认资源限制
DEFAULT_RESOURCE_LIMITS = {
    'cpu_time': 5,  # 秒
    'memory': 100 * 1024 * 1024,  # 100MB
    'file_size': 5 * 1024 * 1024,  # 5MB
    'processes': 5,  # 最多5个进程
}

class CodeSandbox:
    """代码沙箱类"""
    
    def __init__(self, language, resource_limits=None):
        """
        初始化沙箱
        
        Args:
            language: 编程语言
            resource_limits: 资源限制
        """
        self.language = language.lower()
        self.config = LANGUAGE_CONFIG.get(self.language)
        if not self.config:
            raise ValueError(f"不支持的语言: {language}")
        
        self.resource_limits = resource_limits or DEFAULT_RESOURCE_LIMITS
        self.temp_dir = None
        self.temp_file_path = None
        self.input_file_path = None
        self.output_file_path = None
    
    def setup(self, code, input_data=None):
        """
        设置沙箱环境
        
        Args:
            code: 代码内容
            input_data: 输入数据
            
        Returns:
            bool: 是否设置成功
        """
        try:
            # 创建临时目录
            self.temp_dir = tempfile.mkdtemp(prefix='code_sandbox_')
            
            # 创建代码文件
            file_name = f"code_{uuid.uuid4().hex}.{self.config['extension']}"
            self.temp_file_path = os.path.join(self.temp_dir, file_name)
            with open(self.temp_file_path, 'w', encoding='utf-8') as f:
                f.write(code)
            
            # 创建输入文件（如果有）
            if input_data:
                self.input_file_path = os.path.join(self.temp_dir, 'input.txt')
                with open(self.input_file_path, 'w', encoding='utf-8') as f:
                    f.write(input_data)
            
            # 创建输出文件
            self.output_file_path = os.path.join(self.temp_dir, 'output.txt')
            
            return True
        except Exception as e:
            logger.error(f"设置沙箱环境失败: {e}")
            self.cleanup()
            return False
    
    def run(self):
        """
        在沙箱中运行代码
        
        Returns:
            dict: 运行结果
        """
        if not self.temp_file_path:
            return {
                'output': '',
                'error': '沙箱环境未设置',
                'execution_time': 0,
                'memory_usage': 0
            }
        
        start_time = time.time()
        
        try:
            # 准备命令
            command = self.config['run_command'].format(file=self.temp_file_path)
            
            # 设置输入输出重定向
            stdin = open(self.input_file_path, 'r') if self.input_file_path else subprocess.PIPE
            stdout = open(self.output_file_path, 'w') if self.output_file_path else subprocess.PIPE
            
            # 创建进程
            process = subprocess.Popen(
                command,
                shell=True,
                stdin=stdin,
                stdout=stdout,
                stderr=subprocess.PIPE,
                text=True,
                preexec_fn=self._set_resource_limits
            )
            
            # 设置超时时间
            timeout = self.resource_limits['cpu_time']
            
            # 等待进程完成
            try:
                _, error = process.communicate(timeout=timeout)
            except subprocess.TimeoutExpired:
                # 超时，终止进程
                process.kill()
                return {
                    'output': '',
                    'error': '执行超时',
                    'execution_time': timeout,
                    'memory_usage': 0
                }
            
            # 计算执行时间
            execution_time = time.time() - start_time
            
            # 读取输出
            output = ''
            if self.output_file_path and os.path.exists(self.output_file_path):
                with open(self.output_file_path, 'r', encoding='utf-8') as f:
                    output = f.read()
            
            # 估算内存使用（简单实现，实际应使用更准确的方法）
            memory_usage = 0
            
            return {
                'output': output,
                'error': error,
                'execution_time': execution_time,
                'memory_usage': memory_usage
            }
        except Exception as e:
            logger.error(f"在沙箱中运行代码失败: {e}")
            return {
                'output': '',
                'error': str(e),
                'execution_time': time.time() - start_time,
                'memory_usage': 0
            }
        finally:
            # 关闭文件
            if stdin != subprocess.PIPE:
                stdin.close()
            if stdout != subprocess.PIPE:
                stdout.close()
    
    def _set_resource_limits(self):
        """设置资源限制"""
        # 设置CPU时间限制
        resource.setrlimit(resource.RLIMIT_CPU, (self.resource_limits['cpu_time'], self.resource_limits['cpu_time']))
        
        # 设置内存限制
        resource.setrlimit(resource.RLIMIT_AS, (self.resource_limits['memory'], self.resource_limits['memory']))
        
        # 设置文件大小限制
        resource.setrlimit(resource.RLIMIT_FSIZE, (self.resource_limits['file_size'], self.resource_limits['file_size']))
        
        # 设置进程数限制
        resource.setrlimit(resource.RLIMIT_NPROC, (self.resource_limits['processes'], self.resource_limits['processes']))
    
    def cleanup(self):
        """清理沙箱环境"""
        try:
            # 删除临时文件
            if self.temp_file_path and os.path.exists(self.temp_file_path):
                os.unlink(self.temp_file_path)
            
            if self.input_file_path and os.path.exists(self.input_file_path):
                os.unlink(self.input_file_path)
            
            if self.output_file_path and os.path.exists(self.output_file_path):
                os.unlink(self.output_file_path)
            
            # 删除临时目录
            if self.temp_dir and os.path.exists(self.temp_dir):
                os.rmdir(self.temp_dir)
        except Exception as e:
            logger.error(f"清理沙箱环境失败: {e}")

def run_code_in_sandbox(code, language, input_data=None, resource_limits=None):
    """
    在沙箱中运行代码
    
    Args:
        code: 代码内容
        language: 编程语言
        input_data: 输入数据
        resource_limits: 资源限制
        
    Returns:
        dict: 运行结果
    """
    sandbox = CodeSandbox(language, resource_limits)
    
    try:
        if not sandbox.setup(code, input_data):
            return {
                'output': '',
                'error': '设置沙箱环境失败',
                'execution_time': 0,
                'memory_usage': 0
            }
        
        return sandbox.run()
    finally:
        sandbox.cleanup()

def is_sandbox_available():
    """
    检查沙箱是否可用
    
    Returns:
        bool: 是否可用
    """
    try:
        # 尝试设置资源限制
        resource.setrlimit(resource.RLIMIT_CPU, (1, 1))
        resource.setrlimit(resource.RLIMIT_CPU, (resource.RLIM_INFINITY, resource.RLIM_INFINITY))
        return True
    except Exception:
        return False
