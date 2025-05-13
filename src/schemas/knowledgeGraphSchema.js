/**
 * 知识图谱模式定义
 */

import { ObjectId } from 'bson';

/**
 * 知识图谱模式
 */
const KnowledgeGraphSchema = {
  name: 'KnowledgeGraph',
  primaryKey: '_id',
  properties: {
    _id: { type: 'objectId', default: () => new ObjectId() },
    title: { type: 'string', default: '' },
    description: { type: 'string', default: '' },
    user_id: { type: 'objectId', optional: true },
    is_favorite: { type: 'bool', default: false },
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    created_at: { type: 'date', default: () => new Date() },
    updated_at: { type: 'date', default: () => new Date() },
    deleted_at: { type: 'date', optional: true },
    tags: { type: 'string[]', default: [] },
    color: { type: 'string', optional: true },
    metadata: { type: 'dictionary', default: {} },
    layout: { type: 'string', default: 'force' },
    settings: { type: 'dictionary', default: {} },
    category_id: { type: 'objectId', optional: true },
    thumbnail_path: { type: 'string', optional: true },
    _partition: { type: 'string', default: 'knowledge_graphs' },
  },
};

export default KnowledgeGraphSchema;
