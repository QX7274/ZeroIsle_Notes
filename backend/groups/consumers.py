"""
群组模块WebSocket消费者
"""

import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from .models import Group, GroupMember, SharedScreen

logger = logging.getLogger(__name__)

class WebRTCSignalingConsumer(AsyncWebsocketConsumer):
    """
    WebRTC信令服务器消费者
    处理WebRTC连接的信令
    """
    
    async def connect(self):
        """
        连接WebSocket
        """
        # 获取房间ID
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'webrtc_{self.room_id}'
        
        # 获取用户
        self.user = self.scope['user']
        if not self.user.is_authenticated:
            await self.close()
            return
        
        # 检查权限
        if not await self.check_permission():
            await self.close()
            return
        
        # 加入房间组
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # 通知其他用户有新用户加入
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_join',
                'user_id': str(self.user.id),
                'username': self.user.username
            }
        )
    
    async def disconnect(self, close_code):
        """
        断开WebSocket连接
        """
        if hasattr(self, 'room_group_name'):
            # 通知其他用户有用户离开
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_leave',
                    'user_id': str(self.user.id),
                    'username': self.user.username
                }
            )
            
            # 离开房间组
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        """
        接收WebSocket消息
        """
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'offer':
                # 转发offer
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'webrtc_offer',
                        'offer': data.get('offer'),
                        'user_id': str(self.user.id),
                        'target_user_id': data.get('target_user_id')
                    }
                )
            
            elif message_type == 'answer':
                # 转发answer
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'webrtc_answer',
                        'answer': data.get('answer'),
                        'user_id': str(self.user.id),
                        'target_user_id': data.get('target_user_id')
                    }
                )
            
            elif message_type == 'ice_candidate':
                # 转发ICE候选
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'webrtc_ice_candidate',
                        'candidate': data.get('candidate'),
                        'user_id': str(self.user.id),
                        'target_user_id': data.get('target_user_id')
                    }
                )
            
            elif message_type == 'get_users':
                # 获取房间内的用户
                await self.send(json.dumps({
                    'type': 'users',
                    'users': await self.get_room_users()
                }))
        
        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
        except Exception as e:
            logger.error(f"Error processing WebSocket message: {str(e)}")
    
    async def webrtc_offer(self, event):
        """
        处理WebRTC offer
        """
        # 如果消息是发给当前用户的，或者是广播消息
        if 'target_user_id' not in event or event['target_user_id'] == str(self.user.id):
            await self.send(json.dumps({
                'type': 'offer',
                'offer': event['offer'],
                'user_id': event['user_id']
            }))
    
    async def webrtc_answer(self, event):
        """
        处理WebRTC answer
        """
        # 如果消息是发给当前用户的，或者是广播消息
        if 'target_user_id' not in event or event['target_user_id'] == str(self.user.id):
            await self.send(json.dumps({
                'type': 'answer',
                'answer': event['answer'],
                'user_id': event['user_id']
            }))
    
    async def webrtc_ice_candidate(self, event):
        """
        处理WebRTC ICE候选
        """
        # 如果消息是发给当前用户的，或者是广播消息
        if 'target_user_id' not in event or event['target_user_id'] == str(self.user.id):
            await self.send(json.dumps({
                'type': 'ice_candidate',
                'candidate': event['candidate'],
                'user_id': event['user_id']
            }))
    
    async def user_join(self, event):
        """
        处理用户加入事件
        """
        await self.send(json.dumps({
            'type': 'user_join',
            'user_id': event['user_id'],
            'username': event['username']
        }))
    
    async def user_leave(self, event):
        """
        处理用户离开事件
        """
        await self.send(json.dumps({
            'type': 'user_leave',
            'user_id': event['user_id'],
            'username': event['username']
        }))
    
    @database_sync_to_async
    def check_permission(self):
        """
        检查用户是否有权限加入房间
        """
        # 检查是否是共享屏幕房间
        if self.room_id.startswith('screen_'):
            try:
                # 查找共享屏幕
                shared_screen = SharedScreen.objects.get(
                    webrtc_room_id=self.room_id,
                    status__in=['active', 'paused']
                )
                
                # 检查用户是否为群组成员
                return (
                    shared_screen.user == self.user or
                    GroupMember.objects.filter(
                        group=shared_screen.group,
                        user=self.user,
                        is_active=True
                    ).exists()
                )
            except SharedScreen.DoesNotExist:
                return False
        
        return False
    
    @database_sync_to_async
    def get_room_users(self):
        """
        获取房间内的用户
        """
        # 检查是否是共享屏幕房间
        if self.room_id.startswith('screen_'):
            try:
                # 查找共享屏幕
                shared_screen = SharedScreen.objects.get(
                    webrtc_room_id=self.room_id,
                    status__in=['active', 'paused']
                )
                
                # 获取群组成员
                members = GroupMember.objects.filter(
                    group=shared_screen.group,
                    is_active=True
                )
                
                return [
                    {
                        'id': str(member.user.id),
                        'username': member.user.username,
                        'is_sharing': member.user == shared_screen.user
                    }
                    for member in members
                ]
            except SharedScreen.DoesNotExist:
                return []
        
        return []
