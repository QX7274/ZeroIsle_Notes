"""
画布元素服务
"""

import logging
from django.db import transaction
from canvas.models import Canvas, CanvasElement
from canvas.serializers import CanvasElementSerializer

logger = logging.getLogger('backend')

class CanvasElementService:
    """
    画布元素服务类
    处理画布元素相关的业务逻辑
    """
    
    def bulk_update_elements(self, elements_data, user):
        """
        批量更新元素
        
        Args:
            elements_data: 元素数据列表
            user: 用户对象
            
        Returns:
            list: 更新的元素列表
        """
        try:
            updated_elements = []
            
            for element_data in elements_data:
                element_id = element_data.pop('id', None)
                if not element_id:
                    continue
                    
                try:
                    element = CanvasElement.objects.get(id=element_id)
                    # 确保用户有权限更新此元素
                    if element.canvas.user != user:
                        continue
                        
                    serializer = CanvasElementSerializer(element, data=element_data, partial=True)
                    if serializer.is_valid():
                        serializer.save()
                        updated_elements.append(serializer.data)
                except CanvasElement.DoesNotExist:
                    pass
            
            return updated_elements
        except Exception as e:
            logger.error(f"批量更新元素失败: {e}")
            raise
    
    def bulk_create_elements(self, elements_data, canvas_id, user):
        """
        批量创建元素
        
        Args:
            elements_data: 元素数据列表
            canvas_id: 画布ID
            user: 用户对象
            
        Returns:
            list: 创建的元素列表
        """
        try:
            # 获取画布
            try:
                canvas = Canvas.objects.get(id=canvas_id)
                # 确保用户有权限在此画布上创建元素
                if canvas.user != user:
                    raise ValueError(f"无权在此画布上创建元素: {canvas_id}")
            except Canvas.DoesNotExist:
                raise ValueError(f"画布不存在: {canvas_id}")
            
            created_elements = []
            
            with transaction.atomic():
                for element_data in elements_data:
                    # 设置画布ID
                    element_data['canvas'] = canvas.id
                    
                    serializer = CanvasElementSerializer(data=element_data)
                    if serializer.is_valid():
                        element = serializer.save()
                        created_elements.append(serializer.data)
            
            return created_elements
        except Exception as e:
            logger.error(f"批量创建元素失败: {e}")
            raise
    
    def bulk_delete_elements(self, element_ids, user):
        """
        批量删除元素
        
        Args:
            element_ids: 元素ID列表
            user: 用户对象
            
        Returns:
            int: 删除的元素数量
        """
        try:
            # 获取用户有权限删除的元素
            elements = CanvasElement.objects.filter(
                id__in=element_ids,
                canvas__user=user
            )
            
            # 删除元素
            count, _ = elements.delete()
            
            return count
        except Exception as e:
            logger.error(f"批量删除元素失败: {e}")
            raise

    def get_elements_in_viewport(self, canvas_id, viewport_rect):
        """
        获取视口内的元素（空间查询优化）
        
        Args:
            canvas_id: 画布ID
            viewport_rect: 视口矩形 {'x': float, 'y': float, 'width': float, 'height': float}
            
        Returns:
            QuerySet: 元素查询集
        """
        x_min = viewport_rect['x']
        y_min = viewport_rect['y']
        x_max = x_min + viewport_rect['width']
        y_max = y_min + viewport_rect['height']
        
        # 简单的矩形重叠查询
        # 元素中心或边界在视口内
        # 假设最大元素宽1000 (宽松边界)
        return CanvasElement.objects.filter(
            canvas_id=canvas_id,
            position_x__lt=x_max,
            position_x__gt=x_min - 1000, 
            position_y__lt=y_max,
            position_y__gt=y_min - 1000
        )
