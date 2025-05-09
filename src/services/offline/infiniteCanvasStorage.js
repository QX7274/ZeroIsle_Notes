/**
 * 无限画布本地存储服务
 * 提供无限画布相关的本地存储功能
 */

import SQLite from 'react-native-sqlite-storage';
import { TABLES, DATABASE_NAME } from '../../constants/database';
import { offlineStorageService } from './offlineStorage';

// 初始化数据库
const db = SQLite.openDatabase(
  { name: DATABASE_NAME, location: 'default' },
  () => console.log('无限画布数据库初始化成功'),
  error => console.error('无限画布数据库初始化失败:', error)
);

/**
 * 无限画布存储服务
 */
const infiniteCanvasStorage = {
  /**
   * 初始化无限画布相关表
   */
  async initTables() {
    try {
      // 创建无限画布表
      await db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${TABLES.INFINITE_CANVAS} (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          title TEXT,
          description TEXT,
          thumbnail TEXT,
          view_state TEXT,
          created_at TEXT,
          updated_at TEXT,
          sync_status INTEGER DEFAULT 0
        )
      `);

      // 创建无限画布元素表
      await db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${TABLES.INFINITE_CANVAS_ELEMENTS} (
          id TEXT PRIMARY KEY,
          canvas_id TEXT,
          layer_id TEXT,
          type TEXT,
          data TEXT,
          created_at TEXT,
          updated_at TEXT,
          FOREIGN KEY (canvas_id) REFERENCES ${TABLES.INFINITE_CANVAS} (id) ON DELETE CASCADE
        )
      `);

      // 创建无限画布图层表
      await db.executeSql(`
        CREATE TABLE IF NOT EXISTS ${TABLES.INFINITE_CANVAS_LAYERS} (
          id TEXT PRIMARY KEY,
          canvas_id TEXT,
          name TEXT,
          visible INTEGER DEFAULT 1,
          locked INTEGER DEFAULT 0,
          order_index INTEGER,
          created_at TEXT,
          updated_at TEXT,
          FOREIGN KEY (canvas_id) REFERENCES ${TABLES.INFINITE_CANVAS} (id) ON DELETE CASCADE
        )
      `);

      console.log('无限画布表初始化成功');
      return true;
    } catch (error) {
      console.error('初始化无限画布表失败:', error);
      return false;
    }
  },

  /**
   * 保存无限画布
   * @param {Object} canvas 画布数据
   */
  async saveCanvas(canvas) {
    try {
      // 参数验证
      if (!canvas) {
        console.error('saveCanvas: canvas为null或undefined');
        return false;
      }

      if (!canvas.id) {
        console.error('saveCanvas: canvas.id为null或undefined');
        return false;
      }

      // 确保用户已登录
      const currentUser = await offlineStorageService.getCurrentUser();
      const userId = currentUser?.id || 'anonymous';

      // 确保所有必要字段都有值，避免null值
      const safeCanvas = {
        id: canvas.id,
        userId: userId,
        title: canvas.title || '新草稿',
        description: canvas.description || '',
        thumbnail: canvas.thumbnail || '',
        viewState: canvas.viewState || {},
        createdAt: canvas.createdAt || new Date().toISOString(),
        updatedAt: canvas.updatedAt || new Date().toISOString()
      };

      // 开始事务
      await db.transaction(async (tx) => {
        // 保存画布基本信息
        await tx.executeSql(
          `INSERT OR REPLACE INTO ${TABLES.INFINITE_CANVAS} (
            id, user_id, title, description, thumbnail, view_state, created_at, updated_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            safeCanvas.id,
            safeCanvas.userId,
            safeCanvas.title,
            safeCanvas.description,
            safeCanvas.thumbnail,
            JSON.stringify(safeCanvas.viewState),
            safeCanvas.createdAt,
            safeCanvas.updatedAt,
            0 // 未同步状态
          ]
        );

        // 删除旧的元素和图层
        await tx.executeSql(`DELETE FROM ${TABLES.INFINITE_CANVAS_ELEMENTS} WHERE canvas_id = ?`, [safeCanvas.id]);
        await tx.executeSql(`DELETE FROM ${TABLES.INFINITE_CANVAS_LAYERS} WHERE canvas_id = ?`, [safeCanvas.id]);

        // 保存图层
        if (canvas.layers && canvas.layers.length > 0) {
          for (let i = 0; i < canvas.layers.length; i++) {
            const layer = canvas.layers[i];

            // 确保图层ID存在
            if (!layer.id) {
              console.warn(`图层缺少ID，跳过保存: ${JSON.stringify(layer)}`);
              continue;
            }

            // 确保所有字段都有值
            const safeLayer = {
              id: layer.id,
              name: layer.name || `图层 ${i + 1}`,
              visible: layer.visible !== undefined ? layer.visible : true,
              locked: layer.locked !== undefined ? layer.locked : false,
              orderIndex: i
            };

            await tx.executeSql(
              `INSERT INTO ${TABLES.INFINITE_CANVAS_LAYERS} (
                id, canvas_id, name, visible, locked, order_index, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                safeLayer.id,
                safeCanvas.id,
                safeLayer.name,
                safeLayer.visible ? 1 : 0,
                safeLayer.locked ? 1 : 0,
                safeLayer.orderIndex,
                new Date().toISOString(),
                new Date().toISOString()
              ]
            );
          }
        }

        // 保存元素
        if (canvas.elements && canvas.elements.length > 0) {
          for (const element of canvas.elements) {
            // 确保元素ID存在
            if (!element.id) {
              console.warn(`元素缺少ID，跳过保存: ${JSON.stringify(element).substring(0, 100)}...`);
              continue;
            }

            // 确保所有字段都有值
            const safeElement = {
              id: element.id,
              layerId: element.layerId || 'default',
              type: element.type || 'unknown'
            };

            // 确保元素数据可以序列化
            let elementData;
            try {
              elementData = JSON.stringify(element);
            } catch (jsonError) {
              console.error(`元素数据序列化失败，跳过保存: ${jsonError.message}`);
              continue;
            }

            await tx.executeSql(
              `INSERT INTO ${TABLES.INFINITE_CANVAS_ELEMENTS} (
                id, canvas_id, layer_id, type, data, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                safeElement.id,
                safeCanvas.id,
                safeElement.layerId,
                safeElement.type,
                elementData,
                new Date().toISOString(),
                new Date().toISOString()
              ]
            );
          }
        }
      });

      console.log('保存无限画布成功:', canvas.id);
      return true;
    } catch (error) {
      console.error('保存无限画布失败:', error);
      return false;
    }
  },

  /**
   * 获取无限画布
   * @param {string} canvasId 画布ID
   */
  async getCanvas(canvasId) {
    try {
      // 防御性检查：确保canvasId不为null或undefined
      if (!canvasId) {
        console.warn('获取画布失败: 未提供画布ID');
        return null;
      }

      // 确保数据库已初始化
      if (!db) {
        console.error('数据库未初始化');
        // 尝试从offlineStorageService获取
        return await this._getCanvasFromOfflineStorage(canvasId);
      }

      // 使用安全的参数值
      const safeCanvasId = String(canvasId || '');

      try {
        // 获取画布基本信息
        const [canvasResult] = await db.executeSql(
          `SELECT * FROM ${TABLES.INFINITE_CANVAS} WHERE id = ?`,
          [safeCanvasId] // 使用安全的参数值
        );

        if (!canvasResult || canvasResult.rows.length === 0) {
          // 如果在SQLite中找不到画布，尝试从offlineStorageService获取
          console.log(`在SQLite中未找到画布 ${safeCanvasId}，尝试从offlineStorageService获取`);
          return await this._getCanvasFromOfflineStorage(canvasId);
        }

        const canvas = canvasResult.rows.item(0);

        // 获取图层
        const [layersResult] = await db.executeSql(
          `SELECT * FROM ${TABLES.INFINITE_CANVAS_LAYERS} WHERE canvas_id = ? ORDER BY order_index`,
          [safeCanvasId] // 使用安全的参数值
        );

        const layers = [];
        for (let i = 0; i < layersResult.rows.length; i++) {
          const layer = layersResult.rows.item(i);
          layers.push({
            id: layer.id,
            name: layer.name,
            visible: layer.visible === 1,
            locked: layer.locked === 1,
            orderIndex: layer.order_index
          });
        }

        // 获取元素
        const [elementsResult] = await db.executeSql(
          `SELECT * FROM ${TABLES.INFINITE_CANVAS_ELEMENTS} WHERE canvas_id = ?`,
          [safeCanvasId] // 使用安全的参数值
        );

        const elements = [];
        for (let i = 0; i < elementsResult.rows.length; i++) {
          try {
            const elementRow = elementsResult.rows.item(i);
            if (elementRow && elementRow.data) {
              const element = JSON.parse(elementRow.data);
              elements.push(element);
            }
          } catch (parseError) {
            console.error('解析元素数据失败:', parseError);
            // 继续处理其他元素
          }
        }

        // 安全解析view_state
        let viewState = {};
        try {
          if (canvas.view_state) {
            viewState = JSON.parse(canvas.view_state);
          }
        } catch (viewStateError) {
          console.error('解析view_state失败:', viewStateError);
        }

        // 构建完整的画布数据
        return {
          id: canvas.id,
          userId: canvas.user_id || 'anonymous',
          title: canvas.title || '无标题画布',
          description: canvas.description || '',
          thumbnail: canvas.thumbnail || '',
          viewState: viewState,
          elements,
          layers: layers.length > 0 ? layers : [{ id: 'default', name: '默认图层', visible: true, locked: false }],
          activeLayer: 'default',
          createdAt: canvas.created_at || new Date().toISOString(),
          updatedAt: canvas.updated_at || new Date().toISOString()
        };
      } catch (sqlError) {
        console.error('SQL查询失败:', sqlError);
        // 尝试从offlineStorageService获取
        return await this._getCanvasFromOfflineStorage(canvasId);
      }
    } catch (error) {
      console.error('从SQLite获取无限画布失败:', error);

      // 尝试从offlineStorageService获取
      console.log(`尝试从offlineStorageService获取画布 ${canvasId}`);
      return await this._getCanvasFromOfflineStorage(canvasId);
    }
  },

  /**
   * 从离线存储服务获取画布（后备方案）
   * @param {string} canvasId 画布ID
   * @private
   */
  async _getCanvasFromOfflineStorage(canvasId) {
    try {
      // 防御性检查：确保canvasId不为null或undefined
      if (!canvasId) {
        console.warn('_getCanvasFromOfflineStorage: canvasId为null或undefined');
        return null;
      }

      // 使用安全的参数值
      const safeCanvasId = String(canvasId || '');

      // 检查offlineStorageService是否已初始化
      if (!offlineStorageService) {
        console.error('offlineStorageService未初始化');
        return this._createEmptyCanvas(safeCanvasId);
      }

      console.log(`从offlineStorageService获取画布 ${safeCanvasId}`);

      // 尝试多种方法获取画布
      let canvas = null;

      // 方法1: 使用getCanvas方法
      if (typeof offlineStorageService.getCanvas === 'function') {
        try {
          console.log(`尝试使用getCanvas方法`);
          canvas = await offlineStorageService.getCanvas(safeCanvasId);
          if (canvas) {
            console.log(`使用getCanvas方法成功获取画布`);
          }
        } catch (getCanvasError) {
          console.error(`调用offlineStorageService.getCanvas失败:`, getCanvasError);
        }
      } else {
        console.warn('offlineStorageService.getCanvas方法未定义');
      }

      // 方法2: 如果方法1失败，尝试使用getCanvasById方法
      if (!canvas && typeof offlineStorageService.getCanvasById === 'function') {
        try {
          console.log(`尝试使用getCanvasById作为备选方法`);
          canvas = await offlineStorageService.getCanvasById(safeCanvasId);
          if (canvas) {
            console.log(`使用getCanvasById方法成功获取画布`);
          }
        } catch (fallbackError) {
          console.error(`备选方法getCanvasById也失败:`, fallbackError);
        }
      }

      // 方法3: 如果方法1和方法2都失败，尝试直接从getCanvases获取
      if (!canvas && typeof offlineStorageService.getCanvases === 'function') {
        try {
          console.log(`尝试从所有画布中查找`);
          const canvases = await offlineStorageService.getCanvases();
          canvas = canvases.find(c => c.id === safeCanvasId);
          if (canvas) {
            console.log(`从所有画布中成功找到画布`);
          }
        } catch (getCanvasesError) {
          console.error(`从所有画布中查找失败:`, getCanvasesError);
        }
      }

      // 如果所有方法都失败，创建一个空画布
      if (!canvas) {
        console.warn(`在offlineStorageService中未找到画布 ${safeCanvasId}，创建空画布`);
        return this._createEmptyCanvas(safeCanvasId);
      }

      console.log(`成功从offlineStorageService获取画布 ${safeCanvasId}`);

      // 确保画布有必要的属性
      return {
        id: canvas.id,
        title: canvas.title || '无标题画布',
        description: canvas.description || '',
        elements: canvas.elements || [],
        layers: canvas.layers || [{ id: 'default', name: '默认图层', visible: true, locked: false }],
        activeLayer: canvas.activeLayer || 'default',
        viewState: canvas.viewState || {},
        createdAt: canvas.createdAt || new Date().toISOString(),
        updatedAt: canvas.updatedAt || new Date().toISOString()
      };
    } catch (error) {
      console.error(`从offlineStorageService获取画布 ${canvasId} 失败:`, error);
      return this._createEmptyCanvas(String(canvasId || ''));
    }
  },

  /**
   * 创建一个空画布（当所有获取方法都失败时使用）
   * @param {string} canvasId 画布ID
   * @private
   */
  _createEmptyCanvas(canvasId) {
    console.log(`创建空画布: ${canvasId}`);
    return {
      id: canvasId,
      title: '新画布',
      description: '',
      elements: [],
      layers: [{ id: 'default', name: '默认图层', visible: true, locked: false }],
      activeLayer: 'default',
      viewState: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  },

  /**
   * 获取用户的所有无限画布
   * @param {string} userId 用户ID
   */
  async getUserCanvases(userId) {
    try {
      // 如果没有提供用户ID，尝试获取当前用户
      if (!userId) {
        const currentUser = await offlineStorageService.getCurrentUser();
        userId = currentUser?.id || 'anonymous';
      }

      // 确保userId不为null
      userId = userId || 'anonymous';
      console.log(`获取用户(${userId})的所有画布`);

      // 获取用户的所有画布
      const [result] = await db.executeSql(
        `SELECT * FROM ${TABLES.INFINITE_CANVAS} WHERE user_id = ? ORDER BY updated_at DESC`,
        [userId]
      );

      const canvases = [];
      for (let i = 0; i < result.rows.length; i++) {
        const canvas = result.rows.item(i);
        canvases.push({
          id: canvas.id,
          userId: canvas.user_id,
          title: canvas.title,
          description: canvas.description,
          thumbnail: canvas.thumbnail,
          createdAt: canvas.created_at,
          updatedAt: canvas.updated_at
        });
      }

      return canvases;
    } catch (error) {
      console.error('获取用户无限画布失败:', error);
      return [];
    }
  },

  /**
   * 删除无限画布
   * @param {string} canvasId 画布ID
   */
  async deleteCanvas(canvasId) {
    try {
      // 参数验证
      if (!canvasId) {
        console.error('deleteCanvas: canvasId为null或undefined');
        return false;
      }

      // 删除画布（级联删除会自动删除相关的元素和图层）
      await db.executeSql(
        `DELETE FROM ${TABLES.INFINITE_CANVAS} WHERE id = ?`,
        [canvasId || ''] // 确保参数不为null
      );

      console.log('删除无限画布成功:', canvasId);

      // 同时从offlineStorageService中删除
      try {
        await offlineStorageService.deleteCanvas(canvasId);
        console.log('从offlineStorageService删除画布成功:', canvasId);
      } catch (offlineError) {
        console.warn('从offlineStorageService删除画布失败:', offlineError);
        // 继续执行，不影响主流程
      }

      return true;
    } catch (error) {
      console.error('删除无限画布失败:', error);
      return false;
    }
  }
};

export default infiniteCanvasStorage;
