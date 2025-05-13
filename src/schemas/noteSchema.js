/**
 * 笔记模式定义
 */

import { ObjectId } from 'bson';

/**
 * 笔记模式
 */
const NoteSchema = {
  name: 'Note',
  primaryKey: '_id',
  properties: {
    _id: { type: 'objectId', default: () => new ObjectId() },
    title: { type: 'string', default: '' },
    content: { type: 'string', default: '' },
    type: { type: 'string', default: 'text' },
    tags: { type: 'string[]', default: [] },
    category_id: { type: 'objectId', optional: true },
    color: { type: 'string', optional: true },
    is_favorite: { type: 'bool', default: false },
    is_archived: { type: 'bool', default: false },
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    created_at: { type: 'date', default: () => new Date() },
    updated_at: { type: 'date', default: () => new Date() },
    deleted_at: { type: 'date', optional: true },
    user_id: { type: 'objectId', optional: true },
    file_path: { type: 'string', optional: true },
    file_size: { type: 'int', optional: true },
    file_type: { type: 'string', optional: true },
    thumbnail_path: { type: 'string', optional: true },
    parent_id: { type: 'objectId', optional: true },
    metadata: { type: 'dictionary', default: {} },
    _partition: { type: 'string', default: 'notes' },
  },
};

export default NoteSchema;
