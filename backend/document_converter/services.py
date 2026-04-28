import os
import subprocess
import tempfile
import logging
import shlex
from pathlib import Path
from typing import Optional, Tuple

from django.conf import settings
from .exceptions import ToolNotFoundError, ConversionTimeoutError, ConversionFailedError

logger = logging.getLogger(__name__)


logger = logging.getLogger(__name__)

class DocumentConverterService:
    """
    文档转换服务
    - loffice 模式：优先使用 LibreOffice/soffice 进行转换
    - lite 模式：优先对 markdown/txt/html 使用 pandoc，其余回退至 LibreOffice
    """

    def __init__(self):
        self.libreoffice_path = getattr(settings, 'LIBREOFFICE_PATH', 'libreoffice')
        self.pandoc_path = getattr(settings, 'PANDOC_PATH', 'pandoc')
        self.conversion_timeout = getattr(settings, 'CONVERSION_TIMEOUT', 300)
        self.mode = getattr(settings, 'DOC_CONVERTER_MODE', 'lite')

    def _run_command(self, command: list):
        """安全地执行一个外部命令。"""
        try:
            result = subprocess.run(
                command,
                check=True,
                capture_output=True,
                text=True,
                timeout=self.conversion_timeout
            )
            logger.info(f"命令执行成功: {' '.join(command)}")
            return result
        except FileNotFoundError:
            logger.error(f"命令未找到: {command[0]}")
            raise ToolNotFoundError(f"转换工具 '{command[0]}' 未找到或不可执行。")
        except subprocess.TimeoutExpired:
            logger.error(f"命令执行超时 ({self.conversion_timeout}s): {' '.join(command)}")
            raise ConversionTimeoutError("文档转换超时。")
        except subprocess.CalledProcessError as e:
            logger.error(f"命令执行失败: {' '.join(command)}")
            logger.error(f"错误输出: {e.stderr}")
            raise ConversionFailedError(f"文档转换失败: {e.stderr}")
    def _convert_with_libreoffice(self, input_path: str, output_dir: str) -> str:
        command = [
            self.libreoffice_path,
            '--headless',
            '--convert-to', 'pdf',
            '--outdir', output_dir,
            input_path,
        ]
        self._run_command(command)
        output_filename = f"{Path(input_path).stem}.pdf"
        output_path = os.path.join(output_dir, output_filename)
        if not os.path.exists(output_path):
            raise ConversionFailedError("转换后的PDF文件未在预期位置生成。")
        return output_path

    def _convert_with_pandoc(self, input_path: str, output_dir: str) -> str:
        """使用 pandoc 将文本/markdown/html 转为 PDF。不可用或失败时应由调用者回退。"""
        output_path = os.path.join(output_dir, f"{Path(input_path).stem}.pdf")
        command = [
            self.pandoc_path,
            input_path,
            '-o', output_path,
        ]
        self._run_command(command)
        if not os.path.exists(output_path):
            raise ConversionFailedError("pandoc 生成PDF失败")
        return output_path


    def convert_to_pdf(self, input_path: str, output_dir: str) -> str:
        """
        根据模式选择转换路径并生成 PDF。
        - loffice: 使用 LibreOffice/soffice 转换
        - lite: 对 markdown/txt/html 优先使用 pandoc，否则回退到 LibreOffice
        """
        ext = Path(input_path).suffix.lower()
        if self.mode == 'loffice':
            return self._convert_with_libreoffice(input_path, output_dir)

        # lite 模式
        text_like_ext = {'.md', '.markdown', '.txt', '.html', '.htm'}
        if ext in text_like_ext:
            try:
                return self._convert_with_pandoc(input_path, output_dir)
            except (ToolNotFoundError, ConversionFailedError, ConversionTimeoutError):
                logger.warning("pandoc 转换失败或不可用，回退到 LibreOffice")
        # 回退 LibreOffice
        return self._convert_with_libreoffice(input_path, output_dir)

# 创建全局实例
document_converter = DocumentConverterService()
