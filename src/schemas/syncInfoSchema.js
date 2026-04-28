/**
 * 同步信息模式定义
 */


/**
 * 同步信息模式
 */
const SyncInfoSchema = {
  name: 'SyncInfo',
  primaryKey: '_id',
  properties: {
    _id: { type: 'string' },
    user_id: { type: 'string', optional: true },
    last_sync_time: { type: 'date', default: () => new Date() },
    last_sync_status: { type: 'string', default: 'success' }, // success, failed, in_progress
    last_sync_error: { type: 'string', optional: true },
    sync_type: { type: 'string', default: 'full' }, // full, partial
    entity_type: { type: 'string', optional: true },
    entity_id: { type: 'string', optional: true },
    device_id: { type: 'string', optional: true },
    metadata: { type: 'dictionary', default: {} },
    _partition: { type: 'string', default: 'sync_info' },
  },
};

export default SyncInfoSchema;
