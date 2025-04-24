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
from rest_framework.documentation import include_docs_urls

urlpatterns = [
    # Django管理后台
    path('admin/', admin.site.urls),

    # API文档
    path('api/docs/', include_docs_urls(title='零屿笔记管理系统API文档')),

    # API端点
    path('api/auth/', include('auth_api.urls')),
    path('api/users/', include('users.urls')),
    path('api/content/', include('content.urls')),
    path('api/settings/', include('settings_api.urls')),
    path('api/logs/', include('logs.urls')),
]

# 添加媒体文件URL
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
