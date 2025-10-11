/**
 * 服务导出文件
 * 集中导出所有服务，方便引用
 */

// 导入API服务
import api from './api/index';

// 导入应用服务
import { configService } from './app/configService';
import { appStateService } from './app/appStateService';

// 导入数据库服务
import {
  realmService,
  databaseInitService,
  dataService
} from './database';

// 导入网络服务
import { networkService, apiService } from './network';

// 导入离线服务
import {
  offlineStorage,
  // 已移除 offlineStorageService 导出，现在直接使用 realmService
  offlineSyncService
} from './offline';

// 导入AI服务
import { aiService, chatHistoryService } from './ai';

// 导入文件服务
import { fileService } from './files/fileService';

// 工具服务
import { logService } from './utils';

// 导入其他服务
import { notificationService } from './notification';
import { audioService } from './audio';
import { calendarIntegrationService } from './calendar';
import { canvasService } from './canvas';
import { codeService } from './code';
import { compressionService } from './compression';
import { groupService } from './group';
import { noteAIService } from './notes/noteAIService';
import { noteToolbarService } from './notes/noteToolbarService';
import { reminderNotificationService } from './reminder';
import { searchService } from './search';
import { thirdPartyAuth } from './auth';
import { translationService } from './translation';
import { ttsService } from './tts';
import { webrtcService } from './webrtc';
import { websocket } from './websocket';
import { analyticsService } from './analytics/analyticsService';

// 导出所有服务
export {
  // API服务
  api,
  apiService,

  // 应用服务
  configService,
  appStateService,

  // 数据库服务
  realmService,
  databaseInitService,
  dataService,

  // 网络服务
  networkService,

  // 离线服务
  offlineStorage,
  // 已移除 offlineStorageService 导出，现在直接使用 realmService
  offlineSyncService,

  // AI服务
  aiService,
  chatHistoryService,

  // 文件服务
  fileService,

  // 工具服务
  logService,

  // 通知服务
  notificationService,

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

  // 群组服务
  groupService,

  // 笔记服务
  noteAIService,
  noteToolbarService,

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

