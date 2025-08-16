from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView, TemplateView
from django.http import JsonResponse
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

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
        'code': '/api/v1/code/',
        'common': '/api/v1/common/',
        'notifications': '/api/v1/notifications/',
        'groups': '/api/v1/groups/',
        'sync': '/api/v1/sync/',
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

# API版本前缀
api_prefix = 'api/v1/'

urlpatterns = [
    # 根路径 - 使用HTML模板
    path('', TemplateView.as_view(template_name='index.html'), name='api-root'),

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
    path(f'{api_prefix}notes/', include('notes.urls')),
    path(f'{api_prefix}reminders/', include('reminder.urls')),
    path(f'{api_prefix}knowledge-graph/', include('knowledge_graph.urls')),
    path(f'{api_prefix}mind-map/', include('mind_map.urls')),
    path(f'{api_prefix}ai-assistant/', include('ai_assistant.urls')),
    path(f'{api_prefix}voice-recognition/', include('voice_recognition.urls')),
    path(f'{api_prefix}search/', include('search.urls')),
    path(f'{api_prefix}community/', include('community.urls')),
    path(f'{api_prefix}canvas/', include('canvas.urls')),
    path(f'{api_prefix}code/', include('code.urls')),
    path(f'{api_prefix}common/', include('common.urls')),
    path(f'{api_prefix}notifications/', include('notification.urls')),
    path(f'{api_prefix}groups/', include('groups.urls')),
    path(f'{api_prefix}sync/', include('sync.urls')),
    path(f'{api_prefix}document-converter/', include('document_converter.urls')),
]

# 添加媒体文件URL
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)