"""
群组模块WebSocket路由配置
"""

from django.urls import re_path
from .consumers import WebRTCSignalingConsumer

websocket_urlpatterns = [
    re_path(r'ws/webrtc/(?P<room_id>[^/]+)/$', WebRTCSignalingConsumer.as_asgi()),
]
