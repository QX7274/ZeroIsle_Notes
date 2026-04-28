/**
 * 思维导图节点模式定义
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
 * 思维导图节点模式
 */
const MindMapNodeSchema = {
  name: 'MindMapNode',
  primaryKey: '_id',
  properties: {
    _id: { type: 'string' },
    text: { type: 'string', default: '' },
    mind_map_id: { type: 'string', optional: true },
    user_id: { type: 'string', optional: true },
    is_root: { type: 'bool', default: false },
    level: { type: 'int', default: 0 },
    parent_id: { type: 'string', optional: true },
    position: { type: 'Position', default: {} },
    color: { type: 'string', optional: true },
    background_color: { type: 'string', optional: true },
    font_size: { type: 'int', optional: true },
    font_weight: { type: 'string', optional: true },
    shape: { type: 'string', default: 'rectangle' },
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    created_at: { type: 'date', default: () => new Date() },
    updated_at: { type: 'date', default: () => new Date() },
    deleted_at: { type: 'date', optional: true },
    metadata: { type: 'dictionary', default: {} },
    note_id: { type: 'string', optional: true },
    collapsed: { type: 'bool', default: false },
    order: { type: 'int', default: 0 },
    _partition: { type: 'string', default: 'mind_map_nodes' },
  },
};

export default MindMapNodeSchema;
