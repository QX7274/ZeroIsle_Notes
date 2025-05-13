/**
 * 提醒模型 - Realm版本
 */

import Realm from 'realm';

/**
 * 提醒模型定义
 */
class Reminder extends Realm.Object {
  static schema = {
    name: 'Reminder',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      title: 'string',
      description: { type: 'string', default: '' },
      due_date: 'date',
      is_completed: { type: 'bool', default: false },
      completed_at: { type: 'date', optional: true },
      priority: { type: 'string', default: 'medium' }, // 'low', 'medium', 'high'
      repeat_type: { type: 'string', default: 'none' }, // 'none', 'daily', 'weekly', 'monthly', 'yearly', 'custom'
      repeat_interval: { type: 'int', default: 1 },
      repeat_end_date: { type: 'date', optional: true },
      repeat_days: { type: 'int[]', default: [] }, // 0-6, 0 is Sunday
      notification_time: { type: 'date', optional: true },
      notification_id: { type: 'string', optional: true },
      note_id: { type: 'string', optional: true },
      user_id: 'string',
      category_id: { type: 'string', optional: true },
      color: { type: 'string', default: '#2196F3' },
      is_deleted: { type: 'bool', default: false },
      is_synced: { type: 'bool', default: false },
      created_at: 'date',
      updated_at: 'date',
      deleted_at: { type: 'date', optional: true },
      location: { type: 'string', optional: true }, // 存储为JSON字符串
      tags: { type: 'string[]', default: [] },
    },
  };

  /**
   * 转换为JSON
   */
  toJSON() {
    // 解析location JSON字符串
    let locationObj = null;
    if (this.location) {
      try {
        locationObj = JSON.parse(this.location);
      } catch (e) {
        console.error('解析location失败:', e);
      }
    }

    return {
      _id: this._id,
      id: this._id,
      title: this.title,
      description: this.description,
      due_date: this.due_date,
      is_completed: this.is_completed,
      completed_at: this.completed_at,
      priority: this.priority,
      repeat_type: this.repeat_type,
      repeat_interval: this.repeat_interval,
      repeat_end_date: this.repeat_end_date,
      repeat_days: this.repeat_days,
      notification_time: this.notification_time,
      notification_id: this.notification_id,
      note_id: this.note_id,
      user_id: this.user_id,
      category_id: this.category_id,
      color: this.color,
      is_deleted: this.is_deleted,
      is_synced: this.is_synced,
      created_at: this.created_at,
      updated_at: this.updated_at,
      deleted_at: this.deleted_at,
      location: locationObj,
      tags: this.tags,
    };
  }

  /**
   * 完成提醒
   * @param {Realm} realm Realm实例
   */
  complete(realm) {
    realm.write(() => {
      this.is_completed = true;
      this.completed_at = new Date();
      this.updated_at = new Date();
    });

    // 如果是重复提醒，创建下一个提醒
    if (this.repeat_type !== 'none') {
      this.createNextReminder(realm);
    }

    return this;
  }

  /**
   * 取消完成
   * @param {Realm} realm Realm实例
   */
  uncomplete(realm) {
    realm.write(() => {
      this.is_completed = false;
      this.completed_at = null;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 软删除
   * @param {Realm} realm Realm实例
   */
  softDelete(realm) {
    realm.write(() => {
      this.is_deleted = true;
      this.deleted_at = new Date();
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 恢复
   * @param {Realm} realm Realm实例
   */
  restore(realm) {
    realm.write(() => {
      this.is_deleted = false;
      this.deleted_at = null;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 创建下一个重复提醒
   * @param {Realm} realm Realm实例
   * @private
   */
  createNextReminder(realm) {
    // 如果没有重复或已经到了结束日期，不创建下一个提醒
    if (this.repeat_type === 'none' || (this.repeat_end_date && new Date() >= this.repeat_end_date)) {
      return null;
    }

    // 计算下一个提醒日期
    const nextDueDate = this.calculateNextDueDate();

    // 如果下一个提醒日期超过了结束日期，不创建下一个提醒
    if (this.repeat_end_date && nextDueDate > this.repeat_end_date) {
      return null;
    }

    // 创建新的提醒
    let newReminder;
    realm.write(() => {
      newReminder = realm.create('Reminder', {
        _id: new Realm.BSON.ObjectId().toHexString(),
        title: this.title,
        description: this.description,
        due_date: nextDueDate,
        priority: this.priority,
        repeat_type: this.repeat_type,
        repeat_interval: this.repeat_interval,
        repeat_end_date: this.repeat_end_date,
        repeat_days: this.repeat_days,
        note_id: this.note_id,
        user_id: this.user_id,
        category_id: this.category_id,
        color: this.color,
        tags: this.tags,
        location: this.location,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // 设置通知时间
      if (this.notification_time) {
        const timeDiff = this.notification_time.getTime() - this.due_date.getTime();
        newReminder.notification_time = new Date(nextDueDate.getTime() + timeDiff);
      }
    });

    return newReminder;
  }

  /**
   * 计算下一个提醒日期
   * @private
   * @returns {Date} 下一个提醒日期
   */
  calculateNextDueDate() {
    const dueDate = new Date(this.due_date);

    switch (this.repeat_type) {
      case 'daily':
        dueDate.setDate(dueDate.getDate() + this.repeat_interval);
        break;

      case 'weekly':
        if (this.repeat_days && this.repeat_days.length > 0) {
          // 查找下一个匹配的星期几
          const currentDay = dueDate.getDay();
          let nextDay = null;

          // 按照星期几排序
          const sortedDays = [...this.repeat_days].sort((a, b) => a - b);

          // 查找当前星期几之后的下一个星期几
          for (const day of sortedDays) {
            if (day > currentDay) {
              nextDay = day;
              break;
            }
          }

          // 如果没有找到，使用第一个星期几，并增加一周
          if (nextDay === null) {
            nextDay = sortedDays[0];
            dueDate.setDate(dueDate.getDate() + 7 - currentDay + nextDay);
          } else {
            dueDate.setDate(dueDate.getDate() + nextDay - currentDay);
          }
        } else {
          // 如果没有指定星期几，增加一周
          dueDate.setDate(dueDate.getDate() + 7 * this.repeat_interval);
        }
        break;

      case 'monthly':
        dueDate.setMonth(dueDate.getMonth() + this.repeat_interval);
        break;

      case 'yearly':
        dueDate.setFullYear(dueDate.getFullYear() + this.repeat_interval);
        break;

      case 'custom':
        // 自定义重复，根据repeat_interval增加天数
        dueDate.setDate(dueDate.getDate() + this.repeat_interval);
        break;

      default:
        // 默认不重复
        break;
    }

    return dueDate;
  }

  /**
   * 更新通知
   * @param {Realm} realm Realm实例
   * @param {Date} notificationTime 通知时间
   * @param {string} notificationId 通知ID
   */
  updateNotification(realm, notificationTime, notificationId) {
    realm.write(() => {
      this.notification_time = notificationTime;
      this.notification_id = notificationId;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 取消通知
   * @param {Realm} realm Realm实例
   */
  cancelNotification(realm) {
    realm.write(() => {
      this.notification_time = null;
      this.notification_id = null;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 静态方法 - 根据ID查找
   * @param {Realm} realm Realm实例
   * @param {string} id ID
   */
  static findById(realm, id) {
    return realm.objectForPrimaryKey('Reminder', id);
  }

  /**
   * 静态方法 - 查找用户的提醒
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findByUser(realm, userId, options = {}) {
    const {
      is_deleted = false,
      is_completed = false,
      category_id = null,
      start_date = null,
      end_date = null,
      priority = null,
      tags = null,
    } = options;

    let query = `user_id = "${userId}" AND is_deleted = ${is_deleted}`;

    if (is_completed !== null) {
      query += ` AND is_completed = ${is_completed}`;
    }

    if (category_id) {
      query += ` AND category_id = "${category_id}"`;
    }

    if (start_date && end_date) {
      query += ` AND (due_date >= $0 AND due_date <= $1)`;
    } else if (start_date) {
      query += ` AND due_date >= $0`;
    } else if (end_date) {
      query += ` AND due_date <= $0`;
    }

    if (priority) {
      query += ` AND priority = "${priority}"`;
    }

    if (tags) {
      // 在Realm中处理数组包含查询比较复杂，这里简化处理
      const tagArray = Array.isArray(tags) ? tags : [tags];
      const tagQueries = tagArray.map(tag => `tags CONTAINS "${tag}"`).join(' OR ');
      if (tagQueries) {
        query += ` AND (${tagQueries})`;
      }
    }

    let results;
    if (start_date && end_date) {
      results = realm.objects('Reminder').filtered(query, start_date, end_date);
    } else if (start_date) {
      results = realm.objects('Reminder').filtered(query, start_date);
    } else if (end_date) {
      results = realm.objects('Reminder').filtered(query, end_date);
    } else {
      results = realm.objects('Reminder').filtered(query);
    }

    // 排序
    if (options.sort) {
      const sortField = Object.keys(options.sort)[0];
      const sortOrder = options.sort[sortField] === 1;
      results = results.sorted(sortField, sortOrder);
    } else {
      results = results.sorted('due_date', false);
    }

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 50;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 查找今天的提醒
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   */
  static findToday(realm, userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const results = realm.objects('Reminder')
      .filtered(
        `user_id = "${userId}" AND is_deleted = false AND is_completed = false AND due_date >= $0 AND due_date < $1`,
        today, tomorrow
      )
      .sorted('due_date', false);

    return results;
  }

  /**
   * 静态方法 - 查找即将到期的提醒
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {number} days 天数
   */
  static findUpcoming(realm, userId, days = 7) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const future = new Date(today);
    future.setDate(future.getDate() + days);

    const results = realm.objects('Reminder')
      .filtered(
        `user_id = "${userId}" AND is_deleted = false AND is_completed = false AND due_date >= $0 AND due_date < $1`,
        today, future
      )
      .sorted('due_date', false);

    return results;
  }

  /**
   * 静态方法 - 查找过期的提醒
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   */
  static findOverdue(realm, userId) {
    const now = new Date();

    const results = realm.objects('Reminder')
      .filtered(
        `user_id = "${userId}" AND is_deleted = false AND is_completed = false AND due_date < $0`,
        now
      )
      .sorted('due_date', false);

    return results;
  }

  /**
   * 静态方法 - 查找笔记的提醒
   * @param {Realm} realm Realm实例
   * @param {string} noteId 笔记ID
   */
  static findByNote(realm, noteId) {
    const results = realm.objects('Reminder')
      .filtered(`note_id = "${noteId}" AND is_deleted = false`)
      .sorted('due_date', false);

    return results;
  }

  /**
   * 静态方法 - 查找需要通知的提醒
   * @param {Realm} realm Realm实例
   * @param {Date} before 在此时间之前
   */
  static findForNotification(realm, before = new Date()) {
    const results = realm.objects('Reminder')
      .filtered(
        `is_deleted = false AND is_completed = false AND notification_time <= $0 AND notification_id != null`,
        before
      )
      .sorted('notification_time', false);

    return results;
  }
}

export default Reminder;
