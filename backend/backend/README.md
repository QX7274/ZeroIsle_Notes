# Django项目配置模块

本目录包含零屿笔记应用的Django项目核心配置，用于管理全局设置、URL路由、中间件和其他项目级配置。

## 目录结构

- **settings/**: 分环境设置
  - **__init__.py**: 设置入口，根据环境变量加载不同的设置文件
  - **base.py**: 基础设置，所有环境共享的配置
  - **development.py**: 开发环境特定设置，包含调试模式和开发工具
  - **production.py**: 生产环境特定设置，优化性能和安全性
  - **testing.py**: 测试环境特定设置，用于自动化测试
- **urls.py**: 全局URL路由配置，定义API端点和静态资源路径
- **wsgi.py**: WSGI应用配置，用于生产环境部署
- **asgi.py**: ASGI应用配置，支持WebSocket和异步请求
- **celery.py**: Celery任务队列配置，用于异步任务处理
- **middleware.py**: 全局中间件配置，处理请求和响应
- **routing.py**: WebSocket路由配置，处理实时通信
- **logging.py**: 日志配置，设置日志记录和格式
- **settings.py**: 向后兼容的设置文件，重定向到settings目录

## 主要功能

### 环境配置管理

Django项目配置模块提供环境配置管理功能，支持以下特性：

- **多环境支持**: 开发、测试和生产环境的独立配置
- **环境变量集成**: 通过环境变量控制配置加载
- **敏感信息保护**: 将敏感信息（如密钥）存储在环境变量中
- **配置继承**: 通过基础配置和环境特定配置的继承关系简化管理
- **本地开发覆盖**: 支持本地开发环境的特定配置覆盖
- **条件配置**: 根据环境条件启用或禁用特定功能
- **配置验证**: 验证配置的完整性和正确性

### URL路由管理

Django项目配置模块提供URL路由管理功能，支持以下特性：

- **API路由**: 定义RESTful API的URL路径
- **静态资源路由**: 配置静态文件和媒体文件的访问路径
- **管理后台路由**: 配置Django管理后台的访问路径
- **文档路由**: 配置API文档（Swagger/ReDoc）的访问路径
- **健康检查路由**: 配置系统健康检查的访问路径
- **认证路由**: 配置用户认证相关的URL路径
- **版本化API**: 支持API版本管理

### 中间件配置

Django项目配置模块提供中间件配置功能，支持以下特性：

- **认证中间件**: 处理用户认证和授权
- **CORS中间件**: 处理跨域资源共享
- **安全中间件**: 实施安全策略和保护
- **压缩中间件**: 压缩响应内容，提高性能
- **缓存中间件**: 缓存响应，减少数据库负载
- **日志中间件**: 记录请求和响应日志
- **异常处理中间件**: 统一处理和格式化错误响应

### 数据库配置

Django项目配置模块提供数据库配置功能，支持以下特性：

- **MongoDB配置**: 配置MongoDB连接和设置
- **Neo4j配置**: 配置Neo4j图数据库连接
- **Redis配置**: 配置Redis缓存和消息队列
- **连接池管理**: 优化数据库连接池
- **读写分离**: 支持数据库读写分离
- **数据库路由**: 配置多数据库路由
- **ORM设置**: 配置Django ORM行为

### 缓存配置

Django项目配置模块提供缓存配置功能，支持以下特性：

- **Redis缓存**: 配置Redis作为缓存后端
- **缓存策略**: 设置缓存过期时间和策略
- **缓存键前缀**: 配置缓存键前缀，避免冲突
- **缓存中间件**: 配置页面级缓存
- **缓存版本化**: 支持缓存版本管理
- **缓存失效**: 配置缓存失效机制
- **本地内存缓存**: 配置本地内存缓存

### 异步任务配置

Django项目配置模块提供异步任务配置功能，支持以下特性：

- **Celery配置**: 配置Celery任务队列
- **任务路由**: 配置任务路由到不同队列
- **任务调度**: 配置定时任务和周期任务
- **任务监控**: 配置任务执行监控
- **任务重试**: 配置任务失败重试策略
- **任务优先级**: 配置任务优先级
- **任务并发**: 配置任务并发执行数量

### WebSocket配置

Django项目配置模块提供WebSocket配置功能，支持以下特性：

- **ASGI配置**: 配置ASGI服务器
- **WebSocket路由**: 配置WebSocket连接路由
- **认证集成**: 集成WebSocket认证
- **消息处理**: 配置WebSocket消息处理
- **频道层**: 配置频道层后端（Redis）
- **连接管理**: 配置WebSocket连接管理
- **消息广播**: 配置消息广播机制

## 配置示例

### 环境配置示例

```python
# settings/__init__.py
import os

# 默认使用开发环境设置
environment = os.environ.get('DJANGO_ENV', 'development')

if environment == 'production':
    from .production import *
elif environment == 'testing':
    from .testing import *
else:
    from .development import *
```

### URL路由配置示例

```python
# urls.py
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
        title="零屿笔记API",
        default_version='v1',
        description="零屿笔记应用API文档",
        terms_of_service="https://www.example.com/terms/",
        contact=openapi.Contact(email="contact@example.com"),
        license=openapi.License(name="BSD License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

# API前缀
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
    path(f'{api_prefix}knowledge-graph/', include('knowledge_graph.urls')),
    # 其他API端点...
]

# 开发环境下的静态文件和媒体文件URL
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

## 使用方法

### 设置环境变量

```bash
# 设置环境变量
export DJANGO_ENV=production  # 生产环境
export DJANGO_ENV=development  # 开发环境
export DJANGO_ENV=testing  # 测试环境

# 设置数据库连接
export MONGO_HOST=localhost
export MONGO_PORT=27017
export MONGO_DB=zeroislenotes
export MONGO_USER=admin
export MONGO_PASSWORD=password

# 设置密钥
export SECRET_KEY=your-secret-key
```

### 运行开发服务器

```bash
# 使用开发环境配置运行
python manage.py runserver

# 使用生产环境配置运行
DJANGO_ENV=production python manage.py runserver
```

### 部署到生产环境

```bash
# 使用WSGI服务器
gunicorn backend.wsgi:application --bind 0.0.0.0:8000

# 使用ASGI服务器（支持WebSocket）
daphne backend.asgi:application --bind 0.0.0.0:8000
```

## 注意事项

- **敏感信息**: 不要在代码中硬编码敏感信息，使用环境变量
- **调试模式**: 在生产环境中禁用调试模式（DEBUG=False）
- **安全设置**: 确保生产环境中启用所有安全设置
- **静态文件**: 在生产环境中使用专门的静态文件服务器
- **缓存配置**: 在生产环境中配置适当的缓存
- **日志配置**: 确保生产环境中有适当的日志配置
- **性能优化**: 在生产环境中启用性能优化设置
