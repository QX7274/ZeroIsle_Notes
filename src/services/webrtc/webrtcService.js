/**
 * WebRTC服务
 * 处理WebRTC连接和屏幕共享
 */
import { Platform } from 'react-native';
import { getToken } from '../utils/auth';
import { API_BASE_URL } from '../../utils/constants/config';

class WebRTCService {
  constructor() {
    this.socket = null;
    this.peerConnections = {};
    this.localStream = null;
    this.onRemoteStreamCallbacks = [];
    this.onUserJoinCallbacks = [];
    this.onUserLeaveCallbacks = [];
    this.roomId = null;
    this.userId = null;
    this.isConnected = false;
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ];
  }

  /**
   * 初始化WebRTC服务
   * @param {string} userId 用户ID
   */
  init(userId) {
    this.userId = userId;
  }

  /**
   * 连接到WebSocket信令服务器
   * @param {string} roomId 房间ID
   * @returns {Promise} 连接结果
   */
  async connect(roomId) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    this.roomId = roomId;

    return new Promise(async (resolve, reject) => {
      try {
        const token = await getToken();
        if (!token) {
          reject(new Error('未登录，无法连接到信令服务器'));
          return;
        }

        // 构建WebSocket URL
        const wsProtocol = (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:') ? 'wss:' : 'ws:';
        const wsBaseUrl = API_BASE_URL.replace(/^https?:\/\//, '');
        const wsUrl = `${wsProtocol}//${wsBaseUrl}/ws/webrtc/${roomId}/?token=${token}`;

        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          console.log('WebRTC信令服务器连接成功');
          this.isConnected = true;

          // 获取房间内的用户
          this._sendMessage({
            type: 'get_users',
          });

          resolve();
        };

        this.socket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          this._handleSignalingMessage(data);
        };

        this.socket.onclose = () => {
          console.log('WebRTC信令服务器连接关闭');
          this.isConnected = false;
          this._cleanup();
        };

        this.socket.onerror = (error) => {
          console.error('WebRTC信令服务器连接错误:', error);
          reject(error);
        };
      } catch (error) {
        console.error('连接WebRTC信令服务器失败:', error);
        reject(error);
      }
    });
  }

  /**
   * 断开WebSocket连接
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
    this._cleanup();
  }

  /**
   * 开始屏幕共享
   * @returns {Promise} 共享结果
   */
  async startScreenShare() {
    try {
      if (!this.isConnected) {
        throw new Error('未连接到信令服务器');
      }

      // 获取屏幕媒体流
      const stream = await this._getScreenStream();
      this.localStream = stream;

      // 向房间内的所有用户发送offer
      for (const userId in this.peerConnections) {
        await this._createOffer(userId);
      }

      return true;
    } catch (error) {
      console.error('开始屏幕共享失败:', error);
      throw error;
    }
  }

  /**
   * 停止屏幕共享
   */
  stopScreenShare() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  /**
   * 注册远程流回调
   * @param {Function} callback 回调函数
   */
  onRemoteStream(callback) {
    this.onRemoteStreamCallbacks.push(callback);
  }

  /**
   * 注册用户加入回调
   * @param {Function} callback 回调函数
   */
  onUserJoin(callback) {
    this.onUserJoinCallbacks.push(callback);
  }

  /**
   * 注册用户离开回调
   * @param {Function} callback 回调函数
   */
  onUserLeave(callback) {
    this.onUserLeaveCallbacks.push(callback);
  }

  /**
   * 获取屏幕媒体流
   * @returns {Promise<MediaStream>} 媒体流
   * @private
   */
  async _getScreenStream() {
    try {
      if (Platform.OS === 'web') {
        // Web平台使用getDisplayMedia API
        return await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor',
          },
          audio: false,
        });
      } else {
        // 移动平台占位实现：返回空轨道的“伪流”，避免抛错
        // 注意：这不会真正共享屏幕，只用于占位，保证流程不中断
        console.warn('[WebRTCService] 移动端屏幕共享为占位实现：不会推送任何视频轨道');
        return {
          getTracks: () => [],
        };
      }
    } catch (error) {
      console.error('获取屏幕媒体流失败:', error);
      throw error;
    }
  }

  /**
   * 处理信令消息
   * @param {Object} message 消息对象
   * @private
   */
  _handleSignalingMessage(message) {
    switch (message.type) {
      case 'offer':
        this._handleOffer(message);
        break;
      case 'answer':
        this._handleAnswer(message);
        break;
      case 'ice_candidate':
        this._handleIceCandidate(message);
        break;
      case 'user_join':
        this._handleUserJoin(message);
        break;
      case 'user_leave':
        this._handleUserLeave(message);
        break;
      case 'users':
        this._handleUsers(message);
        break;
      default:
        console.log('未知的信令消息类型:', message.type);
    }
  }

  /**
   * 处理offer消息
   * @param {Object} message 消息对象
   * @private
   */
  async _handleOffer(message) {
    try {
      const { user_id, offer } = message;

      // 创建对等连接
      const pc = await this._createPeerConnection(user_id);

      // 设置远程描述
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // 创建应答
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // 发送应答
      this._sendMessage({
        type: 'answer',
        answer,
        target_user_id: user_id,
      });
    } catch (error) {
      console.error('处理offer失败:', error);
    }
  }

  /**
   * 处理answer消息
   * @param {Object} message 消息对象
   * @private
   */
  async _handleAnswer(message) {
    try {
      const { user_id, answer } = message;
      const pc = this.peerConnections[user_id];

      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (error) {
      console.error('处理answer失败:', error);
    }
  }

  /**
   * 处理ICE候选消息
   * @param {Object} message 消息对象
   * @private
   */
  async _handleIceCandidate(message) {
    try {
      const { user_id, candidate } = message;
      const pc = this.peerConnections[user_id];

      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('处理ICE候选失败:', error);
    }
  }

  /**
   * 处理用户加入消息
   * @param {Object} message 消息对象
   * @private
   */
  async _handleUserJoin(message) {
    const { user_id, username } = message;

    // 如果是自己，忽略
    if (user_id === this.userId) {
      return;
    }

    // 创建对等连接
    await this._createPeerConnection(user_id);

    // 如果有本地流，创建offer
    if (this.localStream) {
      await this._createOffer(user_id);
    }

    // 触发用户加入回调
    this.onUserJoinCallbacks.forEach(callback => {
      callback({ id: user_id, username });
    });
  }

  /**
   * 处理用户离开消息
   * @param {Object} message 消息对象
   * @private
   */
  _handleUserLeave(message) {
    const { user_id, username } = message;

    // 关闭对等连接
    if (this.peerConnections[user_id]) {
      this.peerConnections[user_id].close();
      delete this.peerConnections[user_id];
    }

    // 触发用户离开回调
    this.onUserLeaveCallbacks.forEach(callback => {
      callback({ id: user_id, username });
    });
  }

  /**
   * 处理用户列表消息
   * @param {Object} message 消息对象
   * @private
   */
  async _handleUsers(message) {
    const { users } = message;

    // 为每个用户创建对等连接
    for (const user of users) {
      // 如果是自己，忽略
      if (user.id === this.userId) {
        continue;
      }

      // 创建对等连接
      await this._createPeerConnection(user.id);

      // 触发用户加入回调
      this.onUserJoinCallbacks.forEach(callback => {
        callback(user);
      });

      // 如果有本地流，创建offer
      if (this.localStream && user.is_sharing) {
        await this._createOffer(user.id);
      }
    }
  }

  /**
   * 创建对等连接
   * @param {string} userId 用户ID
   * @returns {RTCPeerConnection} 对等连接
   * @private
   */
  async _createPeerConnection(userId) {
    try {
      // 如果已经存在，返回现有连接
      if (this.peerConnections[userId]) {
        return this.peerConnections[userId];
      }

      // 创建新的对等连接
      const pc = new RTCPeerConnection({ iceServers: this.iceServers });

      // 添加本地流
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          pc.addTrack(track, this.localStream);
        });
      }

      // 监听ICE候选
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this._sendMessage({
            type: 'ice_candidate',
            candidate: event.candidate,
            target_user_id: userId,
          });
        }
      };

      // 监听连接状态变化
      pc.onconnectionstatechange = (event) => {
        console.log(`与用户 ${userId} 的连接状态变化:`, pc.connectionState);
      };

      // 监听ICE连接状态变化
      pc.oniceconnectionstatechange = (event) => {
        console.log(`与用户 ${userId} 的ICE连接状态变化:`, pc.iceConnectionState);
      };

      // 监听远程流
      pc.ontrack = (event) => {
        console.log(`收到用户 ${userId} 的远程流`);

        // 触发远程流回调
        this.onRemoteStreamCallbacks.forEach(callback => {
          callback({
            userId,
            stream: event.streams[0],
          });
        });
      };

      // 保存连接
      this.peerConnections[userId] = pc;

      return pc;
    } catch (error) {
      console.error('创建对等连接失败:', error);
      throw error;
    }
  }

  /**
   * 创建offer
   * @param {string} userId 用户ID
   * @private
   */
  async _createOffer(userId) {
    try {
      const pc = this.peerConnections[userId];

      if (!pc) {
        throw new Error(`与用户 ${userId} 的连接不存在`);
      }

      // 创建offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 发送offer
      this._sendMessage({
        type: 'offer',
        offer,
        target_user_id: userId,
      });
    } catch (error) {
      console.error('创建offer失败:', error);
      throw error;
    }
  }

  /**
   * 发送消息到信令服务器
   * @param {Object} message 消息对象
   * @private
   */
  _sendMessage(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('WebSocket未连接，无法发送消息');
    }
  }

  /**
   * 清理资源
   * @private
   */
  _cleanup() {
    // 停止本地流
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // 关闭所有对等连接
    for (const userId in this.peerConnections) {
      this.peerConnections[userId].close();
    }

    this.peerConnections = {};
    this.isConnected = false;
    this.roomId = null;
  }
}

const webrtcService = new WebRTCService();

module.exports = webrtcService;
module.exports.default = webrtcService;
module.exports.webrtcService = webrtcService;
module.exports.WebRTCService = WebRTCService;
