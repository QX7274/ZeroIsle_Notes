"""
Notes WebSocket 路由配置
"""
from django.urls import re_path
from . import consumers
from .websocket_consumers import NoteCollaborationConsumer

websocket_urlpatterns = [
    # 笔记实时更新
    re_path(r'ws/notes/(?P<note_id>[^/]+)/$', consumers.NoteConsumer.as_asgi()),
    
    # 协作编辑
    re_path(r'ws/notes/(?P<note_id>[^/]+)/collaborate/$', NoteCollaborationConsumer.as_asgi()),
]


