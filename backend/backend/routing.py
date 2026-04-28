from channels.routing import URLRouter
from django.urls import path, include

# 导入各应用的WebSocket路由
from reminder.routing import websocket_urlpatterns as reminder_websocket_urlpatterns
from groups.routing import websocket_urlpatterns as groups_websocket_urlpatterns
from knowledge_graph.routing import websocket_urlpatterns as knowledge_graph_websocket_urlpatterns
from notes.routing import websocket_urlpatterns as notes_websocket_urlpatterns
from mind_map.routing import websocket_urlpatterns as mind_map_websocket_urlpatterns
from notification.routing import websocket_urlpatterns as notification_websocket_urlpatterns

# 定义WebSocket URL模式
websocket_urlpatterns = [
    # 提醒相关WebSocket路由
    *reminder_websocket_urlpatterns,

    # 群组相关WebSocket路由
    *groups_websocket_urlpatterns,

    # 知识图谱相关WebSocket路由
    *knowledge_graph_websocket_urlpatterns,

    # 笔记协作相关WebSocket路由
    *notes_websocket_urlpatterns,

    # 思维导图协作
    *mind_map_websocket_urlpatterns,

    # 通知服务
    *notification_websocket_urlpatterns,
]