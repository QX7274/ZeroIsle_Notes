/**
 * 设置模式定义
 */


/**
 * 设置模式
 */
const SettingsSchema = {
  name: 'Settings',
  primaryKey: '_id',
  properties: {
    _id: { type: 'string' },
    user_id: { type: 'string', optional: true },
    key: { type: 'string', default: '' },
    value: { type: 'string', default: '' },
    type: { type: 'string', default: 'string' }, // string, number, boolean, json
    category: { type: 'string', default: 'general' },
    is_synced: { type: 'bool', default: false },
    created_at: { type: 'date', default: () => new Date() },
    updated_at: { type: 'date', default: () => new Date() },
    _partition: { type: 'string', default: 'settings' },
  },
};

export default SettingsSchema;
