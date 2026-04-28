"""
笔记模块WebSocket消费者
"""

import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .mongodb_models import Note, NoteCollaboration
from users.mongodb_models import User
from .services.redis_service import RedisService

logger = logging.getLogger(__name__)

class NoteConsumer(AsyncWebsocketConsumer):
    """
    处理笔记实时协作的WebSocket消费者
    """
    redis_service = RedisService()

    async def connect(self):
        """处理WebSocket连接请求"""
        self.note_id = self.scope['url_route']['kwargs']['note_id']
        self.note_group_name = f'note_{self.note_id}'
        self.user = self.scope['user']

        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        if not await self.has_permission():
            await self.close()
            return

        # 加入房间组
        await self.channel_layer.group_add(
            self.note_group_name,
            self.channel_name
        )

        await self.accept()
        
        # Track user in Redis
        user_info = {
            'id': str(self.user.id),
            'username': self.user.username,
            'avatar': getattr(self.user, 'avatar', '')
        }
        self.redis_service.add_user(self.note_id, str(self.user.id), user_info)
        
        # Broadcast user joined
        await self.channel_layer.group_send(
            self.note_group_name,
            {
                'type': 'user_joined',
                'user': user_info
            }
        )
        
        logger.info(f"用户 {self.user.username} 连接到笔记 {self.note_id} 的协作频道")

    async def disconnect(self, close_code):
        """处理WebSocket断开连接"""
        if hasattr(self, 'note_group_name'):
            # Remove user from Redis
            self.redis_service.remove_user(self.note_id, str(self.user.id))
            
            # Broadcast user left
            await self.channel_layer.group_send(
                self.note_group_name,
                {
                    'type': 'user_left',
                    'user_id': str(self.user.id)
                }
            )
            
            await self.channel_layer.group_discard(
                self.note_group_name,
                self.channel_name
            )
            logger.info(f"用户 {self.user.username} 从笔记 {self.note_id} 的协作频道断开")

    async def receive(self, text_data):
        """接收来自WebSocket的消息并广播"""
        try:
            data = json.loads(text_data)
            # 验证消息格式和内容 (此处省略，实际应用中应添加)
            
            message_type = data.get('type')
            
            # 如果是内容更新，检查冲突
            if message_type == 'content_update':
                incoming_clock = data.get('vector_clock', {})
                note_id = self.note_id
                
                try:
                    # 检查冲突
                    if self.redis_service.detect_conflict(note_id, incoming_clock):
                        # 发送冲突通知
                        await self.send(text_data=json.dumps({
                            'type': 'conflict_detected',
                            'server_clock': self.redis_service.get_vector_clock(note_id),
                            'message': 'Version conflict detected. Please sync with latest version.'
                        }))
                        return
                    
                    # 无冲突，更新服务器时钟 (简单的Last-Write-Wins更新时钟策略，或者是累加)
                    # 实际CRDT中，服务器也应该是一个节点，或者简单地转发并让客户端合并。
                    # 这里我们要么更新服务器的时钟状态，要么只是验证。
                    # 假设我们接受这个更新，我们需要更新Redis中的时钟
                    self.redis_service.set_vector_clock(note_id, incoming_clock)
                    
                except Exception as e:
                    logger.error(f"Conflict detection error: {e}")
            
            elif message_type == 'cursor_update':
                # Update cursor in Redis
                cursor_data = data.get('cursor', {})
                self.redis_service.update_cursor(self.note_id, str(self.user.id), cursor_data)
                
            # 将消息广播到房间组
            await self.channel_layer.group_send(
                self.note_group_name,
                {
                    'type': 'note_update',
                    'message': data,
                    'sender_channel': self.channel_name
                }
            )
            
            # If content update was successful, send ack to sender
            if message_type == 'content_update':
                await self.send(text_data=json.dumps({
                    'type': 'update_ack',
                    'vector_clock': self.redis_service.get_vector_clock(self.note_id)
                }))
        except json.JSONDecodeError:
            logger.error("收到了无效的JSON数据")
        except Exception as e:
            logger.error(f"处理WebSocket消息时出错: {e}")

    async def note_update(self, event):
        """从房间组接收消息并发送到WebSocket"""
        # 不将消息发回给发送者自己
        if self.channel_name != event.get('sender_channel'):
            await self.send(text_data=json.dumps(event['message']))

    async def user_joined(self, event):
        """用户加入通知"""
        await self.send(text_data=json.dumps({
            'type': 'user_joined',
            'user': event['user']
        }))

    async def user_left(self, event):
        """用户离开通知"""
        await self.send(text_data=json.dumps({
            'type': 'user_left',
            'user_id': event['user_id']
        }))

    @database_sync_to_async
    def has_permission(self):
        """检查用户是否有权限访问此笔记"""
        try:
            note = Note.objects.get(id=self.note_id, is_deleted=False)
            # 笔记所有者有权限
            if str(note.user.django_user_id) == str(self.user.id):
                return True
            
            # 检查是否为协作者
            collaboration = NoteCollaboration.objects.filter(
                note=note,
                user=self.user,
                is_active=True
            ).first()
            
            return collaboration is not None
        except Note.DoesNotExist:
            return False
        except Exception as e:
            logger.error(f"检查协作权限时出错: {e}")
            return False

