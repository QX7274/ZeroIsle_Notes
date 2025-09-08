/**
 * 手写文件管理器
 * 负责手写数据与文件的关联保存和加载
 */

import RNFS from 'react-native-fs';
// import { offlineStorageService } from '../offline/offlineStorageService';

class HandwritingFileManager {
  constructor() {
    this.handwritingDir = `${RNFS.DocumentDirectoryPath}/handwriting`;
    this.fileAssociationsDir = `${this.handwritingDir}/associations`;
    this.initialized = false;
  }

  /**
   * 初始化目录结构
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // 创建主目录
      if (!(await RNFS.exists(this.handwritingDir))) {
        await RNFS.mkdir(this.handwritingDir);
      }

      // 创建关联目录
      if (!(await RNFS.exists(this.fileAssociationsDir))) {
        await RNFS.mkdir(this.fileAssociationsDir);
      }

      this.initialized = true;
      console.log('HandwritingFileManager: 初始化完成');
    } catch (error) {
      console.error('HandwritingFileManager: 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 生成文件的唯一标识符
   */
  generateFileId(filePath, fileName) {
    // 使用文件路径和名称生成唯一ID
    const combined = `${filePath}_${fileName}`;
    return combined.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * 保存手写数据与文件的关联
   */
  async saveHandwritingForFile(filePath, fileName, pageNumber, strokes, metadata = {}) {
    await this.initialize();

    try {
      const fileId = this.generateFileId(filePath, fileName);
      const handwritingData = {
        fileId,
        filePath,
        fileName,
        pageNumber,
        strokes: this.serializeStrokes(strokes),
        metadata: {
          ...metadata,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0',
          strokeCount: strokes.length
        }
      };

      // 保存到文件系统
      const associationFile = `${this.fileAssociationsDir}/${fileId}_page_${pageNumber}.json`;
      await RNFS.writeFile(associationFile, JSON.stringify(handwritingData, null, 2), 'utf8');

      // 同时保存到离线存储作为备份
      const storageKey = `handwriting_${fileId}_page_${pageNumber}`;
      // await offlineStorageService.setItem(storageKey, handwritingData);
      // 临时使用文件系统存储
      await this.saveToFileSystem(storageKey, handwritingData);

      // 更新文件索引
      await this.updateFileIndex(fileId, fileName, filePath, pageNumber);

      console.log(`HandwritingFileManager: 已保存手写数据 - 文件: ${fileName}, 页面: ${pageNumber}, 笔迹: ${strokes.length}`);
      return associationFile;
    } catch (error) {
      console.error('HandwritingFileManager: 保存失败:', error);
      throw error;
    }
  }

  /**
   * 加载文件的手写数据
   */
  async loadHandwritingForFile(filePath, fileName, pageNumber) {
    await this.initialize();

    try {
      const fileId = this.generateFileId(filePath, fileName);
      const associationFile = `${this.fileAssociationsDir}/${fileId}_page_${pageNumber}.json`;

      // 首先尝试从文件系统加载
      if (await RNFS.exists(associationFile)) {
        const content = await RNFS.readFile(associationFile, 'utf8');
        const handwritingData = JSON.parse(content);
        
        return {
          ...handwritingData,
          strokes: this.deserializeStrokes(handwritingData.strokes)
        };
      }

      // 如果文件不存在，尝试从离线存储加载
      const storageKey = `handwriting_${fileId}_page_${pageNumber}`;
      // const backupData = await offlineStorageService.getItem(storageKey);
      // 临时使用文件系统读取
      const backupData = await this.loadFromFileSystem(storageKey);
      
      if (backupData) {
        return {
          ...backupData,
          strokes: this.deserializeStrokes(backupData.strokes)
        };
      }

      console.log(`HandwritingFileManager: 未找到手写数据 - 文件: ${fileName}, 页面: ${pageNumber}`);
      return null;
    } catch (error) {
      console.error('HandwritingFileManager: 加载失败:', error);
      return null;
    }
  }

  /**
   * 获取文件的所有页面手写数据
   */
  async getAllPagesForFile(filePath, fileName) {
    await this.initialize();

    try {
      const fileId = this.generateFileId(filePath, fileName);
      const files = await RNFS.readDir(this.fileAssociationsDir);
      
      const pageFiles = files.filter(file => 
        file.name.startsWith(`${fileId}_page_`) && file.name.endsWith('.json')
      );

      const allPages = {};
      
      for (const file of pageFiles) {
        const pageMatch = file.name.match(/_page_(\d+)\.json$/);
        if (pageMatch) {
          const pageNumber = parseInt(pageMatch[1]);
          const handwritingData = await this.loadHandwritingForFile(filePath, fileName, pageNumber);
          if (handwritingData) {
            allPages[pageNumber] = handwritingData;
          }
        }
      }

      return allPages;
    } catch (error) {
      console.error('HandwritingFileManager: 获取所有页面失败:', error);
      return {};
    }
  }

  /**
   * 更新文件索引
   */
  async updateFileIndex(fileId, fileName, filePath, pageNumber) {
    try {
      const indexFile = `${this.handwritingDir}/file_index.json`;
      let index = {};

      // 读取现有索引
      if (await RNFS.exists(indexFile)) {
        const content = await RNFS.readFile(indexFile, 'utf8');
        index = JSON.parse(content);
      }

      // 更新索引
      if (!index[fileId]) {
        index[fileId] = {
          fileName,
          filePath,
          pages: [],
          createdAt: new Date().toISOString()
        };
      }

      if (!index[fileId].pages.includes(pageNumber)) {
        index[fileId].pages.push(pageNumber);
        index[fileId].pages.sort((a, b) => a - b);
      }

      index[fileId].updatedAt = new Date().toISOString();

      // 保存索引
      await RNFS.writeFile(indexFile, JSON.stringify(index, null, 2), 'utf8');
    } catch (error) {
      console.error('HandwritingFileManager: 更新索引失败:', error);
    }
  }

  /**
   * 序列化笔迹数据
   */
  serializeStrokes(strokes) {
    return strokes.map(stroke => ({
      id: stroke.id,
      points: stroke.points,
      style: stroke.style,
      bounds: stroke.bounds,
      isComplete: stroke.isComplete,
      timestamp: stroke.timestamp || Date.now()
    }));
  }

  /**
   * 反序列化笔迹数据
   */
  deserializeStrokes(serializedStrokes) {
    if (!Array.isArray(serializedStrokes)) return [];
    
    return serializedStrokes.map(strokeData => {
      // 重建笔迹对象
      const stroke = {
        id: strokeData.id,
        points: strokeData.points || [],
        style: strokeData.style || {},
        bounds: strokeData.bounds || { minX: 0, minY: 0, maxX: 0, maxY: 0 },
        isComplete: strokeData.isComplete || false,
        timestamp: strokeData.timestamp,
        
        // 添加SVG路径生成方法
        toSVGPath() {
          if (this.points.length === 0) return '';
          
          let path = `M ${this.points[0].x} ${this.points[0].y}`;
          
          if (this.points.length === 1) {
            // 单点，画一个小圆
            path += ` L ${this.points[0].x + 0.1} ${this.points[0].y}`;
          } else {
            // 多点，使用平滑曲线
            for (let i = 1; i < this.points.length; i++) {
              const point = this.points[i];
              path += ` L ${point.x} ${point.y}`;
            }
          }
          
          return path;
        }
      };
      
      return stroke;
    });
  }

  /**
   * 删除文件的手写数据
   */
  async deleteHandwritingForFile(filePath, fileName, pageNumber = null) {
    await this.initialize();

    try {
      const fileId = this.generateFileId(filePath, fileName);

      if (pageNumber !== null) {
        // 删除特定页面
        const associationFile = `${this.fileAssociationsDir}/${fileId}_page_${pageNumber}.json`;
        if (await RNFS.exists(associationFile)) {
          await RNFS.unlink(associationFile);
        }

        const storageKey = `handwriting_${fileId}_page_${pageNumber}`;
        await offlineStorageService.removeItem(storageKey);
      } else {
        // 删除所有页面
        const files = await RNFS.readDir(this.fileAssociationsDir);
        const pageFiles = files.filter(file => file.name.startsWith(`${fileId}_page_`));

        for (const file of pageFiles) {
          await RNFS.unlink(file.path);
          
          const pageMatch = file.name.match(/_page_(\d+)\.json$/);
          if (pageMatch) {
            const page = parseInt(pageMatch[1]);
            const storageKey = `handwriting_${fileId}_page_${page}`;
            // await offlineStorageService.removeItem(storageKey);
            // 临时使用文件系统删除
            await this.deleteFromFileSystem(storageKey);
          }
        }
      }

      console.log(`HandwritingFileManager: 已删除手写数据 - 文件: ${fileName}, 页面: ${pageNumber || '全部'}`);
    } catch (error) {
      console.error('HandwritingFileManager: 删除失败:', error);
    }
  }

  /**
   * 获取所有有手写数据的文件列表
   */
  async getFilesWithHandwriting() {
    await this.initialize();

    try {
      const indexFile = `${this.handwritingDir}/file_index.json`;
      
      if (!(await RNFS.exists(indexFile))) {
        return [];
      }

      const content = await RNFS.readFile(indexFile, 'utf8');
      const index = JSON.parse(content);

      return Object.entries(index).map(([fileId, data]) => ({
        fileId,
        fileName: data.fileName,
        filePath: data.filePath,
        pages: data.pages,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      }));
    } catch (error) {
      console.error('HandwritingFileManager: 获取文件列表失败:', error);
      return [];
    }
  }

  /**
   * 临时文件系统存储方法
   * @param {string} key - 存储键
   * @param {Object} data - 数据
   */
  async saveToFileSystem(key, data) {
    try {
      const filePath = `${this.handwritingDir}/temp_${key}.json`;
      await RNFS.writeFile(filePath, JSON.stringify(data), 'utf8');
    } catch (error) {
      console.warn('HandwritingFileManager: 临时存储失败:', error);
    }
  }

  /**
   * 临时文件系统读取方法
   * @param {string} key - 存储键
   * @returns {Object|null} 数据
   */
  async loadFromFileSystem(key) {
    try {
      const filePath = `${this.handwritingDir}/temp_${key}.json`;
      const exists = await RNFS.exists(filePath);
      if (exists) {
        const content = await RNFS.readFile(filePath, 'utf8');
        return JSON.parse(content);
      }
      return null;
    } catch (error) {
      console.warn('HandwritingFileManager: 临时读取失败:', error);
      return null;
    }
  }

  /**
   * 临时文件系统删除方法
   * @param {string} key - 存储键
   */
  async deleteFromFileSystem(key) {
    try {
      const filePath = `${this.handwritingDir}/temp_${key}.json`;
      const exists = await RNFS.exists(filePath);
      if (exists) {
        await RNFS.unlink(filePath);
      }
    } catch (error) {
      console.warn('HandwritingFileManager: 临时删除失败:', error);
    }
  }
}

export default new HandwritingFileManager();
