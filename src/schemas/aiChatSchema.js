/**
 * AI聊天模式定义
 * 注意：此文件已更新为使用字符串类型存储，以兼容Realm本地存储
 */

/**
 * AI聊天模式
 * messages字段存储为JSON字符串，避免复杂对象序列化问题
 */
const AIChatSchema = {
  name: 'AIChat',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    title: { type: 'string', default: '' },
    messages: { type: 'string', default: '[]' }, // 存储为JSON字符串
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    created_at: { type: 'date', default: () => new Date() },
    updated_at: { type: 'date', default: () => new Date() },
    user_id: { type: 'string', optional: true },
  },
};

export default AIChatSchema;
