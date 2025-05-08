# WebRTC服务

本目录包含零屿笔记应用的WebRTC相关服务，用于提供实时音视频通信和屏幕共享功能。

## 文件结构

- **webRTCService.js**: WebRTC服务，提供实时音视频通信功能

## 主要功能

### WebRTC服务 (webRTCService.js)

WebRTC服务提供以下主要功能：

- **音视频通话**: 提供一对一和多人音视频通话功能
- **屏幕共享**: 支持屏幕内容共享
- **实时数据传输**: 支持通过数据通道传输实时数据
- **媒体设备管理**: 管理音频和视频设备
- **通话质量监控**: 监控通话质量和网络状态
- **录制功能**: 支持通话内容录制
- **信令服务**: 与信令服务器通信，建立连接

## WebRTC连接流程

WebRTC连接的基本流程如下：

1. **获取媒体流**: 获取本地音频和视频流
2. **创建对等连接**: 创建RTCPeerConnection对象
3. **添加媒体流**: 将本地媒体流添加到对等连接
4. **创建和交换SDP**: 创建并交换会话描述协议(SDP)
5. **交换ICE候选**: 交换ICE候选信息
6. **建立连接**: 建立对等连接
7. **传输媒体**: 开始传输音视频数据

## 信令服务

WebRTC服务使用信令服务器进行以下操作：

- **用户发现**: 发现可通话的用户
- **会话建立**: 建立通话会话
- **SDP交换**: 交换会话描述协议(SDP)
- **ICE候选交换**: 交换ICE候选信息
- **会话管理**: 管理通话会话的开始、结束等

## 媒体约束

WebRTC服务支持以下媒体约束：

- **视频约束**: 控制视频分辨率、帧率等
- **音频约束**: 控制音频质量、降噪等
- **带宽约束**: 控制媒体传输的带宽使用

## 与其他服务的交互

WebRTC服务与以下服务有交互：

- **WebSocket服务**: 用于信令通信
- **用户服务**: 获取用户信息和在线状态
- **权限服务**: 管理媒体设备访问权限
- **存储服务**: 存储通话记录和设置

## 使用方法

```javascript
import { webRTCService } from '../../services/webrtc';

// 初始化WebRTC服务
async function initializeWebRTC() {
  try {
    await webRTCService.initialize();
    console.log('WebRTC服务初始化成功');
    return true;
  } catch (error) {
    console.error('WebRTC服务初始化失败:', error);
    return false;
  }
}

// 获取本地媒体流
async function getLocalStream(constraints = { audio: true, video: true }) {
  try {
    const stream = await webRTCService.getLocalStream(constraints);
    console.log('获取本地媒体流成功');
    return stream;
  } catch (error) {
    console.error('获取本地媒体流失败:', error);
    return null;
  }
}

// 发起通话
async function makeCall(userId, options = {}) {
  try {
    const call = await webRTCService.call(userId, {
      audio: options.audio !== false,
      video: options.video !== false,
      screenShare: options.screenShare || false
    });
    
    console.log('发起通话成功:', call);
    return call;
  } catch (error) {
    console.error('发起通话失败:', error);
    return null;
  }
}

// 接听通话
async function answerCall(callId, options = {}) {
  try {
    await webRTCService.answer(callId, {
      audio: options.audio !== false,
      video: options.video !== false
    });
    
    console.log('接听通话成功');
    return true;
  } catch (error) {
    console.error('接听通话失败:', error);
    return false;
  }
}

// 结束通话
async function endCall(callId) {
  try {
    await webRTCService.hangup(callId);
    console.log('结束通话成功');
    return true;
  } catch (error) {
    console.error('结束通话失败:', error);
    return false;
  }
}

// 开始屏幕共享
async function startScreenSharing(callId) {
  try {
    const stream = await webRTCService.startScreenSharing(callId);
    console.log('开始屏幕共享成功');
    return stream;
  } catch (error) {
    console.error('开始屏幕共享失败:', error);
    return null;
  }
}

// 停止屏幕共享
async function stopScreenSharing(callId) {
  try {
    await webRTCService.stopScreenSharing(callId);
    console.log('停止屏幕共享成功');
    return true;
  } catch (error) {
    console.error('停止屏幕共享失败:', error);
    return false;
  }
}

// 静音/取消静音
async function toggleMute(callId, mute) {
  try {
    await webRTCService.setMuted(callId, mute);
    console.log(mute ? '已静音' : '已取消静音');
    return true;
  } catch (error) {
    console.error('切换静音状态失败:', error);
    return false;
  }
}

// 开启/关闭视频
async function toggleVideo(callId, enable) {
  try {
    await webRTCService.setVideoEnabled(callId, enable);
    console.log(enable ? '已开启视频' : '已关闭视频');
    return true;
  } catch (error) {
    console.error('切换视频状态失败:', error);
    return false;
  }
}

// 切换摄像头
async function switchCamera(callId) {
  try {
    await webRTCService.switchCamera(callId);
    console.log('切换摄像头成功');
    return true;
  } catch (error) {
    console.error('切换摄像头失败:', error);
    return false;
  }
}

// 获取可用媒体设备
async function getMediaDevices() {
  try {
    const devices = await webRTCService.getMediaDevices();
    console.log('获取媒体设备成功:', devices);
    return devices;
  } catch (error) {
    console.error('获取媒体设备失败:', error);
    return null;
  }
}

// 监听通话事件
function listenToCallEvents() {
  // 监听来电
  webRTCService.on('incomingCall', (call) => {
    console.log('收到来电:', call);
    // 显示来电界面
    showIncomingCallUI(call);
  });
  
  // 监听通话状态变化
  webRTCService.on('callStateChanged', (callId, state) => {
    console.log('通话状态变化:', callId, state);
    // 更新通话界面
    updateCallUI(callId, state);
  });
  
  // 监听远程流添加
  webRTCService.on('remoteStreamAdded', (callId, stream) => {
    console.log('远程流添加:', callId);
    // 显示远程视频
    displayRemoteVideo(callId, stream);
  });
  
  // 监听远程流移除
  webRTCService.on('remoteStreamRemoved', (callId) => {
    console.log('远程流移除:', callId);
    // 移除远程视频
    removeRemoteVideo(callId);
  });
  
  // 监听通话结束
  webRTCService.on('callEnded', (callId, reason) => {
    console.log('通话结束:', callId, reason);
    // 显示通话结束界面
    showCallEndedUI(callId, reason);
  });
}
```

## 注意事项

- WebRTC需要适当的权限，如摄像头、麦克风访问权限
- WebRTC连接可能受到网络环境的影响，应处理连接失败和重连
- 考虑不同平台和浏览器的兼容性问题
- 信令服务器需要可靠的连接，考虑断线重连机制
- 考虑通话质量和带宽管理，适应不同网络环境
- 提供适当的用户界面反馈，如连接状态、通话质量等
