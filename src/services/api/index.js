/**
 * API服务索引
 * 统一导出所有API服务
 */

// 导入API服务
import authApi from './authApi';
import notesApi from './notesApi';
import knowledgeGraphApi from './knowledgeGraphApi';
import aiAssistantApi from './aiAssistantApi';
import reminderApi from './reminderApi';
import voiceApi from './voiceApi';
import searchApi from './searchApi';
import communityApi from './communityApi';
import canvasApi from './canvasApi';
import codeApi from './codeApi';

// 导出API服务
export {
  authApi,
  notesApi,
  knowledgeGraphApi,
  aiAssistantApi,
  reminderApi,
  voiceApi,
  searchApi,
  communityApi,
  canvasApi,
  codeApi
};

// 默认导出所有API服务
export default {
  auth: authApi,
  notes: notesApi,
  knowledgeGraph: knowledgeGraphApi,
  aiAssistant: aiAssistantApi,
  reminder: reminderApi,
  voice: voiceApi,
  search: searchApi,
  community: communityApi,
  canvas: canvasApi,
  code: codeApi
};
