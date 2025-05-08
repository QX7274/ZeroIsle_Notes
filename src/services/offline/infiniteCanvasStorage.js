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
      // 确保用户已登录
      const currentUser = await offlineStorageService.getCurrentUser();
      const userId = currentUser?.id || 'anonymous';

      // 开始事务
      await db.transaction(async (tx) => {
        // 保存画布基本信息
        await tx.executeSql(
          `INSERT OR REPLACE INTO ${TABLES.INFINITE_CANVAS} (
            id, user_id, title, description, thumbnail, view_state, created_at, updated_at, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            canvas.id,
            userId,
            canvas.title || '新草稿',
            canvas.description || '',
            canvas.thumbnail || null,
            JSON.stringify(canvas.viewState || {}),
            canvas.createdAt || new Date().toISOString(),
            canvas.updatedAt || new Date().toISOString(),
            0 // 未同步状态
          ]
        );

        // 删除旧的元素和图层
        await tx.executeSql(`DELETE FROM ${TABLES.INFINITE_CANVAS_ELEMENTS} WHERE canvas_id = ?`, [canvas.id]);
        await tx.executeSql(`DELETE FROM ${TABLES.INFINITE_CANVAS_LAYERS} WHERE canvas_id = ?`, [canvas.id]);

        // 保存图层
        if (canvas.layers && canvas.layers.length > 0) {
          for (let i = 0; i < canvas.layers.length; i++) {
            const layer = canvas.layers[i];
            await tx.executeSql(
              `INSERT INTO ${TABLES.INFINITE_CANVAS_LAYERS} (
                id, canvas_id, name, visible, locked, order_index, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                layer.id,
                canvas.id,
                layer.name || `图层 ${i + 1}`,
                layer.visible ? 1 : 0,
                layer.locked ? 1 : 0,
                i,
                new Date().toISOString(),
                new Date().toISOString()
              ]
            );
          }
        }

        // 保存元素
        if (canvas.elements && canvas.elements.length > 0) {
          for (const element of canvas.elements) {
            await tx.executeSql(
              `INSERT INTO ${TABLES.INFINITE_CANVAS_ELEMENTS} (
                id, canvas_id, layer_id, type, data, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                element.id,
                canvas.id,
                element.layerId || 'default',
                element.type,
                JSON.stringify(element),
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
      // 获取画布基本信息
      const [canvasResult] = await db.executeSql(
        `SELECT * FROM ${TABLES.INFINITE_CANVAS} WHERE id = ?`,
        [canvasId]
      );

      if (canvasResult.rows.length === 0) {
        return null;
      }

      const canvas = canvasResult.rows.item(0);

      // 获取图层
      const [layersResult] = await db.executeSql(
        `SELECT * FROM ${TABLES.INFINITE_CANVAS_LAYERS} WHERE canvas_id = ? ORDER BY order_index`,
        [canvasId]
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
        [canvasId]
      );

      const elements = [];
      for (let i = 0; i < elementsResult.rows.length; i++) {
        const elementRow = elementsResult.rows.item(i);
        const element = JSON.parse(elementRow.data);
        elements.push(element);
      }

      // 构建完整的画布数据
      return {
        id: canvas.id,
        userId: canvas.user_id,
        title: canvas.title,
        description: canvas.description,
        thumbnail: canvas.thumbnail,
        viewState: JSON.parse(canvas.view_state || '{}'),
        elements,
        layers: layers.length > 0 ? layers : [{ id: 'default', name: '默认图层', visible: true, locked: false }],
        activeLayer: 'default',
        createdAt: canvas.created_at,
        updatedAt: canvas.updated_at
      };
    } catch (error) {
      console.error('获取无限画布失败:', error);
      return null;
    }
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
      // 删除画布（级联删除会自动删除相关的元素和图层）
      await db.executeSql(
        `DELETE FROM ${TABLES.INFINITE_CANVAS} WHERE id = ?`,
        [canvasId]
      );

      console.log('删除无限画布成功:', canvasId);
      return true;
    } catch (error) {
      console.error('删除无限画布失败:', error);
      return false;
    }
  }
};

export default infiniteCanvasStorage;
