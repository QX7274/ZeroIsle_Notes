"""
笔记协作 WebSocket 消费者
提供实时协作编辑功能，包括：
- 协作会话管理
- 在线用户状态
- 协作光标同步
- 编辑操作广播
- 心跳检测
"""

import json
import logging
from datetime import datetime
from typing import Dict, Set, Optional
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async
from .services.redis_service import RedisService

logger = logging.getLogger(__name__)





class NoteCollaborationConsumer(AsyncWebsocketConsumer):
    """
    笔记协作 WebSocket 消费者
    
    消息类型:
    - join: 加入协作
    - leave: 离开协作
    - cursor: 光标位置更新
    - edit: 编辑操作
    - selection: 选区更新
    - heartbeat: 心跳
    """
    
    async def connect(self):
        """WebSocket 连接建立"""
        self.user = self.scope.get("user")
        self.note_id = self.scope['url_route']['kwargs'].get('note_id')
        self.redis_service = RedisService()
        
        # 验证用户
        if self.user is None or self.user.is_anonymous:
            await self.close(code=4001)
            return
        
        if not self.note_id:
            await self.close(code=4002)
            return
        
        # 验证协作权限 (Assuming this method exists or removing check if not needed, but code showed it)
        # The previous code showed `await self._check_collaboration_permission()`. Keeping it.
        has_permission = await self._check_collaboration_permission()
        if not has_permission:
            await self.close(code=4003)
            return
        
        # 加入协作房间
        self.room_group_name = f"note_collab_{self.note_id}"
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # 添加用户到会话
        user_info = await self._get_user_info()
        await sync_to_async(self.redis_service.add_user)(str(self.note_id), str(self.user.id), user_info)
        
        # 广播用户加入
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_joined',
                'user_id': str(self.user.id),
                'user_info': user_info
            }
        )
        
        # 发送当前协作状态给新用户
        users = await sync_to_async(self.redis_service.get_users)(str(self.note_id))
        cursors = await sync_to_async(self.redis_service.get_cursors)(str(self.note_id))
        
        await self.send(text_data=json.dumps({
            'type': 'session_state',
            'users': users,
            'cursors': cursors
        }))
        
        logger.info(f"用户 {self.user.id} 加入笔记 {self.note_id} 的协作")

    async def disconnect(self, close_code):
        """WebSocket 连接断开"""
        if hasattr(self, 'note_id') and hasattr(self, 'user'):
            # 从会话移除用户
            await sync_to_async(self.redis_service.remove_user)(str(self.note_id), str(self.user.id))
            
            # 广播用户离开
            if hasattr(self, 'room_group_name'):
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'user_left',
                        'user_id': str(self.user.id)
                    }
                )
                
                await self.channel_layer.group_discard(
                    self.room_group_name,
                    self.channel_name
                )
            
            logger.info(f"用户 {self.user.id} 离开笔记 {self.note_id} 的协作")

    async def receive(self, text_data=None, bytes_data=None):
        """接收客户端消息"""
        if not text_data:
            return
        
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            # Redis TTL handles activity tracking implicitly via updates
            # If explicit heartbeat is needed, we handle it in 'heartbeat' type
            
            if message_type == 'cursor':
                await self._handle_cursor_update(data)
            elif message_type == 'edit':
                await self._handle_edit(data)
            elif message_type == 'selection':
                await self._handle_selection(data)
            elif message_type == 'heartbeat':
                await self._handle_heartbeat()
            else:
                logger.warning(f"未知消息类型: {message_type}")
                
        except json.JSONDecodeError:
            logger.error("无效的JSON消息")
        except Exception as e:
            logger.error(f"处理消息时出错: {e}")

    async def _handle_cursor_update(self, data):
        """处理光标位置更新"""
        cursor_data = {
            'position': data.get('position'),
            'line': data.get('line'),
            'column': data.get('column')
        }
        
        await sync_to_async(self.redis_service.update_cursor)(str(self.note_id), str(self.user.id), cursor_data)
        
        # 广播给其他用户
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'cursor_update',
                'user_id': str(self.user.id),
                'cursor': cursor_data
            }
        )

    async def _handle_edit(self, data):
        """处理编辑操作（支持向量时钟）"""
        # Optimistic Locking: Increment version
        new_version = await sync_to_async(self.redis_service.increment_version)(str(self.note_id))
        
        # 获取客户端发送的向量时钟
        client_vector_clock = data.get('vectorClock', {})
        client_id = data.get('clientId', str(self.user.id))
        seq = data.get('seq', 0)
        
        # 更新服务端向量时钟
        server_vector_clock = await sync_to_async(self.redis_service.get_vector_clock)(str(self.note_id))
        server_vector_clock[client_id] = max(server_vector_clock.get(client_id, 0), seq)
        await sync_to_async(self.redis_service.set_vector_clock)(str(self.note_id), server_vector_clock)
        
        edit_data = {
            'operation': data.get('operation'),
            'position': data.get('position'),
            'content': data.get('content'),
            'length': data.get('length'),
            'timestamp': datetime.now().isoformat(),
            'version': new_version,
            'clientId': client_id,
            'seq': seq,
            'vectorClock': server_vector_clock
        }
        
        # 广播给其他用户
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'edit_broadcast',
                'user_id': str(self.user.id),
                'edit': edit_data
            }
        )

    async def _handle_selection(self, data):
        """处理选区更新"""
        selection_data = {
            'start': data.get('start'),
            'end': data.get('end')
        }
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'selection_update',
                'user_id': str(self.user.id),
                'selection': selection_data
            }
        )

    async def _handle_heartbeat(self):
        """处理心跳"""
        # Refresh Redis TTL to keep session alive
        user_info = {
            'id': str(self.user.id),
            'username': self.user.username,
            'avatar': getattr(self.user, 'avatar_url', None)
        }
        # Re-adding user updates the TTL
        await sync_to_async(self.redis_service.add_user)(str(self.note_id), str(self.user.id), user_info)
        
        await self.send(text_data=json.dumps({
            'type': 'heartbeat_ack',
            'timestamp': datetime.now().isoformat()
        }))

    # === 事件处理器（接收group_send的消息）===
    
    async def user_joined(self, event):
        """用户加入事件"""
        # 不发送给自己
        if event['user_id'] != str(self.user.id):
            await self.send(text_data=json.dumps({
                'type': 'user_joined',
                'user_id': event['user_id'],
                'user_info': event['user_info']
            }))

    async def user_left(self, event):
        """用户离开事件"""
        await self.send(text_data=json.dumps({
            'type': 'user_left',
            'user_id': event['user_id']
        }))

    async def cursor_update(self, event):
        """光标更新事件"""
        if event['user_id'] != str(self.user.id):
            await self.send(text_data=json.dumps({
                'type': 'cursor_update',
                'user_id': event['user_id'],
                'cursor': event['cursor']
            }))

    async def edit_broadcast(self, event):
        """编辑广播事件"""
        if event['user_id'] != str(self.user.id):
            await self.send(text_data=json.dumps({
                'type': 'edit',
                'user_id': event['user_id'],
                'edit': event['edit']
            }))

    async def selection_update(self, event):
        """选区更新事件"""
        if event['user_id'] != str(self.user.id):
            await self.send(text_data=json.dumps({
                'type': 'selection_update',
                'user_id': event['user_id'],
                'selection': event['selection']
            }))

    # === 辅助方法 ===
    
    @database_sync_to_async
    def _check_collaboration_permission(self) -> bool:
        """检查用户是否有协作权限"""
        try:
            from notes.mongodb_models import Note
            from notes.mongodb_models.note_collaboration import NoteCollaboration
            
            # 检查是否是笔记所有者
            note = Note.objects(id=self.note_id).first()
            if note and str(note.user.id) == str(self.user.id):
                return True
            
            # 检查是否是协作者
            collab = NoteCollaboration.objects(
                note=note,
                user=self.user,
                is_active=True
            ).first()
            
            return collab is not None
        except Exception as e:
            logger.error(f"检查协作权限失败: {e}")
            return False

    @database_sync_to_async
    def _get_user_info(self) -> dict:
        """获取用户信息"""
        return {
            'id': str(self.user.id),
            'username': self.user.username,
            'avatar': getattr(self.user, 'avatar', None) or '',
            'color': self._generate_user_color(str(self.user.id))
        }

    def _generate_user_color(self, user_id: str) -> str:
        """根据用户ID生成唯一颜色"""
        colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
            '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
        ]
        hash_value = sum(ord(c) for c in user_id)
        return colors[hash_value % len(colors)]
