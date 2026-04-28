/**
 * 分类模式定义
 */


/**
 * 分类模式
 */
const CategorySchema = {
  name: 'Category',
  primaryKey: '_id',
  properties: {
    _id: { type: 'string' },
    name: { type: 'string', default: '' },
    description: { type: 'string', default: '' },
    color: { type: 'string', optional: true },
    icon: { type: 'string', optional: true },
    parent_id: { type: 'string', optional: true },
    is_default: { type: 'bool', default: false },
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    created_at: { type: 'date', default: () => new Date() },
    updated_at: { type: 'date', default: () => new Date() },
    user_id: { type: 'string', optional: true },
    order: { type: 'int', default: 0 },
    _partition: { type: 'string', default: 'categories' },
  },
};

export default CategorySchema;
