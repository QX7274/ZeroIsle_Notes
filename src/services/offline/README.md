# 离线服务

本目录包含零屿笔记应用的离线相关服务，用于提供离线模式下的功能支持和数据管理。

## 文件结构

- **offlineAIService.js**: 离线AI服务，提供离线模式下的AI功能
- **offlineStorage.js**: 离线存储服务，提供离线数据存储功能

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

- **离线数据存储**: 存储应用数据，支持离线访问
- **数据同步**: 在网络恢复时同步离线数据
- **冲突解决**: 处理离线编辑与服务器数据的冲突
- **存储管理**: 管理离线存储空间和数据清理
- **数据优先级**: 设置数据的离线存储优先级
- **数据压缩**: 压缩离线数据，减少存储空间占用

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

```javascript
import { offlineAIService, offlineStorage } from '../../services/offline';

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

// 离线生成标签
async function generateTagsOffline(text) {
  try {
    const tags = await offlineAIService.generateTags(text);
    console.log('离线生成的标签:', tags);
    return tags;
  } catch (error) {
    console.error('离线标签生成失败:', error);
    return [];
  }
}

// 离线生成摘要
async function generateSummaryOffline(text, maxLength = 100) {
  try {
    const summary = await offlineAIService.generateSummary(text, maxLength);
    console.log('离线生成的摘要:', summary);
    return summary;
  } catch (error) {
    console.error('离线摘要生成失败:', error);
    return '';
  }
}

// 初始化离线存储
async function initializeOfflineStorage() {
  try {
    await offlineStorage.initialize();
    console.log('离线存储初始化成功');
    return true;
  } catch (error) {
    console.error('离线存储初始化失败:', error);
    return false;
  }
}

// 存储离线数据
async function storeOfflineData(key, data) {
  try {
    await offlineStorage.setItem(key, data);
    console.log('离线数据存储成功:', key);
    return true;
  } catch (error) {
    console.error('离线数据存储失败:', error);
    return false;
  }
}

// 获取离线数据
async function getOfflineData(key) {
  try {
    const data = await offlineStorage.getItem(key);
    console.log('获取离线数据成功:', key);
    return data;
  } catch (error) {
    console.error('获取离线数据失败:', error);
    return null;
  }
}

// 同步离线数据
async function syncOfflineData() {
  try {
    const result = await offlineStorage.syncData();
    console.log('离线数据同步成功:', result);
    return result;
  } catch (error) {
    console.error('离线数据同步失败:', error);
    return { success: false, error };
  }
}

// 设置离线模式
function setOfflineMode(enabled) {
  try {
    offlineStorage.setOfflineMode(enabled);
    console.log('离线模式已' + (enabled ? '启用' : '禁用'));
    return true;
  } catch (error) {
    console.error('设置离线模式失败:', error);
    return false;
  }
}

// 检查是否处于离线模式
function isOfflineMode() {
  return offlineStorage.isOfflineMode();
}

// 获取离线存储状态
async function getOfflineStorageStatus() {
  try {
    const status = await offlineStorage.getStatus();
    console.log('离线存储状态:', status);
    return status;
  } catch (error) {
    console.error('获取离线存储状态失败:', error);
    return null;
  }
}

// 清理离线存储
async function cleanOfflineStorage() {
  try {
    await offlineStorage.clean();
    console.log('离线存储清理成功');
    return true;
  } catch (error) {
    console.error('离线存储清理失败:', error);
    return false;
  }
}
```

## 注意事项

- 离线AI模型可能较大，应在WiFi环境下下载，并提供下载进度反馈
- 离线AI功能可能不如在线AI功能强大，应设置适当的用户期望
- 离线存储空间有限，应优先存储重要数据，并提供存储空间管理功能
- 处理离线编辑与服务器数据的冲突，提供冲突解决机制
- 考虑电池消耗，离线AI功能应优化性能和能耗
- 提供离线模式的视觉指示，让用户了解当前状态
