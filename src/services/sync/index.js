/**
 * 同步服务索引
 * 导出同步相关服务和常量
 */
import syncService from './syncService';
import { SYNC_EVENTS } from './syncEvents';
import * as syncUtils from './syncUtils';

export {
  syncService,
  SYNC_EVENTS,
  syncUtils
};

export default syncService;
