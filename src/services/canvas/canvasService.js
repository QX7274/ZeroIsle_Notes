import { analyticsService } from '../analytics/analyticsService';
import { infiniteCanvasStorage, offlineStorageService } from '../offline';

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

      // 同时保存到offlineStorageService以保持兼容性
      await offlineStorageService.saveCanvas(this.canvasData);

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
      elementType: element.type
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
      elementId
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
      elementId
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
        format: 'image'
      });

      return imageData;
    } catch (error) {
      console.error('导出画布错误:', error);
      analyticsService.trackError(error, { action: 'export_canvas' });
      throw error;
    }
  }

  async _renderCanvasToImage() {
    // 实现画布渲染为图片的逻辑
    // 这里需要根据实际使用的画布库来实现
    throw new Error('未实现的画布渲染逻辑');
  }
}

export const canvasService = new CanvasService();
