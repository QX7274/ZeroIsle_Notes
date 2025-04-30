"""
画布导出服务
"""

import os
import json
import tempfile
import logging
from django.conf import settings
from django.http import HttpResponse, FileResponse
from canvas.mongodb_models import Canvas, CanvasElement, CanvasConnection
from canvas.serializers import CanvasSerializer, CanvasElementSerializer, CanvasConnectionSerializer

# 配置日志
logger = logging.getLogger(__name__)

class CanvasExportService:
    """
    画布导出服务
    提供将画布导出为不同格式的功能
    """
    
    def __init__(self):
        """
        初始化
        """
        # 创建导出目录
        self.export_dir = os.path.join(settings.MEDIA_ROOT, 'exports')
        os.makedirs(self.export_dir, exist_ok=True)
    
    def export_to_json(self, canvas):
        """
        导出画布为JSON格式
        
        Args:
            canvas: 画布对象
            
        Returns:
            HttpResponse: 包含JSON数据的HTTP响应
        """
        try:
            # 获取画布数据
            canvas_data = CanvasSerializer(canvas).data
            elements = CanvasElementSerializer(canvas.elements.all(), many=True).data
            connections = CanvasConnectionSerializer(canvas.connections.all(), many=True).data
            
            # 构建完整数据
            full_data = {
                'canvas': canvas_data,
                'elements': elements,
                'connections': connections
            }
            
            # 创建HTTP响应
            response = HttpResponse(json.dumps(full_data, indent=2), content_type='application/json')
            response['Content-Disposition'] = f'attachment; filename="{canvas.title}.json"'
            
            return response
        except Exception as e:
            logger.error(f"导出画布为JSON失败: {str(e)}")
            raise
    
    def export_to_png(self, canvas):
        """
        导出画布为PNG格式
        
        Args:
            canvas: 画布对象
            
        Returns:
            FileResponse: 包含PNG图像的文件响应
        """
        try:
            # 导入必要的库
            import cairo
            
            # 获取画布元素和连接
            elements = canvas.elements.all()
            connections = canvas.connections.all()
            
            # 确定画布尺寸
            width = 800
            height = 600
            
            # 如果有元素，根据元素位置调整画布尺寸
            if elements:
                max_x = max([element.position.get('x', 0) + element.size.get('width', 0) for element in elements])
                max_y = max([element.position.get('y', 0) + element.size.get('height', 0) for element in elements])
                width = max(width, max_x + 50)
                height = max(height, max_y + 50)
            
            # 创建临时文件
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                temp_path = temp_file.name
            
            # 创建Cairo表面和上下文
            surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, int(width), int(height))
            ctx = cairo.Context(surface)
            
            # 设置白色背景
            ctx.set_source_rgb(1, 1, 1)
            ctx.rectangle(0, 0, width, height)
            ctx.fill()
            
            # 绘制连接
            for connection in connections:
                # 获取源和目标元素
                source_id = connection.source
                target_id = connection.target
                
                try:
                    source_element = next(element for element in elements if str(element.id) == source_id)
                    target_element = next(element for element in elements if str(element.id) == target_id)
                    
                    # 计算连接点
                    source_x = source_element.position.get('x', 0) + source_element.size.get('width', 0) / 2
                    source_y = source_element.position.get('y', 0) + source_element.size.get('height', 0) / 2
                    target_x = target_element.position.get('x', 0) + target_element.size.get('width', 0) / 2
                    target_y = target_element.position.get('y', 0) + target_element.size.get('height', 0) / 2
                    
                    # 绘制连接线
                    ctx.set_source_rgb(0, 0, 0)
                    ctx.set_line_width(2)
                    ctx.move_to(source_x, source_y)
                    ctx.line_to(target_x, target_y)
                    ctx.stroke()
                except Exception as e:
                    logger.warning(f"绘制连接失败: {str(e)}")
            
            # 绘制元素
            for element in elements:
                # 获取元素属性
                x = element.position.get('x', 0)
                y = element.position.get('y', 0)
                width = element.size.get('width', 100)
                height = element.size.get('height', 50)
                
                # 根据元素类型绘制不同形状
                element_type = element.type
                
                if element_type == 'rectangle':
                    # 绘制矩形
                    ctx.set_source_rgb(0.9, 0.9, 0.9)
                    ctx.rectangle(x, y, width, height)
                    ctx.fill()
                    
                    ctx.set_source_rgb(0, 0, 0)
                    ctx.rectangle(x, y, width, height)
                    ctx.stroke()
                elif element_type == 'circle':
                    # 绘制圆形
                    radius = min(width, height) / 2
                    center_x = x + width / 2
                    center_y = y + height / 2
                    
                    ctx.set_source_rgb(0.9, 0.9, 0.9)
                    ctx.arc(center_x, center_y, radius, 0, 2 * 3.14159)
                    ctx.fill()
                    
                    ctx.set_source_rgb(0, 0, 0)
                    ctx.arc(center_x, center_y, radius, 0, 2 * 3.14159)
                    ctx.stroke()
                elif element_type == 'text':
                    # 绘制文本
                    ctx.set_source_rgb(0, 0, 0)
                    ctx.select_font_face("Arial", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
                    ctx.set_font_size(12)
                    ctx.move_to(x + 5, y + 20)
                    ctx.show_text(element.content or "")
                else:
                    # 默认绘制矩形
                    ctx.set_source_rgb(0.9, 0.9, 0.9)
                    ctx.rectangle(x, y, width, height)
                    ctx.fill()
                    
                    ctx.set_source_rgb(0, 0, 0)
                    ctx.rectangle(x, y, width, height)
                    ctx.stroke()
            
            # 保存为PNG
            surface.write_to_png(temp_path)
            
            # 创建文件响应
            response = FileResponse(open(temp_path, 'rb'), content_type='image/png')
            response['Content-Disposition'] = f'attachment; filename="{canvas.title}.png"'
            
            return response
        except ImportError:
            logger.error("导出画布为PNG失败: 缺少必要的库 (cairo)")
            raise Exception("导出画布为PNG失败: 缺少必要的库 (cairo)")
        except Exception as e:
            logger.error(f"导出画布为PNG失败: {str(e)}")
            raise
    
    def export_to_svg(self, canvas):
        """
        导出画布为SVG格式
        
        Args:
            canvas: 画布对象
            
        Returns:
            HttpResponse: 包含SVG数据的HTTP响应
        """
        try:
            # 获取画布元素和连接
            elements = canvas.elements.all()
            connections = canvas.connections.all()
            
            # 确定画布尺寸
            width = 800
            height = 600
            
            # 如果有元素，根据元素位置调整画布尺寸
            if elements:
                max_x = max([element.position.get('x', 0) + element.size.get('width', 0) for element in elements])
                max_y = max([element.position.get('y', 0) + element.size.get('height', 0) for element in elements])
                width = max(width, max_x + 50)
                height = max(height, max_y + 50)
            
            # 创建SVG内容
            svg_content = f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}">\n'
            
            # 添加白色背景
            svg_content += f'<rect width="{width}" height="{height}" fill="white" />\n'
            
            # 添加连接
            for connection in connections:
                # 获取源和目标元素
                source_id = connection.source
                target_id = connection.target
                
                try:
                    source_element = next(element for element in elements if str(element.id) == source_id)
                    target_element = next(element for element in elements if str(element.id) == target_id)
                    
                    # 计算连接点
                    source_x = source_element.position.get('x', 0) + source_element.size.get('width', 0) / 2
                    source_y = source_element.position.get('y', 0) + source_element.size.get('height', 0) / 2
                    target_x = target_element.position.get('x', 0) + target_element.size.get('width', 0) / 2
                    target_y = target_element.position.get('y', 0) + target_element.size.get('height', 0) / 2
                    
                    # 添加连接线
                    svg_content += f'<line x1="{source_x}" y1="{source_y}" x2="{target_x}" y2="{target_y}" stroke="black" stroke-width="2" />\n'
                except Exception as e:
                    logger.warning(f"添加连接失败: {str(e)}")
            
            # 添加元素
            for element in elements:
                # 获取元素属性
                x = element.position.get('x', 0)
                y = element.position.get('y', 0)
                width = element.size.get('width', 100)
                height = element.size.get('height', 50)
                
                # 根据元素类型添加不同形状
                element_type = element.type
                
                if element_type == 'rectangle':
                    # 添加矩形
                    svg_content += f'<rect x="{x}" y="{y}" width="{width}" height="{height}" fill="#E8E8E8" stroke="black" />\n'
                elif element_type == 'circle':
                    # 添加圆形
                    radius = min(width, height) / 2
                    center_x = x + width / 2
                    center_y = y + height / 2
                    svg_content += f'<circle cx="{center_x}" cy="{center_y}" r="{radius}" fill="#E8E8E8" stroke="black" />\n'
                elif element_type == 'text':
                    # 添加文本
                    svg_content += f'<text x="{x + 5}" y="{y + 20}" font-family="Arial" font-size="12">{element.content or ""}</text>\n'
                else:
                    # 默认添加矩形
                    svg_content += f'<rect x="{x}" y="{y}" width="{width}" height="{height}" fill="#E8E8E8" stroke="black" />\n'
            
            # 结束SVG
            svg_content += '</svg>'
            
            # 创建HTTP响应
            response = HttpResponse(svg_content, content_type='image/svg+xml')
            response['Content-Disposition'] = f'attachment; filename="{canvas.title}.svg"'
            
            return response
        except Exception as e:
            logger.error(f"导出画布为SVG失败: {str(e)}")
            raise
    
    def export_to_pdf(self, canvas):
        """
        导出画布为PDF格式
        
        Args:
            canvas: 画布对象
            
        Returns:
            FileResponse: 包含PDF文件的文件响应
        """
        try:
            # 导入必要的库
            import cairo
            
            # 获取画布元素和连接
            elements = canvas.elements.all()
            connections = canvas.connections.all()
            
            # 确定画布尺寸
            width = 800
            height = 600
            
            # 如果有元素，根据元素位置调整画布尺寸
            if elements:
                max_x = max([element.position.get('x', 0) + element.size.get('width', 0) for element in elements])
                max_y = max([element.position.get('y', 0) + element.size.get('height', 0) for element in elements])
                width = max(width, max_x + 50)
                height = max(height, max_y + 50)
            
            # 创建临时文件
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
                temp_path = temp_file.name
            
            # 创建Cairo PDF表面和上下文
            surface = cairo.PDFSurface(temp_path, width, height)
            ctx = cairo.Context(surface)
            
            # 设置白色背景
            ctx.set_source_rgb(1, 1, 1)
            ctx.rectangle(0, 0, width, height)
            ctx.fill()
            
            # 绘制连接
            for connection in connections:
                # 获取源和目标元素
                source_id = connection.source
                target_id = connection.target
                
                try:
                    source_element = next(element for element in elements if str(element.id) == source_id)
                    target_element = next(element for element in elements if str(element.id) == target_id)
                    
                    # 计算连接点
                    source_x = source_element.position.get('x', 0) + source_element.size.get('width', 0) / 2
                    source_y = source_element.position.get('y', 0) + source_element.size.get('height', 0) / 2
                    target_x = target_element.position.get('x', 0) + target_element.size.get('width', 0) / 2
                    target_y = target_element.position.get('y', 0) + target_element.size.get('height', 0) / 2
                    
                    # 绘制连接线
                    ctx.set_source_rgb(0, 0, 0)
                    ctx.set_line_width(2)
                    ctx.move_to(source_x, source_y)
                    ctx.line_to(target_x, target_y)
                    ctx.stroke()
                except Exception as e:
                    logger.warning(f"绘制连接失败: {str(e)}")
            
            # 绘制元素
            for element in elements:
                # 获取元素属性
                x = element.position.get('x', 0)
                y = element.position.get('y', 0)
                width = element.size.get('width', 100)
                height = element.size.get('height', 50)
                
                # 根据元素类型绘制不同形状
                element_type = element.type
                
                if element_type == 'rectangle':
                    # 绘制矩形
                    ctx.set_source_rgb(0.9, 0.9, 0.9)
                    ctx.rectangle(x, y, width, height)
                    ctx.fill()
                    
                    ctx.set_source_rgb(0, 0, 0)
                    ctx.rectangle(x, y, width, height)
                    ctx.stroke()
                elif element_type == 'circle':
                    # 绘制圆形
                    radius = min(width, height) / 2
                    center_x = x + width / 2
                    center_y = y + height / 2
                    
                    ctx.set_source_rgb(0.9, 0.9, 0.9)
                    ctx.arc(center_x, center_y, radius, 0, 2 * 3.14159)
                    ctx.fill()
                    
                    ctx.set_source_rgb(0, 0, 0)
                    ctx.arc(center_x, center_y, radius, 0, 2 * 3.14159)
                    ctx.stroke()
                elif element_type == 'text':
                    # 绘制文本
                    ctx.set_source_rgb(0, 0, 0)
                    ctx.select_font_face("Arial", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
                    ctx.set_font_size(12)
                    ctx.move_to(x + 5, y + 20)
                    ctx.show_text(element.content or "")
                else:
                    # 默认绘制矩形
                    ctx.set_source_rgb(0.9, 0.9, 0.9)
                    ctx.rectangle(x, y, width, height)
                    ctx.fill()
                    
                    ctx.set_source_rgb(0, 0, 0)
                    ctx.rectangle(x, y, width, height)
                    ctx.stroke()
            
            # 完成PDF
            surface.finish()
            
            # 创建文件响应
            response = FileResponse(open(temp_path, 'rb'), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{canvas.title}.pdf"'
            
            return response
        except ImportError:
            logger.error("导出画布为PDF失败: 缺少必要的库 (cairo)")
            raise Exception("导出画布为PDF失败: 缺少必要的库 (cairo)")
        except Exception as e:
            logger.error(f"导出画布为PDF失败: {str(e)}")
            raise
