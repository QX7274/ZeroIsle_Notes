"""
知识图谱 WebSocket 消费者
"""

import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer


logger = logging.getLogger(__name__)


class KnowledgeGraphConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        if self.user is None or self.user.is_anonymous:
            await self.close()
            return

        # 每位用户一个组，便于精准推送
        self.group_name = f"knowledge_graph_{self.user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        # 当前不需要处理客户端消息，预留心跳/订阅接口
        try:
            if text_data:
                _ = json.loads(text_data)
        except Exception:  # 忽略解析错误
            pass

    # Celery任务通过 group_send 调用
    async def knowledge_graph_built(self, event):
        # 标准化事件输出，前端按 type 区分
        await self.send(text_data=json.dumps({
            'type': 'knowledge_graph.built',
            'note_id': event.get('note_id'),
            'payload': event.get('payload'),
        }))


