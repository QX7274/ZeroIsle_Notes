"""
代码沙箱工具
提供安全的代码执行环境
"""

import os
import subprocess
import tempfile
import time
import signal
import logging
import uuid
from .languages import LANGUAGE_CONFIG

logger = logging.getLogger('backend')

# resource 模块在 Windows 上不可用
try:
    import resource
    IS_UNIX = True
except ImportError:
    IS_UNIX = False
    logger.warning("沙箱警告：'resource' 模块不可用（非 Unix 系统）。代码执行将没有资源限制，这在生产环境中是不安全的。")

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
        在沙箱中运行代码（安全重构版）

        Returns:
            dict: 运行结果
        """
        if not self.temp_file_path:
            return {'output': '', 'error': '沙箱环境未设置', 'execution_time': 0, 'memory_usage': 0}

        start_time = time.time()
        compile_command_str = self.config.get('compile_command')
        run_command_template = self.config['run_command']

        # 编译步骤（如果需要）
        if compile_command_str:
            # 格式化编译命令
            # os.path.basename 用于获取文件名，避免路径操纵
            base_filename = os.path.basename(self.temp_file_path)
            executable_filename = os.path.splitext(base_filename)[0]
            compile_cmd = [part.format(file=base_filename, output=executable_filename) for part in compile_command_str.split()]

            try:
                compile_proc = subprocess.run(
                    compile_cmd,
                    cwd=self.temp_dir,  # 在临时目录中执行
                    capture_output=True,
                    text=True,
                    timeout=self.resource_limits['cpu_time']
                )
                if compile_proc.returncode != 0:
                    return {'output': '', 'error': f"编译失败:\n{compile_proc.stderr}", 'execution_time': time.time() - start_time, 'memory_usage': 0}
            except subprocess.TimeoutExpired:
                return {'output': '', 'error': '编译超时', 'execution_time': self.resource_limits['cpu_time'], 'memory_usage': 0}
            except Exception as e:
                logger.error(f"沙箱编译步骤异常: {e}")
                return {'output': '', 'error': f"编译异常: {e}", 'execution_time': time.time() - start_time, 'memory_usage': 0}

        # 准备执行命令
        base_filename = os.path.basename(self.temp_file_path)
        executable_filename = os.path.splitext(base_filename)[0]
        run_cmd_str = run_command_template.format(file=base_filename, executable=executable_filename)
        run_cmd_list = run_cmd_str.split()

        # 执行代码
        stdin, stdout = None, None
        try:
            stdin = open(self.input_file_path, 'r') if self.input_file_path else subprocess.PIPE
            stdout = open(self.output_file_path, 'w') if self.output_file_path else subprocess.PIPE

            popen_kwargs = {
                "stdin": stdin,
                "stdout": stdout,
                "stderr": subprocess.PIPE,
                "text": True,
                "cwd": self.temp_dir,  # 确保在临时目录中执行
            }
            if IS_UNIX:
                popen_kwargs["preexec_fn"] = self._set_resource_limits

            process = subprocess.Popen(run_cmd_list, **popen_kwargs)

            try:
                _, error = process.communicate(timeout=self.resource_limits['cpu_time'])
            except subprocess.TimeoutExpired:
                process.kill()
                return {'output': '', 'error': '执行超时', 'execution_time': self.resource_limits['cpu_time'], 'memory_usage': 0}

            execution_time = time.time() - start_time
            output = ''
            if self.output_file_path and os.path.exists(self.output_file_path):
                with open(self.output_file_path, 'r', encoding='utf-8') as f:
                    output = f.read()

            return {'output': output, 'error': error, 'execution_time': execution_time, 'memory_usage': 0}

        except Exception as e:
            logger.error(f"在沙箱中运行代码失败: {e}")
            return {'output': '', 'error': str(e), 'execution_time': time.time() - start_time, 'memory_usage': 0}
        finally:
            if stdin and stdin != subprocess.PIPE: stdin.close()
            if stdout and stdout != subprocess.PIPE: stdout.close()
    
    def _set_resource_limits(self):
        """设置资源限制（仅在 Unix 系统上有效）"""
        if not IS_UNIX:
            return

        try:
            # 设置CPU时间限制
            resource.setrlimit(resource.RLIMIT_CPU, (self.resource_limits['cpu_time'], self.resource_limits['cpu_time']))

            # 设置内存限制
            resource.setrlimit(resource.RLIMIT_AS, (self.resource_limits['memory'], self.resource_limits['memory']))

            # 设置文件大小限制
            resource.setrlimit(resource.RLIMIT_FSIZE, (self.resource_limits['file_size'], self.resource_limits['file_size']))

            # 设置进程数限制
            resource.setrlimit(resource.RLIMIT_NPROC, (self.resource_limits['processes'], self.resource_limits['processes']))
        except Exception as e:
            # 在 preexec_fn 中打印日志可能不可靠，但此处仍尝试记录
            logger.error(f"沙箱内设置资源限制失败: {e}")
    
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
    检查带资源限制的安全沙箱是否可用。
    在非 Unix 系统（如 Windows）上，代码仍可执行，但没有资源隔离。

    Returns:
        bool: 如果资源限制可用则为 True，否则为 False。
    """
    return IS_UNIX
