import os
import tempfile
import logging
from pathlib import Path
from typing import Optional, Tuple
import comtypes.client
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.utils import ImageReader
from PIL import Image
import io

logger = logging.getLogger(__name__)


class DocumentConverterService:
    """
    文档转换服务
    支持Word和PPT文档转换为PDF
    """
    
    def __init__(self):
        self.temp_dir = tempfile.gettempdir()
        
    def convert_word_to_pdf(self, word_file_path: str, output_path: Optional[str] = None) -> Tuple[bool, str, str]:
        """
        将Word文档转换为PDF
        
        Args:
            word_file_path: Word文档路径
            output_path: 输出PDF路径，如果为None则自动生成
            
        Returns:
            Tuple[bool, str, str]: (成功标志, PDF路径, 错误信息)
        """
        try:
            if not os.path.exists(word_file_path):
                return False, "", f"Word文件不存在: {word_file_path}"
                
            # 生成输出路径
            if output_path is None:
                base_name = Path(word_file_path).stem
                output_path = os.path.join(self.temp_dir, f"{base_name}_converted.pdf")
                
            logger.info(f"开始转换Word文档: {word_file_path} -> {output_path}")
            
            # 使用COM接口转换Word文档
            word_app = None
            try:
                # 创建Word应用程序实例
                word_app = comtypes.client.CreateObject('Word.Application')
                word_app.Visible = False
                word_app.DisplayAlerts = False
                
                # 打开Word文档
                doc = word_app.Documents.Open(word_file_path)
                
                # 导出为PDF
                # wdExportFormatPDF = 17
                doc.ExportAsFixedFormat(
                    OutputFileName=output_path,
                    ExportFormat=17,  # PDF格式
                    OpenAfterExport=False,
                    OptimizeFor=0,  # 针对打印优化
                    BitmapMissingFonts=True,
                    DocStructureTags=True,
                    CreateBookmarks=0,
                    UseDocumentTitle=True
                )
                
                # 关闭文档
                doc.Close()
                
                logger.info(f"Word文档转换成功: {output_path}")
                return True, output_path, ""
                
            except Exception as e:
                logger.error(f"Word转换过程中出错: {str(e)}")
                return False, "", f"Word转换失败: {str(e)}"
                
            finally:
                # 确保Word应用程序被关闭
                if word_app:
                    try:
                        word_app.Quit()
                    except:
                        pass
                        
        except Exception as e:
            logger.error(f"Word转换服务异常: {str(e)}")
            return False, "", f"转换服务异常: {str(e)}"
    
    def convert_ppt_to_pdf(self, ppt_file_path: str, output_path: Optional[str] = None) -> Tuple[bool, str, str]:
        """
        将PPT文档转换为PDF
        
        Args:
            ppt_file_path: PPT文档路径
            output_path: 输出PDF路径，如果为None则自动生成
            
        Returns:
            Tuple[bool, str, str]: (成功标志, PDF路径, 错误信息)
        """
        try:
            if not os.path.exists(ppt_file_path):
                return False, "", f"PPT文件不存在: {ppt_file_path}"
                
            # 生成输出路径
            if output_path is None:
                base_name = Path(ppt_file_path).stem
                output_path = os.path.join(self.temp_dir, f"{base_name}_converted.pdf")
                
            logger.info(f"开始转换PPT文档: {ppt_file_path} -> {output_path}")
            
            # 使用COM接口转换PPT文档
            ppt_app = None
            try:
                # 创建PowerPoint应用程序实例
                ppt_app = comtypes.client.CreateObject('PowerPoint.Application')
                ppt_app.Visible = 1  # PowerPoint需要可见才能正常工作
                
                # 打开PPT文档
                presentation = ppt_app.Presentations.Open(ppt_file_path, ReadOnly=True)
                
                # 导出为PDF
                # ppSaveAsPDF = 32
                presentation.SaveAs(output_path, 32)  # PDF格式
                
                # 关闭演示文稿
                presentation.Close()
                
                logger.info(f"PPT文档转换成功: {output_path}")
                return True, output_path, ""
                
            except Exception as e:
                logger.error(f"PPT转换过程中出错: {str(e)}")
                return False, "", f"PPT转换失败: {str(e)}"
                
            finally:
                # 确保PowerPoint应用程序被关闭
                if ppt_app:
                    try:
                        ppt_app.Quit()
                    except:
                        pass
                        
        except Exception as e:
            logger.error(f"PPT转换服务异常: {str(e)}")
            return False, "", f"转换服务异常: {str(e)}"
    
    def convert_document(self, file_path: str, output_path: Optional[str] = None) -> Tuple[bool, str, str]:
        """
        通用文档转换方法
        根据文件扩展名自动选择转换方法
        
        Args:
            file_path: 文档路径
            output_path: 输出PDF路径
            
        Returns:
            Tuple[bool, str, str]: (成功标志, PDF路径, 错误信息)
        """
        try:
            file_ext = Path(file_path).suffix.lower()
            
            if file_ext in ['.doc', '.docx']:
                return self.convert_word_to_pdf(file_path, output_path)
            elif file_ext in ['.ppt', '.pptx']:
                return self.convert_ppt_to_pdf(file_path, output_path)
            else:
                return False, "", f"不支持的文件格式: {file_ext}"
                
        except Exception as e:
            logger.error(f"文档转换异常: {str(e)}")
            return False, "", f"文档转换异常: {str(e)}"
    
    def cleanup_temp_files(self, max_age_hours: int = 24):
        """
        清理临时文件
        
        Args:
            max_age_hours: 文件最大保留时间（小时）
        """
        try:
            import time
            current_time = time.time()
            temp_path = Path(self.temp_dir)
            
            for file_path in temp_path.glob("*_converted.pdf"):
                file_age = current_time - file_path.stat().st_mtime
                if file_age > max_age_hours * 3600:  # 转换为秒
                    try:
                        file_path.unlink()
                        logger.info(f"清理临时文件: {file_path}")
                    except Exception as e:
                        logger.warning(f"清理文件失败 {file_path}: {str(e)}")
                        
        except Exception as e:
            logger.error(f"清理临时文件异常: {str(e)}")


# 创建全局实例
document_converter = DocumentConverterService()
