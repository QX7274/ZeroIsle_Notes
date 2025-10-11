/**
 * 无限画布存储服务 - 提供基于MongoDB的无限画布数据存储功能
 */

import realmService from '../database/realmService';
import { logService } from '../../utils/logService';

class InfiniteCanvasStorage {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.collectionName = 'infinite_canvas';
  }

  /**
   * 初始化无限画布存储服务
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 初始化Realm服务
        await realmService.initialize();

        this.initialized = true;
        console.log('无限画布存储服务初始化成功');
        resolve();
      } catch (error) {
        console.error('无限画布存储服务初始化失败:', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 初始化数据表（兼容旧版本API）
   */
  async initTables() {
    return this.initialize();
  }

  /**
   * 保存画布数据
   * @param {Object} canvasData - 画布数据
   * @returns {Promise<boolean>} 保存是否成功
   */
  async saveCanvas(canvasData) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!canvasData || !canvasData.id) {
        throw new Error('画布数据无效：缺少ID');
      }

      // 准备保存的数据
      const saveData = {
        _id: canvasData._id || canvasData.id,
        id: canvasData.id,
        title: canvasData.title || '无标题画布',
        type: 'canvas',
        canvasStyle: canvasData.canvasStyle || 'white',
        scale: canvasData.scale || 1,
        translateX: canvasData.translateX || 0,
        translateY: canvasData.translateY || 0,
        paths: canvasData.paths || [],
        images: canvasData.images || [],
        created_at: canvasData.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 使用realmService保存数据
      await realmService.saveData(this.collectionName, saveData);

      console.log('画布保存成功:', saveData.title);
      return true;
    } catch (error) {
      console.error('保存画布失败:', error);
      logService.error('保存画布失败', { error: error.message, canvasId: canvasData?.id });
      return false;
    }
  }

  /**
   * 获取画布数据
   * @param {string} canvasId - 画布ID
   * @returns {Promise<Object|null>} 画布数据
   */
  async getCanvas(canvasId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!canvasId) {
        throw new Error('画布ID不能为空');
      }

      const canvas = await realmService.getData(this.collectionName, canvasId);
      
      if (canvas) {
        console.log('获取画布成功:', canvas.title);
        return canvas;
      } else {
        console.log('画布不存在:', canvasId);
        return null;
      }
    } catch (error) {
      console.error('获取画布失败:', error);
      logService.error('获取画布失败', { error: error.message, canvasId });
      return null;
    }
  }

  /**
   * 获取所有画布
   * @returns {Promise<Array>} 画布列表
   */
  async getCanvases() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const canvases = await realmService.getAllData(this.collectionName);
      
      // 按更新时间排序
      const sortedCanvases = canvases.sort((a, b) => {
        const timeA = new Date(a.updated_at || a.created_at || 0);
        const timeB = new Date(b.updated_at || b.created_at || 0);
        return timeB - timeA;
      });

      console.log(`获取到 ${sortedCanvases.length} 个画布`);
      return sortedCanvases;
    } catch (error) {
      console.error('获取画布列表失败:', error);
      logService.error('获取画布列表失败', { error: error.message });
      return [];
    }
  }

  /**
   * 删除画布
   * @param {string} canvasId - 画布ID
   * @returns {Promise<boolean>} 删除是否成功
   */
  async deleteCanvas(canvasId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!canvasId) {
        throw new Error('画布ID不能为空');
      }

      await realmService.deleteData(this.collectionName, canvasId);
      
      console.log('画布删除成功:', canvasId);
      return true;
    } catch (error) {
      console.error('删除画布失败:', error);
      logService.error('删除画布失败', { error: error.message, canvasId });
      return false;
    }
  }

  /**
   * 更新画布数据
   * @param {string} canvasId - 画布ID
   * @param {Object} updateData - 更新的数据
   * @returns {Promise<boolean>} 更新是否成功
   */
  async updateCanvas(canvasId, updateData) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!canvasId || !updateData) {
        throw new Error('画布ID和更新数据不能为空');
      }

      // 添加更新时间
      updateData.updated_at = new Date().toISOString();

      await realmService.updateData(this.collectionName, canvasId, updateData);
      
      console.log('画布更新成功:', canvasId);
      return true;
    } catch (error) {
      console.error('更新画布失败:', error);
      logService.error('更新画布失败', { error: error.message, canvasId });
      return false;
    }
  }

  /**
   * 清空所有画布数据
   * @returns {Promise<boolean>} 清空是否成功
   */
  async clearAllCanvases() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      await realmService.clearCollection(this.collectionName);
      
      console.log('所有画布数据已清空');
      return true;
    } catch (error) {
      console.error('清空画布数据失败:', error);
      logService.error('清空画布数据失败', { error: error.message });
      return false;
    }
  }

  /**
   * 获取画布数量
   * @returns {Promise<number>} 画布数量
   */
  async getCanvasCount() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const canvases = await this.getCanvases();
      return canvases.length;
    } catch (error) {
      console.error('获取画布数量失败:', error);
      return 0;
    }
  }
}

// 导出单例
const infiniteCanvasStorage = new InfiniteCanvasStorage();
export default infiniteCanvasStorage;
