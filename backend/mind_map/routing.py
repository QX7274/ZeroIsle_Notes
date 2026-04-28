from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/mindmaps/(?P<mind_map_id>[\w-]+)/collaborate/$', consumers.MindMapCollaborationConsumer.as_asgi()),
]
