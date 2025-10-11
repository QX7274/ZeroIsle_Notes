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

// 模型类已删除，统一使用Realm模型

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

  // 注意：旧的模型类已被删除，统一使用Realm模型
};

// 存储项目的模式定义
const StorageItem = {
  name: 'StorageItem',
  primaryKey: 'key',
  properties: {
    key: 'string',
    value: 'string',
    created_at: 'date',
    updated_at: 'date',
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
