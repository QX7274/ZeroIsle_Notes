# 网络服务

本目录包含零屿笔记应用的网络相关服务，用于管理网络状态、连接类型检测和网络请求管理。

## 文件结构

- **networkService.js**: 网络服务，提供网络状态监测和连接类型检测功能

## 主要功能

### 网络服务 (networkService.js)

网络服务提供以下主要功能：

- **网络状态监测**: 监测设备的网络连接状态（在线/离线）
- **连接类型检测**: 检测当前网络连接类型（WiFi、移动数据、以太网等）
- **网络质量评估**: 评估当前网络连接的质量和速度
- **网络变化监听**: 监听网络状态变化并通知应用
- **网络请求管理**: 根据网络状态管理网络请求
- **离线模式支持**: 在网络不可用时启用离线模式

## 网络状态

网络服务定义了以下网络状态：

- **CONNECTED**: 设备已连接到网络
- **DISCONNECTED**: 设备未连接到网络
- **CONNECTING**: 设备正在连接到网络
- **UNKNOWN**: 网络状态未知

## 连接类型

网络服务支持检测以下连接类型：

- **WIFI**: WiFi连接
- **CELLULAR**: 移动数据连接
- **ETHERNET**: 以太网连接
- **BLUETOOTH**: 蓝牙连接
- **VPN**: VPN连接
- **UNKNOWN**: 未知连接类型

## 网络质量

网络服务定义了以下网络质量级别：

- **EXCELLENT**: 优秀的网络质量，适合所有操作
- **GOOD**: 良好的网络质量，适合大多数操作
- **FAIR**: 一般的网络质量，可能影响某些操作
- **POOR**: 较差的网络质量，可能影响多数操作
- **UNUSABLE**: 无法使用的网络质量

## 网络事件

网络服务提供以下网络事件监听：

- **onConnected**: 当设备连接到网络时触发
- **onDisconnected**: 当设备断开网络连接时触发
- **onConnectionTypeChanged**: 当网络连接类型改变时触发
- **onQualityChanged**: 当网络质量改变时触发

## 与其他服务的交互

网络服务与以下服务有交互：

- **API服务**: 根据网络状态管理API请求
- **同步服务**: 根据网络状态控制数据同步
- **离线服务**: 在网络不可用时启用离线模式
- **通知服务**: 通知用户网络状态变化

## 使用方法

```javascript
import { networkService, NETWORK_EVENTS } from '../../services/network';

// 初始化网络服务
async function initializeNetwork() {
  try {
    await networkService.initialize();
    console.log('网络服务初始化成功');
    return true;
  } catch (error) {
    console.error('网络服务初始化失败:', error);
    return false;
  }
}

// 检查网络连接状态
function checkNetworkStatus() {
  const isOnline = networkService.isOnline();
  console.log('网络连接状态:', isOnline ? '已连接' : '未连接');
  return isOnline;
}

// 获取当前连接类型
function getConnectionType() {
  const connectionType = networkService.getConnectionType();
  console.log('当前连接类型:', connectionType);
  return connectionType;
}

// 获取当前连接质量
function getConnectionQuality() {
  const quality = networkService.getConnectionQuality();
  console.log('当前连接质量:', quality);
  return quality;
}

// 监听网络状态变化
function listenToNetworkChanges() {
  // 监听网络状态变化
  const removeChangeListener = networkService.addListener(NETWORK_EVENTS.NETWORK_CHANGE, (state) => {
    console.log('网络状态变化:', state);
  });

  // 监听网络连接
  const removeOnlineListener = networkService.addListener(NETWORK_EVENTS.ONLINE, () => {
    console.log('网络已连接');
    // 网络已连接，执行相应操作
    syncData();
  });

  // 监听网络断开
  const removeOfflineListener = networkService.addListener(NETWORK_EVENTS.OFFLINE, () => {
    console.log('网络已断开');
    // 网络已断开，启用离线模式
    enableOfflineMode();
  });

  // 返回取消监听的函数
  return () => {
    removeChangeListener();
    removeOnlineListener();
    removeOfflineListener();
  };
}

// 手动检查网络连接
async function checkConnection() {
  const isOnline = await networkService.checkConnection();
  console.log('网络连接状态:', isOnline ? '已连接' : '未连接');
  return isOnline;
}
```

## 注意事项

- 网络状态检测可能不是100%准确，应考虑网络请求的错误处理
- 不同平台（iOS/Android）的网络API可能有差异，需要适配
- 监听网络状态变化可能会消耗电量，应在不需要时移除监听
- 考虑用户的数据使用偏好，在移动数据连接时可能需要限制某些操作
- 提供网络状态变化的视觉反馈，让用户了解当前状态
