# 公共模块

本目录包含零屿笔记应用的公共组件和工具，用于在不同模块之间共享通用功能和实用工具。

## 目录结构

- **middleware/**: 中间件
  - **auth_middleware.py**: 认证中间件，处理用户认证
  - **cors_middleware.py**: CORS中间件，处理跨域请求
  - **logging_middleware.py**: 日志中间件，记录请求日志
  - **rate_limit_middleware.py**: 限流中间件，限制请求频率
  - **error_middleware.py**: 错误处理中间件，统一错误处理
- **utils/**: 工具函数
  - **auth_utils.py**: 认证工具，处理令牌等
  - **date_utils.py**: 日期工具，处理日期和时间
  - **file_utils.py**: 文件工具，处理文件操作
  - **string_utils.py**: 字符串工具，处理字符串操作
  - **validation_utils.py**: 验证工具，数据验证
  - **response_utils.py**: 响应工具，统一响应格式
  - **pagination_utils.py**: 分页工具，处理分页逻辑
- **decorators/**: 装饰器
  - **auth_decorators.py**: 认证装饰器，权限控制
  - **cache_decorators.py**: 缓存装饰器，结果缓存
  - **logging_decorators.py**: 日志装饰器，函数日志
  - **rate_limit_decorators.py**: 限流装饰器，频率限制
  - **validation_decorators.py**: 验证装饰器，参数验证
- **exceptions/**: 异常类
  - **api_exceptions.py**: API异常，自定义API错误
  - **auth_exceptions.py**: 认证异常，认证相关错误
  - **validation_exceptions.py**: 验证异常，验证相关错误
  - **database_exceptions.py**: 数据库异常，数据库相关错误
  - **service_exceptions.py**: 服务异常，服务相关错误
- **models/**: 公共模型
  - **base_model.py**: 基础模型，模型基类
  - **timestamp_model.py**: 时间戳模型，带时间戳的模型
  - **soft_delete_model.py**: 软删除模型，支持软删除
  - **user_owned_model.py**: 用户所有模型，用户关联模型
- **serializers/**: 公共序列化器
  - **base_serializer.py**: 基础序列化器，序列化器基类
  - **timestamp_serializer.py**: 时间戳序列化器
  - **nested_serializer.py**: 嵌套序列化器，处理嵌套关系
  - **user_serializer.py**: 用户序列化器，用户数据序列化
- **services/**: 公共服务
  - **cache_service.py**: 缓存服务，数据缓存
  - **email_service.py**: 邮件服务，发送邮件
  - **sms_service.py**: 短信服务，发送短信
  - **storage_service.py**: 存储服务，文件存储
  - **notification_service.py**: 通知服务，发送通知
  - **logging_service.py**: 日志服务，记录日志
- **tasks/**: 异步任务
  - **email_tasks.py**: 邮件任务，异步发送邮件
  - **sms_tasks.py**: 短信任务，异步发送短信
  - **cleanup_tasks.py**: 清理任务，清理过期数据
  - **notification_tasks.py**: 通知任务，异步发送通知
- **tests/**: 测试
  - **test_utils.py**: 工具测试
  - **test_decorators.py**: 装饰器测试
  - **test_middleware.py**: 中间件测试
  - **test_services.py**: 服务测试

## 主要功能

### 中间件

公共模块提供以下中间件：

- **认证中间件**: 处理用户认证和授权
- **CORS中间件**: 处理跨域资源共享
- **日志中间件**: 记录请求和响应日志
- **限流中间件**: 限制API请求频率
- **错误处理中间件**: 统一处理和格式化错误响应

### 工具函数

公共模块提供以下工具函数：

- **认证工具**: JWT令牌生成、验证和刷新
- **日期工具**: 日期格式化、解析和计算
- **文件工具**: 文件上传、下载和处理
- **字符串工具**: 字符串处理和格式化
- **验证工具**: 数据验证和清理
- **响应工具**: 统一API响应格式
- **分页工具**: 处理列表分页逻辑

### 装饰器

公共模块提供以下装饰器：

- **认证装饰器**: 验证用户身份和权限
- **缓存装饰器**: 缓存函数结果
- **日志装饰器**: 记录函数调用日志
- **限流装饰器**: 限制函数调用频率
- **验证装饰器**: 验证函数参数

### 异常类

公共模块提供以下异常类：

- **API异常**: 自定义API错误
- **认证异常**: 认证和授权相关错误
- **验证异常**: 数据验证相关错误
- **数据库异常**: 数据库操作相关错误
- **服务异常**: 服务调用相关错误

### 公共模型

公共模块提供以下公共模型：

- **基础模型**: 所有模型的基类
- **时间戳模型**: 包含创建和更新时间戳的模型
- **软删除模型**: 支持软删除的模型
- **用户所有模型**: 与用户关联的模型

### 公共序列化器

公共模块提供以下公共序列化器：

- **基础序列化器**: 所有序列化器的基类
- **时间戳序列化器**: 处理时间戳的序列化器
- **嵌套序列化器**: 处理嵌套关系的序列化器
- **用户序列化器**: 处理用户数据的序列化器

### 公共服务

公共模块提供以下公共服务：

- **缓存服务**: 数据缓存管理
- **邮件服务**: 电子邮件发送
- **短信服务**: 短信发送
- **存储服务**: 文件存储管理
- **通知服务**: 用户通知管理
- **日志服务**: 应用日志记录

## 使用方法

### 中间件使用

在Django设置中注册中间件：

```python
MIDDLEWARE = [
    # Django内置中间件
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    # 自定义中间件
    'common.middleware.cors_middleware.CORSMiddleware',
    'common.middleware.auth_middleware.JWTAuthMiddleware',
    'common.middleware.logging_middleware.RequestLoggingMiddleware',
    'common.middleware.rate_limit_middleware.RateLimitMiddleware',
    'common.middleware.error_middleware.ErrorHandlingMiddleware',
]
```

### 工具函数使用

导入并使用工具函数：

```python
from common.utils.auth_utils import generate_token, verify_token
from common.utils.date_utils import format_date, parse_date
from common.utils.response_utils import success_response, error_response

# 生成认证令牌
token = generate_token(user_id)

# 格式化日期
formatted_date = format_date(date_obj, format='%Y-%m-%d')

# 返回成功响应
return success_response(data={'user': user_data})
```

### 装饰器使用

使用装饰器包装视图函数：

```python
from common.decorators.auth_decorators import login_required, permission_required
from common.decorators.cache_decorators import cache_result
from common.decorators.rate_limit_decorators import rate_limit

@login_required
def profile_view(request):
    # 只有登录用户可以访问
    return get_user_profile(request.user)

@permission_required('notes.create_note')
def create_note_view(request):
    # 只有有权限的用户可以访问
    return create_note(request.data)

@cache_result(timeout=300)  # 缓存5分钟
def get_popular_tags_view(request):
    # 结果会被缓存
    return get_popular_tags()

@rate_limit(limit=10, period=60)  # 每分钟最多10次
def search_view(request):
    # 限制调用频率
    return search(request.query_params)
```

### 异常处理

使用自定义异常：

```python
from common.exceptions.api_exceptions import APIError, NotFoundError
from common.exceptions.auth_exceptions import AuthenticationError

def get_note(note_id):
    try:
        note = Note.objects.get(id=note_id)
        if note.user != request.user:
            raise AuthenticationError("You don't have permission to access this note")
        return note
    except Note.DoesNotExist:
        raise NotFoundError("Note not found")
```

### 公共服务使用

使用公共服务：

```python
from common.services.email_service import send_email
from common.services.notification_service import send_notification
from common.services.storage_service import upload_file

# 发送邮件
send_email(
    to_email='user@example.com',
    subject='Welcome to Zero Isle Notes',
    template='welcome_email.html',
    context={'username': 'John'}
)

# 发送通知
send_notification(
    user_id=user_id,
    title='New Comment',
    message='Someone commented on your note',
    data={'note_id': note_id}
)

# 上传文件
file_url = upload_file(
    file_obj=request.FILES['attachment'],
    folder='attachments',
    allowed_types=['image/jpeg', 'image/png', 'application/pdf']
)
```

## 注意事项

- **一致性**: 确保在整个应用中一致地使用公共组件
- **文档**: 为公共组件提供详细的文档和示例
- **测试**: 彻底测试公共组件，因为它们被多个模块使用
- **性能**: 优化公共组件的性能，因为它们可能被频繁调用
- **向后兼容**: 修改公共组件时注意保持向后兼容性
- **依赖管理**: 避免公共组件之间的循环依赖
- **职责分离**: 确保每个组件有明确的职责，避免功能重叠
