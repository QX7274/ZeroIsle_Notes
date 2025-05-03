/**
 * 服务导出文件
 * 集中导出所有API服务，方便引用
 */

// 导入API服务
import api from './api/index';
import { notificationService } from './notificationService';
import { fileService } from './fileService';
import { analyticsService } from './analytics';

// 导出API服务
export {
  api,
  notificationService,
  fileService,
  analyticsService,
};

// 导出API服务的各个模块
export const {
  auth: authApi,
  notes: notesApi,
  knowledgeGraph: knowledgeGraphApi,
  aiAssistant: aiAssistantApi,
  voice: voiceApi,
  search: searchApi,
  reminder: reminderApi,
  community: communityApi,
  canvas: canvasApi,
  code: codeApi,
  user: userApi,
  annotation: annotationApi,
  drawingPath: drawingPathApi
} = api;
