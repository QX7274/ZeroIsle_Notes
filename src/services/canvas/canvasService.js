import { analyticsService } from '../analytics/analyticsService';
import { infiniteCanvasStorage } from '../offline';
// 已移除 offlineStorageService 导入，现在直接使用 realmService
import realmService from '../database/realmService';

class CanvasService {
  constructor() {
    this.canvasData = null;
    this.undoStack = [];
    this.redoStack = [];
  }

  async createCanvas(title = '新画布') {
    try {
      this.canvasData = {
        id: Date.now().toString(),
        title,
        elements: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.saveCanvas();
      analyticsService.trackCanvasAction('create', { canvasId: this.canvasData.id });
      return this.canvasData;
    } catch (error) {
      console.error('创建画布错误:', error);
      analyticsService.trackError(error, { action: 'create_canvas' });
      throw error;
    }
  }

  async loadCanvas(canvasId) {
    try {
      const canvas = await infiniteCanvasStorage.getCanvas(canvasId);
      if (canvas) {
        this.canvasData = canvas;
        this.undoStack = [];
        this.redoStack = [];
        analyticsService.trackCanvasAction('load', { canvasId });
        return canvas;
      }
      throw new Error('画布不存在');
    } catch (error) {
      console.error('加载画布错误:', error);
      analyticsService.trackError(error, { action: 'load_canvas' });
      throw error;
    }
  }

  async saveCanvas() {
    try {
      if (!this.canvasData) {
        throw new Error('没有活动的画布');
      }

      this.canvasData.updatedAt = new Date().toISOString();
      await infiniteCanvasStorage.saveCanvas(this.canvasData);

      // 同时保存到realmService以保持兼容性
      const realm = await realmService.getRealm();
      realm.write(() => {
        realm.create('InfiniteCanvas', this.canvasData);
      });

      analyticsService.trackCanvasAction('save', { canvasId: this.canvasData.id });
    } catch (error) {
      console.error('保存画布错误:', error);
      analyticsService.trackError(error, { action: 'save_canvas' });
      throw error;
    }
  }

  addElement(element) {
    if (!this.canvasData) {
      throw new Error('没有活动的画布');
    }

    this.undoStack.push(JSON.stringify(this.canvasData.elements));
    this.redoStack = [];

    this.canvasData.elements.push({
      ...element,
      id: Date.now().toString(),
    });

    analyticsService.trackCanvasAction('add_element', {
      canvasId: this.canvasData.id,
      elementType: element.type,
    });
  }

  updateElement(elementId, updates) {
    if (!this.canvasData) {
      throw new Error('没有活动的画布');
    }

    this.undoStack.push(JSON.stringify(this.canvasData.elements));
    this.redoStack = [];

    const elementIndex = this.canvasData.elements.findIndex(e => e.id === elementId);
    if (elementIndex !== -1) {
      this.canvasData.elements[elementIndex] = {
        ...this.canvasData.elements[elementIndex],
        ...updates,
      };
    }

    analyticsService.trackCanvasAction('update_element', {
      canvasId: this.canvasData.id,
      elementId,
    });
  }

  deleteElement(elementId) {
    if (!this.canvasData) {
      throw new Error('没有活动的画布');
    }

    this.undoStack.push(JSON.stringify(this.canvasData.elements));
    this.redoStack = [];

    this.canvasData.elements = this.canvasData.elements.filter(e => e.id !== elementId);

    analyticsService.trackCanvasAction('delete_element', {
      canvasId: this.canvasData.id,
      elementId,
    });
  }

  undo() {
    if (!this.canvasData || this.undoStack.length === 0) {
      return;
    }

    this.redoStack.push(JSON.stringify(this.canvasData.elements));
    this.canvasData.elements = JSON.parse(this.undoStack.pop());

    analyticsService.trackCanvasAction('undo', { canvasId: this.canvasData.id });
  }

  redo() {
    if (!this.canvasData || this.redoStack.length === 0) {
      return;
    }

    this.undoStack.push(JSON.stringify(this.canvasData.elements));
    this.canvasData.elements = JSON.parse(this.redoStack.pop());

    analyticsService.trackCanvasAction('redo', { canvasId: this.canvasData.id });
  }

  async exportToImage() {
    try {
      if (!this.canvasData) {
        throw new Error('没有活动的画布');
      }

      // 这里需要实现实际的导出逻辑
      const imageData = await this._renderCanvasToImage();

      analyticsService.trackCanvasAction('export', {
        canvasId: this.canvasData.id,
        format: 'image',
      });

      return imageData;
    } catch (error) {
      console.error('导出画布错误:', error);
      analyticsService.trackError(error, { action: 'export_canvas' });
      throw error;
    }
  }

  async _renderCanvasToImage() {
    // 使用 react-native-view-shot: 由调用方提供一个可捕获的 ref
    // 若当前服务没有 ref，则抛出更明确的错误
    if (!this.captureRef) {
      throw new Error('未提供可捕获的视图引用 (captureRef)。请在渲染容器处将其通过 canvasService.captureRef = ref 进行注入');
    }
    try {
      const viewShot = require('react-native-view-shot');
      const { captureRef } = viewShot;
      const uri = await captureRef(this.captureRef, {
        format: 'png',
        quality: 0.9,
      });
      return { uri, format: 'png' };
    } catch (e) {
      // 降级方案：直接返回当前内存结构快照（供调试）
      console.warn('captureRef 失败，返回内存结构快照:', e);
      return {
        dataUrl: `data:application/json;base64,${Buffer.from(JSON.stringify(this.canvasData || {})).toString('base64')}`,
        format: 'json',
      };
    }
  }
}

const canvasService = new CanvasService();

module.exports = canvasService;
module.exports.default = canvasService;
module.exports.canvasService = canvasService;
module.exports.CanvasService = CanvasService;
