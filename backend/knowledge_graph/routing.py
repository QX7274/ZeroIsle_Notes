from django.urls import re_path
from . import websocket_consumers

websocket_urlpatterns = [
    # 客户端应连接 ws://.../ws/knowledge-graph/ 并在鉴权中识别用户
    re_path(r"ws/knowledge-graph/$", websocket_consumers.KnowledgeGraphConsumer.as_asgi()),
]


