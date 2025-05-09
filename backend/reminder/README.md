# 提醒模块

本目录包含零屿笔记应用的提醒功能相关服务，用于管理用户的提醒、待办事项和日程安排。

## 目录结构

- **models/**: 数据模型
  - **reminder.py**: 提醒模型，基本提醒
  - **recurring_reminder.py**: 重复提醒模型，周期性提醒
  - **reminder_category.py**: 提醒分类模型，分类管理
  - **reminder_tag.py**: 提醒标签模型，标签管理
  - **reminder_notification.py**: 提醒通知模型，通知记录
- **serializers/**: 序列化器
  - **reminder.py**: 提醒序列化器
  - **recurring_reminder.py**: 重复提醒序列化器
  - **reminder_category.py**: 提醒分类序列化器
  - **reminder_tag.py**: 提醒标签序列化器
  - **reminder_notification.py**: 提醒通知序列化器
- **views/**: 视图
  - **reminder.py**: 提醒视图，CRUD操作
  - **recurring_reminder.py**: 重复提醒视图
  - **reminder_category.py**: 提醒分类视图
  - **reminder_tag.py**: 提醒标签视图
  - **reminder_notification.py**: 提醒通知视图
  - **calendar.py**: 日历视图，日历展示
  - **sync.py**: 同步视图，同步提醒
- **services/**: 业务逻辑
  - **reminder_service.py**: 提醒服务，核心逻辑
  - **notification_service.py**: 通知服务，发送通知
  - **recurrence_service.py**: 重复服务，处理重复逻辑
  - **calendar_service.py**: 日历服务，日历管理
  - **sync_service.py**: 同步服务，同步提醒
- **tasks/**: 异步任务
  - **notification_tasks.py**: 通知任务，异步发送通知
  - **reminder_tasks.py**: 提醒任务，处理提醒
  - **sync_tasks.py**: 同步任务，异步同步提醒
- **utils/**: 工具函数
  - **date_utils.py**: 日期工具，处理日期和时间
  - **recurrence_utils.py**: 重复工具，处理重复规则
  - **notification_utils.py**: 通知工具，处理通知

## 主要功能

### 提醒管理

提醒模块提供提醒管理功能，支持以下特性：

- **提醒创建**: 创建新的提醒
- **提醒编辑**: 编辑现有提醒的内容和设置
- **提醒删除**: 删除不再需要的提醒
- **提醒查询**: 查询和筛选提醒
- **提醒完成**: 标记提醒为已完成
- **提醒恢复**: 恢复已完成的提醒
- **提醒排序**: 按不同条件排序提醒

### 重复提醒

提醒模块提供重复提醒功能，支持以下特性：

- **重复规则**: 设置提醒的重复规则（每天、每周、每月等）
- **自定义重复**: 自定义复杂的重复规则
- **重复例外**: 设置重复规则的例外日期
- **重复结束**: 设置重复的结束条件（次数、日期）
- **重复编辑**: 编辑重复提醒的规则
- **单次修改**: 修改重复提醒的单次实例
- **重复查看**: 查看重复提醒的所有实例

### 分类和标签

提醒模块提供分类和标签功能，支持以下特性：

- **分类管理**: 创建、编辑、删除和查询提醒分类
- **标签管理**: 创建、编辑、删除和查询提醒标签
- **分类筛选**: 按分类筛选提醒
- **标签筛选**: 按标签筛选提醒
- **分类统计**: 统计各分类的提醒数量
- **标签统计**: 统计各标签的提醒数量
- **批量操作**: 批量为提醒添加或移除标签/分类

### 通知系统

提醒模块提供通知系统，支持以下特性：

- **通知发送**: 在提醒时间发送通知
- **多渠道通知**: 支持多种通知渠道（应用内、邮件、短信等）
- **通知设置**: 自定义通知的方式和时间
- **提前通知**: 在提醒时间前提前通知
- **通知历史**: 记录通知的发送历史
- **通知状态**: 跟踪通知的状态（已发送、已读等）
- **通知静音**: 暂时静音特定提醒的通知

### 日历视图

提醒模块提供日历视图功能，支持以下特性：

- **日视图**: 查看某一天的所有提醒
- **周视图**: 查看某一周的所有提醒
- **月视图**: 查看某一月的所有提醒
- **年视图**: 查看某一年的所有提醒
- **日历导航**: 在不同日期之间导航
- **日历过滤**: 按条件过滤日历中的提醒
- **日历导出**: 导出日历数据

### 同步功能

提醒模块提供同步功能，支持以下特性：

- **增量同步**: 只同步变更的部分，减少数据传输
- **冲突解决**: 处理多设备编辑导致的冲突
- **离线支持**: 支持离线编辑，网络恢复后自动同步
- **同步状态**: 跟踪提醒的同步状态
- **选择性同步**: 选择需要同步的提醒
- **同步历史**: 记录同步历史，便于追踪问题
- **外部日历同步**: 与外部日历服务同步（如Google日历）

## API端点

提醒模块提供以下主要API端点：

- **提醒API**:
  - `GET /api/reminders/`: 获取提醒列表
  - `POST /api/reminders/`: 创建新提醒
  - `GET /api/reminders/{id}/`: 获取特定提醒详情
  - `PUT /api/reminders/{id}/`: 更新提醒
  - `DELETE /api/reminders/{id}/`: 删除提醒
  - `POST /api/reminders/{id}/complete/`: 完成提醒
  - `POST /api/reminders/{id}/restore/`: 恢复提醒
  - `GET /api/reminders/stats/`: 获取提醒统计信息

- **重复提醒API**:
  - `GET /api/reminders/recurring/`: 获取重复提醒列表
  - `POST /api/reminders/recurring/`: 创建新重复提醒
  - `GET /api/reminders/recurring/{id}/`: 获取特定重复提醒详情
  - `PUT /api/reminders/recurring/{id}/`: 更新重复提醒
  - `DELETE /api/reminders/recurring/{id}/`: 删除重复提醒
  - `GET /api/reminders/recurring/{id}/instances/`: 获取重复提醒的实例
  - `PUT /api/reminders/recurring/{id}/instances/{instance_id}/`: 更新单个实例

- **分类API**:
  - `GET /api/reminders/categories/`: 获取分类列表
  - `POST /api/reminders/categories/`: 创建新分类
  - `GET /api/reminders/categories/{id}/`: 获取特定分类详情
  - `PUT /api/reminders/categories/{id}/`: 更新分类
  - `DELETE /api/reminders/categories/{id}/`: 删除分类
  - `GET /api/reminders/categories/{id}/reminders/`: 获取分类下的提醒

- **标签API**:
  - `GET /api/reminders/tags/`: 获取标签列表
  - `POST /api/reminders/tags/`: 创建新标签
  - `GET /api/reminders/tags/{id}/`: 获取特定标签详情
  - `PUT /api/reminders/tags/{id}/`: 更新标签
  - `DELETE /api/reminders/tags/{id}/`: 删除标签
  - `GET /api/reminders/tags/{id}/reminders/`: 获取标签下的提醒

- **通知API**:
  - `GET /api/reminders/notifications/`: 获取通知列表
  - `GET /api/reminders/notifications/{id}/`: 获取特定通知详情
  - `PUT /api/reminders/notifications/{id}/read/`: 标记通知为已读
  - `GET /api/reminders/notifications/settings/`: 获取通知设置
  - `PUT /api/reminders/notifications/settings/`: 更新通知设置

- **日历API**:
  - `GET /api/reminders/calendar/day/{date}/`: 获取日视图
  - `GET /api/reminders/calendar/week/{date}/`: 获取周视图
  - `GET /api/reminders/calendar/month/{date}/`: 获取月视图
  - `GET /api/reminders/calendar/year/{date}/`: 获取年视图
  - `GET /api/reminders/calendar/export/`: 导出日历数据

- **同步API**:
  - `POST /api/reminders/sync/`: 同步提醒
  - `GET /api/reminders/sync/status/`: 获取同步状态
  - `POST /api/reminders/sync/resolve-conflicts/`: 解决同步冲突
  - `POST /api/reminders/sync/external/`: 与外部日历同步

## 数据模型

### 提醒模型 (Reminder)

```python
class Reminder(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(User, required=True)
    title = StringField(max_length=255, required=True)
    description = StringField()
    due_date = DateTimeField(required=True)
    completed = BooleanField(default=False)
    completed_at = DateTimeField()
    priority = StringField(choices=['low', 'medium', 'high'], default='medium')
    category = ReferenceField('ReminderCategory')
    tags = ListField(ReferenceField('ReminderTag'))
    note = ReferenceField('Note')
    recurring = ReferenceField('RecurringReminder')
    notification_settings = DictField()
    is_all_day = BooleanField(default=False)
    location = StringField()
    color = StringField(max_length=20)
    is_deleted = BooleanField(default=False)
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
    sync_status = StringField(choices=['synced', 'local_only', 'conflict'], default='local_only')
    last_synced_at = DateTimeField()
```

### 重复提醒模型 (RecurringReminder)

```python
class RecurringReminder(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(User, required=True)
    title = StringField(max_length=255, required=True)
    description = StringField()
    start_date = DateTimeField(required=True)
    end_date = DateTimeField()
    recurrence_rule = StringField(required=True)  # iCalendar RRULE format
    exceptions = ListField(DateTimeField())
    priority = StringField(choices=['low', 'medium', 'high'], default='medium')
    category = ReferenceField('ReminderCategory')
    tags = ListField(ReferenceField('ReminderTag'))
    notification_settings = DictField()
    is_all_day = BooleanField(default=False)
    location = StringField()
    color = StringField(max_length=20)
    is_deleted = BooleanField(default=False)
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
```

### 提醒分类模型 (ReminderCategory)

```python
class ReminderCategory(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(User, required=True)
    name = StringField(max_length=100, required=True)
    description = StringField()
    color = StringField(max_length=20)
    icon = StringField(max_length=50)
    order = IntField(default=0)
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
```

## 与其他模块的交互

提醒模块与以下模块有交互：

- **用户模块**: 管理提醒的所有权和访问权限
- **笔记模块**: 将提醒关联到笔记
- **通知模块**: 发送提醒通知
- **AI助手模块**: 利用AI能力分析和处理提醒
- **存储模块**: 管理提醒数据的存储和同步

## 注意事项

- **时区处理**: 妥善处理不同时区的提醒时间
- **重复规则**: 确保重复规则的正确解析和处理
- **通知可靠性**: 确保通知的可靠发送，避免遗漏
- **同步冲突**: 妥善处理多设备同步时的冲突
- **性能优化**: 优化大量提醒和重复提醒的处理性能
- **电池消耗**: 优化移动设备上的电池消耗
- **用户体验**: 提供直观的界面和操作，降低使用门槛
