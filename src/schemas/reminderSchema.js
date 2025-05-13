/**
 * 提醒模式定义
 */

import { ObjectId } from 'bson';

/**
 * 提醒模式
 */
const ReminderSchema = {
  name: 'Reminder',
  primaryKey: '_id',
  properties: {
    _id: { type: 'objectId', default: () => new ObjectId() },
    title: { type: 'string', default: '' },
    description: { type: 'string', default: '' },
    date: { type: 'date', optional: true },
    time: { type: 'string', optional: true },
    is_completed: { type: 'bool', default: false },
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    created_at: { type: 'date', default: () => new Date() },
    updated_at: { type: 'date', default: () => new Date() },
    completed_at: { type: 'date', optional: true },
    deleted_at: { type: 'date', optional: true },
    user_id: { type: 'objectId', optional: true },
    note_id: { type: 'objectId', optional: true },
    repeat_type: { type: 'string', optional: true }, // daily, weekly, monthly, yearly
    repeat_interval: { type: 'int', optional: true },
    repeat_end_date: { type: 'date', optional: true },
    priority: { type: 'int', default: 0 }, // 0: normal, 1: important, 2: urgent
    notification_id: { type: 'string', optional: true },
    color: { type: 'string', optional: true },
    _partition: { type: 'string', default: 'reminders' },
  },
};

export default ReminderSchema;
