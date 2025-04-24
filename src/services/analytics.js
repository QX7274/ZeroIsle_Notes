import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

class AnalyticsService {
  constructor() {
    this.maxEvents = 100;
    this.flushInterval = 5 * 60 * 1000; // 5分钟
    this.timer = null;
  }

  async init() {
    await this.loadEvents();
    this.startFlushTimer();
  }

  async trackEvent(eventType, data = {}) {
    try {
      const event = {
        type: eventType,
        data,
        timestamp: new Date().toISOString(),
      };
      const events = await this.getEvents();
      events.push(event);
      if (events.length > this.maxEvents) {
        events.splice(0, events.length - this.maxEvents);
      }
      await this.saveEvents(events);
    } catch (error) {
      console.error('记录事件失败:', error);
    }
  }

  async trackScreenView(screenName) {
    await this.trackEvent('screen_view', { screen: screenName });
  }

  async trackUserAction(action, data = {}) {
    await this.trackEvent('user_action', { action, ...data });
  }

  async trackError(error, data = {}) {
    await this.trackEvent('error', {
      message: error.message,
      stack: error.stack,
      ...data,
    });
  }

  async trackNoteAction(action, noteId) {
    await this.trackEvent('note_action', { action, noteId });
  }

  async trackCanvasAction(action, data = {}) {
    await this.trackEvent('canvas_action', { action, ...data });
  }

  async getEvents() {
    try {
      const eventsJson = await AsyncStorage.getItem('analytics_events');
      return eventsJson ? JSON.parse(eventsJson) : [];
    } catch (error) {
      console.error('获取事件失败:', error);
      return [];
    }
  }

  async saveEvents(events) {
    try {
      await AsyncStorage.setItem('analytics_events', JSON.stringify(events));
    } catch (error) {
      console.error('保存事件失败:', error);
    }
  }

  async loadEvents() {
    try {
      const events = await this.getEvents();
      if (events.length > 0) {
        await this.flushEvents();
      }
    } catch (error) {
      console.error('加载事件失败:', error);
    }
  }

  async flushEvents() {
    try {
      const events = await this.getEvents();
      if (events.length === 0) return;

      // 这里可以添加发送事件到服务器的逻辑
      // 例如：await api.sendAnalyticsEvents(events);

      await this.saveEvents([]);
    } catch (error) {
      console.error('刷新事件失败:', error);
    }
  }

  startFlushTimer() {
    this.timer = setInterval(() => {
      this.flushEvents();
    }, this.flushInterval);
  }

  stopFlushTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const analyticsService = new AnalyticsService(); 