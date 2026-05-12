import os
import time
import logging

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from django.views.generic import RedirectView, TemplateView
from drf_yasg import openapi
from drf_yasg.views import get_schema_view
from rest_framework import permissions

logger = logging.getLogger(__name__)


def _check_redis():
    import redis

    hosts = settings.CHANNEL_LAYERS['default']['CONFIG'].get('hosts', [])
    host, port = hosts[0]
    client = redis.Redis(
        host=host,
        port=port,
        socket_connect_timeout=1,
        socket_timeout=1,
    )
    client.ping()


def _check_mongodb():
    from pymongo import MongoClient

    mongo_uri = os.environ.get('MONGO_URI')
    if mongo_uri:
        client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=1000,
            connectTimeoutMS=1000,
            socketTimeoutMS=1000,
        )
    else:
        client = MongoClient(
            host=getattr(settings, 'MONGO_HOST', 'localhost'),
            port=int(getattr(settings, 'MONGO_PORT', 27017)),
            serverSelectionTimeoutMS=1000,
            connectTimeoutMS=1000,
            socketTimeoutMS=1000,
        )
    client.admin.command('ping')


def _check_neo4j():
    from neo4j import GraphDatabase

    driver = GraphDatabase.driver(
        settings.NEO4J_URI,
        auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
    )
    try:
        with driver.session() as session:
            session.run("RETURN 1").consume()
    finally:
        driver.close()


def health_check(request):
    """Lightweight liveness probe."""
    return JsonResponse({
        'status': 'alive',
        'timestamp': time.time(),
    })


def readiness_check(request):
    """Dependency readiness probe."""
    readiness_status = {
        'status': 'ready',
        'timestamp': time.time(),
        'services': {},
    }

    checks = {
        'redis': _check_redis,
        'mongodb': _check_mongodb,
        'neo4j': _check_neo4j,
    }

    for service_name, checker in checks.items():
        try:
            checker()
            readiness_status['services'][service_name] = 'ok'
        except Exception as exc:
            readiness_status['services'][service_name] = f'error: {str(exc)[:120]}'
            readiness_status['status'] = 'not_ready'

    status_code = 200 if readiness_status['status'] == 'ready' else 503
    return JsonResponse(readiness_status, status=status_code)


def api_root_json(request):
    return JsonResponse({
        'name': 'ZeroIsle Notes API',
        'version': 'v1',
        'status': 'running',
        'documentation': '/swagger/',
        'api_prefix': '/api/v1/',
    })


def api_v1_root(request):
    endpoints = {
        'auth': '/api/v1/auth/',
        'code': '/api/v1/code/',
        'notes': '/api/v1/notes/',
        'reminders': '/api/v1/reminders/',
        'knowledge_graph': '/api/v1/knowledge-graph/',
        'mind_map': '/api/v1/mind-map/',
        'ai_assistant': '/api/v1/ai-assistant/',
        'voice_recognition': '/api/v1/voice-recognition/',
        'search': '/api/v1/search/',
        'community': '/api/v1/community/',
        'canvas': '/api/v1/canvas/',
        'document_converter': '/api/v1/document-converter/',
        'notifications': '/api/v1/notifications/',
        'groups': '/api/v1/groups/',
        'sync': '/api/v1/sync/',
        'personal_activity': '/api/v1/personal-activity/',
        'tasks': '/api/v1/tasks/',
    }

    return JsonResponse({
        'name': 'ZeroIsle Notes API',
        'version': 'v1',
        'status': 'running',
        'documentation': '/swagger/',
        'endpoints': endpoints,
    })


schema_view = get_schema_view(
    openapi.Info(
        title="ZeroIsle Notes API",
        default_version='v1',
        description="ZeroIsle Notes 应用 API 文档。",
        terms_of_service="https://www.zeroislenotes.com/terms/",
        contact=openapi.Contact(email="contact@zeroislenotes.com"),
        license=openapi.License(name="BSD License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

try:
    import django_prometheus  # noqa: F401

    prometheus_urls = [path('metrics/', include('django_prometheus.urls'))]
except Exception:
    prometheus_urls = []


def _append_optional_route(urlpatterns, route, module_path):
    try:
        urlpatterns.append(path(route, include(module_path)))
    except Exception as exc:
        logger.exception("Failed to include %s: %s", module_path, exc)


api_prefix = 'api/v1/'

urlpatterns = [
    path('', TemplateView.as_view(template_name='index.html'), name='api-root'),
    path('health/', health_check, name='health-check'),
    path('ready/', readiness_check, name='readiness-check'),
    *prometheus_urls,
    path('api.json', api_root_json, name='api-root-json'),
    path('api/', RedirectView.as_view(url='/swagger/', permanent=False), name='api-docs'),
    path(api_prefix.rstrip('/'), api_v1_root, name='api-v1-root'),
    path('admin/', admin.site.urls),
    re_path(r'^swagger(?P<format>\.json|\.yaml)$', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    path(f'{api_prefix}auth/', include('users.urls')),
    path(f'{api_prefix}ai-assistant/', include('ai_assistant.urls')),
    path(f'{api_prefix}search/', include('search.urls')),
]

optional_routes = [
    (f'{api_prefix}code/', 'code_editor.urls'),
    (f'{api_prefix}notes/', 'notes.urls'),
    (f'{api_prefix}reminders/', 'reminder.urls'),
    (f'{api_prefix}mind-map/', 'mind_map.urls'),
    (f'{api_prefix}community/', 'community.urls'),
    (f'{api_prefix}canvas/', 'canvas.urls'),
    (f'{api_prefix}document-converter/', 'document_converter.urls'),
    (f'{api_prefix}notifications/', 'notification.urls'),
    (f'{api_prefix}groups/', 'groups.urls'),
    (f'{api_prefix}knowledge-graph/', 'knowledge_graph.urls'),
    (f'{api_prefix}personal-activity/', 'personal_activity.urls'),
    (f'{api_prefix}sync/', 'sync.urls'),
    (f'{api_prefix}tasks/', 'tasks.urls'),
    (f'{api_prefix}voice-recognition/', 'voice_recognition.urls'),
]

for route, module_path in optional_routes:
    _append_optional_route(urlpatterns, route, module_path)


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
