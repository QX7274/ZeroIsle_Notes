/**
 * 日历集成服务
 * 提供与设备日历的集成功能
 */
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { isNetworkConnected } from './networkService';
import analyticsService from './analytics/analyticsService';

/**
 * 日历集成服务
 */
class CalendarIntegrationService {
  constructor() {
    this.initialized = false;
    this.defaultCalendarId = null;
  }

  /**
   * 初始化日历服务
   */
  async init() {
    if (this.initialized) return;

    try {
      // 请求日历权限
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('没有日历权限');
      }

      // 获取默认日历
      this.defaultCalendarId = await this._getDefaultCalendarId();
      
      this.initialized = true;
      console.log('日历集成服务初始化成功');
    } catch (error) {
      console.error('初始化日历集成服务失败:', error);
      analyticsService.trackError(error, { action: 'init_calendar_integration_service' });
    }
  }

  /**
   * 获取默认日历ID
   * @returns {Promise<string>} 日历ID
   * @private
   */
  async _getDefaultCalendarId() {
    try {
      // 获取所有日历
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      
      // 根据平台选择默认日历
      if (Platform.OS === 'ios') {
        // iOS: 选择第一个可写的iCloud或本地日历
        const defaultCalendar = calendars.find(
          cal => cal.allowsModifications && 
                (cal.source.name === 'iCloud' || cal.source.name === 'Default')
        );
        return defaultCalendar?.id;
      } else {
        // Android: 选择第一个可写的日历
        const defaultCalendar = calendars.find(cal => cal.allowsModifications);
        return defaultCalendar?.id;
      }
    } catch (error) {
      console.error('获取默认日历失败:', error);
      analyticsService.trackError(error, { action: 'get_default_calendar_id' });
      return null;
    }
  }

  /**
   * 获取所有日历
   * @returns {Promise<Array>} 日历列表
   */
  async getCalendars() {
    try {
      await this.init();
      return await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    } catch (error) {
      console.error('获取日历列表失败:', error);
      analyticsService.trackError(error, { action: 'get_calendars' });
      return [];
    }
  }

  /**
   * 创建日历事件
   * @param {Object} reminder 提醒对象
   * @param {string} calendarId 日历ID (可选，默认使用默认日历)
   * @returns {Promise<string>} 事件ID
   */
  async createCalendarEvent(reminder, calendarId = null) {
    try {
      await this.init();
      
      // 使用指定的日历ID或默认日历ID
      const targetCalendarId = calendarId || this.defaultCalendarId;
      if (!targetCalendarId) {
        throw new Error('没有可用的日历');
      }
      
      // 准备事件详情
      const eventDetails = {
        title: reminder.title,
        notes: reminder.description || '',
        startDate: new Date(reminder.dueDate || reminder.due_date),
        endDate: new Date(new Date(reminder.dueDate || reminder.due_date).getTime() + 30 * 60000), // 默认30分钟
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        alarms: [{ relativeOffset: -15 }], // 提前15分钟提醒
      };
      
      // 添加重复规则
      if (reminder.frequency && reminder.frequency !== 'once') {
        eventDetails.recurrenceRule = this._createRecurrenceRule(reminder);
      }
      
      // 创建事件
      const eventId = await Calendar.createEventAsync(targetCalendarId, eventDetails);
      
      // 记录分析数据
      analyticsService.trackEvent('create_calendar_event', {
        reminderTitle: reminder.title,
        calendarId: targetCalendarId,
        frequency: reminder.frequency,
      });
      
      return eventId;
    } catch (error) {
      console.error('创建日历事件失败:', error);
      analyticsService.trackError(error, { action: 'create_calendar_event' });
      return null;
    }
  }

  /**
   * 更新日历事件
   * @param {string} eventId 事件ID
   * @param {Object} reminder 提醒对象
   * @returns {Promise<boolean>} 是否成功
   */
  async updateCalendarEvent(eventId, reminder) {
    try {
      await this.init();
      
      // 准备事件详情
      const eventDetails = {
        title: reminder.title,
        notes: reminder.description || '',
        startDate: new Date(reminder.dueDate || reminder.due_date),
        endDate: new Date(new Date(reminder.dueDate || reminder.due_date).getTime() + 30 * 60000), // 默认30分钟
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        alarms: [{ relativeOffset: -15 }], // 提前15分钟提醒
      };
      
      // 添加重复规则
      if (reminder.frequency && reminder.frequency !== 'once') {
        eventDetails.recurrenceRule = this._createRecurrenceRule(reminder);
      }
      
      // 更新事件
      await Calendar.updateEventAsync(eventId, eventDetails);
      
      // 记录分析数据
      analyticsService.trackEvent('update_calendar_event', {
        reminderTitle: reminder.title,
        eventId,
      });
      
      return true;
    } catch (error) {
      console.error('更新日历事件失败:', error);
      analyticsService.trackError(error, { action: 'update_calendar_event' });
      return false;
    }
  }

  /**
   * 删除日历事件
   * @param {string} eventId 事件ID
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteCalendarEvent(eventId) {
    try {
      await this.init();
      
      // 删除事件
      await Calendar.deleteEventAsync(eventId);
      
      // 记录分析数据
      analyticsService.trackEvent('delete_calendar_event', {
        eventId,
      });
      
      return true;
    } catch (error) {
      console.error('删除日历事件失败:', error);
      analyticsService.trackError(error, { action: 'delete_calendar_event' });
      return false;
    }
  }

  /**
   * 创建重复规则
   * @param {Object} reminder 提醒对象
   * @returns {Object} 重复规则
   * @private
   */
  _createRecurrenceRule(reminder) {
    const rule = {
      frequency: this._mapFrequency(reminder.frequency),
    };
    
    // 如果有结束日期
    if (reminder.repeat_end_date) {
      rule.endDate = new Date(reminder.repeat_end_date);
    }
    
    return rule;
  }

  /**
   * 映射频率
   * @param {string} frequency 频率
   * @returns {string} 日历频率
   * @private
   */
  _mapFrequency(frequency) {
    switch (frequency) {
      case 'daily':
        return Calendar.Frequency.DAILY;
      case 'weekly':
        return Calendar.Frequency.WEEKLY;
      case 'monthly':
        return Calendar.Frequency.MONTHLY;
      case 'yearly':
        return Calendar.Frequency.YEARLY;
      default:
        return Calendar.Frequency.DAILY;
    }
  }

  /**
   * 导出提醒到日历
   * @param {Array} reminders 提醒列表
   * @param {string} calendarId 日历ID (可选)
   * @returns {Promise<Object>} 导出结果
   */
  async exportRemindersToCalendar(reminders, calendarId = null) {
    try {
      await this.init();
      
      // 使用指定的日历ID或默认日历ID
      const targetCalendarId = calendarId || this.defaultCalendarId;
      if (!targetCalendarId) {
        throw new Error('没有可用的日历');
      }
      
      // 导出结果
      const result = {
        total: reminders.length,
        success: 0,
        failed: 0,
        eventIds: [],
      };
      
      // 导出每个提醒
      for (const reminder of reminders) {
        try {
          const eventId = await this.createCalendarEvent(reminder, targetCalendarId);
          if (eventId) {
            result.success++;
            result.eventIds.push(eventId);
          } else {
            result.failed++;
          }
        } catch (error) {
          console.error('导出提醒失败:', error);
          result.failed++;
        }
      }
      
      // 记录分析数据
      analyticsService.trackEvent('export_reminders_to_calendar', {
        total: result.total,
        success: result.success,
        failed: result.failed,
      });
      
      return result;
    } catch (error) {
      console.error('导出提醒到日历失败:', error);
      analyticsService.trackError(error, { action: 'export_reminders_to_calendar' });
      throw error;
    }
  }

  /**
   * 从日历导入事件
   * @param {string} calendarId 日历ID
   * @param {Date} startDate 开始日期
   * @param {Date} endDate 结束日期
   * @returns {Promise<Array>} 提醒列表
   */
  async importEventsFromCalendar(calendarId, startDate, endDate) {
    try {
      await this.init();
      
      // 获取日历事件
      const events = await Calendar.getEventsAsync(
        [calendarId],
        startDate,
        endDate
      );
      
      // 转换为提醒
      const reminders = events.map(event => ({
        title: event.title,
        description: event.notes || '',
        due_date: event.startDate.toISOString(),
        frequency: this._mapCalendarFrequency(event.recurrenceRule?.frequency),
        repeat_end_date: event.recurrenceRule?.endDate?.toISOString() || null,
        is_enabled: true,
        is_completed: false,
        calendar_event_id: event.id,
      }));
      
      // 记录分析数据
      analyticsService.trackEvent('import_events_from_calendar', {
        calendarId,
        eventCount: events.length,
      });
      
      return reminders;
    } catch (error) {
      console.error('从日历导入事件失败:', error);
      analyticsService.trackError(error, { action: 'import_events_from_calendar' });
      return [];
    }
  }

  /**
   * 映射日历频率
   * @param {string} frequency 日历频率
   * @returns {string} 频率
   * @private
   */
  _mapCalendarFrequency(frequency) {
    if (!frequency) return 'once';
    
    switch (frequency) {
      case Calendar.Frequency.DAILY:
        return 'daily';
      case Calendar.Frequency.WEEKLY:
        return 'weekly';
      case Calendar.Frequency.MONTHLY:
        return 'monthly';
      case Calendar.Frequency.YEARLY:
        return 'yearly';
      default:
        return 'once';
    }
  }
}

export default new CalendarIntegrationService();
