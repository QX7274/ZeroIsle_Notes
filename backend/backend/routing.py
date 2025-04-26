from channels.routing import URLRouter
from django.urls import path

# 导入各应用的WebSocket消费者
from reminder.consumers import ReminderConsumer

# 定义WebSocket URL模式
websocket_urlpatterns = [
    path('ws/reminders/', ReminderConsumer.as_asgi()),
    # 可以添加其他WebSocket路由
]