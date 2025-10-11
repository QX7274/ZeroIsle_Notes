/**
 * 存储服务索引
 * 导出所有存储相关服务
 * 使用MongoDB Realm作为本地存储
 */
import offlineDataService from './offlineDataService';
import { realmService } from '../database/realmService';
import STORAGE_KEYS from '../../constants/storageKeys';

export {
  realmService as realmStorageService,
  offlineDataService,
  realmService as storageService,
  STORAGE_KEYS
};

export default {
  realmStorageService: realmService,
  offlineDataService,
  storageService: realmService,
  STORAGE_KEYS
};
