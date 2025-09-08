"""
WebSocket视图用于实时进度推送
"""

import json
import asyncio
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .services import DocumentConverterService

logger = logging.getLogger(__name__)

class DocumentConversionConsumer(AsyncWebsocketConsumer):
    """文档转换WebSocket消费者"""
    
    async def connect(self):
        """WebSocket连接"""
        self.conversion_id = self.scope['url_route']['kwargs']['conversion_id']
        self.room_group_name = f'conversion_{self.conversion_id}'
        
        # 加入房间组
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        logger.info(f"WebSocket连接已建立: {self.conversion_id}")
    
    async def disconnect(self, close_code):
        """WebSocket断开连接"""
        # 离开房间组
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        logger.info(f"WebSocket连接已断开: {self.conversion_id}")
    
    async def receive(self, text_data):
        """接收WebSocket消息"""
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type')
            
            if message_type == 'start_conversion':
                # 开始转换
                await self.start_conversion(text_data_json)
            elif message_type == 'cancel_conversion':
                # 取消转换
                await self.cancel_conversion()
                
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': '无效的JSON数据'
            }))
    
    async def start_conversion(self, data):
        """开始文档转换"""
        try:
            file_path = data.get('file_path')
            file_type = data.get('file_type')
            
            if not file_path or not file_type:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': '缺少必需参数'
                }))
                return
            
            # 创建转换器实例
            converter = DocumentConverterService()
            
            # 设置进度回调
            converter.set_progress_callback(self.progress_callback)
            
            # 异步执行转换
            asyncio.create_task(self.perform_conversion(converter, file_path))
            
        except Exception as e:
            logger.error(f"启动转换失败: {str(e)}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))
    
    async def perform_conversion(self, converter, file_path):
        """执行转换任务"""
        try:
            # 在线程池中执行转换
            result = await asyncio.get_event_loop().run_in_executor(
                None, converter.convert_file, file_path
            )
            
            if result['success']:
                # 读取PDF文件并转换为base64
                import base64
                with open(result['output_file'], 'rb') as f:
                    pdf_data = f.read()
                    pdf_base64 = base64.b64encode(pdf_data).decode('utf-8')
                
                await self.send(text_data=json.dumps({
                    'type': 'conversion_complete',
                    'success': True,
                    'pdf_base64': pdf_base64,
                    'file_info': {
                        'original_name': result.get('input_file', ''),
                        'file_type': result.get('file_type', ''),
                        'pages': result.get('pages', 1),
                        'conversion_method': result.get('conversion_method', 'unknown'),
                        'output_size': result.get('output_size', 0)
                    }
                }))
                
                # 清理临时文件
                import os
                try:
                    os.unlink(result['output_file'])
                except:
                    pass
                    
            else:
                await self.send(text_data=json.dumps({
                    'type': 'conversion_complete',
                    'success': False,
                    'error': result.get('error', '转换失败')
                }))
                
        except Exception as e:
            logger.error(f"转换执行失败: {str(e)}")
            await self.send(text_data=json.dumps({
                'type': 'conversion_complete',
                'success': False,
                'error': str(e)
            }))
    
    def progress_callback(self, progress_data):
        """进度回调函数"""
        # 发送进度更新到WebSocket
        asyncio.create_task(self.send_progress_update(progress_data))
    
    async def send_progress_update(self, progress_data):
        """发送进度更新"""
        await self.send(text_data=json.dumps({
            'type': 'progress_update',
            'stage': progress_data.get('stage'),
            'progress': progress_data.get('progress'),
            'message': progress_data.get('message'),
            'timestamp': progress_data.get('timestamp')
        }))
    
    async def cancel_conversion(self):
        """取消转换"""
        # 这里可以实现转换取消逻辑
        await self.send(text_data=json.dumps({
            'type': 'conversion_cancelled',
            'message': '转换已取消'
        }))
    
    # 处理组消息
    async def progress_message(self, event):
        """处理进度消息"""
        await self.send(text_data=json.dumps({
            'type': 'progress_update',
            'stage': event['stage'],
            'progress': event['progress'],
            'message': event['message'],
            'timestamp': event['timestamp']
        }))
    
    async def conversion_complete_message(self, event):
        """处理转换完成消息"""
        await self.send(text_data=json.dumps({
            'type': 'conversion_complete',
            'success': event['success'],
            'data': event.get('data', {}),
            'error': event.get('error', '')
        }))
