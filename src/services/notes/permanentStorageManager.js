/**
 * 永久存储管理器
 * 统一管理所有笔记类型的永久存储，确保数据不丢失
 */

import { Alert } from 'react-native';
import enhancedNoteService from './enhancedNoteService';
import dataIntegrityService from '../data/dataIntegrityService';
import autoBackupService from '../backup/autoBackupService';
import dataRecoveryService from '../recovery/dataRecoveryService';
import { logService } from '../../utils/logService';
import { networkService } from '../network/networkService';

class PermanentStorageManager {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.services = {
      noteService: enhancedNoteService,
      integrityService: dataIntegrityService,
      backupService: autoBackupService,
      recoveryService: dataRecoveryService,
    };
    this.storageStats = {
      totalNotes: 0,
      totalSize: 0,
      lastBackup: null,
      lastIntegrityCheck: null,
      issuesFound: 0,
    };
  }

  /**
   * 初始化永久存储管理器
   */
  async initialize() {
    if (this.initialized) {return Promise.resolve();}

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        logService.info('初始化永久存储管理器...');

        // 初始化所有服务（失败即中止，禁止跳过）
        const initPromises = [
          this.services.noteService.initialize().catch(err => {
            logService.error('增强笔记服务初始化失败', err);
            throw err;
          }),
          this.services.integrityService.initialize().catch(err => {
            logService.error('数据完整性服务初始化失败', err);
            throw err;
          }),
          this.services.backupService.initialize().catch(err => {
            logService.error('自动备份服务初始化失败', err);
            throw err;
          }),
          this.services.recoveryService.initialize().catch(err => {
            logService.error('数据恢复服务初始化失败', err);
            throw err;
          }),
        ];

        await Promise.all(initPromises);

        // 加载存储统计信息
        await this.loadStorageStats();

        // 执行启动时的完整性检查
        await this.performStartupIntegrityCheck();

        this.initialized = true;
        logService.info('永久存储管理器初始化成功');
        resolve();
      } catch (error) {
        logService.error('永久存储管理器初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 创建笔记 - 确保永久存储
   */
  async createNote(noteData) {
    try {
      await this.initialize();

      // 验证输入数据
      const validation = await this.validateNoteData(noteData);
      if (!validation.isValid) {
        throw new Error(`笔记数据验证失败: ${validation.errors.join(', ')}`);
      }

      // 创建笔记
      const note = await this.services.noteService.createNote(noteData);

      // 更新统计信息
      await this.updateStorageStats();

      // 触发自动备份（如果距离上次备份超过阈值）
      this.triggerBackupIfNeeded();

      logService.info(`笔记创建成功，已确保永久存储(ID: ${note._id})`);
      return note;

    } catch (error) {
      logService.error('创建笔记失败', error);

      // 尝试数据恢复
      try {
        await this.handleStorageError(error, 'createNote', noteData);
      } catch (recoveryError) {
        logService.error('数据恢复失败', recoveryError);
      }

      throw error;
    }
  }

  /**
   * 更新笔记 - 确保永久存储
   */
  async updateNote(noteId, updateData) {
    try {
      await this.initialize();

      // 验证更新数据
      const validation = await this.validateNoteData(updateData);
      if (!validation.isValid) {
        throw new Error(`更新数据验证失败: ${validation.errors.join(', ')}`);
      }

      // 更新笔记
      const note = await this.services.noteService.updateNote(noteId, updateData);

      // 更新统计信息
      await this.updateStorageStats();

      // 触发自动备份
      this.triggerBackupIfNeeded();

      logService.info(`笔记更新成功，已确保永久存储(ID: ${noteId})`);
      return note;

    } catch (error) {
      logService.error('更新笔记失败', error);

      // 尝试数据恢复
      try {
        await this.handleStorageError(error, 'updateNote', { noteId, updateData });
      } catch (recoveryError) {
        logService.error('数据恢复失败', recoveryError);
      }

      throw error;
    }
  }

  /**
   * 获取笔记 - 确保数据完整性
   */
  async getNote(noteId) {
    try {
      await this.initialize();

      const note = await this.services.noteService.getNoteById(noteId);
      if (!note) {
        return null;
      }

      // 验证数据完整性
      const integrityCheck = await this.services.integrityService.validateNote(note);
      if (!integrityCheck.isValid) {
        logService.warn(`笔记数据完整性检查失败(ID: ${noteId})`);

        // 尝试修复
        const repairedNote = await this.services.integrityService.repairNote(note, integrityCheck);
        if (repairedNote) {
          logService.info(`笔记数据已修复(ID: ${noteId})`);
          return repairedNote;
        }
      }

      return note;

    } catch (error) {
      logService.error('获取笔记失败', error);
      throw error;
    }
  }

  /**
   * 获取所有笔记 - 确保数据完整性
   */
  async getAllNotes(options = {}) {
    try {
      await this.initialize();

      const notes = await this.services.noteService.getNotes(options);

      // 批量验证数据完整性
      const integrityResults = await this.services.integrityService.validateNotes(notes);

      if (integrityResults.invalid > 0) {
        logService.warn(`发现 ${integrityResults.invalid} 个数据完整性问题的笔记`);

        // 尝试修复有问题的笔记
        for (const detail of integrityResults.details) {
          if (!detail.isValid) {
            try {
              const note = notes.find(n => n._id === detail.noteId);
              if (note) {
                const repairedNote = await this.services.integrityService.repairNote(note, detail);
                if (repairedNote) {
                  const index = notes.findIndex(n => n._id === detail.noteId);
                  notes[index] = repairedNote;
                  logService.info(`笔记数据已修复(ID: ${detail.noteId})`);
                }
              }
            } catch (repairError) {
              logService.error(`修复笔记失败(ID: ${detail.noteId})`, repairError);
            }
          }
        }
      }

      return notes;

    } catch (error) {
      logService.error('获取所有笔记失败', error);
      throw error;
    }
  }

  /**
   * 删除笔记 - 确保安全删除
   */
  async deleteNote(noteId, permanent = false) {
    try {
      await this.initialize();

      if (permanent) {
        // 永久删除前先备份
        const note = await this.getNote(noteId);
        if (note) {
          await this.services.backupService.createBackup();
        }

        await this.services.noteService.permanentlyDeleteNote(noteId);
        logService.info(`笔记永久删除成功(ID: ${noteId})`);
      } else {
        await this.services.noteService.deleteNote(noteId);
        logService.info(`笔记删除成功(ID: ${noteId})`);
      }

      // 更新统计信息
      await this.updateStorageStats();

    } catch (error) {
      logService.error('删除笔记失败', error);
      throw error;
    }
  }

  /**
   * 执行数据完整性检查
   */
  async performIntegrityCheck() {
    try {
      await this.initialize();

      logService.info('开始执行数据完整性检查...');

      // 检测数据问题
      const issues = await this.services.recoveryService.detectDataIssues();

      // 统计问题数量
      const totalIssues =
        issues.corruptedNotes.length +
        issues.missingFiles.length +
        issues.orphanedRecords.length +
        issues.syncErrors.length +
        issues.integrityViolations.length;

      this.storageStats.issuesFound = totalIssues;
      this.storageStats.lastIntegrityCheck = new Date().toISOString();

      await this.saveStorageStats();

      logService.info(`数据完整性检查完成，发现 ${totalIssues} 个问题`);

      return {
        success: true,
        issues,
        totalIssues,
        timestamp: this.storageStats.lastIntegrityCheck,
      };

    } catch (error) {
      logService.error('数据完整性检查失败', error);
      throw error;
    }
  }

  /**
   * 执行数据恢复
   */
  async performDataRecovery(options = {}) {
    try {
      await this.initialize();

      logService.info('开始执行数据恢复...');

      const recoveryResult = await this.services.recoveryService.performDataRecovery(options);

      // 更新统计信息
      await this.updateStorageStats();

      logService.info(`数据恢复完成: ${recoveryResult.recoveredNotes} 个笔记，${recoveryResult.recoveredFiles} 个文件`);

      return recoveryResult;

    } catch (error) {
      logService.error('数据恢复失败', error);
      throw error;
    }
  }

  /**
   * 执行手动备份
   */
  async performManualBackup() {
    try {
      await this.initialize();

      logService.info('开始执行手动备份...');

      const backupResult = await this.services.backupService.triggerManualBackup();

      if (backupResult.success) {
        this.storageStats.lastBackup = new Date().toISOString();
        await this.saveStorageStats();
      }

      return backupResult;

    } catch (error) {
      logService.error('手动备份失败', error);
      throw error;
    }
  }

  /**
   * 验证笔记数据
   */
  async validateNoteData(noteData) {
    try {
      // 基础验证
      const errors = [];
      const warnings = [];

      if (!noteData) {
        errors.push('笔记数据为空');
        return { isValid: false, errors, warnings };
      }

      if (!noteData.title || noteData.title.trim().length === 0) {
        errors.push('笔记标题不能为空');
      }

      if (noteData.title && noteData.title.length > 200) {
        warnings.push('笔记标题过长，可能影响显示');
      }

      // 类型特定验证
      if (noteData.type) {
        const typeValidation = this.validateNoteType(noteData);
        errors.push(...typeValidation.errors);
        warnings.push(...typeValidation.warnings);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };

    } catch (error) {
      logService.error('验证笔记数据失败', error);
      throw error;
    }
  }

  /**
   * 验证笔记类型
   */
  validateNoteType(noteData) {
    const errors = [];
    const warnings = [];

    switch (noteData.type) {
      case 'canvas':
        if (!noteData.strokeData && !noteData.viewport) {
          warnings.push('画布笔记缺少笔迹数据或视窗信息');
        }
        break;

      case 'pdf':
        if (!noteData.pdfPath) {
          errors.push('PDF笔记缺少文件路径');
        }
        break;

      case 'audio':
        if (!noteData.audioPath) {
          errors.push('音频笔记缺少文件路径');
        }
        break;

      case 'video':
        if (!noteData.videoPath) {
          errors.push('视频笔记缺少文件路径');
        }
        break;

      case 'image':
        if (!noteData.imagePath) {
          errors.push('图片笔记缺少文件路径');
        }
        break;

      case 'word':
        if (!noteData.wordPath) {
          errors.push('Word笔记缺少文件路径');
        }
        break;

      case 'paged':
        if (!noteData.pages) {
          warnings.push('分页笔记缺少页面数据');
        }
        break;
    }

    return { errors, warnings };
  }

  /**
   * 处理存储错误
   */
  async handleStorageError(error, operation, data) {
    try {
      logService.warn(`处理存储错误: ${operation}`, error);

      // 尝试数据恢复
      const recoveryResult = await this.services.recoveryService.performDataRecovery({
        recoverCorruptedNotes: true,
        handleMissingFiles: true,
        cleanupOrphanedRecords: true,
        fixSyncErrors: true,
        fixIntegrityViolations: true,
      });

      if (recoveryResult.success) {
        logService.info('数据恢复成功，重试操作');

        // 重试原始操作
        switch (operation) {
          case 'createNote':
            return await this.services.noteService.createNote(data);
          case 'updateNote':
            return await this.services.noteService.updateNote(data.noteId, data.updateData);
          default:
            throw error;
        }
      } else {
        throw error;
      }

    } catch (recoveryError) {
      logService.error('数据恢复失败', recoveryError);
      throw error;
    }
  }

  /**
   * 执行启动时的完整性检查
   */
  async performStartupIntegrityCheck() {
    try {
      // 只在启动时执行轻量级检查
      const issues = await this.services.recoveryService.detectDataIssues();

      const criticalIssues =
        issues.corruptedNotes.filter(note => note.score < 50).length +
        issues.missingFiles.length;

      if (criticalIssues > 0) {
        logService.warn(`启动时发现 ${criticalIssues} 个严重数据问题`);

        // 显示用户友好的提示
        Alert.alert(
          '数据问题检测',
          `检测到 ${criticalIssues} 个数据问题，建议执行数据恢复。是否现在执行？`,
          [
            { text: '稍后', style: 'cancel' },
            {
              text: '立即恢复',
              onPress: () => {
                this.performDataRecovery().catch(error => {
                  logService.error('启动时数据恢复失败', error);
                });
              },
            },
          ]
        );
      }

    } catch (error) {
      logService.error('启动时完整性检查失败', error);
      throw error;
    }
  }

  /**
   * 触发备份（如果需要）
   */
  triggerBackupIfNeeded() {
    try {
      const now = new Date();
      const lastBackup = this.storageStats.lastBackup ? new Date(this.storageStats.lastBackup) : null;

      // 如果距离上次备份超过1小时，触发备份
      if (!lastBackup || (now - lastBackup) > 60 * 60 * 1000) {
        this.services.backupService.triggerManualBackup().catch(error => {
          logService.error('自动备份失败', error);
        });
      }
    } catch (error) {
      logService.error('触发备份失败', error);
      throw error;
    }
  }

  /**
   * 更新存储统计信息
   */
  async updateStorageStats() {
    try {
      const notes = await this.services.noteService.getNotes();
      this.storageStats.totalNotes = notes.length;

      // 计算总大小（简化计算）
      this.storageStats.totalSize = notes.reduce((total, note) => {
        return total + (note.content ? note.content.length : 0) +
               (note.strokeData ? note.strokeData.length : 0) +
               (note.pdfAnnotations ? note.pdfAnnotations.length : 0);
      }, 0);

      await this.saveStorageStats();
    } catch (error) {
      logService.error('更新存储统计信息失败', error);
      throw error;
    }
  }

  /**
   * 保存存储统计信息
   */
  async saveStorageStats() {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('storage_stats', JSON.stringify(this.storageStats));
    } catch (error) {
      logService.error('保存存储统计信息失败', error);
      throw error;
    }
  }

  /**
   * 加载存储统计信息
   */
  async loadStorageStats() {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const stats = await AsyncStorage.getItem('storage_stats');
      if (stats) {
        this.storageStats = { ...this.storageStats, ...JSON.parse(stats) };
      }
    } catch (error) {
      logService.error('加载存储统计信息失败', error);
      throw error;
    }
  }

  /**
   * 获取存储统计信息
   */
  getStorageStats() {
    return {
      ...this.storageStats,
      backupStats: this.services.backupService.getBackupStats(),
      recoveryStatus: this.services.recoveryService.getRecoveryStatus(),
    };
  }

  /**
   * 获取服务状态
   */
  getServiceStatus() {
    return {
      initialized: this.initialized,
      services: {
        noteService: this.services.noteService.initialized,
        integrityService: this.services.integrityService.initialized,
        backupService: this.services.backupService.initialized,
        recoveryService: this.services.recoveryService.initialized,
      },
    };
  }

  /**
   * 销毁管理器
   */
  destroy() {
    try {
      // 销毁所有服务
      if (this.services.noteService.destroy) {
        this.services.noteService.destroy();
      }
      if (this.services.backupService.destroy) {
        this.services.backupService.destroy();
      }

      this.initialized = false;
      this.initializationPromise = null;

      logService.info('永久存储管理器已销毁');
    } catch (error) {
      logService.error('销毁永久存储管理器失败', error);
    }
  }
}

// 创建单例实例
const permanentStorageManager = new PermanentStorageManager();

export default permanentStorageManager;
export { PermanentStorageManager };




