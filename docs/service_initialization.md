# 零屿笔记服务初始化指南

## 概述

零屿笔记应用采用模块化的服务架构，每个服务负责特定的功能领域。为了确保应用正常运行，所有服务必须按照正确的顺序初始化，并处理可能的初始化失败情况。本文档提供了服务初始化的详细说明和最佳实践。

## 服务初始化顺序

服务初始化应遵循以下顺序，以确保依赖关系得到满足：

1. **基础服务**：不依赖其他服务的基础服务
   - `logService`：日志服务
   - `configService`：配置服务
   - `networkService`：网络服务

2. **存储服务**：依赖基础服务的存储相关服务
   - `realmStorageService`：Realm本地存储服务
   - `apiCacheService`：API缓存服务
   - `authStorageService`：认证存储服务

3. **功能服务**：依赖存储服务的功能服务
   - `authService`：认证服务
   - `noteService`：笔记服务
   - `reminderService`：提醒服务
   - `syncService`：同步服务
   - `aiService`：AI助手服务
   - 其他功能服务

## 服务初始化模式

每个服务应实现以下初始化模式：

```javascript
class ExampleService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
  }

  async initialize() {
    // 如果已初始化，直接返回
    if (this.initialized) return Promise.resolve();

    // 如果正在初始化，返回初始化Promise
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // 创建初始化Promise
    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 初始化依赖服务
        await dependencyService.initialize();

        // 执行初始化逻辑
        // ...

        // 标记为已初始化
        this.initialized = true;
        logService.info('服务初始化成功');
        resolve();
      } catch (error) {
        logService.error('服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }
}
```

## 服务依赖关系

以下是主要服务的依赖关系图：

```
logService       <-- 无依赖
configService    <-- 无依赖
networkService   <-- 无依赖
                     |
                     v
realmStorageService <-- logService
                     |
                     v
apiCacheService   <-- realmStorageService, logService
authStorageService <-- realmStorageService, logService
                     |
                     v
authService       <-- authStorageService, logService
noteService       <-- realmStorageService, logService
reminderService   <-- realmStorageService, logService
syncService       <-- realmStorageService, networkService, logService
```

## 初始化失败处理

服务初始化失败时，应采取以下策略：

1. **记录错误**：使用`console.error`记录错误，即使`logService`未初始化
2. **提供回退方案**：如果可能，提供简单的回退实现
3. **通知用户**：显示初始化失败的提示，并提供重试选项
4. **防止级联失败**：依赖失败服务的其他服务应优雅地处理依赖失败

## 服务初始化状态界面

应用启动时会显示服务初始化状态界面，展示各个服务的初始化状态：

- 绿色：初始化成功
- 红色：初始化失败
- 黄色：正在初始化

用户可以选择：
- **继续使用**：即使某些非关键服务初始化失败，也继续使用应用
- **重试**：重新尝试初始化失败的服务
- **退出**：退出应用

## 关键服务

以下服务被视为关键服务，必须成功初始化才能继续使用应用：

- `logService`：日志服务
- `realmStorageService`：Realm本地存储服务
- `authStorageService`：认证存储服务

其他服务初始化失败时，应用可以继续运行，但某些功能可能不可用。

## 初始化超时

为防止初始化过程无限等待，每个服务的初始化应设置超时时间：

```javascript
async initialize(timeout = 10000) {
  // 创建超时Promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('初始化超时')), timeout);
  });

  // 竞争初始化Promise和超时Promise
  return Promise.race([this.doInitialize(), timeoutPromise]);
}
```

## 初始化重试

对于初始化失败的服务，应提供重试机制：

```javascript
async retryInitialization() {
  // 重置初始化状态
  this.initialized = false;
  this.initializationPromise = null;
  
  // 重新初始化
  return this.initialize();
}
```

## 最佳实践

1. **懒加载**：服务应在首次使用时初始化，而不是在应用启动时全部初始化
2. **并行初始化**：不相互依赖的服务可以并行初始化，提高启动速度
3. **初始化状态持久化**：记录服务初始化状态，避免重复初始化
4. **初始化进度反馈**：提供初始化进度反馈，提升用户体验
5. **初始化日志**：详细记录初始化过程，方便调试

## 服务初始化检查清单

添加新服务时，请确保：

- [ ] 实现`initialize`方法
- [ ] 处理初始化失败情况
- [ ] 记录初始化成功和失败日志
- [ ] 正确处理依赖服务
- [ ] 提供回退方案（如果可能）
- [ ] 添加到服务初始化状态界面

## 故障排除

### 常见问题

1. **"Property 'REALM_APP_ID' doesn't exist"**
   - 原因：`realmConfig.js`文件中的`REALM_APP_ID`未正确设置或导入
   - 解决方案：确保`src/config/realmConfig.js`文件存在并正确导出`REALM_APP_ID`，或设置`USE_LOCAL_STORAGE`为`true`

2. **"Cannot read property 'initialize' of undefined"**
   - 原因：服务未正确导入或创建
   - 解决方案：检查服务导入和创建代码

3. **"初始化超时"**
   - 原因：服务初始化过程耗时过长
   - 解决方案：检查网络连接，增加超时时间，或优化初始化逻辑

4. **循环依赖**
   - 原因：服务之间存在循环依赖
   - 解决方案：重构服务，打破循环依赖
