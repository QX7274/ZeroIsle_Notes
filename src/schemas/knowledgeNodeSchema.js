/**
 * 知识节点模式定义
 */


/**
 * 位置模式
 */
const PositionSchema = {
  name: 'Position',
  embedded: true,
  properties: {
    x: { type: 'float', default: 0 },
    y: { type: 'float', default: 0 },
  },
};

/**
 * 知识节点模式
 */
const KnowledgeNodeSchema = {
  name: 'KnowledgeNode',
  primaryKey: '_id',
  properties: {
    _id: { type: 'string' },
    title: { type: 'string', default: '' },
    content: { type: 'string', default: '' },
    graph_id: { type: 'string', optional: true },
    user_id: { type: 'string', optional: true },
    position: { type: 'Position', default: {} },
    color: { type: 'string', optional: true },
    size: { type: 'string', default: 'medium' }, // small, medium, large
    shape: { type: 'string', default: 'circle' }, // circle, rectangle, diamond, etc.
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    created_at: { type: 'date', default: () => new Date() },
    updated_at: { type: 'date', default: () => new Date() },
    deleted_at: { type: 'date', optional: true },
    metadata: { type: 'dictionary', default: {} },
    tags: { type: 'list', objectType: 'string', default: [] },
    note_id: { type: 'objectId', optional: true },
    file_id: { type: 'objectId', optional: true },
    url: { type: 'string', optional: true },
    _partition: { type: 'string', default: 'knowledge_nodes' },
  },
};

export default KnowledgeNodeSchema;
