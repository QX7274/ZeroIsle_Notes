# WebSocket服务

本目录包含零屿笔记应用的WebSocket相关服务，用于提供实时通信和数据同步功能。

## 文件结构

- **websocketService.js**: WebSocket服务，提供WebSocket连接和通信功能

## 主要功能

### WebSocket服务 (websocketService.js)

WebSocket服务提供以下主要功能：

- **WebSocket连接**: 建立和管理WebSocket连接
- **消息发送**: 发送消息到服务器
- **消息接收**: 接收服务器发送的消息
- **连接状态管理**: 管理连接状态和重连机制
- **消息处理**: 处理不同类型的消息
- **事件分发**: 将接收到的消息分发给相应的处理器
- **心跳机制**: 保持连接活跃的心跳机制

## 消息类型

WebSocket服务支持以下主要消息类型：

- **系统消息**: 系统相关的消息，如服务器状态、系统通知等
- **用户消息**: 用户相关的消息，如用户状态变更、用户操作等
- **数据同步消息**: 数据同步相关的消息，如笔记更新、设置变更等
- **实时协作消息**: 实时协作相关的消息，如共同编辑、光标位置等
- **通知消息**: 通知相关的消息，如提醒、公告等
- **心跳消息**: 用于保持连接活跃的心跳消息

## 连接状态

WebSocket服务定义了以下连接状态：

- **CONNECTING**: 正在连接
- **CONNECTED**: 已连接
- **DISCONNECTED**: 已断开连接
- **RECONNECTING**: 正在重新连接
- **FAILED**: 连接失败

## 重连机制

WebSocket服务使用以下重连机制：

- **指数退避**: 连接失败后，重连间隔逐渐增加
- **最大重试次数**: 设置最大重试次数，避免无限重试
- **重连超时**: 设置重连超时时间，避免长时间等待
- **网络状态感知**: 根据网络状态调整重连策略

## 与其他服务的交互

WebSocket服务与以下服务有交互：

- **网络服务**: 检测网络状态，决定连接策略
- **认证服务**: 提供连接认证信息
- **数据同步服务**: 处理数据同步消息
- **实时协作服务**: 处理实时协作消息
- **通知服务**: 处理通知消息

## 使用方法

```javascript
import { websocketService } from '../../services/websocket';

// 初始化WebSocket服务
async function initializeWebSocket() {
  try {
    await websocketService.initialize();
    console.log('WebSocket服务初始化成功');
    return true;
  } catch (error) {
    console.error('WebSocket服务初始化失败:', error);
    return false;
  }
}

// 连接WebSocket
async function connectWebSocket(url, options = {}) {
  try {
    await websocketService.connect(url, {
      token: options.token,
      reconnect: options.reconnect !== false,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      reconnectInterval: options.reconnectInterval || 1000
    });
    
    console.log('WebSocket连接成功');
    return true;
  } catch (error) {
    console.error('WebSocket连接失败:', error);
    return false;
  }
}

// 断开WebSocket连接
async function disconnectWebSocket() {
  try {
    await websocketService.disconnect();
    console.log('WebSocket断开连接成功');
    return true;
  } catch (error) {
    console.error('WebSocket断开连接失败:', error);
    return false;
  }
}

// 发送消息
async function sendMessage(type, data) {
  try {
    await websocketService.send({
      type,
      data,
      timestamp: Date.now()
    });
    
    console.log('消息发送成功:', type);
    return true;
  } catch (error) {
    console.error('消息发送失败:', error);
    return false;
  }
}

// 监听消息
function listenToMessages() {
  // 监听系统消息
  websocketService.on('system', (message) => {
    console.log('收到系统消息:', message);
    // 处理系统消息
    handleSystemMessage(message);
  });
  
  // 监听用户消息
  websocketService.on('user', (message) => {
    console.log('收到用户消息:', message);
    // 处理用户消息
    handleUserMessage(message);
  });
  
  // 监听数据同步消息
  websocketService.on('sync', (message) => {
    console.log('收到数据同步消息:', message);
    // 处理数据同步消息
    handleSyncMessage(message);
  });
  
  // 监听实时协作消息
  websocketService.on('collaboration', (message) => {
    console.log('收到实时协作消息:', message);
    // 处理实时协作消息
    handleCollaborationMessage(message);
  });
  
  // 监听通知消息
  websocketService.on('notification', (message) => {
    console.log('收到通知消息:', message);
    // 处理通知消息
    handleNotificationMessage(message);
  });
  
  // 监听连接状态变化
  websocketService.on('connectionStateChanged', (state) => {
    console.log('WebSocket连接状态变化:', state);
    // 更新UI显示连接状态
    updateConnectionStateUI(state);
  });
}

// 发送笔记更新消息
async function sendNoteUpdate(noteId, content) {
  try {
    await sendMessage('sync', {
      action: 'updateNote',
      noteId,
      content,
      timestamp: Date.now()
    });
    
    console.log('笔记更新消息发送成功');
    return true;
  } catch (error) {
    console.error('笔记更新消息发送失败:', error);
    return false;
  }
}

// 发送光标位置更新消息
async function sendCursorPosition(noteId, position) {
  try {
    await sendMessage('collaboration', {
      action: 'updateCursor',
      noteId,
      position,
      timestamp: Date.now()
    });
    
    console.log('光标位置更新消息发送成功');
    return true;
  } catch (error) {
    console.error('光标位置更新消息发送失败:', error);
    return false;
  }
}

// 获取WebSocket连接状态
function getConnectionState() {
  return websocketService.getState();
}

// 检查WebSocket是否已连接
function isConnected() {
  return websocketService.isConnected();
}
```

## 消息数据结构

WebSocket消息的基本数据结构如下：

```javascript
{
  type: String,              // 消息类型
  data: Object,              // 消息数据
  timestamp: Number,         // 消息时间戳
  id: String,                // 消息ID
  sender: String,            // 发送者ID
  recipient: String,         // 接收者ID（可选）
  metadata: Object           // 元数据（可选）
}
```

## 注意事项

- WebSocket连接可能受到网络环境的影响，应处理连接失败和重连
- 考虑消息的可靠性，可能需要实现消息确认和重发机制
- 处理大量消息时，考虑消息队列和批处理，避免阻塞
- 考虑消息的安全性，如消息加密和身份验证
- 提供适当的用户界面反馈，如连接状态、消息发送状态等
- 考虑离线情况，可能需要缓存消息并在重新连接后发送
