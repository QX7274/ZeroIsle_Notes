/**
 * 同步模型
 * 定义同步相关的Realm模型
 */

/**
 * 同步信息模型
 * 用于存储同步相关的信息，如上次同步时间
 */
export const SyncInfoSchema = {
  name: 'SyncInfo',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    type: 'string',
    value: 'string',
    created_at: 'date',
    updated_at: 'date'
  }
};

/**
 * 离线队列模型
 * 用于存储离线操作，等待同步到服务器
 */
export const OfflineQueueSchema = {
  name: 'OfflineQueue',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    type: 'string',
    collection: 'string',
    document_id: 'string?',
    data: 'string',
    created_at: 'date',
    updated_at: 'date',
    is_synced: { type: 'bool', default: false },
    retry_count: { type: 'int', default: 0 },
    last_error: 'string?',
    server_response: 'string?'
  }
};

/**
 * 同步冲突模型
 * 用于存储同步过程中发生的冲突
 */
export const SyncConflictSchema = {
  name: 'SyncConflict',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    collection: 'string',
    document_id: 'string',
    local_data: 'string',
    remote_data: 'string',
    resolved: { type: 'bool', default: false },
    resolution: 'string?',
    created_at: 'date',
    updated_at: 'date'
  }
};

/**
 * 同步日志模型
 * 用于记录同步操作的日志
 */
export const SyncLogSchema = {
  name: 'SyncLog',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    type: 'string',
    message: 'string',
    details: 'string?',
    created_at: 'date'
  }
};

/**
 * 同步设置模型
 * 用于存储同步相关的设置
 */
export const SyncSettingsSchema = {
  name: 'SyncSettings',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    auto_sync_enabled: { type: 'bool', default: true },
    auto_sync_interval: { type: 'int', default: 5 }, // 分钟
    sync_on_app_start: { type: 'bool', default: true },
    sync_on_network_change: { type: 'bool', default: true },
    sync_on_background: { type: 'bool', default: false },
    sync_collections: 'string[]',
    created_at: 'date',
    updated_at: 'date'
  }
};

// 导出所有同步模型
export const SyncModels = [
  SyncInfoSchema,
  OfflineQueueSchema,
  SyncConflictSchema,
  SyncLogSchema,
  SyncSettingsSchema
];

export default SyncModels;
