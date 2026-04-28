/**
 * 标签模式定义
 */


/**
 * 标签模式
 */
const TagSchema = {
  name: 'Tag',
  primaryKey: '_id',
  properties: {
    _id: { type: 'string' },
    name: { type: 'string', default: '' },
    color: { type: 'string', optional: true },
    count: { type: 'int', default: 0 },
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    created_at: { type: 'date', default: () => new Date() },
    updated_at: { type: 'date', default: () => new Date() },
    user_id: { type: 'string', optional: true },
    _partition: { type: 'string', default: 'tags' },
  },
};

export default TagSchema;
