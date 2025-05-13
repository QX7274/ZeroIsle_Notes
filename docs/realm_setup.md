# MongoDB Realm 设置指南

## 概述

零屿笔记应用使用MongoDB Realm作为本地存储解决方案，并可以选择性地与MongoDB Atlas云数据库同步。本文档提供了设置和配置MongoDB Realm的详细说明。

## 存储模式

应用支持两种存储模式：

1. **本地存储模式**：数据仅存储在设备本地，不与云端同步
2. **云同步模式**：数据存储在本地，并与MongoDB Atlas云数据库同步

默认情况下，应用使用本地存储模式，这不需要MongoDB Atlas账户或Realm App ID。

## 配置文件

MongoDB Realm的配置在以下文件中定义：

- `src/config/realmConfig.js`：Realm应用ID和存储模式配置
- `src/config/mongodbConfig.js`：MongoDB Atlas连接信息
- `src/services/database/realmConfig.js`：Realm数据库配置和操作

## 本地存储模式

本地存储模式是默认设置，不需要MongoDB Atlas账户。在这种模式下：

1. 所有数据存储在设备本地的Realm数据库中
2. 不会尝试连接MongoDB Atlas
3. 同步功能仅在本地模拟，不实际执行

### 配置本地存储模式

在`src/config/realmConfig.js`中，确保以下设置：

```javascript
// Realm应用ID，需要从MongoDB Realm控制台获取
export const REALM_APP_ID = 'zeroislenotes-abcde'; // 可以是任何值

// 如果没有Realm App ID，使用本地存储模式
export const USE_LOCAL_STORAGE = true; // 设置为true启用本地存储模式
```

## 云同步模式

如果您希望启用与MongoDB Atlas的同步，需要完成以下步骤：

### 1. 创建MongoDB Atlas账户和集群

1. 访问[MongoDB Atlas](https://www.mongodb.com/cloud/atlas)并创建账户
2. 创建一个新集群（可以使用免费层级）
3. 设置数据库用户和网络访问权限

### 2. 创建Realm应用

1. 在MongoDB Atlas控制台中，选择"App Services"
2. 点击"Create a New App"
3. 选择您的集群作为数据源
4. 完成应用创建向导

### 3. 获取Realm App ID

1. 在Realm应用控制台中，找到"App ID"
2. 复制这个ID，它看起来类似于`zeroislenotes-abcde`

### 4. 配置应用

1. 打开`src/config/realmConfig.js`
2. 更新以下设置：

```javascript
// Realm应用ID，需要从MongoDB Realm控制台获取
export const REALM_APP_ID = '您的实际App ID'; // 替换为您的Realm App ID

// 如果没有Realm App ID，使用本地存储模式
export const USE_LOCAL_STORAGE = false; // 设置为false启用云同步模式
```

3. 打开`src/config/mongodbConfig.js`
4. 更新MongoDB Atlas连接信息：

```javascript
export const MONGODB_CONFIG = {
  // MongoDB Atlas连接URI
  URI: 'mongodb+srv://用户名:密码@集群地址.mongodb.net/',
  // 数据库名称
  DB_NAME: 'ZeroIsle_Notes',
  // 本地数据库名称
  LOCAL_DB_NAME: 'zeroislenotes_local',
  // 模式版本
  SCHEMA_VERSION: 1,
};
```

## 故障排除

### 常见错误

#### 1. "Property 'REALM_APP_ID' doesn't exist"

**原因**：`realmConfig.js`文件中的`REALM_APP_ID`未正确设置或导入。

**解决方案**：
- 确保`src/config/realmConfig.js`文件存在并正确导出`REALM_APP_ID`
- 确保`USE_LOCAL_STORAGE`设置为`true`
- 重新启动应用

#### 2. "Failed to connect to MongoDB Atlas"

**原因**：无法连接到MongoDB Atlas云数据库。

**解决方案**：
- 检查网络连接
- 验证MongoDB Atlas连接URI是否正确
- 确认MongoDB Atlas集群是否运行
- 检查网络访问设置是否允许应用连接

#### 3. "Realm schema version mismatch"

**原因**：本地Realm数据库架构版本与应用期望的版本不匹配。

**解决方案**：
- 增加`schemaVersion`值
- 实现适当的迁移函数
- 如果是开发环境，可以删除应用数据重新开始

## 数据模型

Realm数据模型定义在`src/services/database/realmModels.js`文件中。每个模型定义了一个Realm对象类型，包括：

- 属性和类型
- 主键
- 索引
- 默认值

如果需要修改数据模型，请确保：

1. 更新模型定义
2. 增加`schemaVersion`值
3. 实现适当的迁移函数

## 最佳实践

1. **开发阶段使用本地存储模式**：简化开发流程，不需要网络连接
2. **生产环境考虑云同步模式**：提供数据备份和跨设备同步
3. **敏感信息处理**：不要在代码中硬编码MongoDB Atlas凭据
4. **错误处理**：实现适当的错误处理和回退机制
5. **数据迁移**：在更新数据模型时，提供平滑的迁移路径
