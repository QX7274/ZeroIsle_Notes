import { getToken } from '../auth/tokenService';
import { API_URL } from '../../config';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = 1000;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    const token = getToken();
    if (!token) {
      console.log('No token available, cannot connect to WebSocket');
      return;
    }

    const wsBase = API_URL.replace(/^http/, 'ws');
    // 连接提醒与知识图谱两个通道，知识图谱用于接收构建完成事件
    const wsUrl = `${wsBase}/ws/knowledge-graph/?token=${token}`;
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // 标准化事件名称
      const eventType = data.type || data.event;
      this.notifyListeners(eventType, data);
    };

    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
      this.reconnect();
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, this.reconnectTimeout * this.reconnectAttempts);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  addListener(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(callback);
  }

  removeListener(type, callback) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).delete(callback);
    }
  }

  notifyListeners(type, data) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).forEach(callback => callback(data));
    }
  }

  markNotificationRead(notificationId) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'mark_read',
        notification_id: notificationId,
      }));
    }
  }
}

const websocketService = new WebSocketService();

module.exports = websocketService;
module.exports.default = websocketService;
module.exports.websocketService = websocketService;
module.exports.WebSocketService = WebSocketService;
