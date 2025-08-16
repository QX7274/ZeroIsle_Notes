import os
import tempfile
import logging
from django.http import JsonResponse, FileResponse, Http404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.utils.decorators import method_decorator
from django.views import View
from .services import document_converter
import json

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name='dispatch')
class DocumentConverterView(View):
    """
    文档转换API视图
    """
    
    def post(self, request):
        """
        处理文档转换请求
        """
        try:
            # 检查是否有文件上传
            if 'file' not in request.FILES:
                return JsonResponse({
                    'success': False,
                    'error': '没有上传文件'
                }, status=400)
            
            uploaded_file = request.FILES['file']
            
            # 验证文件类型
            allowed_extensions = ['.doc', '.docx', '.ppt', '.pptx']
            file_ext = os.path.splitext(uploaded_file.name)[1].lower()
            
            if file_ext not in allowed_extensions:
                return JsonResponse({
                    'success': False,
                    'error': f'不支持的文件格式: {file_ext}'
                }, status=400)
            
            # 保存上传的文件到临时目录
            temp_dir = tempfile.gettempdir()
            temp_file_path = os.path.join(temp_dir, uploaded_file.name)
            
            with open(temp_file_path, 'wb+') as destination:
                for chunk in uploaded_file.chunks():
                    destination.write(chunk)
            
            logger.info(f"文件上传成功: {temp_file_path}")
            
            # 执行转换
            success, pdf_path, error_msg = document_converter.convert_document(temp_file_path)
            
            # 清理上传的临时文件
            try:
                os.remove(temp_file_path)
            except:
                pass
            
            if success:
                # 读取转换后的PDF文件
                with open(pdf_path, 'rb') as pdf_file:
                    pdf_content = pdf_file.read()
                
                # 清理转换后的临时文件
                try:
                    os.remove(pdf_path)
                except:
                    pass
                
                # 生成唯一的文件名
                import uuid
                pdf_filename = f"converted_{uuid.uuid4().hex[:8]}.pdf"
                
                # 保存到Django的媒体存储
                pdf_file_path = default_storage.save(
                    f'converted_docs/{pdf_filename}',
                    ContentFile(pdf_content)
                )
                
                # 返回成功响应
                return JsonResponse({
                    'success': True,
                    'pdf_url': f'/api/document-converter/download/{pdf_filename}',
                    'pdf_path': pdf_file_path,
                    'original_filename': uploaded_file.name
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': error_msg
                }, status=500)
                
        except Exception as e:
            logger.error(f"文档转换API异常: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': f'服务器内部错误: {str(e)}'
            }, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def download_converted_pdf(request, filename):
    """
    下载转换后的PDF文件
    """
    try:
        # 构建文件路径
        file_path = f'converted_docs/{filename}'
        
        # 检查文件是否存在
        if not default_storage.exists(file_path):
            raise Http404("文件不存在")
        
        # 打开文件
        file_obj = default_storage.open(file_path, 'rb')
        
        # 返回文件响应
        response = FileResponse(
            file_obj,
            content_type='application/pdf',
            as_attachment=False
        )
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        
        return response
        
    except Exception as e:
        logger.error(f"PDF下载异常: {str(e)}")
        raise Http404("文件下载失败")


@csrf_exempt
@require_http_methods(["POST"])
def convert_progress(request):
    """
    获取转换进度（模拟实现）
    在实际应用中，可以使用Celery等任务队列来跟踪真实进度
    """
    try:
        data = json.loads(request.body)
        task_id = data.get('task_id')
        
        # 这里是模拟进度，实际应用中应该查询真实的任务状态
        progress_data = {
            'task_id': task_id,
            'progress': 100,  # 假设已完成
            'status': 'completed',
            'message': '转换完成'
        }
        
        return JsonResponse({
            'success': True,
            'data': progress_data
        })
        
    except Exception as e:
        logger.error(f"进度查询异常: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def cleanup_temp_files(request):
    """
    清理临时文件
    """
    try:
        document_converter.cleanup_temp_files()
        
        return JsonResponse({
            'success': True,
            'message': '临时文件清理完成'
        })
        
    except Exception as e:
        logger.error(f"清理临时文件异常: {str(e)}")
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
