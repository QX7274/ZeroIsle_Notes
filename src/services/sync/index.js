/**
 * 同步服务索引
 * 导出同步相关服务和常量
 */
import syncService from './syncService';
import syncManager from './syncManager';
import { SYNC_EVENTS } from './syncEvents';
import * as syncUtils from './syncUtils';

export {
  syncService,
  syncManager,
  SYNC_EVENTS,
  syncUtils,
};

// 默认保持 syncService，避免破坏现有调用方；新调用方优先使用 syncManager
export default syncService;
