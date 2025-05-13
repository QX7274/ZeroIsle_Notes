/**
 * 离线队列模式定义
 */

import { ObjectId } from 'bson';

/**
 * 离线队列模式
 */
const OfflineQueueSchema = {
  name: 'OfflineQueue',
  primaryKey: '_id',
  properties: {
    _id: { type: 'objectId', default: () => new ObjectId() },
    entity_id: { type: 'objectId', optional: true },
    entity_type: { type: 'string', default: '' },
    operation: { type: 'string', default: '' }, // create, update, delete
    data: { type: 'dictionary', default: {} },
    status: { type: 'string', default: 'pending' }, // pending, processing, completed, failed
    error: { type: 'string', optional: true },
    retry_count: { type: 'int', default: 0 },
    created_at: { type: 'date', default: () => new Date() },
    updated_at: { type: 'date', default: () => new Date() },
    completed_at: { type: 'date', optional: true },
    user_id: { type: 'objectId', optional: true },
    device_id: { type: 'string', optional: true },
    priority: { type: 'int', default: 0 },
    _partition: { type: 'string', default: 'offline_queue' },
  },
};

export default OfflineQueueSchema;
