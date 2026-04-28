import json
import logging
from datetime import datetime
from typing import Dict
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)

class MindMapCollaborationSession:
    """思维导图协作会话管理（内存存储）"""
    _sessions: Dict[str, Dict] = {}  # map_id -> session_data
    
    @classmethod
    def add_user(cls, map_id: str, user_id: str, user_info: dict):
        if map_id not in cls._sessions:
            cls._sessions[map_id] = {'users': {}, 'created_at': datetime.now().isoformat()}
        cls._sessions[map_id]['users'][user_id] = {
            **user_info,
            'joined_at': datetime.now().isoformat(),
            'last_active': datetime.now().isoformat()
        }
    
    @classmethod
    def remove_user(cls, map_id: str, user_id: str):
        if map_id in cls._sessions:
            cls._sessions[map_id]['users'].pop(user_id, None)
            if not cls._sessions[map_id]['users']:
                del cls._sessions[map_id]

    @classmethod
    def get_users(cls, map_id: str) -> dict:
        return cls._sessions.get(map_id, {}).get('users', {})

class MindMapCollaborationConsumer(AsyncWebsocketConsumer):
    """思维导图协作 WebSocket 消费者"""
    
    async def connect(self):
        self.user = self.scope.get("user")
        self.map_id = self.scope['url_route']['kwargs'].get('mind_map_id')
        
        if not self.user or self.user.is_anonymous or not self.map_id:
            await self.close(code=4001)
            return
            
        # 验证权限
        if not await self._check_permission():
            await self.close(code=4003)
            return
            
        self.room_group_name = f"mindmap_collab_{self.map_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        
        # 添加用户
        user_info = await self._get_user_info()
        MindMapCollaborationSession.add_user(self.map_id, str(self.user.id), user_info)
        
        # 广播加入
        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'user_joined',
            'user_id': str(self.user.id),
            'user_info': user_info
        })
        
        # 发送当前状态
        await self.send(json.dumps({
            'type': 'session_state',
            'users': MindMapCollaborationSession.get_users(self.map_id)
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'map_id') and hasattr(self, 'user'):
            MindMapCollaborationSession.remove_user(self.map_id, str(self.user.id))
            await self.channel_layer.group_send(self.room_group_name, {
                'type': 'user_left',
                'user_id': str(self.user.id)
            })
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data=None):
        if not text_data: return
        try:
            data = json.loads(text_data)
            msg_type = data.get('type')
            
            if msg_type in ['node_update', 'node_add', 'node_delete', 'edge_update', 'layout_change']:
                await self.channel_layer.group_send(self.room_group_name, {
                    'type': 'broadcast_update',
                    'user_id': str(self.user.id),
                    'data': data
                })
            elif msg_type == 'cursor':
                await self.channel_layer.group_send(self.room_group_name, {
                    'type': 'cursor_update',
                    'user_id': str(self.user.id),
                    'cursor': data.get('cursor')
                })
        except Exception as e:
            logger.error(f"Error processing message: {e}")

    async def broadcast_update(self, event):
        if event['user_id'] != str(self.user.id):
            await self.send(json.dumps(event['data']))

    async def cursor_update(self, event):
        if event['user_id'] != str(self.user.id):
            await self.send(json.dumps({
                'type': 'cursor',
                'user_id': event['user_id'],
                'cursor': event['cursor']
            }))

    async def user_joined(self, event):
        if event['user_id'] != str(self.user.id):
            await self.send(json.dumps(event))

    async def user_left(self, event):
        await self.send(json.dumps(event))

    @database_sync_to_async
    def _check_permission(self):
        from mind_map.mongodb_models import MindMap
        # 简单检查：是所有者或者图是公开的，或者(未来)有协作记录
        mmap = MindMap.objects(id=self.map_id).first()
        return mmap and (str(mmap.user.id) == str(self.user.id) or mmap.is_public)

    @database_sync_to_async
    def _get_user_info(self):
        return {
            'id': str(self.user.id),
            'username': self.user.username,
            'avatar': getattr(self.user, 'avatar', '')
        }
