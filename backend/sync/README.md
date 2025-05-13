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

同步模块包含以下测试：

1. 单元测试：测试各个服务组件的功能
2. 集成测试：测试API端点的功能
3. 性能测试：测试同步操作的性能

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
