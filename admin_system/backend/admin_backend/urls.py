"""
URL configuration for admin_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_yasg import openapi
from drf_yasg.views import get_schema_view
from rest_framework import permissions

# API 文档 Schema。
#
# 说明（问题背景）：此前使用 DRF 自带的 include_docs_urls，它在导入期即通过
# CoreAPI 生成器构建 schema，而 CoreAPI 已在 DRF 3.16 中移除依赖，导致：
#   AssertionError: `coreapi` must be installed for schema support.
# 只要 urls.py 被导入（包括 manage.py check / runserver / migrate），进程即崩溃。
#
# 现改用本项目 requirements.txt 已声明的 drf-yasg（OpenAPI 2.0），
# 不依赖 coreapi，且文档仅在访问 /api/docs/ 时才真正生成 schema，
# 不会阻塞进程启动。
schema_view = get_schema_view(
    openapi.Info(
        title='零屿笔记管理系统 API',
        default_version='v1',
        description='管理后台接口文档',
    ),
    public=False,
    permission_classes=(permissions.IsAuthenticated,),
)

urlpatterns = [
    # Django管理后台
    path('admin/', admin.site.urls),

    # API文档（drf-yasg）
    path('api/docs/', schema_view.with_ui('swagger', cache_timeout=0), name='admin-api-docs'),

    # API端点
    path('api/auth/', include('auth_api.urls')),
    path('api/users/', include('users.urls')),
    path('api/content/', include('content.urls')),
    path('api/settings/', include('settings_api.urls')),
    path('api/logs/', include('logs.urls')),
    path('api/sync/', include('sync.urls')),
    path('api/analytics/', include('analytics.urls')),
]

# 添加媒体文件URL
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
