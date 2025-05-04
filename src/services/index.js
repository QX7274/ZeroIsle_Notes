/**
 * 服务导出文件
 * 集中导出所有服务，方便引用
 */

// 导入API服务
import api from './api/index';

// 导入其他服务
import { fileService } from './file';
import { notificationService } from './notification';
import { storageService } from './storage';
import { networkService } from './network';
import { audioService } from './audio';
import { calendarIntegrationService } from './calendar';
import { canvasService } from './canvas';
import { codeService } from './code';
import { compressionService } from './compression';
import { exportService } from './export';
import { groupService } from './group';
import { noteAIService, noteToolbarService } from './note';
import { offlineAIService, offlineStorage } from './offline';
import { reminderNotificationService } from './reminder';
import { searchService } from './search';
import { thirdPartyAuth } from './auth';
import { translationService } from './translation';
import { ttsService } from './tts';
import { webrtcService } from './webrtc';
import { websocket } from './websocket';
import { aiHistoryService } from './ai_history';
import { analyticsService } from './analytics/analyticsService';

// 导出所有服�?
export {
  // API服务
  api,

  // 文件服务
  fileService,

  // 通知服务
  notificationService,

  // 存储服务
  storageService,

  // 网络服务
  networkService,

  // 音频服务
  audioService,

  // 日历服务
  calendarIntegrationService,

  // 画布服务
  canvasService,

  // 代码服务
  codeService,

  // 压缩服务
  compressionService,

  // 导出服务
  exportService,

  // 群组服务
  groupService,

  // 笔记服务
  noteAIService,
  noteToolbarService,

  // 离线服务
  offlineAIService,
  offlineStorage,

  // 提醒服务
  reminderNotificationService,

  // 搜索服务
  searchService,

  // 认证服务
  thirdPartyAuth,

  // 翻译服务
  translationService,

  // TTS服务
  ttsService,

  // WebRTC服务
  webrtcService,

  // WebSocket服务
  websocket,

  // AI历史服务
  aiHistoryService,

  // 分析服务
  analyticsService,
};

// 导出API服务的各个模�?
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

