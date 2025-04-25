from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

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
    path(f'{api_prefix}ai-assistant/', include('ai_assistant.urls')),
    path(f'{api_prefix}voice-recognition/', include('voice_recognition.urls')),
    path(f'{api_prefix}search/', include('search.urls')),
    path(f'{api_prefix}community/', include('community.urls')),
    path(f'{api_prefix}canvas/', include('canvas.urls')),
    path(f'{api_prefix}code/', include('code.urls')),
]

# 添加媒体文件URL
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)