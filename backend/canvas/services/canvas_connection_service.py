"""
画布连接服务
"""

import logging
from django.db import transaction
from canvas.models import Canvas, CanvasConnection
from canvas.serializers import CanvasConnectionSerializer

logger = logging.getLogger('backend')

class CanvasConnectionService:
    """
    画布连接服务类
    处理画布连接相关的业务逻辑
    """
    
    def bulk_update_connections(self, connections_data, user):
        """
        批量更新连接
        
        Args:
            connections_data: 连接数据列表
            user: 用户对象
            
        Returns:
            list: 更新的连接列表
        """
        try:
            updated_connections = []
            
            for connection_data in connections_data:
                connection_id = connection_data.pop('id', None)
                if not connection_id:
                    continue
                    
                try:
                    connection = CanvasConnection.objects.get(id=connection_id)
                    # 确保用户有权限更新此连接
                    if connection.canvas.user != user:
                        continue
                        
                    serializer = CanvasConnectionSerializer(connection, data=connection_data, partial=True)
                    if serializer.is_valid():
                        serializer.save()
                        updated_connections.append(serializer.data)
                except CanvasConnection.DoesNotExist:
                    pass
            
            return updated_connections
        except Exception as e:
            logger.error(f"批量更新连接失败: {e}")
            raise
    
    def bulk_create_connections(self, connections_data, canvas_id, user):
        """
        批量创建连接
        
        Args:
            connections_data: 连接数据列表
            canvas_id: 画布ID
            user: 用户对象
            
        Returns:
            list: 创建的连接列表
        """
        try:
            # 获取画布
            try:
                canvas = Canvas.objects.get(id=canvas_id)
                # 确保用户有权限在此画布上创建连接
                if canvas.user != user:
                    raise ValueError(f"无权在此画布上创建连接: {canvas_id}")
            except Canvas.DoesNotExist:
                raise ValueError(f"画布不存在: {canvas_id}")
            
            created_connections = []
            
            with transaction.atomic():
                for connection_data in connections_data:
                    # 设置画布ID
                    connection_data['canvas'] = canvas.id
                    
                    serializer = CanvasConnectionSerializer(data=connection_data)
                    if serializer.is_valid():
                        connection = serializer.save()
                        created_connections.append(serializer.data)
            
            return created_connections
        except Exception as e:
            logger.error(f"批量创建连接失败: {e}")
            raise
    
    def bulk_delete_connections(self, connection_ids, user):
        """
        批量删除连接
        
        Args:
            connection_ids: 连接ID列表
            user: 用户对象
            
        Returns:
            int: 删除的连接数量
        """
        try:
            # 获取用户有权限删除的连接
            connections = CanvasConnection.objects.filter(
                id__in=connection_ids,
                canvas__user=user
            )
            
            # 删除连接
            count, _ = connections.delete()
            
            return count
        except Exception as e:
            logger.error(f"批量删除连接失败: {e}")
            raise
