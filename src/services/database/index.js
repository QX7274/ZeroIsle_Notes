/**
 * 数据库服务索引
 * 导出所有数据库相关的服务
 * 使用MongoDB Realm作为本地存储
 */
import realmService from './realmService';
import { databaseInitService } from './databaseInitService';
import { dataService } from './dataService';
import { mongoDBService } from './mongoDBAdapter';

export {
  realmService,
  databaseInitService,
  dataService,
  mongoDBService
};

export default {
  realmService,
  databaseInitService,
  dataService,
  mongoDBService
};
