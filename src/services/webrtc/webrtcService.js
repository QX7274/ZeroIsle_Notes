/**
 * WebRTC 服务
 * 处理 WebRTC 连接和屏幕共享
 */
import { Platform } from 'react-native';
import { API_URL } from '../../config';
import { getToken } from '../utils/auth';

class WebRTCService {
  constructor() {
    this.socket = null;
    this.peerConnections = {};
    this.localStream = null;
    this.onRemoteStreamCallbacks = [];
    this.onUserJoinCallbacks = [];
    this.onUserLeaveCallbacks = [];
    this.onConnectionStateChangeCallbacks = [];
    this.connectionState = 'idle';
    this.roomId = null;
    this.userId = null;
    this.isConnected = false;
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ];
  }

  init(userId) {
    this.userId = userId;
  }

  async connect(roomId) {
    if (
      this.socket
      && this.socket.readyState === WebSocket.OPEN
      && this.roomId === roomId
    ) {
      return;
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.roomId !== roomId) {
      this.disconnect();
    }

    this.roomId = roomId;
    this._setConnectionState('connecting');

    return new Promise(async (resolve, reject) => {
      try {
        const token = await getToken();
        if (!token) {
          this._setConnectionState('error', '未登录，无法连接到信令服务器');
          reject(new Error('未登录，无法连接到信令服务器'));
          return;
        }

        const wsProtocol = typeof window !== 'undefined' && window.location?.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsBaseUrl = API_URL.replace(/^https?:\/\//, '').replace(/\/+$/, '');
        const wsUrl = `${wsProtocol}//${wsBaseUrl}/ws/webrtc/${roomId}/?token=${token}`;

        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          this.isConnected = true;
          this._setConnectionState('connected');
          this._sendMessage({ type: 'get_users' });
          resolve();
        };

        this.socket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          this._handleSignalingMessage(data);
        };

        this.socket.onclose = () => {
          this.isConnected = false;
          this._setConnectionState('closed');
          this._cleanup();
        };

        this.socket.onerror = (error) => {
          this._setConnectionState('error', '信令连接失败，请检查本地 Web 端和网络状态');
          reject(error);
        };
      } catch (error) {
        this._setConnectionState('error', error?.message || '信令连接初始化失败');
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
    this._setConnectionState('idle');
    this._cleanup();
  }

  async startScreenShare() {
    if (!this.isConnected) {
      throw new Error('未连接到信令服务器');
    }

    const stream = await this._getScreenStream();
    this.localStream = stream;

    for (const userId in this.peerConnections) {
      this._syncLocalTracksForPeerConnection(this.peerConnections[userId]);
      await this._createOffer(userId);
    }

    return true;
  }

  stopScreenShare() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    for (const userId in this.peerConnections) {
      this._syncLocalTracksForPeerConnection(this.peerConnections[userId]);
    }
  }

  onRemoteStream(callback) {
    this.onRemoteStreamCallbacks.push(callback);
    return () => {
      this.onRemoteStreamCallbacks = this.onRemoteStreamCallbacks.filter(
        (item) => item !== callback
      );
    };
  }

  onUserJoin(callback) {
    this.onUserJoinCallbacks.push(callback);
    return () => {
      this.onUserJoinCallbacks = this.onUserJoinCallbacks.filter(
        (item) => item !== callback
      );
    };
  }

  onUserLeave(callback) {
    this.onUserLeaveCallbacks.push(callback);
    return () => {
      this.onUserLeaveCallbacks = this.onUserLeaveCallbacks.filter(
        (item) => item !== callback
      );
    };
  }

  onConnectionStateChange(callback) {
    this.onConnectionStateChangeCallbacks.push(callback);
    callback({
      state: this.connectionState,
      detail: null,
    });
    return () => {
      this.onConnectionStateChangeCallbacks = this.onConnectionStateChangeCallbacks.filter(
        (item) => item !== callback
      );
    };
  }

  async _getScreenStream() {
    if (Platform.OS === 'web') {
      return navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
        },
        audio: false,
      });
    }

    throw new Error('当前平台不支持屏幕共享');
  }

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
        break;
    }
  }

  async _handleOffer(message) {
    try {
      const { user_id, offer } = message;
      const pc = await this._createPeerConnection(user_id);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this._sendMessage({
        type: 'answer',
        answer,
        target_user_id: user_id,
      });
    } catch (error) {
      console.error('处理 offer 失败:', error);
    }
  }

  async _handleAnswer(message) {
    try {
      const { user_id, answer } = message;
      const pc = this.peerConnections[user_id];

      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (error) {
      console.error('处理 answer 失败:', error);
    }
  }

  async _handleIceCandidate(message) {
    try {
      const { user_id, candidate } = message;
      const pc = this.peerConnections[user_id];

      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('处理 ICE 候选失败:', error);
    }
  }

  async _handleUserJoin(message) {
    const { user_id, username } = message;

    if (user_id === this.userId) {
      return;
    }

    await this._createPeerConnection(user_id);

    if (this.localStream) {
      await this._createOffer(user_id);
    }

    this.onUserJoinCallbacks.forEach(callback => {
      callback({ id: user_id, username });
    });
  }

  _handleUserLeave(message) {
    const { user_id, username } = message;

    if (this.peerConnections[user_id]) {
      this.peerConnections[user_id].close();
      delete this.peerConnections[user_id];
    }

    this.onUserLeaveCallbacks.forEach(callback => {
      callback({ id: user_id, username });
    });
  }

  async _handleUsers(message) {
    const { users } = message;

    for (const user of users) {
      if (user.id === this.userId) {
        continue;
      }

      await this._createPeerConnection(user.id);

      this.onUserJoinCallbacks.forEach(callback => {
        callback(user);
      });

      if (this.localStream && user.is_sharing) {
        await this._createOffer(user.id);
      }
    }
  }

  async _createPeerConnection(userId) {
    if (this.peerConnections[userId]) {
      return this.peerConnections[userId];
    }

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    this._syncLocalTracksForPeerConnection(pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this._sendMessage({
          type: 'ice_candidate',
          candidate: event.candidate,
          target_user_id: userId,
        });
      }
    };

    pc.ontrack = (event) => {
      this.onRemoteStreamCallbacks.forEach(callback => {
        callback({
          userId,
          stream: event.streams[0],
        });
      });
    };

    this.peerConnections[userId] = pc;
    return pc;
  }

  _syncLocalTracksForPeerConnection(pc) {
    if (!pc || typeof pc.addTrack !== 'function') {
      return;
    }

    const localTracks = this.localStream?.getTracks?.() || [];
    const localTrackIds = new Set(localTracks.map((track) => track?.id).filter(Boolean));
    const initialSenders = typeof pc.getSenders === 'function' ? pc.getSenders() || [] : [];

    if (typeof pc.removeTrack === 'function') {
      initialSenders.forEach((sender) => {
        const senderTrackId = sender?.track?.id;
        if (senderTrackId && !localTrackIds.has(senderTrackId)) {
          pc.removeTrack(sender);
        }
      });
    }

    const attachedTrackIds = new Set(
      (typeof pc.getSenders === 'function' ? pc.getSenders() || [] : initialSenders)
        .map((sender) => sender?.track?.id)
        .filter(Boolean)
    );

    localTracks.forEach((track) => {
      if (track?.id && attachedTrackIds.has(track.id)) {
        return;
      }

      pc.addTrack(track, this.localStream);
      if (track?.id) {
        attachedTrackIds.add(track.id);
      }
    });
  }

  async _createOffer(userId) {
    const pc = this.peerConnections[userId];

    if (!pc) {
      throw new Error(`与用户 ${userId} 的连接不存在`);
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this._sendMessage({
      type: 'offer',
      offer,
      target_user_id: userId,
    });
  }

  _sendMessage(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  _setConnectionState(state, detail = null) {
    this.connectionState = state;
    this.onConnectionStateChangeCallbacks.forEach((callback) => {
      callback({ state, detail });
    });
  }

  _cleanup() {
    this.socket = null;

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

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
