/**
 * 存储服务索引
 * 导出所有存储相关服务
 */
import localStorageService, { STORAGE_KEYS } from './localStorageService';
import offlineDataService from './offlineDataService';
import { default as storageService } from './storageService';

export {
  localStorageService,
  offlineDataService,
  storageService,
  STORAGE_KEYS
};

export default {
  localStorageService,
  offlineDataService,
  storageService,
  STORAGE_KEYS
};
