/**
 * 模型导出 - Realm版本
 */

// 导入Realm模型
import Note from './Note';
import Category from './Category';
import User from './User';
import AIChat from './AIChat';
import Tag from './Tag';
import Reminder from './Reminder';
import KnowledgeNode from './KnowledgeNode';
import KnowledgeEdge from './KnowledgeEdge';
import KnowledgeGraph from './KnowledgeGraph';
import InfiniteCanvas from './InfiniteCanvas';
import CanvasElement from './CanvasElement';
import MindMap from './MindMap';
import MindMapNode from './MindMapNode';
import SyncInfo from './SyncInfo';
import File from './File';
import SearchHistory from './SearchHistory';
import SearchIndex from './SearchIndex';
import Settings from './Settings';
import OfflineQueue from './OfflineQueue';

// 导入模型类 - 这些将在后续迁移中更新
import BaseModel from './BaseModel';
import NoteModel from './NoteModel';
import CategoryModel from './CategoryModel';
import TagModel from './TagModel';
import ReminderModel from './ReminderModel';
import AIChatModel from './AIChatModel';
import FileModel from './FileModel';
import KnowledgeGraphModel from './KnowledgeGraphModel';
import KnowledgeNodeModel from './KnowledgeNodeModel';
import KnowledgeEdgeModel from './KnowledgeEdgeModel';
import MindMapModel from './MindMapModel';
import MindMapNodeModel from './MindMapNodeModel';
import SettingsModel from './SettingsModel';
import OfflineQueueModel from './OfflineQueueModel';

// 导出所有Realm模型
export {
  // Realm模型
  Note,
  Category,
  User,
  AIChat,
  Tag,
  Reminder,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraph,
  InfiniteCanvas,
  CanvasElement,
  MindMap,
  MindMapNode,
  SyncInfo,
  File,
  SearchHistory,
  SearchIndex,
  Settings,
  OfflineQueue,

  // 模型类 - 这些将在后续迁移中更新
  BaseModel,
  NoteModel,
  CategoryModel,
  TagModel,
  ReminderModel,
  AIChatModel,
  FileModel,
  KnowledgeGraphModel,
  KnowledgeNodeModel,
  KnowledgeEdgeModel,
  MindMapModel,
  MindMapNodeModel,
  SettingsModel,
  OfflineQueueModel
};

// 存储项目的模式定义
const StorageItem = {
  name: 'StorageItem',
  primaryKey: 'key',
  properties: {
    key: 'string',
    value: 'string',
    createdAt: 'date',
    updatedAt: 'date',
  },
};

// 导出所有Realm模型的数组，用于Realm配置
export const realmModels = [
  Note,
  Category,
  User,
  AIChat,
  Tag,
  Reminder,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraph,
  InfiniteCanvas,
  CanvasElement,
  MindMap,
  MindMapNode,
  SyncInfo,
  File,
  SearchHistory,
  SearchIndex,
  Settings,
  OfflineQueue,
  StorageItem
];
