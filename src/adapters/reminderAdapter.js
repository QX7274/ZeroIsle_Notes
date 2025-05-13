/**
 * 提醒模型适配器
 * 用于在前端和后端模型之间进行转换
 */

import { ReminderModel } from '../models';
import { logService } from '../services/utils/logService';
import { offlineSyncService } from '../services/offline/offlineSyncService';

/**
 * 将后端提醒模型转换为前端提醒对象
 * @param {Object} reminder 后端提醒模型
 * @returns {Object} 前端提醒对象
 */
export const toFrontendReminder = (reminder) => {
  if (!reminder) return null;
  
  try {
    return {
      id: reminder._id,
      title: reminder.title || '',
      description: reminder.description || '',
      noteId: reminder.note_id,
      date: reminder.date ? new Date(reminder.date) : null,
      time: reminder.time || null,
      isCompleted: reminder.is_completed || false,
      isDeleted: reminder.is_deleted || false,
      isSynced: reminder.is_synced || false,
      isRecurring: reminder.is_recurring || false,
      recurringPattern: reminder.recurring_pattern || null,
      priority: reminder.priority || 'normal',
      color: reminder.color || '#CCCCCC',
      userId: reminder.user_id,
      createdAt: reminder.created_at ? new Date(reminder.created_at) : new Date(),
      updatedAt: reminder.updated_at ? new Date(reminder.updated_at) : new Date(),
      deletedAt: reminder.deleted_at ? new Date(reminder.deleted_at) : null,
      completedAt: reminder.completed_at ? new Date(reminder.completed_at) : null,
      notificationId: reminder.notification_id,
      notificationSent: reminder.notification_sent || false,
      notificationTime: reminder.notification_time ? new Date(reminder.notification_time) : null,
    };
  } catch (error) {
    logService.error('转换提醒模型失败', error);
    return null;
  }
};

/**
 * 将前端提醒对象转换为后端提醒模型
 * @param {Object} reminder 前端提醒对象
 * @returns {Object} 后端提醒模型
 */
export const toBackendReminder = (reminder) => {
  if (!reminder) return null;
  
  try {
    return {
      _id: reminder.id,
      title: reminder.title || '',
      description: reminder.description || '',
      note_id: reminder.noteId,
      date: reminder.date,
      time: reminder.time,
      is_completed: reminder.isCompleted || false,
      is_deleted: reminder.isDeleted || false,
      is_synced: reminder.isSynced || false,
      is_recurring: reminder.isRecurring || false,
      recurring_pattern: reminder.recurringPattern,
      priority: reminder.priority || 'normal',
      color: reminder.color || '#CCCCCC',
      user_id: reminder.userId,
      created_at: reminder.createdAt || new Date(),
      updated_at: reminder.updatedAt || new Date(),
      deleted_at: reminder.deletedAt,
      completed_at: reminder.completedAt,
      notification_id: reminder.notificationId,
      notification_sent: reminder.notificationSent || false,
      notification_time: reminder.notificationTime,
    };
  } catch (error) {
    logService.error('转换提醒对象失败', error);
    return null;
  }
};

/**
 * 创建提醒
 * @param {Object} reminderData 提醒数据
 * @param {string} userId 用户ID
 * @returns {Promise<Object>} 创建的提醒
 */
export const createReminder = async (reminderData, userId) => {
  try {
    // 准备提醒数据
    const now = new Date();
    const reminderId = `reminder_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    const backendReminder = {
      _id: reminderId,
      title: reminderData.title || '',
      description: reminderData.description || '',
      note_id: reminderData.noteId,
      date: reminderData.date,
      time: reminderData.time,
      is_completed: reminderData.isCompleted || false,
      is_deleted: false,
      is_synced: false,
      is_recurring: reminderData.isRecurring || false,
      recurring_pattern: reminderData.recurringPattern,
      priority: reminderData.priority || 'normal',
      color: reminderData.color || '#CCCCCC',
      user_id: userId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      completed_at: reminderData.isCompleted ? now : null,
      notification_id: reminderData.notificationId,
      notification_sent: reminderData.notificationSent || false,
      notification_time: reminderData.notificationTime,
    };
    
    // 创建提醒模型
    const reminder = await ReminderModel.create(backendReminder);
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: reminder._id,
      entity_type: 'reminder',
      operation: 'create',
      data: reminder.toJSON(),
      user_id: userId,
    });
    
    // 返回前端提醒对象
    return toFrontendReminder(reminder);
  } catch (error) {
    logService.error('创建提醒失败', error);
    throw error;
  }
};

/**
 * 更新提醒
 * @param {string} reminderId 提醒ID
 * @param {Object} reminderData 提醒数据
 * @returns {Promise<Object>} 更新后的提醒
 */
export const updateReminder = async (reminderId, reminderData) => {
  try {
    // 查找提醒
    const reminder = await ReminderModel.findById(reminderId);
    
    if (!reminder) {
      throw new Error(`提醒不存在: ${reminderId}`);
    }
    
    // 更新提醒属性
    if (reminderData.title !== undefined) reminder.title = reminderData.title;
    if (reminderData.description !== undefined) reminder.description = reminderData.description;
    if (reminderData.noteId !== undefined) reminder.note_id = reminderData.noteId;
    if (reminderData.date !== undefined) reminder.date = reminderData.date;
    if (reminderData.time !== undefined) reminder.time = reminderData.time;
    if (reminderData.isCompleted !== undefined) {
      reminder.is_completed = reminderData.isCompleted;
      reminder.completed_at = reminderData.isCompleted ? new Date() : null;
    }
    if (reminderData.isRecurring !== undefined) reminder.is_recurring = reminderData.isRecurring;
    if (reminderData.recurringPattern !== undefined) reminder.recurring_pattern = reminderData.recurringPattern;
    if (reminderData.priority !== undefined) reminder.priority = reminderData.priority;
    if (reminderData.color !== undefined) reminder.color = reminderData.color;
    if (reminderData.notificationId !== undefined) reminder.notification_id = reminderData.notificationId;
    if (reminderData.notificationSent !== undefined) reminder.notification_sent = reminderData.notificationSent;
    if (reminderData.notificationTime !== undefined) reminder.notification_time = reminderData.notificationTime;
    
    // 更新时间
    reminder.updated_at = new Date();
    reminder.is_synced = false;
    
    // 保存提醒
    await reminder.save();
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: reminder._id,
      entity_type: 'reminder',
      operation: 'update',
      data: reminder.toJSON(),
      user_id: reminder.user_id,
    });
    
    // 返回前端提醒对象
    return toFrontendReminder(reminder);
  } catch (error) {
    logService.error(`更新提醒失败: ${reminderId}`, error);
    throw error;
  }
};

/**
 * 删除提醒
 * @param {string} reminderId 提醒ID
 * @param {boolean} permanent 是否永久删除
 * @returns {Promise<boolean>} 是否成功
 */
export const deleteReminder = async (reminderId, permanent = false) => {
  try {
    // 查找提醒
    const reminder = await ReminderModel.findById(reminderId);
    
    if (!reminder) {
      throw new Error(`提醒不存在: ${reminderId}`);
    }
    
    if (permanent) {
      // 永久删除
      await reminder.remove({ soft: false });
    } else {
      // 软删除
      reminder.is_deleted = true;
      reminder.deleted_at = new Date();
      reminder.is_synced = false;
      await reminder.save();
      
      // 添加到同步队列
      await offlineSyncService.addToSyncQueue({
        entity_id: reminder._id,
        entity_type: 'reminder',
        operation: 'update',
        data: reminder.toJSON(),
        user_id: reminder.user_id,
      });
    }
    
    return true;
  } catch (error) {
    logService.error(`删除提醒失败: ${reminderId}`, error);
    throw error;
  }
};

/**
 * 获取提醒列表
 * @param {string} userId 用户ID
 * @param {Object} options 选项
 * @returns {Promise<Array<Object>>} 提醒列表
 */
export const getReminders = async (userId, options = {}) => {
  try {
    // 查找提醒
    const reminders = await ReminderModel.findByUser(userId, options);
    
    // 转换为前端提醒对象
    return reminders.map(toFrontendReminder);
  } catch (error) {
    logService.error('获取提醒列表失败', error);
    throw error;
  }
};

/**
 * 获取提醒详情
 * @param {string} reminderId 提醒ID
 * @returns {Promise<Object>} 提醒详情
 */
export const getReminderById = async (reminderId) => {
  try {
    // 查找提醒
    const reminder = await ReminderModel.findById(reminderId);
    
    if (!reminder) {
      throw new Error(`提醒不存在: ${reminderId}`);
    }
    
    // 转换为前端提醒对象
    return toFrontendReminder(reminder);
  } catch (error) {
    logService.error(`获取提醒详情失败: ${reminderId}`, error);
    throw error;
  }
};

/**
 * 获取笔记的提醒
 * @param {string} noteId 笔记ID
 * @returns {Promise<Array<Object>>} 提醒列表
 */
export const getNoteReminders = async (noteId) => {
  try {
    // 查找提醒
    const reminders = await ReminderModel.findByNote(noteId);
    
    // 转换为前端提醒对象
    return reminders.map(toFrontendReminder);
  } catch (error) {
    logService.error(`获取笔记提醒失败: ${noteId}`, error);
    throw error;
  }
};
