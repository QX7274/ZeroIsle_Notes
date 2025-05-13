# 离线服务

本目录包含零屿笔记应用的离线相关服务，用于提供离线模式下的功能支持和数据管理。项目已完全迁移到 MongoDB，不再使用 SQLite 或 AsyncStorage。

## 文件结构

- **infiniteCanvasStorage.js**: 无限画布存储服务，提供基于 MongoDB 的无限画布数据存储和同步功能
- **offlineStorage.js**: 离线存储服务，提供基于 MongoDB 的通用离线数据存储和同步功能
- **offlineAIService.js**: 离线AI服务，提供离线模式下的AI功能

## MongoDB 配置

项目使用 MongoDB Atlas 作为云数据库服务：

- **连接 URL**: `mongodb+srv://qianxin7274:<password>@cluster0.lo5ybvq.mongodb.net/`
- **数据库名**: `ZeroIsle_Notes`
- **集合名**:
  - `infinite_canvas`: 存储无限画布数据
  - `notes`: 存储笔记数据
  - `categories`: 存储分类数据
  - `tags`: 存储标签数据
  - `reminders`: 存储提醒数据
  - `settings`: 存储设置数据
  - `files`: 存储文件数据

## 主要功能

### 离线AI服务 (offlineAIService.js)

离线AI服务提供以下主要功能：

- **离线文本分析**: 在离线状态下分析文本内容
- **离线标签生成**: 在离线状态下生成标签建议
- **离线内容摘要**: 在离线状态下生成内容摘要
- **离线语言检测**: 在离线状态下检测文本语言
- **离线模型管理**: 管理离线AI模型的下载和更新
- **模型优化**: 优化模型大小和性能，适应移动设备

### 离线存储服务 (offlineStorage.js)

离线存储服务提供以下主要功能：

- **离线数据存储**: 使用MongoDB Atlas存储应用数据，支持离线访问
- **存储管理**: 管理离线存储空间和数据清理
- **数据同步**: 在网络恢复时自动同步数据到MongoDB
- **离线笔记**: 在离线状态下创建和编辑笔记
- **离线分类**: 在离线状态下创建和编辑分类
- **离线标签**: 在离线状态下创建和编辑标签
- **离线提醒**: 在离线状态下创建和编辑提醒

### 无限画布存储服务 (infiniteCanvasStorage.js)

无限画布存储服务提供以下主要功能：

- **画布数据存储**: 使用MongoDB Atlas存储无限画布数据
- **离线访问**: 支持在离线状态下访问和编辑画布
- **数据同步**: 在网络恢复时自动同步画布数据到MongoDB
- **画布管理**: 创建、获取、更新和删除画布
- **图层管理**: 管理画布中的图层
- **元素管理**: 管理画布中的元素

### 离线同步服务 (offlineSyncService.js)

离线同步服务提供以下主要功能：

- **数据同步**: 在网络恢复时同步离线数据
- **冲突解决**: 处理离线编辑与服务器数据的冲突
- **同步队列**: 管理待同步的操作队列
- **重试机制**: 处理同步失败的情况
- **增量同步**: 只同步变更的数据，减少数据传输
- **批量同步**: 批量处理同步操作，提高效率
- **同步状态**: 提供同步状态的监控和通知

## 离线AI模型

离线AI服务使用以下类型的模型：

- **轻量级NLP模型**: 用于文本分析和处理
- **小型分类模型**: 用于内容分类和标签生成
- **压缩摘要模型**: 用于生成内容摘要
- **语言检测模型**: 用于检测文本语言

## 离线存储策略

离线存储服务使用以下存储策略：

- **必要数据优先**: 优先存储用户必需的数据
- **最近访问优先**: 优先存储最近访问的数据
- **用户指定优先**: 允许用户指定需要离线存储的数据
- **增量同步**: 只同步变更的数据，减少数据传输
- **智能预取**: 预测并预先下载用户可能需要的数据

## 与其他服务的交互

离线服务与以下服务有交互：

- **网络服务**: 检测网络状态，决定是否启用离线模式
- **同步服务**: 在网络恢复时同步离线数据
- **AI服务**: 在在线状态下使用更强大的AI功能
- **数据库服务**: 管理本地数据库和离线数据

## 使用方法

### 无限画布存储服务

```javascript
import infiniteCanvasStorage from '../../services/offline/infiniteCanvasStorage';

// 初始化无限画布存储服务
async function initializeCanvasStorage() {
  try {
    await infiniteCanvasStorage.initialize();
    console.log('无限画布存储服务初始化成功');
    return true;
  } catch (error) {
    console.error('无限画布存储服务初始化失败:', error);
    return false;
  }
}

// 获取所有画布
async function getAllCanvases() {
  try {
    const canvases = await infiniteCanvasStorage.getCanvases();
    console.log(`获取到 ${canvases.length} 个画布`);
    return canvases;
  } catch (error) {
    console.error('获取画布失败:', error);
    return [];
  }
}

// 获取特定画布
async function getCanvas(canvasId) {
  try {
    const canvas = await infiniteCanvasStorage.getCanvas(canvasId);
    console.log('获取画布成功:', canvas.title);
    return canvas;
  } catch (error) {
    console.error('获取画布失败:', error);
    return null;
  }
}

// 保存画布
async function saveCanvas(canvas) {
  try {
    const success = await infiniteCanvasStorage.saveCanvas(canvas);
    console.log('保存画布' + (success ? '成功' : '失败'));
    return success;
  } catch (error) {
    console.error('保存画布失败:', error);
    return false;
  }
}

// 删除画布
async function deleteCanvas(canvasId) {
  try {
    const success = await infiniteCanvasStorage.deleteCanvas(canvasId);
    console.log('删除画布' + (success ? '成功' : '失败'));
    return success;
  } catch (error) {
    console.error('删除画布失败:', error);
    return false;
  }
}
```

### 离线存储服务

```javascript
import { offlineStorageService } from '../../services/offline/offlineStorage';

// 初始化离线存储服务
async function initializeOfflineStorage() {
  try {
    await offlineStorageService.init();
    console.log('离线存储服务初始化成功');
    return true;
  } catch (error) {
    console.error('离线存储服务初始化失败:', error);
    return false;
  }
}

// 获取画布（兼容无限画布存储）
async function getCanvas(canvasId) {
  try {
    const canvas = await offlineStorageService.getCanvas(canvasId);
    console.log('获取画布成功:', canvas.title);
    return canvas;
  } catch (error) {
    console.error('获取画布失败:', error);
    return null;
  }
}

// 获取所有画布
async function getAllCanvases() {
  try {
    const canvases = await offlineStorageService.getCanvases();
    console.log(`获取到 ${canvases.length} 个画布`);
    return canvases;
  } catch (error) {
    console.error('获取画布失败:', error);
    return [];
  }
}
```

### 离线AI服务

```javascript
import { offlineAIService } from '../../services/offline';

// 初始化离线AI服务
async function initializeOfflineAI() {
  try {
    await offlineAIService.initialize();
    console.log('离线AI服务初始化成功');
    return true;
  } catch (error) {
    console.error('离线AI服务初始化失败:', error);
    return false;
  }
}

// 下载离线AI模型
async function downloadOfflineModels() {
  try {
    const progress = await offlineAIService.downloadModels({
      onProgress: (progress) => {
        console.log('模型下载进度:', progress);
      }
    });

    console.log('离线AI模型下载成功');
    return true;
  } catch (error) {
    console.error('离线AI模型下载失败:', error);
    return false;
  }
}

// 离线分析文本
async function analyzeTextOffline(text) {
  try {
    const analysis = await offlineAIService.analyzeText(text);
    console.log('离线文本分析结果:', analysis);
    return analysis;
  } catch (error) {
    console.error('离线文本分析失败:', error);
    return null;
  }
}
```

## 注意事项

### MongoDB 迁移相关

- 项目已完全迁移到 MongoDB Atlas，不再使用 SQLite 或 AsyncStorage
- MongoDB Atlas 是云数据库服务，需要网络连接才能直接访问
- 离线功能通过在本地缓存数据并在网络恢复时同步到 MongoDB 实现
- 所有数据库操作都是异步的，使用 `async/await` 处理
- 数据同步在后台进行，不阻塞用户界面

### 离线功能相关

- 离线AI模型可能较大，应在WiFi环境下下载，并提供下载进度反馈
- 离线AI功能可能不如在线AI功能强大，应设置适当的用户期望
- 处理离线编辑与服务器数据的冲突，提供冲突解决机制
- 考虑电池消耗，离线AI功能应优化性能和能耗
- 提供离线模式的视觉指示，让用户了解当前状态
- 添加适当的错误处理，确保应用在数据库操作失败时能够正常运行
- 使用事件机制通知其他组件状态变化
- 支持离线操作，确保用户在离线状态下也能操作数据
- 提供同步状态的反馈，让用户了解同步进度
- 处理同步失败的情况，提供重试机制
- 考虑网络连接不稳定的情况，确保数据不会丢失
