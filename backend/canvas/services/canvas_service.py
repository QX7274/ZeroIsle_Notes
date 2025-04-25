"""
画布服务
"""

import logging
from django.db import transaction
from canvas.models import Canvas

logger = logging.getLogger('backend')

class CanvasService:
    """
    画布服务类
    处理画布相关的业务逻辑
    """
    
    def create_canvas(self, user, data):
        """
        创建画布
        
        Args:
            user: 用户对象
            data: 画布数据
            
        Returns:
            Canvas: 创建的画布
        """
        try:
            # 创建画布
            canvas = Canvas.objects.create(
                user=user,
                title=data.get('title', '未命名画布'),
                description=data.get('description', ''),
                is_public=data.get('is_public', False)
            )
            
            return canvas
        except Exception as e:
            logger.error(f"创建画布失败: {e}")
            raise
    
    def update_canvas(self, canvas, data):
        """
        更新画布
        
        Args:
            canvas: 画布对象
            data: 画布数据
            
        Returns:
            Canvas: 更新的画布
        """
        try:
            # 更新画布字段
            for field in ['title', 'description', 'is_public']:
                if field in data:
                    setattr(canvas, field, data[field])
            
            canvas.save()
            return canvas
        except Exception as e:
            logger.error(f"更新画布失败: {e}")
            raise
    
    def delete_canvas(self, canvas):
        """
        删除画布
        
        Args:
            canvas: 画布对象
            
        Returns:
            bool: 是否成功
        """
        try:
            with transaction.atomic():
                # 删除画布的所有元素和连接
                canvas.elements.all().delete()
                canvas.connections.all().delete()
                
                # 删除画布
                canvas.delete()
                
                return True
        except Exception as e:
            logger.error(f"删除画布失败: {e}")
            raise
    
    def increment_view_count(self, canvas):
        """
        增加画布查看次数
        
        Args:
            canvas: 画布对象
            
        Returns:
            Canvas: 更新的画布
        """
        try:
            canvas.view_count += 1
            canvas.save(update_fields=['view_count'])
            return canvas
        except Exception as e:
            logger.error(f"增加画布查看次数失败: {e}")
            raise
    
    def get_canvas_by_id(self, canvas_id, user=None):
        """
        根据ID获取画布
        
        Args:
            canvas_id: 画布ID
            user: 用户对象
            
        Returns:
            Canvas: 画布对象
        """
        try:
            # 获取画布
            if user:
                # 用户可以查看自己的画布和公开的画布
                canvas = Canvas.objects.filter(
                    id=canvas_id
                ).filter(
                    models.Q(user=user) | models.Q(is_public=True)
                ).first()
            else:
                # 未登录用户只能查看公开的画布
                canvas = Canvas.objects.filter(
                    id=canvas_id,
                    is_public=True
                ).first()
            
            if not canvas:
                raise Canvas.DoesNotExist(f"画布不存在或无权访问: {canvas_id}")
            
            return canvas
        except Canvas.DoesNotExist:
            logger.error(f"画布不存在: {canvas_id}")
            raise
        except Exception as e:
            logger.error(f"获取画布失败: {e}")
            raise
