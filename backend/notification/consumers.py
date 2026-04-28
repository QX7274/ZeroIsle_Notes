
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)

class NotificationConsumer(AsyncWebsocketConsumer):
    """
    处理实时通知的WebSocket消费者
    """

    async def connect(self):
        """处理WebSocket连接请求"""
        self.user = self.scope['user']

        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        # 每个用户一个唯一的通知频道
        self.group_name = f'user_notifications_{self.user.id}'

        # 加入房间组
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()
        logger.info(f"用户 {self.user.username} 连接到通知频道")

    async def disconnect(self, close_code):
        """处理WebSocket断开连接"""
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
            logger.info(f"用户 {self.user.username} 断开通知频道")

    async def receive(self, text_data):
        """接收来自客户端的消息（通常通知是单向推送，但客户端可能发送确认已读等）"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'mark_read':
                # 处理标记已读逻辑 (可选，通常走HTTP API更稳妥，但WS也可支持)
                pass
        except json.JSONDecodeError:
            pass

    async def notification_message(self, event):
        """处理发送给用户的通知消息"""
        # 发送消息到WebSocket
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'data': event['message']
        }))
