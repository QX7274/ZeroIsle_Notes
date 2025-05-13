/**
 * 提醒模型类
 */

import BaseModel from './BaseModel';
import { logService } from '../services/utils/logService';

// 优先级枚举
export const PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

// 重复类型枚举
export const REPEAT_TYPE = {
  NONE: 'none',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  CUSTOM: 'custom',
};

class ReminderModel extends BaseModel {
  constructor(data = {}) {
    super(data, 'Reminder');
    
    this.title = data.title || '';
    this.description = data.description || '';
    this.due_date = data.due_date || null;
    this.is_completed = data.is_completed || false;
    this.completed_at = data.completed_at || null;
    this.priority = data.priority || PRIORITY.MEDIUM;
    this.repeat_type = data.repeat_type || REPEAT_TYPE.NONE;
    this.repeat_interval = data.repeat_interval || 1;
    this.repeat_end_date = data.repeat_end_date || null;
    this.repeat_days = data.repeat_days || [];
    this.notification_time = data.notification_time || null;
    this.notification_id = data.notification_id || null;
    this.note_id = data.note_id || null;
    this.user_id = data.user_id || null;
    this.category_id = data.category_id || null;
    this.color = data.color || null;
    this.is_deleted = data.is_deleted || false;
    this.is_synced = data.is_synced || false;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
    this.deleted_at = data.deleted_at || null;
    this.tags = data.tags || [];
  }

  /**
   * 更新标题
   * @param {string} title 标题
   * @returns {ReminderModel} 提醒模型
   */
  updateTitle(title) {
    this.title = title;
    this.isModified = true;
    this.modifiedFields.add('title');
    return this;
  }

  /**
   * 更新描述
   * @param {string} description 描述
   * @returns {ReminderModel} 提醒模型
   */
  updateDescription(description) {
    this.description = description;
    this.isModified = true;
    this.modifiedFields.add('description');
    return this;
  }

  /**
   * 设置到期日期
   * @param {Date} dueDate 到期日期
   * @returns {ReminderModel} 提醒模型
   */
  setDueDate(dueDate) {
    this.due_date = dueDate;
    this.isModified = true;
    this.modifiedFields.add('due_date');
    return this;
  }

  /**
   * 设置完成状态
   * @param {boolean} isCompleted 是否完成
   * @returns {ReminderModel} 提醒模型
   */
  setCompleted(isCompleted) {
    this.is_completed = isCompleted;
    
    if (isCompleted) {
      this.completed_at = new Date();
      this.modifiedFields.add('completed_at');
    } else {
      this.completed_at = null;
      this.modifiedFields.add('completed_at');
    }
    
    this.isModified = true;
    this.modifiedFields.add('is_completed');
    return this;
  }

  /**
   * 设置优先级
   * @param {string} priority 优先级
   * @returns {ReminderModel} 提醒模型
   */
  setPriority(priority) {
    if (Object.values(PRIORITY).includes(priority)) {
      this.priority = priority;
      this.isModified = true;
      this.modifiedFields.add('priority');
    }
    return this;
  }

  /**
   * 设置重复类型
   * @param {string} repeatType 重复类型
   * @param {number} interval 重复间隔
   * @returns {ReminderModel} 提醒模型
   */
  setRepeatType(repeatType, interval = 1) {
    if (Object.values(REPEAT_TYPE).includes(repeatType)) {
      this.repeat_type = repeatType;
      this.repeat_interval = interval;
      this.isModified = true;
      this.modifiedFields.add('repeat_type');
      this.modifiedFields.add('repeat_interval');
    }
    return this;
  }

  /**
   * 设置重复结束日期
   * @param {Date} endDate 结束日期
   * @returns {ReminderModel} 提醒模型
   */
  setRepeatEndDate(endDate) {
    this.repeat_end_date = endDate;
    this.isModified = true;
    this.modifiedFields.add('repeat_end_date');
    return this;
  }

  /**
   * 设置重复日期
   * @param {Array<number>} days 重复日期（0-6，表示周日到周六）
   * @returns {ReminderModel} 提醒模型
   */
  setRepeatDays(days) {
    this.repeat_days = days;
    this.isModified = true;
    this.modifiedFields.add('repeat_days');
    return this;
  }

  /**
   * 设置通知时间
   * @param {Date} notificationTime 通知时间
   * @returns {ReminderModel} 提醒模型
   */
  setNotificationTime(notificationTime) {
    this.notification_time = notificationTime;
    this.isModified = true;
    this.modifiedFields.add('notification_time');
    return this;
  }

  /**
   * 设置通知ID
   * @param {string} notificationId 通知ID
   * @returns {ReminderModel} 提醒模型
   */
  setNotificationId(notificationId) {
    this.notification_id = notificationId;
    this.isModified = true;
    this.modifiedFields.add('notification_id');
    return this;
  }

  /**
   * 关联笔记
   * @param {string} noteId 笔记ID
   * @returns {ReminderModel} 提醒模型
   */
  linkNote(noteId) {
    this.note_id = noteId;
    this.isModified = true;
    this.modifiedFields.add('note_id');
    return this;
  }

  /**
   * 设置分类
   * @param {string} categoryId 分类ID
   * @returns {ReminderModel} 提醒模型
   */
  setCategory(categoryId) {
    this.category_id = categoryId;
    this.isModified = true;
    this.modifiedFields.add('category_id');
    return this;
  }

  /**
   * 设置颜色
   * @param {string} color 颜色
   * @returns {ReminderModel} 提醒模型
   */
  setColor(color) {
    this.color = color;
    this.isModified = true;
    this.modifiedFields.add('color');
    return this;
  }

  /**
   * 添加标签
   * @param {string} tag 标签
   * @returns {ReminderModel} 提醒模型
   */
  addTag(tag) {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.isModified = true;
      this.modifiedFields.add('tags');
    }
    return this;
  }

  /**
   * 移除标签
   * @param {string} tag 标签
   * @returns {ReminderModel} 提醒模型
   */
  removeTag(tag) {
    const index = this.tags.indexOf(tag);
    if (index !== -1) {
      this.tags.splice(index, 1);
      this.isModified = true;
      this.modifiedFields.add('tags');
    }
    return this;
  }

  /**
   * 创建下一个重复提醒
   * @returns {Promise<ReminderModel|null>} 下一个提醒
   */
  async createNextReminder() {
    if (this.repeat_type === REPEAT_TYPE.NONE) {
      return null;
    }
    
    // 计算下一个到期日期
    const nextDueDate = this.calculateNextDueDate();
    
    // 检查是否超过结束日期
    if (this.repeat_end_date && nextDueDate > this.repeat_end_date) {
      return null;
    }
    
    // 创建新的提醒
    const nextReminder = new ReminderModel({
      title: this.title,
      description: this.description,
      due_date: nextDueDate,
      priority: this.priority,
      repeat_type: this.repeat_type,
      repeat_interval: this.repeat_interval,
      repeat_end_date: this.repeat_end_date,
      repeat_days: this.repeat_days,
      notification_time: this.calculateNextNotificationTime(nextDueDate),
      note_id: this.note_id,
      user_id: this.user_id,
      category_id: this.category_id,
      color: this.color,
      tags: [...this.tags],
    });
    
    // 保存新提醒
    await nextReminder.save();
    
    return nextReminder;
  }

  /**
   * 计算下一个到期日期
   * @returns {Date} 下一个到期日期
   * @private
   */
  calculateNextDueDate() {
    if (!this.due_date) {
      return new Date();
    }
    
    const dueDate = new Date(this.due_date);
    const interval = this.repeat_interval || 1;
    
    switch (this.repeat_type) {
      case REPEAT_TYPE.DAILY:
        return new Date(dueDate.setDate(dueDate.getDate() + interval));
        
      case REPEAT_TYPE.WEEKLY:
        return new Date(dueDate.setDate(dueDate.getDate() + (7 * interval)));
        
      case REPEAT_TYPE.MONTHLY:
        return new Date(dueDate.setMonth(dueDate.getMonth() + interval));
        
      case REPEAT_TYPE.YEARLY:
        return new Date(dueDate.setFullYear(dueDate.getFullYear() + interval));
        
      case REPEAT_TYPE.CUSTOM:
        if (this.repeat_days && this.repeat_days.length > 0) {
          // 获取当前星期几（0-6，表示周日到周六）
          const currentDay = dueDate.getDay();
          
          // 找到下一个重复日
          let nextDay = null;
          for (let i = 1; i <= 7; i++) {
            const checkDay = (currentDay + i) % 7;
            if (this.repeat_days.includes(checkDay)) {
              nextDay = checkDay;
              break;
            }
          }
          
          if (nextDay !== null) {
            // 计算需要增加的天数
            const daysToAdd = (nextDay - currentDay + 7) % 7;
            return new Date(dueDate.setDate(dueDate.getDate() + daysToAdd));
          }
        }
        
        // 默认增加一天
        return new Date(dueDate.setDate(dueDate.getDate() + 1));
        
      default:
        return new Date(dueDate.setDate(dueDate.getDate() + 1));
    }
  }

  /**
   * 计算下一个通知时间
   * @param {Date} nextDueDate 下一个到期日期
   * @returns {Date|null} 下一个通知时间
   * @private
   */
  calculateNextNotificationTime(nextDueDate) {
    if (!this.notification_time || !nextDueDate) {
      return null;
    }
    
    const dueDate = new Date(this.due_date);
    const notificationTime = new Date(this.notification_time);
    
    // 计算通知时间与到期日期的时间差（毫秒）
    const timeDiff = dueDate.getTime() - notificationTime.getTime();
    
    // 应用相同的时间差到下一个到期日期
    return new Date(nextDueDate.getTime() - timeDiff);
  }

  /**
   * 查找用户的提醒
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<ReminderModel>>} 提醒模型数组
   */
  static async findByUser(userId, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { due_date: 1 },
        is_deleted = false,
        is_completed = null,
        priority = null,
        category_id = null,
        tags = null,
        from_date = null,
        to_date = null,
      } = options;
      
      const filter = { user_id: userId, is_deleted };
      
      if (is_completed !== null) {
        filter.is_completed = is_completed;
      }
      
      if (priority) {
        filter.priority = priority;
      }
      
      if (category_id) {
        filter.category_id = category_id;
      }
      
      if (tags) {
        filter.tags = { $in: Array.isArray(tags) ? tags : [tags] };
      }
      
      if (from_date || to_date) {
        filter.due_date = {};
        
        if (from_date) {
          filter.due_date.$gte = from_date;
        }
        
        if (to_date) {
          filter.due_date.$lte = to_date;
        }
      }
      
      return this.find(filter, { sort, limit, skip });
    } catch (error) {
      logService.error('查找用户提醒失败', error);
      throw error;
    }
  }

  /**
   * 查找今天的提醒
   * @param {string} userId 用户ID
   * @returns {Promise<Array<ReminderModel>>} 提醒模型数组
   */
  static async findToday(userId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      return this.findByUser(userId, {
        from_date: today,
        to_date: tomorrow,
        is_completed: false,
        sort: { priority: -1, due_date: 1 },
      });
    } catch (error) {
      logService.error('查找今天提醒失败', error);
      throw error;
    }
  }

  /**
   * 查找过期的提醒
   * @param {string} userId 用户ID
   * @returns {Promise<Array<ReminderModel>>} 提醒模型数组
   */
  static async findOverdue(userId) {
    try {
      const now = new Date();
      
      return this.findByUser(userId, {
        to_date: now,
        is_completed: false,
        sort: { due_date: 1 },
      });
    } catch (error) {
      logService.error('查找过期提醒失败', error);
      throw error;
    }
  }

  /**
   * 查找笔记的提醒
   * @param {string} noteId 笔记ID
   * @returns {Promise<Array<ReminderModel>>} 提醒模型数组
   */
  static async findByNote(noteId) {
    try {
      return this.find({
        note_id: noteId,
        is_deleted: false,
      }, { sort: { due_date: 1 } });
    } catch (error) {
      logService.error('查找笔记提醒失败', error);
      throw error;
    }
  }

  /**
   * 查找需要通知的提醒
   * @returns {Promise<Array<ReminderModel>>} 提醒模型数组
   */
  static async findForNotification() {
    try {
      const now = new Date();
      
      return this.find({
        notification_time: { $lte: now },
        is_completed: false,
        is_deleted: false,
      });
    } catch (error) {
      logService.error('查找需要通知的提醒失败', error);
      throw error;
    }
  }
}

// 设置集合名称
ReminderModel.collectionName = 'Reminder';

export default ReminderModel;
