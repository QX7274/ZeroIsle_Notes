# 应用服务

本目录包含零屿笔记应用的应用服务，负责应用的初始化和全局状态管理。

## 文件结构

- **initService.js**: 应用初始化服务，负责初始化应用所需的各种服务和数据
- **index.js**: 应用服务索引，导出所有应用相关服务

## 主要功能

### 应用初始化服务 (initService.js)

应用初始化服务提供以下主要功能：

- **服务初始化**: 初始化应用所需的各种服务，包括数据库服务、存储服务、笔记服务等
- **初始化顺序管理**: 确保服务按照正确的顺序初始化，处理依赖关系
- **初始化状态管理**: 跟踪各个服务的初始化状态，提供初始化进度和结果
- **错误处理**: 处理初始化过程中的错误，确保应用能够在部分服务初始化失败的情况下继续运行

- **初始化事件**: 发送初始化相关的事件，允许其他组件监听初始化进度和结果

## 初始化流程

应用初始化服务按照以下顺序初始化各个服务：

1. **Realm数据库服务**: 初始化Realm数据库，创建必要的数据模型和表
2. **存储服务**: 初始化存储服务，提供本地存储功能
3. **笔记服务**: 初始化笔记服务，提供笔记相关的CRUD操作
4. **分类服务**: 初始化分类服务，提供分类相关的CRUD操作
5. **离线服务**: 初始化离线服务，提供离线数据存储和同步功能
6. **文件服务**: 初始化文件服务，提供文件相关的CRUD操作


## 初始化事件

应用初始化服务发送以下事件：

- **INIT_EVENTS.STARTED**: 初始化开始
- **INIT_EVENTS.PROGRESS**: 初始化进度更新，包含当前初始化的服务和进度
- **INIT_EVENTS.COMPLETED**: 初始化完成，包含初始化结果
- **INIT_EVENTS.FAILED**: 初始化失败，包含错误信息

## 使用方法

### 初始化应用

```javascript
import { initService } from '../../services/app';

// 在应用启动时初始化
async function initializeApp() {
  try {
    await initService.init();
    console.log('应用初始化成功');
    return true;
  } catch (error) {
    console.error('应用初始化失败:', error);
    return false;
  }
}
```

### 监听初始化事件

```javascript
import { INIT_EVENTS } from '../../services/app';
import EventEmitter from '../../utils/eventEmitter';

// 监听初始化开始事件
EventEmitter.addListener(INIT_EVENTS.STARTED, () => {
  console.log('应用初始化开始');
});

// 监听初始化进度事件
EventEmitter.addListener(INIT_EVENTS.PROGRESS, (data) => {
  console.log(`初始化进度: ${data.progress}%, 当前服务: ${data.service}`);
});

// 监听初始化完成事件
EventEmitter.addListener(INIT_EVENTS.COMPLETED, (data) => {
  console.log('应用初始化完成', data);
});

// 监听初始化失败事件
EventEmitter.addListener(INIT_EVENTS.FAILED, (data) => {
  console.error('应用初始化失败:', data.error);
});
```

### 获取初始化状态

```javascript
import { initService } from '../../services/app';

// 获取初始化状态
const initStatus = initService.getInitStatus();
console.log('初始化状态:', initStatus);
```


```

## 注意事项

1. **初始化顺序**: 确保服务按照正确的顺序初始化，处理依赖关系
2. **错误处理**: 处理初始化过程中的错误，确保应用能够在部分服务初始化失败的情况下继续运行
3. **超时处理**: 添加初始化超时处理，避免初始化过程卡住
4. **降级模式**: 在部分服务初始化失败的情况下，提供降级模式，确保应用的基本功能可用
5. **初始化事件**: 使用事件机制通知其他组件初始化进度和结果
