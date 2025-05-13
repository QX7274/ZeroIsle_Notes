/**
 * 用户模式定义
 */

import { ObjectId } from 'bson';

/**
 * 用户模式
 */
const UserSchema = {
  name: 'User',
  primaryKey: '_id',
  properties: {
    _id: { type: 'objectId', default: () => new ObjectId() },
    username: { type: 'string', default: '' },
    email: { type: 'string', default: '' },
    avatar_url: { type: 'string', optional: true },
    is_active: { type: 'bool', default: true },
    is_deleted: { type: 'bool', default: false },
    created_at: { type: 'date', default: () => new Date() },
    updated_at: { type: 'date', default: () => new Date() },
    last_login_at: { type: 'date', optional: true },
    preferences: { type: 'dictionary', default: {} },
    metadata: { type: 'dictionary', default: {} },
    _partition: { type: 'string', default: 'users' },
  },
};

export default UserSchema;
