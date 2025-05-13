/**
 * 无限画布存储服务
 * 提供基于MongoDB Realm的无限画布数据存储和同步功能
 */

import { realmStorageService } from '../storage/realmStorageService';
import { offlineSyncService } from './offlineSyncService';
import { logService } from '../utils/logService';
import STORAGE_KEYS from '../../constants/storageKeys';

class InfiniteCanvasStorage {
  constructor() {
    this.isInitialized = false;
    this.canvasCache = [];
  }

  /**
   * 初始化存储服务
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        logService.info('无限画布存储服务已经初始化');
        return;
      }

      logService.info('初始化无限画布存储服务');
      
      // 初始化表
      await this.initTables();
      
      // 加载缓存
      await this.loadCache();
      
      this.isInitialized = true;
      logService.info('无限画布存储服务初始化完成');
    } catch (error) {
      logService.error('初始化无限画布存储服务失败', error);
      throw error;
    }
  }

  /**
   * 初始化数据表
   */
  async initTables() {
    try {
      logService.info('初始化无限画布数据表');
      // 使用Realm存储，不需要创建表
      // 只需确保缓存已加载
      await this.loadCache();
      return true;
    } catch (error) {
      logService.error('初始化无限画布数据表失败', error);
      return false;
    }
  }

  /**
   * 加载缓存
   */
  async loadCache() {
    try {
      logService.info('加载无限画布缓存');
      const canvasesJson = await realmStorageService.getItem(STORAGE_KEYS.CANVAS_CACHE);
      
      if (canvasesJson) {
        this.canvasCache = JSON.parse(canvasesJson);
        logService.info(`已加载${this.canvasCache.length}个画布到缓存`);
      } else {
        this.canvasCache = [];
        logService.info('无限画布缓存为空');
      }
      
      return this.canvasCache;
    } catch (error) {
      logService.error('加载无限画布缓存失败', error);
      this.canvasCache = [];
      return [];
    }
  }

  /**
   * 保存缓存
   */
  async saveCache() {
    try {
      logService.info(`保存${this.canvasCache.length}个画布到缓存`);
      await realmStorageService.setItem(STORAGE_KEYS.CANVAS_CACHE, JSON.stringify(this.canvasCache));
      return true;
    } catch (error) {
      logService.error('保存无限画布缓存失败', error);
      return false;
    }
  }

  /**
   * 获取画布
   * @param {string} canvasId 画布ID
   * @returns {Object} 画布对象
   */
  async getCanvas(canvasId) {
    try {
      logService.info(`获取画布: ${canvasId}`);
      
      // 确保缓存已加载
      if (this.canvasCache.length === 0) {
        await this.loadCache();
      }
      
      // 从缓存中查找
      const canvas = this.canvasCache.find(c => c.id === canvasId);
      
      if (canvas) {
        logService.info(`找到画布: ${canvasId}`);
        return canvas;
      }
      
      logService.warn(`未找到画布: ${canvasId}`);
      return null;
    } catch (error) {
      logService.error(`获取画布失败: ${canvasId}`, error);
      return null;
    }
  }

  /**
   * 获取所有画布
   * @returns {Array} 画布数组
   */
  async getCanvases() {
    try {
      logService.info('获取所有画布');
      
      // 确保缓存已加载
      if (this.canvasCache.length === 0) {
        await this.loadCache();
      }
      
      return this.canvasCache;
    } catch (error) {
      logService.error('获取所有画布失败', error);
      return [];
    }
  }

  /**
   * 保存画布
   * @param {Object} canvas 画布对象
   * @returns {boolean} 是否成功
   */
  async saveCanvas(canvas) {
    try {
      logService.info(`保存画布: ${canvas.id}`);
      
      // 确保缓存已加载
      if (this.canvasCache.length === 0) {
        await this.loadCache();
      }
      
      // 更新或添加画布
      const index = this.canvasCache.findIndex(c => c.id === canvas.id);
      
      if (index !== -1) {
        this.canvasCache[index] = canvas;
      } else {
        this.canvasCache.push(canvas);
      }
      
      // 保存缓存
      await this.saveCache();
      
      // 同步到服务器
      offlineSyncService.syncCanvas(canvas);
      
      return true;
    } catch (error) {
      logService.error(`保存画布失败: ${canvas.id}`, error);
      return false;
    }
  }

  /**
   * 删除画布
   * @param {string} canvasId 画布ID
   * @returns {boolean} 是否成功
   */
  async deleteCanvas(canvasId) {
    try {
      logService.info(`删除画布: ${canvasId}`);
      
      // 确保缓存已加载
      if (this.canvasCache.length === 0) {
        await this.loadCache();
      }
      
      // 从缓存中删除
      this.canvasCache = this.canvasCache.filter(c => c.id !== canvasId);
      
      // 保存缓存
      await this.saveCache();
      
      // 同步到服务器
      offlineSyncService.deleteCanvas(canvasId);
      
      return true;
    } catch (error) {
      logService.error(`删除画布失败: ${canvasId}`, error);
      return false;
    }
  }
}

const infiniteCanvasStorage = new InfiniteCanvasStorage();
export default infiniteCanvasStorage;
