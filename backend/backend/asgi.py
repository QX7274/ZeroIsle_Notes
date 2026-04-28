"""
ASGI config for backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/asgi/
"""

import os
import django
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.contrib.auth import get_user_model
from urllib.parse import parse_qs
from rest_framework_simplejwt.authentication import JWTAuthentication
from channels.security.websocket import AllowedHostsOriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

# 导入路由配置
from backend.routing import websocket_urlpatterns


class QueryStringJWTAuthMiddleware:
    """
    从WebSocket查询参数中提取 token 并认证用户，设置到 scope['user']
    """
    def __init__(self, inner):
        self.inner = inner
        self.jwt_auth = JWTAuthentication()

    async def __call__(self, scope, receive, send):
        try:
            query_string = scope.get('query_string', b'').decode('utf-8')
            params = parse_qs(query_string)
            token_list = params.get('token', [])
            if token_list:
                token = token_list[0]
                # 构造一个假的DRF请求对象以复用JWTAuthentication
                class Dummy:
                    META = { 'HTTP_AUTHORIZATION': f'Bearer {token}' }
                    headers = [(b'authorization', f'Bearer {token}'.encode('utf-8'))]
                user_auth = self.jwt_auth.authenticate(Dummy())
                if user_auth and user_auth[0]:
                    scope['user'] = user_auth[0]
        except Exception:
            # 鉴权失败则保持原有匿名用户
            pass

        return await self.inner(scope, receive, send)


def QueryStringJWTAuthMiddlewareStack(inner):
    return QueryStringJWTAuthMiddleware(AuthMiddlewareStack(inner))


application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AllowedHostsOriginValidator(
        QueryStringJWTAuthMiddlewareStack(
            URLRouter(
                websocket_urlpatterns
            )
        )
    ),
})
