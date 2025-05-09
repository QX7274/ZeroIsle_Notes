# 通知模块

本目录包含零屿笔记应用的通知功能相关服务，用于管理和发送各类通知，包括应用内通知、推送通知、邮件通知和短信通知等。

## 目录结构

- **models/**: 数据模型
  - **notification.py**: 通知模型，基本通知
  - **notification_channel.py**: 通知渠道模型，发送渠道
  - **notification_template.py**: 通知模板模型，消息模板
  - **notification_preference.py**: 通知偏好模型，用户设置
  - **notification_group.py**: 通知组模型，通知分组
- **serializers/**: 序列化器
  - **notification.py**: 通知序列化器
  - **notification_channel.py**: 通知渠道序列化器
  - **notification_template.py**: 通知模板序列化器
  - **notification_preference.py**: 通知偏好序列化器
  - **notification_group.py**: 通知组序列化器
- **views/**: 视图
  - **notification.py**: 通知视图，通知管理
  - **notification_channel.py**: 通知渠道视图
  - **notification_template.py**: 通知模板视图
  - **notification_preference.py**: 通知偏好视图
  - **notification_group.py**: 通知组视图
  - **websocket.py**: WebSocket视图，实时通知
- **services/**: 业务逻辑
  - **notification_service.py**: 通知服务，核心逻辑
  - **channel_service.py**: 渠道服务，渠道管理
  - **template_service.py**: 模板服务，模板管理
  - **preference_service.py**: 偏好服务，偏好管理
  - **push_service.py**: 推送服务，推送通知
  - **email_service.py**: 邮件服务，邮件通知
  - **sms_service.py**: 短信服务，短信通知
  - **websocket_service.py**: WebSocket服务，实时通知
- **tasks/**: 异步任务
  - **notification_tasks.py**: 通知任务，异步发送通知
  - **cleanup_tasks.py**: 清理任务，清理过期通知
  - **batch_tasks.py**: 批量任务，批量发送通知
- **consumers/**: WebSocket消费者
  - **notification_consumer.py**: 通知消费者，处理WebSocket连接
- **utils/**: 工具函数
  - **template_utils.py**: 模板工具，处理模板渲染
  - **channel_utils.py**: 渠道工具，处理渠道选择
  - **batch_utils.py**: 批量工具，处理批量发送

## 主要功能

### 通知管理

通知模块提供通知管理功能，支持以下特性：

- **通知创建**: 创建新的通知
- **通知查询**: 查询和筛选通知
- **通知标记**: 标记通知为已读/未读
- **通知删除**: 删除不再需要的通知
- **通知分组**: 对通知进行分组管理
- **通知统计**: 统计通知数量和状态
- **通知历史**: 查看历史通知记录

### 多渠道通知

通知模块提供多渠道通知功能，支持以下特性：

- **应用内通知**: 在应用内显示通知
- **推送通知**: 发送移动设备推送通知
- **邮件通知**: 发送电子邮件通知
- **短信通知**: 发送短信通知
- **渠道配置**: 配置各通知渠道的参数
- **渠道优先级**: 设置通知渠道的优先级
- **渠道状态**: 监控通知渠道的状态

### 通知模板

通知模块提供通知模板功能，支持以下特性：

- **模板创建**: 创建通知内容模板
- **模板编辑**: 编辑现有模板
- **模板变量**: 支持在模板中使用变量
- **模板渲染**: 根据上下文渲染模板
- **多语言模板**: 支持多语言模板
- **模板版本**: 管理模板的版本历史
- **模板测试**: 测试模板渲染效果

### 用户偏好

通知模块提供用户偏好功能，支持以下特性：

- **偏好设置**: 设置通知接收偏好
- **渠道选择**: 选择接收通知的渠道
- **通知类型**: 选择接收的通知类型
- **通知频率**: 设置通知的接收频率
- **免打扰时间**: 设置免打扰时间段
- **偏好导入导出**: 导入导出通知偏好
- **默认偏好**: 设置默认通知偏好

### 实时通知

通知模块提供实时通知功能，支持以下特性：

- **WebSocket通知**: 通过WebSocket实时推送通知
- **连接管理**: 管理WebSocket连接
- **通知推送**: 向特定用户推送通知
- **状态同步**: 同步通知状态（如已读状态）
- **离线处理**: 处理用户离线时的通知
- **重连机制**: 处理连接断开和重连
- **心跳检测**: 维持WebSocket连接活跃

### 批量通知

通知模块提供批量通知功能，支持以下特性：

- **批量发送**: 向多个用户发送相同通知
- **目标筛选**: 根据条件筛选通知目标
- **分批处理**: 分批处理大量通知
- **发送进度**: 跟踪批量发送进度
- **失败重试**: 自动重试发送失败的通知
- **结果统计**: 统计批量发送结果
- **定时发送**: 定时发送批量通知

## API端点

通知模块提供以下主要API端点：

- **通知API**:
  - `GET /api/notifications/`: 获取通知列表
  - `GET /api/notifications/{id}/`: 获取特定通知详情
  - `PUT /api/notifications/{id}/read/`: 标记通知为已读
  - `PUT /api/notifications/read-all/`: 标记所有通知为已读
  - `DELETE /api/notifications/{id}/`: 删除通知
  - `GET /api/notifications/unread-count/`: 获取未读通知数量
  - `GET /api/notifications/stats/`: 获取通知统计信息

- **偏好API**:
  - `GET /api/notifications/preferences/`: 获取通知偏好
  - `PUT /api/notifications/preferences/`: 更新通知偏好
  - `GET /api/notifications/preferences/types/`: 获取通知类型列表
  - `GET /api/notifications/preferences/channels/`: 获取通知渠道列表
  - `POST /api/notifications/preferences/test/`: 发送测试通知
  - `POST /api/notifications/preferences/import/`: 导入通知偏好
  - `GET /api/notifications/preferences/export/`: 导出通知偏好

- **模板API**:
  - `GET /api/notifications/templates/`: 获取模板列表
  - `POST /api/notifications/templates/`: 创建新模板
  - `GET /api/notifications/templates/{id}/`: 获取特定模板详情
  - `PUT /api/notifications/templates/{id}/`: 更新模板
  - `DELETE /api/notifications/templates/{id}/`: 删除模板
  - `POST /api/notifications/templates/{id}/test/`: 测试模板渲染
  - `GET /api/notifications/templates/{id}/versions/`: 获取模板版本历史

- **批量通知API**:
  - `POST /api/notifications/batch/`: 发送批量通知
  - `GET /api/notifications/batch/{id}/`: 获取批量发送状态
  - `POST /api/notifications/batch/{id}/cancel/`: 取消批量发送
  - `GET /api/notifications/batch/history/`: 获取批量发送历史
  - `GET /api/notifications/batch/{id}/stats/`: 获取批量发送统计

## 数据模型

### 通知模型 (Notification)

```python
class Notification(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(User, required=True)
    title = StringField(max_length=255, required=True)
    message = StringField(required=True)
    type = StringField(max_length=100, required=True)
    data = DictField()
    is_read = BooleanField(default=False)
    read_at = DateTimeField()
    is_deleted = BooleanField(default=False)
    deleted_at = DateTimeField()
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
    sent_via = ListField(StringField(max_length=50))
    group = StringField(max_length=100)
    priority = StringField(choices=['low', 'normal', 'high'], default='normal')
    expires_at = DateTimeField()
```

### 通知偏好模型 (NotificationPreference)

```python
class NotificationPreference(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(User, required=True, unique=True)
    enabled = BooleanField(default=True)
    channels = DictField()  # 每个通知类型的渠道设置
    quiet_hours = DictField()  # 免打扰时间设置
    frequency = DictField()  # 通知频率设置
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
```

### 通知模板模型 (NotificationTemplate)

```python
class NotificationTemplate(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    name = StringField(max_length=100, required=True)
    description = StringField()
    type = StringField(max_length=100, required=True)
    title_template = StringField(required=True)
    message_template = StringField(required=True)
    email_subject_template = StringField()
    email_body_template = StringField()
    push_title_template = StringField()
    push_body_template = StringField()
    sms_template = StringField()
    variables = ListField(StringField())
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
    created_by = ReferenceField(User)
    version = IntField(default=1)
```

## 与其他模块的交互

通知模块与以下模块有交互：

- **用户模块**: 获取用户信息和通知偏好
- **社区模块**: 发送社区活动的通知
- **提醒模块**: 发送提醒相关的通知
- **笔记模块**: 发送笔记相关的通知
- **认证模块**: 发送认证相关的通知

## 配置说明

通知模块需要以下配置：

- **渠道配置**: 各通知渠道的配置参数
- **模板配置**: 默认通知模板的配置
- **偏好配置**: 默认通知偏好的配置
- **WebSocket配置**: WebSocket服务的配置
- **批量处理配置**: 批量通知处理的配置

## 注意事项

- **性能优化**: 优化通知发送和查询的性能
- **可靠性**: 确保通知的可靠发送，避免丢失
- **实时性**: 确保实时通知的及时性
- **资源消耗**: 控制通知发送的资源消耗
- **用户体验**: 避免过多通知打扰用户
- **隐私保护**: 保护通知内容中的敏感信息
- **跨平台兼容**: 确保通知在不同平台上的兼容性
