/**
 * CommonJS版本手写文件管理器
 * 避免ES6模块问题
 */

const RNFS = require('react-native-fs');

class HandwritingFileManagerCJS {
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
      await RNFS.mkdir(this.handwritingDir);
      await RNFS.mkdir(this.fileAssociationsDir);
      this.initialized = true;
      console.log('HandwritingFileManagerCJS: 初始化完成');
    } catch (error) {
      console.error('HandwritingFileManagerCJS: 初始化失败:', error);
    }
  }

  /**
   * 保存手写数据
   */
  async saveHandwriting(fileId, fileName, filePath, pageNumber, strokes) {
    try {
      await this.initialize();
      
      const handwritingData = {
        fileId,
        fileName,
        filePath,
        pageNumber,
        strokes: this.serializeStrokes(strokes),
        metadata: {
          fileType: 'handwriting',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0',
          strokeCount: strokes.length
        }
      };

      const associationFile = `${this.fileAssociationsDir}/${fileId}_page_${pageNumber}.json`;
      await RNFS.writeFile(associationFile, JSON.stringify(handwritingData, null, 2), 'utf8');

      console.log(`HandwritingFileManagerCJS: 已保存手写数据 - 文件: ${fileName}, 页面: ${pageNumber}, 笔迹: ${strokes.length}`);
      return true;
    } catch (error) {
      console.error('HandwritingFileManagerCJS: 保存失败:', error);
      return false;
    }
  }

  /**
   * 加载手写数据
   */
  async loadHandwriting(fileId, fileName, filePath, pageNumber) {
    try {
      await this.initialize();
      
      const associationFile = `${this.fileAssociationsDir}/${fileId}_page_${pageNumber}.json`;
      const exists = await RNFS.exists(associationFile);
      
      if (exists) {
        const content = await RNFS.readFile(associationFile, 'utf8');
        const handwritingData = JSON.parse(content);
        
        return {
          ...handwritingData,
          strokes: this.deserializeStrokes(handwritingData.strokes)
        };
      }

      console.log(`HandwritingFileManagerCJS: 未找到手写数据 - 文件: ${fileName}, 页面: ${pageNumber}`);
      return null;
    } catch (error) {
      console.error('HandwritingFileManagerCJS: 加载失败:', error);
      return null;
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
  deserializeStrokes(strokeDataArray) {
    return strokeDataArray.map(strokeData => ({
      id: strokeData.id,
      points: strokeData.points || [],
      style: strokeData.style || {},
      bounds: strokeData.bounds || { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      isComplete: strokeData.isComplete || false,
      timestamp: strokeData.timestamp,
      toSVGPath: function() {
        if (!this.points || this.points.length === 0) return '';
        
        let path = `M ${this.points[0].x} ${this.points[0].y}`;
        for (let i = 1; i < this.points.length; i++) {
          path += ` L ${this.points[i].x} ${this.points[i].y}`;
        }
        return path;
      }
    }));
  }

  /**
   * 删除手写数据
   */
  async deleteHandwriting(fileId, fileName, filePath, pageNumber = null) {
    try {
      await this.initialize();
      
      if (pageNumber !== null) {
        const associationFile = `${this.fileAssociationsDir}/${fileId}_page_${pageNumber}.json`;
        const exists = await RNFS.exists(associationFile);
        if (exists) {
          await RNFS.unlink(associationFile);
        }
      } else {
        const files = await RNFS.readDir(this.fileAssociationsDir);
        for (const file of files) {
          if (file.name.startsWith(`${fileId}_page_`)) {
            await RNFS.unlink(file.path);
          }
        }
      }

      console.log(`HandwritingFileManagerCJS: 已删除手写数据 - 文件: ${fileName}, 页面: ${pageNumber || '全部'}`);
      return true;
    } catch (error) {
      console.error('HandwritingFileManagerCJS: 删除失败:', error);
      return false;
    }
  }
}

module.exports = new HandwritingFileManagerCJS();
