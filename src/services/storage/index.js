/**
 * 存储服务索引
 * 导出所有存储相关服务
 * 使用MongoDB Realm作为本地存储
 */
import realmStorageService, { STORAGE_KEYS } from './realmStorageService';
import offlineDataService from './offlineDataService';
import { default as storageService } from './storageService';

export {
  realmStorageService,
  offlineDataService,
  storageService,
  STORAGE_KEYS
};

export default {
  realmStorageService,
  offlineDataService,
  storageService,
  STORAGE_KEYS
};
