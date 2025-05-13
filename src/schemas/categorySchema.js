/**
 * 分类模式定义
 */

import { ObjectId } from 'bson';

/**
 * 分类模式
 */
const CategorySchema = {
  name: 'Category',
  primaryKey: '_id',
  properties: {
    _id: { type: 'objectId', default: () => new ObjectId() },
    name: { type: 'string', default: '' },
    description: { type: 'string', default: '' },
    color: { type: 'string', optional: true },
    icon: { type: 'string', optional: true },
    parent_id: { type: 'objectId', optional: true },
    is_default: { type: 'bool', default: false },
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    created_at: { type: 'date', default: () => new Date() },
    updated_at: { type: 'date', default: () => new Date() },
    user_id: { type: 'objectId', optional: true },
    order: { type: 'int', default: 0 },
    _partition: { type: 'string', default: 'categories' },
  },
};

export default CategorySchema;
