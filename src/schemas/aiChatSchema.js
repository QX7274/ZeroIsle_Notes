/**
 * AI聊天模式定义
 */

import { ObjectId } from 'bson';

/**
 * AI聊天消息模式
 */
const AIChatMessageSchema = {
  name: 'AIChatMessage',
  embedded: true,
  properties: {
    role: { type: 'string', default: 'user' }, // user, assistant, system
    content: { type: 'string', default: '' },
    timestamp: { type: 'date', default: () => new Date() },
    metadata: { type: 'dictionary', default: {} },
  },
};

/**
 * AI聊天模式
 */
const AIChatSchema = {
  name: 'AIChat',
  primaryKey: '_id',
  properties: {
    _id: { type: 'objectId', default: () => new ObjectId() },
    title: { type: 'string', default: '' },
    messages: { type: 'list', objectType: 'AIChatMessage', default: [] },
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    created_at: { type: 'date', default: () => new Date() },
    updated_at: { type: 'date', default: () => new Date() },
    deleted_at: { type: 'date', optional: true },
    user_id: { type: 'objectId', optional: true },
    model: { type: 'string', default: 'gpt-3.5-turbo' },
    system_prompt: { type: 'string', optional: true },
    metadata: { type: 'dictionary', default: {} },
    _partition: { type: 'string', default: 'ai_chats' },
  },
};

export default AIChatSchema;
