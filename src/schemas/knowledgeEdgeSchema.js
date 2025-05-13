/**
 * 知识边模式定义
 */

import { ObjectId } from 'bson';

/**
 * 知识边模式
 */
const KnowledgeEdgeSchema = {
  name: 'KnowledgeEdge',
  primaryKey: '_id',
  properties: {
    _id: { type: 'objectId', default: () => new ObjectId() },
    source_id: { type: 'objectId', optional: true },
    target_id: { type: 'objectId', optional: true },
    graph_id: { type: 'objectId', optional: true },
    user_id: { type: 'objectId', optional: true },
    label: { type: 'string', default: '' },
    type: { type: 'string', default: 'default' },
    color: { type: 'string', optional: true },
    width: { type: 'float', default: 1 },
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    created_at: { type: 'date', default: () => new Date() },
    updated_at: { type: 'date', default: () => new Date() },
    deleted_at: { type: 'date', optional: true },
    metadata: { type: 'dictionary', default: {} },
    weight: { type: 'float', default: 1 },
    bidirectional: { type: 'bool', default: false },
    _partition: { type: 'string', default: 'knowledge_edges' },
  },
};

export default KnowledgeEdgeSchema;
