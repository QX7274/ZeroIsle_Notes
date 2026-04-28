from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView, TemplateView
from django.http import JsonResponse
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
import time
import logging

logger = logging.getLogger(__name__)


# Health Check View - for Docker/K8s probes
def health_check(request):
    """
    Health check endpoint for container orchestration (Docker/K8s).
    Checks Redis and MongoDB connectivity.

    说明：探针必须“快速失败”，避免 Redis/Mongo 不可用时阻塞整个接口。
    """
    health_status = {
        'status': 'healthy',
        'timestamp': time.time(),
        'services': {}
    }

    # Redis：使用短超时快速探测
    try:
        import redis
        host, port = settings.CHANNEL_LAYERS['default']['CONFIG']['hosts'][0]
        r = redis.Redis(
            host=host,
            port=port,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        r.ping()
        health_status['services']['redis'] = 'ok'
    except Exception as e:
        health_status['services']['redis'] = f'error: {str(e)[:80]}'
        health_status['status'] = 'degraded'

    # MongoDB：不要复用 development.py 里可能长超时的全局客户端
    try:
        from pymongo import MongoClient
        mongo_client = MongoClient(
            host=getattr(settings, 'MONGO_HOST', 'localhost'),
            port=int(getattr(settings, 'MONGO_PORT', 27017)),
            serverSelectionTimeoutMS=1000,
            connectTimeoutMS=1000,
            socketTimeoutMS=1000,
        )
        mongo_client.admin.command('ping')
        health_status['services']['mongodb'] = 'ok'
    except Exception as e:
        health_status['services']['mongodb'] = f'error: {str(e)[:80]}'
        health_status['status'] = 'degraded'

    status_code = 200 if health_status['status'] == 'healthy' else 503
    return JsonResponse(health_status, status=status_code)

# 根路径视图函数 - 返回JSON格式的API信息
def api_root_json(request):
    """
    API根路径，返回API信息（JSON格式）
    """
    return JsonResponse({
        'name': '零屿笔记 API',
        'version': 'v1',
        'status': 'running',
        'documentation': '/swagger/',
        'api_prefix': '/api/v1/'
    })

# API v1根路径视图函数 - 返回API v1信息
def api_v1_root(request):
    """
    API v1根路径，返回API v1信息（JSON格式）
    """
    # 获取所有API端点
    endpoints = {
        'auth': '/api/v1/auth/',
        'notes': '/api/v1/notes/',
        'reminders': '/api/v1/reminders/',
        'knowledge_graph': '/api/v1/knowledge-graph/',
        'mind_map': '/api/v1/mind-map/',
        'ai_assistant': '/api/v1/ai-assistant/',
        'voice_recognition': '/api/v1/voice-recognition/',
        'search': '/api/v1/search/',
        'community': '/api/v1/community/',
        'canvas': '/api/v1/canvas/',
        'code_editor': '/api/v1/code-editor/',
        'common': '/api/v1/common/',
        'notifications': '/api/v1/notifications/',
        'groups': '/api/v1/groups/',
        'sync': '/api/v1/sync/',
        'personal_activity': '/api/v1/personal-activity/',
    }

    return JsonResponse({
        'name': '零屿笔记 API',
        'version': 'v1',
        'status': 'running',
        'documentation': '/swagger/',
        'endpoints': endpoints
    })

# API文档配置
schema_view = get_schema_view(
    openapi.Info(
        title="零屿笔记 API",
        default_version='v1',
        description="零屿笔记应用API文档",
        terms_of_service="https://www.zeroislenotes.com/terms/",
        contact=openapi.Contact(email="contact@zeroislenotes.com"),
        license=openapi.License(name="BSD License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

# Conditionally include Prometheus metrics if available
try:
    import django_prometheus  # noqa: F401
    PROMETHEUS_URLS = [path('metrics/', include('django_prometheus.urls'))]
except Exception:
    PROMETHEUS_URLS = []

# API版本前缀
api_prefix = 'api/v1/'

urlpatterns = [
    # 根路径 - 使用HTML模板
    path('', TemplateView.as_view(template_name='index.html'), name='api-root'),

    # Health Check - for Docker/K8s/Load Balancers
    path('health/', health_check, name='health-check'),

    # 条件引入 Prometheus 指标路由
    *PROMETHEUS_URLS,

    # API根路径 - JSON格式
    path('api.json', api_root_json, name='api-root-json'),

    # 重定向到Swagger文档
    path('api/', RedirectView.as_view(url='/swagger/', permanent=False), name='api-docs'),

    # API v1根路径
    path(api_prefix.rstrip('/'), api_v1_root, name='api-v1-root'),

    # Django管理后台
    path('admin/', admin.site.urls),

    # API文档
    re_path(r'^swagger(?P<format>\.json|\.yaml)$', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),

    # API端点
    path(f'{api_prefix}auth/', include('users.urls')),
    path(f'{api_prefix}ai-assistant/', include('ai_assistant.urls')),
    path(f'{api_prefix}search/', include('search.urls')),
]

# 在模块底部，尝试性地追加业务模块路由（如导入失败则记录原因）
try:
    urlpatterns.append(path(f'{api_prefix}notes/', include('notes.urls')))
except Exception as e:
    logger.exception("Failed to include notes.urls: %s", e)

try:
    urlpatterns.append(path(f'{api_prefix}knowledge-graph/', include('knowledge_graph.urls')))
except Exception as e:
    logger.exception("Failed to include knowledge_graph.urls: %s", e)

try:
    urlpatterns.append(path(f'{api_prefix}sync/', include('sync.urls')))
except Exception as e:
    logger.exception("Failed to include sync.urls: %s", e)

try:
    urlpatterns.append(path(f'{api_prefix}voice-recognition/', include('voice_recognition.urls')))
except Exception as e:
    logger.exception("Failed to include voice_recognition.urls: %s", e)


# 添加媒体文件URL
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)