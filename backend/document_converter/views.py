import os
import tempfile
import logging
import base64
import json
from django.http import JsonResponse, FileResponse, Http404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.utils.decorators import method_decorator
from django.views import View
from .services import DocumentConverterService

logger = logging.getLogger(__name__)

# 创建转换器实例
document_converter = DocumentConverterService()


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
            
            # 执行转换（使用新的跨平台方法）
            result = document_converter.convert_file(temp_file_path)
            success = result['success']
            pdf_path = result.get('output_file', '')
            error_msg = result.get('error', '转换失败')
            
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

                # 转换PDF为base64
                pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')

                # 生成唯一的文件名（用于下载链接）
                import uuid
                pdf_filename = f"converted_{uuid.uuid4().hex[:8]}.pdf"

                # 保存到Django的媒体存储（可选，用于下载）
                pdf_file_path = default_storage.save(
                    f'converted_docs/{pdf_filename}',
                    ContentFile(pdf_content)
                )

                # 返回成功响应（包含base64数据）
                return JsonResponse({
                    'success': True,
                    'pdf_base64': pdf_base64,
                    'pdf_url': f'/api/v1/document-converter/download/{pdf_filename}',
                    'pdf_path': pdf_file_path,
                    'file_info': {
                        'original_name': uploaded_file.name,
                        'file_type': result.get('file_type', 'unknown'),
                        'pages': result.get('pages', 1),
                        'conversion_method': result.get('conversion_method', 'unknown'),
                        'output_size': len(pdf_content)
                    },
                    'timestamp': result.get('timestamp', ''),
                    'message': '转换成功'
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


@method_decorator(csrf_exempt, name='dispatch')
class Base64ConvertView(View):
    """Base64文件转换视图"""

    def post(self, request):
        """处理Base64文件转换请求"""
        try:
            # 解析JSON数据
            data = json.loads(request.body)

            # 检查必需字段
            if 'file_data' not in data or 'file_extension' not in data:
                return JsonResponse({
                    'success': False,
                    'error': '缺少必需字段: file_data, file_extension',
                    'code': 'MISSING_FIELDS'
                }, status=400)

            file_data = data['file_data']
            file_extension = data['file_extension'].lower()
            filename = data.get('filename', f'document.{file_extension}')

            # 检查文件类型
            supported_formats = ['ppt', 'pptx', 'doc', 'docx']
            if file_extension not in supported_formats:
                return JsonResponse({
                    'success': False,
                    'error': f'不支持的文件类型: {file_extension}。支持的格式: {", ".join(supported_formats)}',
                    'code': 'UNSUPPORTED_FORMAT'
                }, status=400)

            logger.info(f"开始Base64转换: {filename} ({file_extension})")

            # 转换文件
            result = document_converter.convert_base64_file(file_data, file_extension)

            if result['success']:
                return JsonResponse({
                    'success': True,
                    'pdf_base64': result['pdf_base64'],
                    'file_info': {
                        'original_name': filename,
                        'file_type': file_extension,
                        'pages': result.get('pages', 1),
                        'conversion_method': result.get('conversion_method', 'unknown'),
                        'output_size': len(base64.b64decode(result['pdf_base64']))
                    },
                    'timestamp': result['timestamp'],
                    'message': '转换成功'
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': result.get('error', '转换失败'),
                    'code': 'CONVERSION_FAILED'
                }, status=500)

        except json.JSONDecodeError:
            return JsonResponse({
                'success': False,
                'error': '无效的JSON数据',
                'code': 'INVALID_JSON'
            }, status=400)
        except Exception as e:
            logger.error(f"Base64转换API异常: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': str(e),
                'code': 'INTERNAL_ERROR'
            }, status=500)


@require_http_methods(["GET"])
def health_check(request):
    """健康检查接口"""
    return JsonResponse({
        'status': 'healthy',
        'service': 'document-converter',
        'timestamp': '2023-12-01T12:00:00',
        'supported_formats': ['ppt', 'pptx', 'doc', 'docx']
    })


@require_http_methods(["GET"])
def conversion_status(request):
    """获取转换服务状态"""
    return JsonResponse({
        'service': 'document-converter',
        'status': 'running',
        'supported_formats': ['ppt', 'pptx', 'doc', 'docx'],
        'timestamp': '2023-12-01T12:00:00',
        'version': '1.0.0'
    })
