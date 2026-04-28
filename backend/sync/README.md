# 零屿笔记后端同步模块

## 概述

后端同步模块是零屿笔记应用的核心组件之一，负责处理前端应用与MongoDB Atlas云数据库之间的数据同步。该模块实现了分层同步策略，将数据分为关键数据和非关键数据，分别采用不同的同步方式，以优化网络使用和提高用户体验。

## 架构设计

### 模块结构

```
backend/sync/
├── __init__.py           # 包初始化文件
├── apps.py               # Django应用配置
├── models.py             # 同步相关模型（如有）
├── urls.py               # URL路由配置
├── views.py              # API视图
├── signals.py            # 信号处理器
├── services/             # 服务层
│   ├── __init__.py       # 服务包初始化
│   ├── mongodb_service.py # MongoDB连接服务
│   └── sync_service.py   # 同步业务逻辑服务
└── tests/                # 测试代码
    └── __init__.py       # 测试包初始化
```

### 技术栈

- **Django**: Web框架
- **Django REST Framework**: RESTful API框架
- **PyMongo**: MongoDB Python驱动
- **MongoDB Atlas**: 云数据库服务

## 同步策略

后端同步模块实现了分层同步策略，将数据分为两类：

1. **关键数据**：用户信息、应用设置等重要但数据量小的信息
2. **非关键数据**：笔记、提醒等主要内容数据

### 关键数据同步

- 端点：`/api/v1/sync/key-data/`
- 频率：自动同步，前端每2分钟请求一次
- 数据：用户信息、应用设置
- 特点：双向同步，优先级高

### 非关键数据同步

- 端点：
  - `/api/v1/sync/notes/`：笔记同步
  - `/api/v1/sync/reminders/`：提醒同步
  - `/api/v1/sync/settings/`：设置同步
- 频率：手动触发或条件自动
- 特点：支持批量操作，增量同步

## 变更记录（本轮优化）

### 2026-03 Sync 子路由唯一性契约回归增强

- 变更内容
  - 扩展 `backend/sync/tests/test_sync_urls.py`，新增 `test_sync_url_route_names_and_paths_are_unique`。
  - 断言 `backend/sync/urls.py` 中 5 个子路由的 `name` 与 `path` 均无重复，并校验路由 name 集合与既定契约一致。
- 变更原因
  - 在已覆盖“路由存在与主挂载”基础上，补充唯一性约束，防止后续新增/调整路由时出现命名冲突或重复路径。
- 影响范围
  - 代码：`backend/sync/tests/test_sync_urls.py`
  - 回归流程：Sync 子路由 name/path 唯一性与契约一致性检查
- 使用方式
  - 在 `backend` 目录执行：`python -m unittest sync.tests.test_sync_urls`
  - 联合回归：`python -m unittest sync.tests.test_sync_views sync.tests.test_sync_service_v2 sync.tests.test_sync_urls`
- 兼容性与注意事项
  - 仅新增测试与文档，不改变生产路由、service 协议和接口行为。

### 2026-03 根文档同步接口版本前缀一致性校准

- 变更内容
  - 更新根文档 `README.md` 的 Sync 接口示例路径，将 `/api/sync/*` 统一为 `/api/v1/sync/*`。
- 变更原因
  - 与实际主路由配置 `backend/backend/urls.py`（`api_prefix = 'api/v1/'` 且挂载 `sync/`）保持一致，避免调用方按旧路径接入。
- 影响范围
  - 文档：`README.md`（同步模块配置说明章节）
- 使用方式
  - 客户端和联调文档应统一按 `/api/v1/sync/*` 使用与验证。
- 兼容性与注意事项
  - 本轮仅文档校准，不改变任何接口实现与业务语义。

### 2026-03 Sync 主路由前缀契约回归增强

- 变更内容
  - 扩展 `backend/sync/tests/test_sync_urls.py`，新增 `test_project_root_api_prefix_and_sync_path_contract`。
  - 新增断言：`backend/backend/urls.py` 中 `api_prefix` 固定为 `api/v1/`，且 `sync` 路由通过 `path(f'{api_prefix}sync/', include('sync.urls'))` 挂载。
- 变更原因
  - 上一轮已覆盖子路由映射与 `include('sync.urls')` 存在性，本轮补齐主路由前缀语义约束，防止未来改动导致 `/api/v1/sync/*` 前缀回退。
- 影响范围
  - 代码：`backend/sync/tests/test_sync_urls.py`
  - 回归流程：Sync 主路由前缀与挂载拼接契约（`/api/v1/sync/*`）
- 使用方式
  - 在 `backend` 目录执行：`python -m unittest sync.tests.test_sync_urls`
  - 全量关联回归：`python -m unittest sync.tests.test_sync_views sync.tests.test_sync_service_v2 sync.tests.test_sync_urls`
- 兼容性与注意事项
  - 本轮仅增强测试覆盖与文档，不修改生产路由、service 协议与业务行为。

### 2026-03 Sync 路由与接口契约一致性回归补强

- 变更内容
  - 新增 `backend/sync/tests/test_sync_urls.py`，补充 Sync 路由契约测试。
  - 校验 `backend/sync/urls.py` 中 5 个子路由端点与视图映射：`data/`、`key-data/`、`notes/`、`reminders/`、`settings/`。
  - 校验 `backend/backend/urls.py` 已挂载 `include('sync.urls')`，确保 `/api/v1/sync/*` 主路由可达。
- 变更原因
  - 现有文档已声明 Sync 对外端点，但此前缺少专门的路由契约自动化回归，无法及时发现路由回退或映射错误。
- 影响范围
  - 代码：`backend/sync/tests/test_sync_urls.py`
  - 回归流程：`/api/v1/sync/*` 路由存在性与挂载一致性检查
- 使用方式
  - 在 `backend` 目录执行：`python -m unittest sync.tests.test_sync_urls`
  - 或执行联合回归：`python -m unittest sync.tests.test_sync_views sync.tests.test_sync_service_v2 sync.tests.test_sync_urls`
- 兼容性与注意事项
  - 本轮仅新增测试与文档记录，不修改 service 协议、业务语义与现有接口行为。

### 2026-03 同步视图错误响应关键流程回归补强

- 变更内容
  - 扩展 `backend/sync/tests/test_sync_views.py`：新增 `SyncDataView.get` 异常分支用例。
  - 用例通过 mock `SyncService.pull_notes` 抛异常，验证 `500` 响应同时包含 `error` 与 `errors` 字段。
- 变更原因
  - 在上一轮完成结构统一后，补充聚合入口 `SyncDataView.get` 的关键流程回归，防止后续修改导致错误响应结构回退。
- 影响范围
  - 代码：`backend/sync/tests/test_sync_views.py`
  - 回归流程：`/api/v1/sync/data/` GET 异常路径（视图层）
- 使用方式
  - 在 `backend` 目录执行：`python -m unittest sync.tests.test_sync_views sync.tests.test_sync_service_v2`
- 兼容性与注意事项
  - 仅新增测试，不改变生产逻辑、错误码语义与 service 层协议。

### 2026-03 同步视图错误响应结构一致性优化

- 变更内容
  - 在 `backend/sync/views.py` 新增 `_build_error_response(code, message)` 统一错误响应构造。
  - 将视图层错误分支统一为同时返回 `error`（对象）与 `errors`（单元素数组）字段。
  - 覆盖场景包含：`SYNC_400_INVALID_LIMIT`（GET limit 校验失败）与 `SYNC_500_INTERNAL_SERVER_ERROR`（异常分支）。
  - 扩展 `backend/sync/tests/test_sync_views.py`，新增 2 个用例验证 400/500 响应结构均包含 `error` 与 `errors`。
- 变更原因
  - 当前视图层存在 `error` 与 `errors` 混用，客户端处理成本高，且与聚合成功响应中的 `errors` 字段风格不一致。
- 影响范围
  - 代码：`backend/sync/views.py`、`backend/sync/tests/test_sync_views.py`
  - 接口：`/api/v1/sync/data/`、`/api/v1/sync/notes/`、`/api/v1/sync/reminders/`、`/api/v1/sync/key-data/`、`/api/v1/sync/settings/`（错误分支）
- 使用方式
  - 客户端可继续读取原有 `error` 字段；若采用统一列表处理，也可读取 `errors` 字段。
- 兼容性与注意事项
  - 保持原有 HTTP 状态码与错误码不变，仅补充兼容字段，不破坏既有调用方。

### 2026-03 同步视图层 limit 参数测试补强

- 变更内容
  - 新增测试文件：`backend/sync/tests/test_sync_views.py`。
  - 增加 `_parse_limit_param` 的 5 个单元测试：默认值、合法整数、非法字符串、下限越界、上限越界。
  - 测试中补充最小 Django/DRF 配置初始化，确保可独立执行视图层辅助函数测试。
- 变更原因
  - 上一轮已在 `views.py` 引入 `limit` 参数校验逻辑，需要补齐对应测试覆盖，避免后续回归。
- 影响范围
  - 代码：`backend/sync/tests/test_sync_views.py`
  - 测试命令：`python -m unittest sync.tests.test_sync_views`
- 使用方式
  - 在 `backend` 目录执行上述命令即可运行视图层 limit 参数测试。
- 兼容性与注意事项
  - 本次仅新增测试，不改变生产业务逻辑与接口行为。

### 2026-03 同步接口 limit 参数校验优化

- 变更内容
  - 在 `backend/sync/views.py` 新增 `_parse_limit_param` 统一参数解析逻辑。
  - 对以下 GET 接口的 `limit` 参数增加整数与范围校验（1~500）：
    - `SyncDataView.get`
    - `SyncNotesView.get`
    - `SyncRemindersView.get`
  - 当 `limit` 非法时返回 `400 Bad Request`，错误码 `SYNC_400_INVALID_LIMIT`。
- 变更原因
  - 旧实现直接 `int(request.query_params.get('limit', 100))`，当传入非法字符串时会抛异常并落入 500 分支。
  - 该类请求属于客户端参数错误，应明确返回 400，避免误判为服务端故障。
- 影响范围
  - 代码：`backend/sync/views.py`
  - 接口：`/api/v1/sync/data/`、`/api/v1/sync/notes/`、`/api/v1/sync/reminders/`（GET）
- 使用方式
  - 客户端继续使用 `limit` 查询参数；需传入 1~500 的整数。
- 兼容性与注意事项
  - 默认 `limit=100` 保持不变。
  - 返回结构保持一致，仅新增非法参数时的标准化 400 响应。

### 2026-03 同步模块路由与提醒增量拉取修复

- 变更内容
  - 在主路由中补充 `sync` 模块注册，确保 `/api/v1/sync/` 及其子端点可访问。
  - 修复 `pull_reminders` 中提醒实例关联查询的 ID 类型问题：先保留 `ObjectId` 列表用于查询，再对返回结果进行字符串序列化。
- 变更原因
  - 文档声明已存在同步端点，但主路由未包含 `sync.urls` 时会导致端点不可用。
  - 旧实现先把提醒 `_id` 转为字符串，再用于 `original_reminder_id` 的 `$in` 查询，可能导致查不到实例数据。
- 影响范围
  - 代码：`backend/backend/urls.py`、`backend/sync/services/sync_service.py`
  - 接口：`/api/v1/sync/*`
- 使用方式
  - 无新增参数；客户端调用方式不变。
- 兼容性与注意事项
  - 返回结构保持不变（`items`、`instances`、`next_cursor`）。
  - 仅修复实例数据关联准确性，不改变既有游标协议。

## API端点

### 1. 关键数据同步

```
POST /api/v1/sync/key-data/
```

**请求体格式**:
```json
{
  "user": {
    "username": "用户名",
    "email": "邮箱",
    "profile": { ... }
  },
  "settings": {
    "theme": "light",
    "fontSize": "medium",
    ...
  },
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

**响应格式**:
```json
{
  "success": true,
  "results": {
    "settings": {
      "success": true,
      "status": "updated",
      "timestamp": "2023-01-01T00:00:00.000Z"
    },
    "user": {
      "success": true,
      "status": "updated",
      "timestamp": "2023-01-01T00:00:00.000Z"
    }
  },
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

### 2. 笔记同步

```
POST /api/v1/sync/notes/
```

**请求体格式**:
```json
{
  "notes": [
    {
      "_id": "笔记ID",
      "title": "标题",
      "content": "内容",
      "tags": ["标签1", "标签2"],
      "created_at": "2023-01-01T00:00:00.000Z",
      "updated_at": "2023-01-01T00:00:00.000Z",
      "_operation": "create|update|delete"
    },
    ...
  ],
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

**响应格式**:
```json
{
  "success": true,
  "results": {
    "created": 1,
    "updated": 2,
    "deleted": 0,
    "failed": 0
  },
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

### 3. 提醒同步

```
POST /api/v1/sync/reminders/
```

**请求体格式**:
```json
{
  "reminders": [
    {
      "_id": "提醒ID",
      "title": "标题",
      "description": "描述",
      "due_date": "2023-01-01T00:00:00.000Z",
      "is_completed": false,
      "created_at": "2023-01-01T00:00:00.000Z",
      "updated_at": "2023-01-01T00:00:00.000Z",
      "_operation": "create|update|delete"
    },
    ...
  ],
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

**响应格式**:
```json
{
  "success": true,
  "results": {
    "created": 1,
    "updated": 2,
    "deleted": 0,
    "failed": 0
  },
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

### 4. 设置同步

```
POST /api/v1/sync/settings/
```

**请求体格式**:
```json
{
  "settings": {
    "theme": "light",
    "fontSize": "medium",
    "notificationEnabled": true,
    ...
  },
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

**响应格式**:
```json
{
  "success": true,
  "results": {
    "updated": true
  },
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

## 服务组件

### MongoDB服务 (mongodb_service.py)

MongoDB服务负责与MongoDB Atlas云数据库的连接和基本操作。主要功能包括：

1. 初始化数据库连接
2. 创建必要的索引
3. 提供数据库操作接口

### 同步服务 (sync_service.py)

同步服务实现了核心的同步业务逻辑，包括：

1. 关键数据同步
2. 笔记同步
3. 提醒同步
4. 设置同步
5. 冲突解决

## 配置说明

### 环境变量

- `MONGO_URI`: MongoDB Atlas连接URI
- `MONGO_DB_NAME`: 数据库名称

### 安全注意事项

- MongoDB Atlas连接URI包含敏感信息，应通过环境变量或安全的配置管理系统提供
- 所有API端点都需要JWT认证
- 数据同步操作应验证用户身份和权限

## 错误处理

同步服务实现了全面的错误处理机制：

1. 连接错误：当无法连接到MongoDB Atlas时的处理
2. 同步错误：当同步操作失败时的处理
3. 冲突错误：当发生数据冲突时的处理

## 性能优化

为提高同步性能，采取了以下措施：

1. 批量处理：同一类型的数据批量同步
2. 增量同步：只同步变更的数据
3. 索引优化：为常用查询创建索引
4. 连接池：使用MongoDB连接池

## 测试

当前仓库内已落地的同步模块测试文件如下：

1. `backend/sync/tests/test_sync_views.py`
   - 覆盖视图层参数校验与错误响应结构（含 `error` + `errors` 一致性断言）。
2. `backend/sync/tests/test_sync_urls.py`
   - 覆盖 Sync 子路由映射、主路由挂载与 `/api/v1/sync/*` 前缀契约。
3. `backend/sync/tests/test_sync_service_v2.py`
   - 覆盖核心同步服务流程回归（notes/reminders/settings 等关键路径）。
4. `backend/sync/tests/test_sync_service.py`
   - 覆盖同步服务基础行为与兼容路径。
5. `backend/sync/tests/test_mongodb_service.py`
   - 覆盖 MongoDB 服务连接与数据访问相关行为。

建议执行命令：

- 路由契约回归：`python -m unittest sync.tests.test_sync_urls`
- 视图 + 服务 + 路由联合回归：`python -m unittest sync.tests.test_sync_views sync.tests.test_sync_service_v2 sync.tests.test_sync_urls`

## 部署

同步模块作为Django应用的一部分进行部署。部署时需要注意：

1. 设置正确的环境变量
2. 确保MongoDB Atlas连接可用
3. 配置适当的日志级别

## 监控

建议对同步模块进行监控，关注以下指标：

1. 同步成功率
2. 同步延迟
3. 数据冲突率
4. MongoDB连接状态
