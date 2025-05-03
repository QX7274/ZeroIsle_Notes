from channels.routing import URLRouter
from django.urls import path, include

# 导入各应用的WebSocket路由
from reminder.routing import websocket_urlpatterns as reminder_websocket_urlpatterns
from groups.routing import websocket_urlpatterns as groups_websocket_urlpatterns

# 定义WebSocket URL模式
websocket_urlpatterns = [
    # 提醒相关WebSocket路由
    *reminder_websocket_urlpatterns,

    # 群组相关WebSocket路由
    *groups_websocket_urlpatterns,
]