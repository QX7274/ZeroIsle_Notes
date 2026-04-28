/**
 * 自动备份服务
 * 提供定期备份、增量备份和数据恢复功能
 */

import realmService from '../database/realmService';
import { logService } from '../../utils/logService';
import { fileService } from '../files/fileService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../constants/storageKeys';

class AutoBackupService {
  constructor() {
    this.initialized = false;
    this.backupTimer = null;
    this.backupInterval = 30 * 60 * 1000; // 30分钟
    this.maxBackups = 10; // 最多保留10个备份
    this.backupInProgress = false;
    this.lastBackupTime = null;
    this.backupStats = {
      totalBackups: 0,
      successfulBackups: 0,
      failedBackups: 0,
      lastBackupSize: 0,
    };
  }

  /**
   * 初始化自动备份服务
   */
  async initialize() {
    if (this.initialized) {return;}

    try {
      await realmService.initialize();
      await fileService.initialize();

      // 加载备份统计信息
      await this.loadBackupStats();

      this.initialized = true;
      logService.info('自动备份服务初始化成功');

      // 启动自动备份
      this.startAutoBackup();
    } catch (error) {
      logService.error('自动备份服务初始化失败', error);
      throw error;
    }
  }

  /**
   * 启动自动备份
   */
  startAutoBackup() {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    this.backupTimer = setInterval(async () => {
      try {
        await this.performBackup();
      } catch (error) {
        logService.error('自动备份失败', error);
      }
    }, this.backupInterval);

    logService.info(`自动备份已启动，间隔: ${this.backupInterval / 1000 / 60} 分钟`);
  }

  /**
   * 停止自动备份
   */
  stopAutoBackup() {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
      logService.info('自动备份已停止');
    }
  }

  /**
   * 执行备份
   */
  async performBackup() {
    if (this.backupInProgress) {
      logService.warn('备份正在进行中，跳过此次备份');
      return;
    }

    try {
      this.backupInProgress = true;
      const startTime = Date.now();

      logService.info('开始执行自动备份...');

      // 创建备份
      const backup = await this.createBackup();

      // 保存备份信息
      await this.saveBackupInfo(backup);

      // 清理旧备份
      await this.cleanupOldBackups();

      // 更新统计信息
      this.backupStats.totalBackups++;
      this.backupStats.successfulBackups++;
      this.backupStats.lastBackupSize = backup.size;
      this.lastBackupTime = new Date();

      await this.saveBackupStats();

      const duration = Date.now() - startTime;
      logService.info(`自动备份完成，耗时: ${duration}ms，大小: ${this.formatFileSize(backup.size)}`);

    } catch (error) {
      logService.error('自动备份失败', error);
      this.backupStats.failedBackups++;
      await this.saveBackupStats();
    } finally {
      this.backupInProgress = false;
    }
  }

  /**
   * 创建备份
   */
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `backup_${timestamp}`;

    try {
      // 获取所有笔记数据
      const notes = await this.exportNotes();

      // 获取所有文件信息
      const files = await this.exportFiles();

      // 获取用户设置
      const settings = await this.exportSettings();

      // 创建备份对象
      const backup = {
        id: backupId,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        data: {
          notes,
          files,
          settings,
        },
        metadata: {
          notesCount: notes.length,
          filesCount: files.length,
          totalSize: this.calculateBackupSize(notes, files, settings),
        },
      };

      // 保存备份到本地存储
      const backupPath = await this.saveBackupToStorage(backup);

      return {
        id: backupId,
        path: backupPath,
        size: backup.metadata.totalSize,
        timestamp: backup.timestamp,
        notesCount: backup.metadata.notesCount,
        filesCount: backup.metadata.filesCount,
      };

    } catch (error) {
      logService.error('创建备份失败', error);
      throw error;
    }
  }

  /**
   * 导出笔记数据
   */
  async exportNotes() {
    try {
      const realm = await realmService.getRealm();
      const notes = realm.objects('Note').filtered('is_deleted == false');

      const exportedNotes = [];
      for (const note of notes) {
        exportedNotes.push({
          _id: note._id,
          title: note.title,
          content: note.content,
          type: note.type,
          tags: note.tags,
          category_id: note.category_id,
          color: note.color,
          is_favorite: note.is_favorite,
          is_archived: note.is_archived,
          created_at: note.created_at,
          updated_at: note.updated_at,
          user_id: note.user_id,
          metadata: note.metadata,

          // 文件相关字段
          file_path: note.file_path,
          file_uri: note.file_uri,
          file_name: note.file_name,
          file_size: note.file_size,
          file_type: note.file_type,
          file_hash: note.file_hash,
          thumbnail_path: note.thumbnail_path,

          // 画布相关字段
          strokeData: note.strokeData,
          viewport: note.viewport,
          canvasStyle: note.canvasStyle,
          paths: note.paths,
          images: note.images,
          canvasVersion: note.canvasVersion,

          // 分页笔记字段
          currentPage: note.currentPage,
          totalPages: note.totalPages,
          pageStyle: note.pageStyle,
          pages: note.pages,
          scale: note.scale,

          // PDF相关字段
          pdfPath: note.pdfPath,
          pdfCurrentPage: note.pdfCurrentPage,
          pdfTotalPages: note.pdfTotalPages,
          pdfScale: note.pdfScale,
          pdfAnnotations: note.pdfAnnotations,
          pdfScrollPosition: note.pdfScrollPosition,
          pdfBookmarks: note.pdfBookmarks,

          // 音频/视频字段
          audioPath: note.audioPath,
          videoPath: note.videoPath,
          duration: note.duration,
          audioTranscription: note.audioTranscription,
          videoThumbnails: note.videoThumbnails,

          // 图片字段
          imagePath: note.imagePath,
          imageWidth: note.imageWidth,
          imageHeight: note.imageHeight,
          imageFormat: note.imageFormat,

          // Word文档字段
          wordPath: note.wordPath,
          wordContent: note.wordContent,
          wordMetadata: note.wordMetadata,

          // 数据完整性字段
          dataHash: note.dataHash,
          backupCount: note.backupCount,
          lastBackupAt: note.lastBackupAt,
          syncStatus: note.syncStatus,
          syncError: note.syncError,
          retryCount: note.retryCount,
          lastRetryAt: note.lastRetryAt,
        });
      }

      return exportedNotes;
    } catch (error) {
      logService.error('导出笔记数据失败', error);
      throw error;
    }
  }

  /**
   * 导出文件信息
   */
  async exportFiles() {
    try {
      const realm = await realmService.getRealm();
      const files = realm.objects('File').filtered('is_deleted == false');

      const exportedFiles = [];
      for (const file of files) {
        exportedFiles.push({
          _id: file._id,
          name: file.name,
          original_name: file.original_name,
          path: file.path,
          size: file.size,
          mime_type: file.mime_type,
          extension: file.extension,
          type: file.type,
          hash: file.hash,
          thumbnail_path: file.thumbnail_path,
          metadata: file.metadata,
          storage_location: file.storage_location,
          cloud_path: file.cloud_path,
          cloud_provider: file.cloud_provider,
          user_id: file.user_id,
          note_id: file.note_id,
          created_at: file.created_at,
          updated_at: file.updated_at,
          last_accessed_at: file.last_accessed_at,
          is_public: file.is_public,
          public_url: file.public_url,
          expiry_date: file.expiry_date,
          tags: file.tags,
        });
      }

      return exportedFiles;
    } catch (error) {
      logService.error('导出文件信息失败', error);
      throw error;
    }
  }

  /**
   * 导出用户设置
   */
  async exportSettings() {
    try {
      const settings = {};

      // 从AsyncStorage导出设置
      const keys = await AsyncStorage.getAllKeys();
      for (const key of keys) {
        if (key.startsWith('zeroisle_')) {
          const value = await AsyncStorage.getItem(key);
          settings[key] = value;
        }
      }

      return settings;
    } catch (error) {
      logService.error('导出用户设置失败', error);
      throw error;
    }
  }

  /**
   * 保存备份到存储
   */
  async saveBackupToStorage(backup) {
    try {
      const backupData = JSON.stringify(backup, null, 2);
      const backupPath = `backups/${backup.id}.json`;

      await fileService.writeFile(backupPath, backupData);

      return backupPath;
    } catch (error) {
      logService.error('保存备份到存储失败', error);
      throw error;
    }
  }

  /**
   * 计算备份大小
   */
  calculateBackupSize(notes, files, settings) {
    let size = 0;

    // 计算笔记数据大小
    size += JSON.stringify(notes).length;

    // 计算文件信息大小
    size += JSON.stringify(files).length;

    // 计算设置大小
    size += JSON.stringify(settings).length;

    return size;
  }

  /**
   * 保存备份信息
   */
  async saveBackupInfo(backup) {
    try {
      const backupInfo = {
        id: backup.id,
        path: backup.path,
        size: backup.size,
        timestamp: backup.timestamp,
        notesCount: backup.notesCount,
        filesCount: backup.filesCount,
      };

      const existingBackups = await this.getBackupList();
      existingBackups.push(backupInfo);

      // 按时间排序
      existingBackups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      await AsyncStorage.setItem(STORAGE_KEYS.BACKUP_INFO, JSON.stringify(existingBackups));
    } catch (error) {
      logService.error('保存备份信息失败', error);
      throw error;
    }
  }

  /**
   * 获取备份列表
   */
  async getBackupList() {
    try {
      const backupInfo = await AsyncStorage.getItem(STORAGE_KEYS.BACKUP_INFO);
      return backupInfo ? JSON.parse(backupInfo) : [];
    } catch (error) {
      logService.error('获取备份列表失败', error);
      throw error;
    }
  }

  /**
   * 清理旧备份
   */
  async cleanupOldBackups() {
    try {
      const backups = await this.getBackupList();

      if (backups.length <= this.maxBackups) {
        return;
      }

      // 删除多余的备份
      const backupsToDelete = backups.slice(this.maxBackups);

      for (const backup of backupsToDelete) {
        try {
          await fileService.deleteFile(backup.path);
          logService.info(`删除旧备份: ${backup.id}`);
        } catch (error) {
          logService.error(`删除备份失败: ${backup.id}`, error);
        }
      }

      // 更新备份列表
      const remainingBackups = backups.slice(0, this.maxBackups);
      await AsyncStorage.setItem(STORAGE_KEYS.BACKUP_INFO, JSON.stringify(remainingBackups));

    } catch (error) {
      logService.error('清理旧备份失败', error);
    }
  }

  /**
   * 恢复备份
   */
  async restoreBackup(backupId) {
    try {
      logService.info(`开始恢复备份: ${backupId}`);

      // 获取备份信息
      const backups = await this.getBackupList();
      const backup = backups.find(b => b.id === backupId);

      if (!backup) {
        throw new Error(`备份不存在: ${backupId}`);
      }

      // 读取备份数据
      const backupData = await fileService.readFile(backup.path);
      const backupObj = JSON.parse(backupData);

      // 恢复笔记数据
      await this.restoreNotes(backupObj.data.notes);

      // 恢复文件信息
      await this.restoreFiles(backupObj.data.files);

      // 恢复用户设置
      await this.restoreSettings(backupObj.data.settings);

      logService.info(`备份恢复完成: ${backupId}`);

      return {
        success: true,
        message: '备份恢复成功',
        restoredNotes: backupObj.data.notes.length,
        restoredFiles: backupObj.data.files.length,
      };

    } catch (error) {
      logService.error(`恢复备份失败: ${backupId}`, error);
      throw error;
    }
  }

  /**
   * 恢复笔记数据
   */
  async restoreNotes(notes) {
    try {
      const realm = await realmService.getRealm();

      realm.write(() => {
        // 清空现有笔记
        const existingNotes = realm.objects('Note');
        realm.delete(existingNotes);

        // 恢复笔记
        for (const noteData of notes) {
          // 使用'modified'模式：如果Note已存在则更新，不存在则创建
          realm.create('Note', noteData, 'modified');
        }
      });

      logService.info(`恢复了 ${notes.length} 个笔记`);
    } catch (error) {
      logService.error('恢复笔记数据失败', error);
      throw error;
    }
  }

  /**
   * 恢复文件信息
   */
  async restoreFiles(files) {
    try {
      const realm = await realmService.getRealm();

      realm.write(() => {
        // 清空现有文件
        const existingFiles = realm.objects('File');
        realm.delete(existingFiles);

        // 恢复文件
        for (const fileData of files) {
          realm.create('File', fileData);
        }
      });

      logService.info(`恢复了 ${files.length} 个文件信息`);
    } catch (error) {
      logService.error('恢复文件信息失败', error);
      throw error;
    }
  }

  /**
   * 恢复用户设置
   */
  async restoreSettings(settings) {
    try {
      // 恢复设置到AsyncStorage
      for (const [key, value] of Object.entries(settings)) {
        await AsyncStorage.setItem(key, value);
      }

      logService.info(`恢复了 ${Object.keys(settings).length} 个设置项`);
    } catch (error) {
      logService.error('恢复用户设置失败', error);
      throw error;
    }
  }

  /**
   * 加载备份统计信息
   */
  async loadBackupStats() {
    try {
      const stats = await AsyncStorage.getItem('backup_stats');
      if (stats) {
        this.backupStats = { ...this.backupStats, ...JSON.parse(stats) };
      }

      const lastBackupTime = await AsyncStorage.getItem('last_backup_time');
      if (lastBackupTime) {
        this.lastBackupTime = new Date(lastBackupTime);
      }
    } catch (error) {
      logService.error('加载备份统计信息失败', error);
    }
  }

  /**
   * 保存备份统计信息
   */
  async saveBackupStats() {
    try {
      await AsyncStorage.setItem('backup_stats', JSON.stringify(this.backupStats));

      if (this.lastBackupTime) {
        await AsyncStorage.setItem('last_backup_time', this.lastBackupTime.toISOString());
      }
    } catch (error) {
      logService.error('保存备份统计信息失败', error);
    }
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) {return '0 Bytes';}

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 获取备份统计信息
   */
  getBackupStats() {
    return {
      ...this.backupStats,
      lastBackupTime: this.lastBackupTime,
      isBackupInProgress: this.backupInProgress,
      nextBackupTime: this.lastBackupTime ?
        new Date(this.lastBackupTime.getTime() + this.backupInterval) : null,
    };
  }

  /**
   * 手动触发备份
   */
  async triggerManualBackup() {
    try {
      logService.info('手动触发备份...');
      await this.performBackup();
      return { success: true, message: '手动备份完成' };
    } catch (error) {
      logService.error('手动备份失败', error);
      throw error;
    }
  }

  /**
   * 销毁服务
   */
  destroy() {
    this.stopAutoBackup();
    this.initialized = false;
  }
}

// 创建单例实例
const autoBackupService = new AutoBackupService();

export default autoBackupService;
export { AutoBackupService };




