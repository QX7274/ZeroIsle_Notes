/**
 * 数据库服务索引
 * 导出所有数据库相关的服务
 */
import sqliteService, { TABLES } from './sqliteService';
import syncService from './syncService';
import dataService from './dataService';

export {
  sqliteService,
  syncService,
  dataService,
  TABLES
};

export default {
  sqliteService,
  syncService,
  dataService,
  TABLES
};
