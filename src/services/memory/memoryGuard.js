/**
 * 内存守护服务
 * 防止大文件导致的内存溢出问题
 */

import RNFS from 'react-native-fs';

class MemoryGuard {
  constructor() {
    this.maxFileSize = 500 * 1024 * 1024; // 500MB限制
    this.maxTotalMemory = 1024 * 1024 * 1024; // 1GB总内存限制
    this.currentMemoryUsage = 0;
    this.loadedFiles = new Map();
    this.deferredFiles = new Set(); // 延迟加载的文件
  }

  /**
   * 检查文件是否可以安全加载
   * @param {string} filePath - 文件路径
   * @param {number} fileSize - 文件大小
   * @returns {Promise<Object>} 检查结果
   */
  async canLoadFile(filePath, fileSize = null) {
    try {
      // 获取文件大小
      if (!fileSize) {
        const stats = await RNFS.stat(filePath);
        fileSize = stats.size;
      }

      // 检查单个文件大小
      if (fileSize > this.maxFileSize) {
        console.warn(`MemoryGuard: 文件过大 (${Math.round(fileSize / 1024 / 1024)}MB)，延迟加载:`, filePath);
        this.deferredFiles.add(filePath);
        return {
          canLoad: false,
          reason: 'file_too_large',
          fileSize,
          shouldDefer: true,
          message: `文件过大 (${Math.round(fileSize / 1024 / 1024)}MB)，超过500MB限制，将在需要时加载`,
        };
      }

      // 检查总内存使用
      if (this.currentMemoryUsage + fileSize > this.maxTotalMemory) {
        console.warn('MemoryGuard: 内存使用过高，延迟加载:', filePath);
        this.deferredFiles.add(filePath);
        return {
          canLoad: false,
          reason: 'memory_limit',
          currentUsage: this.currentMemoryUsage,
          requestedSize: fileSize,
          shouldDefer: true,
          message: '内存使用过高，将在需要时加载',
        };
      }

      return {
        canLoad: true,
        fileSize,
        message: '文件可以安全加载',
      };
    } catch (error) {
      console.error('MemoryGuard: 检查文件失败:', error);
      return {
        canLoad: false,
        reason: 'check_failed',
        error: error.message,
        shouldDefer: true,
      };
    }
  }

  /**
   * 标记文件已加载
   * @param {string} filePath - 文件路径
   * @param {number} fileSize - 文件大小
   */
  markFileLoaded(filePath, fileSize) {
    this.loadedFiles.set(filePath, {
      size: fileSize,
      loadedAt: Date.now(),
    });
    this.currentMemoryUsage += fileSize;
    console.log(`MemoryGuard: 文件已加载，当前内存使用: ${Math.round(this.currentMemoryUsage / 1024 / 1024)}MB`);
  }

  /**
   * 标记文件已卸载
   * @param {string} filePath - 文件路径
   */
  markFileUnloaded(filePath) {
    const fileInfo = this.loadedFiles.get(filePath);
    if (fileInfo) {
      this.currentMemoryUsage -= fileInfo.size;
      this.loadedFiles.delete(filePath);
      console.log(`MemoryGuard: 文件已卸载，当前内存使用: ${Math.round(this.currentMemoryUsage / 1024 / 1024)}MB`);
    }
  }

  /**
   * 清理内存，卸载最旧的文件
   * @param {number} targetSize - 目标释放大小
   */
  async cleanupMemory(targetSize = 100 * 1024 * 1024) { // 默认清理100MB
    console.log('MemoryGuard: 开始清理内存...');

    // 按加载时间排序，最旧的先卸载
    const sortedFiles = Array.from(this.loadedFiles.entries())
      .sort((a, b) => a[1].loadedAt - b[1].loadedAt);

    let freedSize = 0;
    for (const [filePath, fileInfo] of sortedFiles) {
      if (freedSize >= targetSize) {break;}

      this.markFileUnloaded(filePath);
      freedSize += fileInfo.size;

      console.log(`MemoryGuard: 已卸载文件: ${filePath} (${Math.round(fileInfo.size / 1024 / 1024)}MB)`);
    }

    console.log(`MemoryGuard: 内存清理完成，释放了 ${Math.round(freedSize / 1024 / 1024)}MB`);
    return freedSize;
  }

  /**
   * 创建安全的笔记对象（不包含大文件内容）
   * @param {Object} note - 原始笔记对象
   * @returns {Object} 安全的笔记对象
   */
  createSafeNote(note) {
    if (!note) {return note;}

    const safeNote = { ...note };

    // 检查是否是大文件类型
    const isLargeFileType = ['ppt', 'pptx', 'pdf', 'docx', 'word'].includes(note.type || note.file_type);

    if (isLargeFileType && note.file_uri) {
      // 标记为延迟加载
      safeNote._isDeferred = true;
      safeNote._originalFileUri = note.file_uri;

      // 移除可能导致内存问题的字段
      delete safeNote.content_base64;
      delete safeNote.file_content;
      delete safeNote.preview_data;

      // 添加占位符内容
      safeNote.content = safeNote.content || `${note.type || 'document'}文件: ${note.file_name || '未命名'}`;

      console.log(`MemoryGuard: 创建安全笔记对象: ${note.title || note.file_name}`);
    }

    return safeNote;
  }

  /**
   * 批量创建安全的笔记列表
   * @param {Array} notes - 笔记数组
   * @returns {Array} 安全的笔记数组
   */
  createSafeNotesList(notes) {
    if (!Array.isArray(notes)) {return notes;}

    console.log(`MemoryGuard: 处理 ${notes.length} 条笔记，创建安全列表`);

    const safeNotes = notes.map(note => this.createSafeNote(note));

    // 统计延迟加载的文件数量
    const deferredCount = safeNotes.filter(note => note._isDeferred).length;
    if (deferredCount > 0) {
      console.log(`MemoryGuard: ${deferredCount} 个大文件将延迟加载`);
    }

    return safeNotes;
  }

  /**
   * 按需加载延迟的文件
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>} 加载结果
   */
  async loadDeferredFile(filePath) {
    try {
      console.log('MemoryGuard: 按需加载延迟文件:', filePath);

      // 检查文件是否存在
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        throw new Error('文件不存在');
      }

      // 检查是否可以安全加载
      const checkResult = await this.canLoadFile(filePath);

      if (!checkResult.canLoad) {
        // 如果内存不足，先清理
        if (checkResult.reason === 'memory_limit') {
          await this.cleanupMemory(checkResult.requestedSize);

          // 重新检查
          const recheckResult = await this.canLoadFile(filePath);
          if (!recheckResult.canLoad) {
            throw new Error('内存不足，无法加载文件');
          }
        } else {
          throw new Error(checkResult.message || '无法加载文件');
        }
      }

      // 标记文件已加载
      this.markFileLoaded(filePath, checkResult.fileSize);
      this.deferredFiles.delete(filePath);

      return {
        success: true,
        filePath,
        fileSize: checkResult.fileSize,
        message: '文件加载成功',
      };

    } catch (error) {
      console.error('MemoryGuard: 加载延迟文件失败:', error);
      return {
        success: false,
        error: error.message,
        filePath,
      };
    }
  }

  /**
   * 获取内存使用统计
   * @returns {Object} 内存统计信息
   */
  getMemoryStats() {
    return {
      currentUsage: this.currentMemoryUsage,
      currentUsageMB: Math.round(this.currentMemoryUsage / 1024 / 1024),
      maxMemory: this.maxTotalMemory,
      maxMemoryMB: Math.round(this.maxTotalMemory / 1024 / 1024),
      loadedFilesCount: this.loadedFiles.size,
      deferredFilesCount: this.deferredFiles.size,
      usagePercentage: Math.round((this.currentMemoryUsage / this.maxTotalMemory) * 100),
    };
  }

  /**
   * 重置内存守护
   */
  reset() {
    this.currentMemoryUsage = 0;
    this.loadedFiles.clear();
    this.deferredFiles.clear();
    console.log('MemoryGuard: 已重置');
  }
}

// 创建单例实例
const memoryGuard = new MemoryGuard();

export default memoryGuard;
