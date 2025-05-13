/**
 * 模式定义索引
 * 导出所有Realm模式定义
 */

import NoteSchema from './noteSchema';
import CategorySchema from './categorySchema';
import TagSchema from './tagSchema';
import ReminderSchema from './reminderSchema';
import AIChatSchema from './aiChatSchema';
import FileSchema from './fileSchema';
import KnowledgeGraphSchema from './knowledgeGraphSchema';
import KnowledgeNodeSchema from './knowledgeNodeSchema';
import KnowledgeEdgeSchema from './knowledgeEdgeSchema';
import MindMapSchema from './mindMapSchema';
import MindMapNodeSchema from './mindMapNodeSchema';
import SyncInfoSchema from './syncInfoSchema';
import UserSchema from './userSchema';
import SettingsSchema from './settingsSchema';
import OfflineQueueSchema from './offlineQueueSchema';

// 所有模式定义
const SCHEMAS = [
  NoteSchema,
  CategorySchema,
  TagSchema,
  ReminderSchema,
  AIChatSchema,
  FileSchema,
  KnowledgeGraphSchema,
  KnowledgeNodeSchema,
  KnowledgeEdgeSchema,
  MindMapSchema,
  MindMapNodeSchema,
  SyncInfoSchema,
  UserSchema,
  SettingsSchema,
  OfflineQueueSchema,
];

export {
  NoteSchema,
  CategorySchema,
  TagSchema,
  ReminderSchema,
  AIChatSchema,
  FileSchema,
  KnowledgeGraphSchema,
  KnowledgeNodeSchema,
  KnowledgeEdgeSchema,
  MindMapSchema,
  MindMapNodeSchema,
  SyncInfoSchema,
  UserSchema,
  SettingsSchema,
  OfflineQueueSchema,
  SCHEMAS,
};

export default SCHEMAS;
