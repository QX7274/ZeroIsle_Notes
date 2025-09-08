/**
 * 手写历史管理器
 * 为每个支持手写的文件类型（普通笔记、PDF、无限画布）实现完整的笔迹历史存储和管理功能
 */

import RNFS from 'react-native-fs';
import { offlineStorageService } from '../offline/offlineStorageService';
import { AdvancedStrokeData } from '../../components/handwriting/UniversalHandwritingEngine';

class HandwritingHistoryManager {
  constructor() {
    this.historyDir = `${RNFS.DocumentDirectoryPath}/handwriting_history`;
    this.versionsDir = `${this.historyDir}/versions`;
    this.backupsDir = `${this.historyDir}/backups`;
    this.initialized = false;
    this.maxVersions = 50; // 每个文件最多保留50个版本
    this.maxBackups = 10; // 最多保留10个备份
    this.compressionEnabled = true;
  }

  /**
   * 初始化历史管理器
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // 创建必要的目录
      const dirs = [this.historyDir, this.versionsDir, this.backupsDir];
      for (const dir of dirs) {
        const exists = await RNFS.exists(dir);
        if (!exists) {
          await RNFS.mkdir(dir);
        }
      }

      this.initialized = true;
      console.log('HandwritingHistoryManager: 初始化完成');
    } catch (error) {
      console.error('HandwritingHistoryManager: 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 保存笔迹历史版本
   */
  async saveVersion(documentId, fileType, pageNumber, strokes, metadata = {}) {
    await this.initialize();

    try {
      const versionId = this.generateVersionId();
      const versionData = {
        versionId,
        documentId,
        fileType,
        pageNumber,
        timestamp: Date.now(),
        strokes: this.serializeStrokes(strokes),
        metadata: {
          ...metadata,
          strokeCount: strokes.length,
          totalPoints: strokes.reduce((sum, stroke) => sum + stroke.points.length, 0),
          bounds: this.calculateBounds(strokes),
          version: '2.0'
        }
      };

      // 压缩数据（如果启用）
      if (this.compressionEnabled) {
        versionData.compressed = true;
        versionData.strokes = this.compressStrokes(versionData.strokes);
      }

      const fileName = `${documentId}_page_${pageNumber}_${versionId}.json`;
      const filePath = `${this.versionsDir}/${fileName}`;

      await RNFS.writeFile(filePath, JSON.stringify(versionData, null, 2), 'utf8');

      // 更新版本索引
      await this.updateVersionIndex(documentId, fileType, pageNumber, versionId, versionData.metadata);

      // 清理旧版本
      await this.cleanupOldVersions(documentId, pageNumber);

      console.log(`HandwritingHistoryManager: 已保存版本 ${versionId} for ${documentId} page ${pageNumber}`);
      return versionId;
    } catch (error) {
      console.error('HandwritingHistoryManager: 保存版本失败:', error);
      throw error;
    }
  }

  /**
   * 加载指定版本的笔迹
   */
  async loadVersion(documentId, pageNumber, versionId) {
    await this.initialize();

    try {
      const fileName = `${documentId}_page_${pageNumber}_${versionId}.json`;
      const filePath = `${this.versionsDir}/${fileName}`;

      if (!(await RNFS.exists(filePath))) {
        console.warn(`HandwritingHistoryManager: 版本文件不存在: ${fileName}`);
        return null;
      }

      const content = await RNFS.readFile(filePath, 'utf8');
      const versionData = JSON.parse(content);

      // 解压缩数据（如果需要）
      let strokes = versionData.strokes;
      if (versionData.compressed) {
        strokes = this.decompressStrokes(strokes);
      }

      return {
        ...versionData,
        strokes: this.deserializeStrokes(strokes)
      };
    } catch (error) {
      console.error('HandwritingHistoryManager: 加载版本失败:', error);
      return null;
    }
  }

  /**
   * 获取文档的版本历史
   */
  async getVersionHistory(documentId, pageNumber) {
    await this.initialize();

    try {
      const indexFile = `${this.historyDir}/${documentId}_page_${pageNumber}_index.json`;
      
      if (!(await RNFS.exists(indexFile))) {
        return [];
      }

      const content = await RNFS.readFile(indexFile, 'utf8');
      const index = JSON.parse(content);
      
      return index.versions || [];
    } catch (error) {
      console.error('HandwritingHistoryManager: 获取版本历史失败:', error);
      return [];
    }
  }

  /**
   * 创建备份
   */
  async createBackup(documentId, fileType, description = '') {
    await this.initialize();

    try {
      const backupId = this.generateBackupId();
      const backupData = {
        backupId,
        documentId,
        fileType,
        timestamp: Date.now(),
        description,
        pages: {}
      };

      // 收集所有页面的最新版本
      const files = await RNFS.readDir(this.versionsDir);
      const documentFiles = files.filter(file => 
        file.name.startsWith(`${documentId}_page_`) && file.name.endsWith('.json')
      );

      for (const file of documentFiles) {
        const match = file.name.match(/page_(\d+)_(.+)\.json$/);
        if (match) {
          const pageNumber = parseInt(match[1]);
          const versionId = match[2];
          
          if (!backupData.pages[pageNumber] || versionId > backupData.pages[pageNumber].versionId) {
            const versionData = await this.loadVersion(documentId, pageNumber, versionId);
            if (versionData) {
              backupData.pages[pageNumber] = {
                versionId,
                timestamp: versionData.timestamp,
                strokeCount: versionData.metadata.strokeCount,
                strokes: versionData.strokes
              };
            }
          }
        }
      }

      const backupFile = `${this.backupsDir}/${documentId}_${backupId}.json`;
      await RNFS.writeFile(backupFile, JSON.stringify(backupData, null, 2), 'utf8');

      // 更新备份索引
      await this.updateBackupIndex(documentId, backupId, backupData);

      // 清理旧备份
      await this.cleanupOldBackups(documentId);

      console.log(`HandwritingHistoryManager: 已创建备份 ${backupId} for ${documentId}`);
      return backupId;
    } catch (error) {
      console.error('HandwritingHistoryManager: 创建备份失败:', error);
      throw error;
    }
  }

  /**
   * 恢复备份
   */
  async restoreBackup(documentId, backupId) {
    await this.initialize();

    try {
      const backupFile = `${this.backupsDir}/${documentId}_${backupId}.json`;
      
      if (!(await RNFS.exists(backupFile))) {
        throw new Error(`备份文件不存在: ${backupId}`);
      }

      const content = await RNFS.readFile(backupFile, 'utf8');
      const backupData = JSON.parse(content);

      const restoredPages = {};
      
      // 恢复每个页面
      for (const [pageNumber, pageData] of Object.entries(backupData.pages)) {
        const versionId = await this.saveVersion(
          documentId,
          backupData.fileType,
          parseInt(pageNumber),
          pageData.strokes,
          {
            restoredFrom: backupId,
            originalTimestamp: pageData.timestamp,
            restoredAt: Date.now()
          }
        );
        
        restoredPages[pageNumber] = versionId;
      }

      console.log(`HandwritingHistoryManager: 已恢复备份 ${backupId} for ${documentId}`);
      return restoredPages;
    } catch (error) {
      console.error('HandwritingHistoryManager: 恢复备份失败:', error);
      throw error;
    }
  }

  /**
   * 生成版本ID
   */
  generateVersionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 6);
    return `v_${timestamp}_${random}`;
  }

  /**
   * 生成备份ID
   */
  generateBackupId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 6);
    return `backup_${timestamp}_${random}`;
  }

  /**
   * 序列化笔迹数据
   */
  serializeStrokes(strokes) {
    return strokes.map(stroke => {
      if (stroke instanceof AdvancedStrokeData) {
        return stroke.toJSON();
      } else {
        // 兼容旧格式
        return {
          id: stroke.id || Date.now() + Math.random(),
          points: stroke.points || [],
          style: stroke.style || {},
          bounds: stroke.bounds || {},
          isComplete: stroke.isComplete || false,
          timestamp: stroke.timestamp || Date.now(),
          transform: stroke.transform || { scale: 1, translateX: 0, translateY: 0 }
        };
      }
    });
  }

  /**
   * 反序列化笔迹数据
   */
  deserializeStrokes(serializedStrokes) {
    return serializedStrokes.map(strokeData => {
      try {
        return AdvancedStrokeData.fromJSON(strokeData);
      } catch (error) {
        console.warn('HandwritingHistoryManager: 反序列化笔迹失败，使用兼容模式:', error);
        // 兼容模式处理
        const stroke = new AdvancedStrokeData(strokeData.style || {});
        stroke.id = strokeData.id || stroke.generateUniqueId();
        stroke.points = strokeData.points || [];
        stroke.bounds = strokeData.bounds || {};
        stroke.isComplete = strokeData.isComplete || false;
        stroke.timestamp = strokeData.timestamp || Date.now();
        stroke.transform = strokeData.transform || { scale: 1, translateX: 0, translateY: 0 };
        return stroke;
      }
    });
  }

  /**
   * 计算笔迹边界
   */
  calculateBounds(strokes) {
    if (strokes.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    strokes.forEach(stroke => {
      if (stroke.bounds) {
        minX = Math.min(minX, stroke.bounds.minX);
        minY = Math.min(minY, stroke.bounds.minY);
        maxX = Math.max(maxX, stroke.bounds.maxX);
        maxY = Math.max(maxY, stroke.bounds.maxY);
      }
    });

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
}

  /**
   * 压缩笔迹数据
   */
  compressStrokes(strokes) {
    // 简化的压缩算法：减少点的精度
    return strokes.map(stroke => ({
      ...stroke,
      points: stroke.points.map(point => ({
        x: Math.round(point.x * 10) / 10,
        y: Math.round(point.y * 10) / 10,
        pressure: Math.round(point.pressure * 100) / 100,
        timestamp: point.timestamp,
        tilt: Math.round(point.tilt * 100) / 100,
        azimuth: Math.round(point.azimuth * 100) / 100
      }))
    }));
  }

  /**
   * 解压缩笔迹数据
   */
  decompressStrokes(strokes) {
    // 解压缩就是直接返回，因为我们的压缩是有损的
    return strokes;
  }

  /**
   * 更新版本索引
   */
  async updateVersionIndex(documentId, fileType, pageNumber, versionId, metadata) {
    const indexFile = `${this.historyDir}/${documentId}_page_${pageNumber}_index.json`;

    let index = { versions: [] };
    if (await RNFS.exists(indexFile)) {
      try {
        const content = await RNFS.readFile(indexFile, 'utf8');
        index = JSON.parse(content);
      } catch (error) {
        console.warn('HandwritingHistoryManager: 读取版本索引失败，创建新索引');
      }
    }

    // 添加新版本
    index.versions.push({
      versionId,
      timestamp: Date.now(),
      metadata,
      fileType
    });

    // 按时间戳排序
    index.versions.sort((a, b) => b.timestamp - a.timestamp);

    await RNFS.writeFile(indexFile, JSON.stringify(index, null, 2), 'utf8');
  }

  /**
   * 更新备份索引
   */
  async updateBackupIndex(documentId, backupId, backupData) {
    const indexFile = `${this.historyDir}/${documentId}_backups_index.json`;

    let index = { backups: [] };
    if (await RNFS.exists(indexFile)) {
      try {
        const content = await RNFS.readFile(indexFile, 'utf8');
        index = JSON.parse(content);
      } catch (error) {
        console.warn('HandwritingHistoryManager: 读取备份索引失败，创建新索引');
      }
    }

    // 添加新备份
    index.backups.push({
      backupId,
      timestamp: backupData.timestamp,
      description: backupData.description,
      pageCount: Object.keys(backupData.pages).length,
      totalStrokes: Object.values(backupData.pages).reduce((sum, page) => sum + page.strokeCount, 0)
    });

    // 按时间戳排序
    index.backups.sort((a, b) => b.timestamp - a.timestamp);

    await RNFS.writeFile(indexFile, JSON.stringify(index, null, 2), 'utf8');
  }

  /**
   * 清理旧版本
   */
  async cleanupOldVersions(documentId, pageNumber) {
    try {
      const versions = await this.getVersionHistory(documentId, pageNumber);

      if (versions.length > this.maxVersions) {
        const versionsToDelete = versions.slice(this.maxVersions);

        for (const version of versionsToDelete) {
          const fileName = `${documentId}_page_${pageNumber}_${version.versionId}.json`;
          const filePath = `${this.versionsDir}/${fileName}`;

          if (await RNFS.exists(filePath)) {
            await RNFS.unlink(filePath);
          }
        }

        // 更新索引
        const indexFile = `${this.historyDir}/${documentId}_page_${pageNumber}_index.json`;
        const updatedIndex = {
          versions: versions.slice(0, this.maxVersions)
        };
        await RNFS.writeFile(indexFile, JSON.stringify(updatedIndex, null, 2), 'utf8');

        console.log(`HandwritingHistoryManager: 清理了 ${versionsToDelete.length} 个旧版本`);
      }
    } catch (error) {
      console.error('HandwritingHistoryManager: 清理旧版本失败:', error);
    }
  }

  /**
   * 清理旧备份
   */
  async cleanupOldBackups(documentId) {
    try {
      const indexFile = `${this.historyDir}/${documentId}_backups_index.json`;

      if (!(await RNFS.exists(indexFile))) return;

      const content = await RNFS.readFile(indexFile, 'utf8');
      const index = JSON.parse(content);

      if (index.backups.length > this.maxBackups) {
        const backupsToDelete = index.backups.slice(this.maxBackups);

        for (const backup of backupsToDelete) {
          const backupFile = `${this.backupsDir}/${documentId}_${backup.backupId}.json`;

          if (await RNFS.exists(backupFile)) {
            await RNFS.unlink(backupFile);
          }
        }

        // 更新索引
        const updatedIndex = {
          backups: index.backups.slice(0, this.maxBackups)
        };
        await RNFS.writeFile(indexFile, JSON.stringify(updatedIndex, null, 2), 'utf8');

        console.log(`HandwritingHistoryManager: 清理了 ${backupsToDelete.length} 个旧备份`);
      }
    } catch (error) {
      console.error('HandwritingHistoryManager: 清理旧备份失败:', error);
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats() {
    await this.initialize();

    try {
      const stats = {
        versions: { count: 0, totalSize: 0 },
        backups: { count: 0, totalSize: 0 },
        total: { count: 0, totalSize: 0 }
      };

      // 统计版本文件
      const versionFiles = await RNFS.readDir(this.versionsDir);
      for (const file of versionFiles) {
        if (file.name.endsWith('.json')) {
          stats.versions.count++;
          stats.versions.totalSize += file.size;
        }
      }

      // 统计备份文件
      const backupFiles = await RNFS.readDir(this.backupsDir);
      for (const file of backupFiles) {
        if (file.name.endsWith('.json')) {
          stats.backups.count++;
          stats.backups.totalSize += file.size;
        }
      }

      stats.total.count = stats.versions.count + stats.backups.count;
      stats.total.totalSize = stats.versions.totalSize + stats.backups.totalSize;

      return stats;
    } catch (error) {
      console.error('HandwritingHistoryManager: 获取存储统计失败:', error);
      return null;
    }
  }

  /**
   * 导出历史数据
   */
  async exportHistory(documentId, format = 'json') {
    await this.initialize();

    try {
      const exportData = {
        documentId,
        exportedAt: Date.now(),
        format,
        versions: {},
        backups: {}
      };

      // 导出所有版本
      const versionFiles = await RNFS.readDir(this.versionsDir);
      for (const file of versionFiles) {
        if (file.name.startsWith(`${documentId}_page_`) && file.name.endsWith('.json')) {
          const content = await RNFS.readFile(file.path, 'utf8');
          const versionData = JSON.parse(content);

          const pageNumber = versionData.pageNumber;
          if (!exportData.versions[pageNumber]) {
            exportData.versions[pageNumber] = [];
          }
          exportData.versions[pageNumber].push(versionData);
        }
      }

      // 导出所有备份
      const backupFiles = await RNFS.readDir(this.backupsDir);
      for (const file of backupFiles) {
        if (file.name.startsWith(`${documentId}_`) && file.name.endsWith('.json')) {
          const content = await RNFS.readFile(file.path, 'utf8');
          const backupData = JSON.parse(content);
          exportData.backups[backupData.backupId] = backupData;
        }
      }

      return exportData;
    } catch (error) {
      console.error('HandwritingHistoryManager: 导出历史数据失败:', error);
      throw error;
    }
  }
}

// 创建单例实例
const handwritingHistoryManager = new HandwritingHistoryManager();

export default handwritingHistoryManager;
