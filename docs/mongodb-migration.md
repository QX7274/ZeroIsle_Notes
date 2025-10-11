# MongoDB 迁移指南

本文档描述了从 SQLite 迁移到 MongoDB 的过程和架构设计。

## 架构概述

### 数据存储层

- **MongoDB Atlas**: 云端数据库服务，用于存储所有应用数据
- **Realm**: 本地数据库，用于离线存储和同步

### 模型层

- **模式定义 (Schema)**: 定义数据结构和验证规则
- **模型类 (Model)**: 提供数据操作方法

### 适配器层

- **适配器 (Adapter)**: 在前端和后端模型之间进行转换
- **同步服务 (Sync Service)**: 处理数据同步和冲突解决

### API 服务层

- **API 客户端**: 处理网络请求和响应
- **API 服务**: 提供业务逻辑和数据访问接口

## 文件结构

```
src/
├── models/                 # 数据模型定义
│   ├── Note.js             # 笔记模式定义
│   ├── NoteModel.js        # 笔记模型类
│   ├── Category.js         # 分类模式定义
│   ├── CategoryModel.js    # 分类模型类
│   ├── ...
│   └── index.js            # 模型导出
├── adapters/               # 适配器
│   ├── noteAdapter.js      # 笔记适配器
│   ├── categoryAdapter.js  # 分类适配器
│   ├── ...
│   └── index.js            # 适配器导出
├── services/               # 服务
│   ├── api/                # API 服务
│   │   ├── apiClient.js    # API 客户端
│   │   ├── noteApi.js      # 笔记 API
│   │   ├── ...
│   │   └── index.js        # API 服务导出
│   ├── database/           # 数据库服务
│   │   ├── mongoDBService.js  # MongoDB 服务
│   │   ├── realmService.js    # Realm 服务
│   │   └── ...
│   ├── offline/            # 离线服务
│   │   ├── offlineSyncService.js  # 离线同步服务
│   │   └── ...
│   ├── network/            # 网络服务
│   │   ├── networkService.js  # 网络状态服务
│   │   └── ...
│   └── utils/              # 工具服务
│       ├── logService.js   # 日志服务
│       ├── eventEmitter.js # 事件发射器
│       └── ...
└── config/                 # 配置
    ├── mongodb.js          # MongoDB 配置
    └── ...
```

## 数据模型

### 笔记 (Note)

```javascript
{
  _id: String,              // 唯一标识符
  title: String,            // 标题
  content: String,          // 内容
  category_id: String,      // 分类ID
  tags: Array,              // 标签数组
  is_deleted: Boolean,      // 是否已删除
  is_synced: Boolean,       // 是否已同步
  user_id: String,          // 用户ID
  created_at: Date,         // 创建时间
  updated_at: Date,         // 更新时间
  deleted_at: Date,         // 删除时间
  metadata: Object          // 元数据
}
```

### 分类 (Category)

```javascript
{
  _id: String,              // 唯一标识符
  name: String,             // 名称
  description: String,      // 描述
  color: String,            // 颜色
  icon: String,             // 图标
  parent_id: String,        // 父分类ID
  order: Number,            // 排序
  is_default: Boolean,      // 是否默认
  is_favorite: Boolean,     // 是否收藏
  is_archived: Boolean,     // 是否归档
  is_deleted: Boolean,      // 是否已删除
  is_synced: Boolean,       // 是否已同步
  user_id: String,          // 用户ID
  created_at: Date,         // 创建时间
  updated_at: Date,         // 更新时间
  deleted_at: Date,         // 删除时间
  metadata: Object          // 元数据
}
```

### 标签 (Tag)

```javascript
{
  _id: String,              // 唯一标识符
  name: String,             // 名称
  color: String,            // 颜色
  count: Number,            // 使用次数
  is_deleted: Boolean,      // 是否已删除
  is_synced: Boolean,       // 是否已同步
  user_id: String,          // 用户ID
  created_at: Date,         // 创建时间
  updated_at: Date,         // 更新时间
  deleted_at: Date          // 删除时间
}
```

### 离线队列 (OfflineQueue)

```javascript
{
  _id: String,              // 唯一标识符
  entity_id: String,        // 实体ID
  entity_type: String,      // 实体类型
  operation: String,        // 操作类型
  data: Object,             // 操作数据
  user_id: String,          // 用户ID
  status: String,           // 状态
  retry_count: Number,      // 重试次数
  error: String,            // 错误信息
  created_at: Date,         // 创建时间
  updated_at: Date,         // 更新时间
  synced_at: Date           // 同步时间
}
```

## 适配器模式

适配器模式用于在前端和后端模型之间进行转换，主要解决以下问题：

1. **命名风格转换**: 将后端的下划线命名转换为前端的驼峰命名
2. **数据格式转换**: 将后端的日期字符串转换为前端的 Date 对象
3. **数据验证**: 在数据进入数据库前进行验证
4. **错误处理**: 统一处理数据操作中的错误

适配器提供以下方法：

- `toFrontendX`: 将后端模型转换为前端对象
- `toBackendX`: 将前端对象转换为后端模型
- `createX`: 创建数据
- `updateX`: 更新数据
- `deleteX`: 删除数据
- `getX`: 获取数据

## 离线同步

离线同步服务用于处理数据同步和冲突解决，主要功能包括：

1. **离线操作队列**: 将离线操作保存到队列中
2. **自动同步**: 当网络恢复时自动同步数据
3. **冲突解决**: 处理同步冲突
4. **重试机制**: 处理同步失败的情况

离线同步服务提供以下方法：

- `addToSyncQueue`: 添加到同步队列
- `syncQueue`: 同步队列
- `getQueue`: 获取同步队列
- `clearQueue`: 清空同步队列

### 自定义同步实现

本项目使用自定义的同步实现，而不是使用 MongoDB Realm 的自动同步功能。这种方式有以下优势：

1. **更灵活的控制**: 完全控制同步的逻辑和行为，根据应用的具体需求定制同步策略。
2. **减少依赖**: 不依赖于 Realm 的特定功能，降低了对第三方服务的依赖性。
3. **成本控制**: 避免了 MongoDB Realm 的某些高级功能可能需要的额外付费。
4. **与现有系统集成**: 更容易与现有的后端系统和业务逻辑集成。

自定义同步实现包括以下组件：

1. **离线队列**: 使用 `OfflineQueue` 存储离线操作，包括实体ID、操作类型、数据等信息。
2. **网络监听**: 使用 `networkService` 监听网络状态变化，当网络恢复时触发同步。
3. **同步服务**: 使用 `offlineSyncService` 处理同步逻辑，包括添加到队列、同步队列、处理冲突等。
4. **API服务**: 使用 `apiClient` 处理与服务器的通信，包括发送请求、处理响应等。

## API 服务

API 服务用于处理网络请求和响应，主要功能包括：

1. **网络请求**: 发送 HTTP 请求
2. **响应处理**: 处理 HTTP 响应
3. **错误处理**: 处理网络错误
4. **认证**: 处理用户认证

API 服务提供以下方法：

- `get`: 发送 GET 请求
- `post`: 发送 POST 请求
- `put`: 发送 PUT 请求
- `delete`: 发送 DELETE 请求

## 迁移步骤

1. **安装依赖**: 安装 MongoDB 和 Realm 相关依赖
2. **创建模型**: 创建 MongoDB 模型
3. **创建适配器**: 创建适配器
4. **创建服务**: 创建 API 服务和同步服务
5. **更新 Redux**: 更新 Redux 切片
6. **数据迁移**: 将 SQLite 数据迁移到 MongoDB
7. **测试**: 测试迁移结果

## 注意事项

1. **数据一致性**: 确保数据在本地和云端保持一致
2. **性能优化**: 优化数据查询和同步性能
3. **错误处理**: 处理各种错误情况
4. **用户体验**: 确保用户在离线和在线状态下都有良好的体验
5. **安全性**: 确保数据安全和用户隐私
