import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { logService } from '../log/logService';

/**
 * 文件持久化存储服务
 * 负责将content URI的文件复制到应用的私有目录并管理本地文件路径
 * 解决应用重启后无法访问content URI的权限问题
 */
class FilePersistenceService {
  constructor() {
    this.initialized = false;
    this.documentsDir = '';
    this.cacheDir = '';
  }

  /**
   * 初始化服务
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // 设置文档目录和缓存目录
      this.documentsDir = RNFS.DocumentDirectoryPath;
      this.cacheDir = RNFS.CachesDirectoryPath;

      // 创建文档存储子目录
      const persistentDocsDir = `${this.documentsDir}/persistent_documents`;
      const exists = await RNFS.exists(persistentDocsDir);
      if (!exists) {
        await RNFS.mkdir(persistentDocsDir);
      }

      this.persistentDocsDir = persistentDocsDir;
      this.initialized = true;
      
      console.log('FilePersistenceService: 初始化完成');
      console.log('FilePersistenceService: 文档目录:', this.documentsDir);
      console.log('FilePersistenceService: 持久化文档目录:', this.persistentDocsDir);
    } catch (error) {
      console.error('FilePersistenceService: 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 将文件持久化存储到应用私有目录
   * @param {string} sourceUri - 源文件URI (可能是content://协议)
   * @param {string} fileName - 文件名
   * @param {string} fileType - 文件类型 (pdf, docx, pptx等)
   * @param {Function} onProgress - 进度回调函数
   * @returns {Promise<Object>} 包含本地文件路径和相关信息的对象
   */
  async persistFile(sourceUri, fileName, fileType, onProgress = null) {
    await this.initialize();

    try {
      console.log('FilePersistenceService: 开始持久化文件:', { sourceUri, fileName, fileType });

      // 生成唯一的文件名，避免冲突
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const fileExtension = this.getFileExtension(fileName, fileType);
      const uniqueFileName = `${timestamp}_${randomSuffix}.${fileExtension}`;

      // 目标路径
      const destinationPath = `${this.persistentDocsDir}/${uniqueFileName}`;

      // 报告开始复制
      if (onProgress) {
        onProgress({ stage: 'copying', progress: 0 });
      }

      // 使用非阻塞方式复制文件
      await this.copyFileNonBlocking(sourceUri, destinationPath, onProgress);

      // 报告验证阶段
      if (onProgress) {
        onProgress({ stage: 'verifying', progress: 90 });
      }

      // 验证文件是否复制成功
      const destinationExists = await RNFS.exists(destinationPath);
      if (!destinationExists) {
        throw new Error('文件复制失败，目标文件不存在');
      }

      // 获取文件信息
      const fileStats = await RNFS.stat(destinationPath);

      // 报告完成
      if (onProgress) {
        onProgress({ stage: 'completed', progress: 100 });
      }

      const result = {
        originalUri: sourceUri,
        localPath: destinationPath,
        localUri: Platform.OS === 'android' ? `file://${destinationPath}` : destinationPath,
        fileName: fileName,
        uniqueFileName: uniqueFileName,
        fileType: fileType,
        fileSize: fileStats.size,
        createdAt: new Date().toISOString(),
        isPersistent: true
      };

      console.log('FilePersistenceService: 文件持久化完成:', result);
      return result;

    } catch (error) {
      console.error('FilePersistenceService: 文件持久化失败:', error);
      throw new Error(`文件持久化失败: ${error.message}`);
    }
  }

  /**
   * 非阻塞方式复制文件
   * @param {string} sourceUri - 源文件URI
   * @param {string} destinationPath - 目标路径
   * @param {Function} onProgress - 进度回调
   */
  async copyFileNonBlocking(sourceUri, destinationPath, onProgress = null) {
    try {
      // 检查源文件是否存在
      if (sourceUri.startsWith('content://')) {
        // 对于content URI，直接复制
        console.log('FilePersistenceService: 复制content URI文件到:', destinationPath);

        // 分块复制大文件，避免阻塞UI
        await this.copyFileWithProgress(sourceUri, destinationPath, onProgress);

      } else if (sourceUri.startsWith('file://')) {
        // 对于file URI，去掉file://前缀后复制
        const sourcePath = sourceUri.replace('file://', '');
        const sourceExists = await RNFS.exists(sourcePath);
        if (!sourceExists) {
          throw new Error(`源文件不存在: ${sourcePath}`);
        }
        console.log('FilePersistenceService: 复制file URI文件到:', destinationPath);
        await this.copyFileWithProgress(sourcePath, destinationPath, onProgress);

      } else {
        // 对于普通路径，直接复制
        const sourceExists = await RNFS.exists(sourceUri);
        if (!sourceExists) {
          throw new Error(`源文件不存在: ${sourceUri}`);
        }
        console.log('FilePersistenceService: 复制本地文件到:', destinationPath);
        await this.copyFileWithProgress(sourceUri, destinationPath, onProgress);
      }
    } catch (error) {
      console.error('FilePersistenceService: 非阻塞文件复制失败:', error);
      throw error;
    }
  }

  /**
   * 带进度的文件复制
   * @param {string} sourcePath - 源路径
   * @param {string} destinationPath - 目标路径
   * @param {Function} onProgress - 进度回调
   */
  async copyFileWithProgress(sourcePath, destinationPath, onProgress = null) {
    try {
      // 获取文件大小
      let fileSize = 0;
      try {
        const stats = await RNFS.stat(sourcePath);
        fileSize = stats.size;
      } catch (statError) {
        console.warn('FilePersistenceService: 无法获取文件大小，使用默认复制方式');
        await RNFS.copyFile(sourcePath, destinationPath);
        return;
      }

      // 如果文件较小（小于100MB），直接复制
      if (fileSize < 100 * 1024 * 1024) {
        if (onProgress) {
          onProgress({ stage: 'copying', progress: 50 });
        }
        await RNFS.copyFile(sourcePath, destinationPath);
        return;
      }

      // 对于大文件，使用分块复制
      console.log('FilePersistenceService: 大文件分块复制，文件大小:', fileSize);

      const chunkSize = 1024 * 1024; // 1MB chunks
      const totalChunks = Math.ceil(fileSize / chunkSize);

      // 创建目标文件
      await RNFS.writeFile(destinationPath, '', 'base64');

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const length = Math.min(chunkSize, fileSize - start);

        // 读取块
        const chunk = await RNFS.read(sourcePath, length, start, 'base64');

        // 追加到目标文件
        await RNFS.appendFile(destinationPath, chunk, 'base64');

        // 报告进度
        if (onProgress) {
          const progress = Math.round(((i + 1) / totalChunks) * 80) + 10; // 10-90%
          onProgress({ stage: 'copying', progress });
        }

        // 每处理几个块后让出控制权
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

    } catch (error) {
      console.error('FilePersistenceService: 带进度文件复制失败:', error);
      // 回退到标准复制方式
      await RNFS.copyFile(sourcePath, destinationPath);
    }
  }

  /**
   * 检查持久化文件是否存在
   * @param {string} localPath - 本地文件路径
   * @returns {Promise<boolean>} 文件是否存在
   */
  async checkFileExists(localPath) {
    try {
      return await RNFS.exists(localPath);
    } catch (error) {
      console.error('FilePersistenceService: 检查文件存在性失败:', error);
      return false;
    }
  }

  /**
   * 删除持久化文件
   * @param {string} localPath - 本地文件路径
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deletePersistedFile(localPath) {
    try {
      const exists = await RNFS.exists(localPath);
      if (exists) {
        await RNFS.unlink(localPath);
        console.log('FilePersistenceService: 删除持久化文件成功:', localPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('FilePersistenceService: 删除持久化文件失败:', error);
      return false;
    }
  }

  /**
   * 获取文件扩展名
   * @param {string} fileName - 文件名
   * @param {string} fileType - 文件类型
   * @returns {string} 文件扩展名
   */
  getFileExtension(fileName, fileType) {
    if (fileName && fileName.includes('.')) {
      return fileName.split('.').pop().toLowerCase();
    }

    // 根据文件类型返回默认扩展名
    const typeMap = {
      'pdf': 'pdf',
      'docx': 'docx',
      'doc': 'doc',
      'pptx': 'pptx',
      'ppt': 'ppt',
      'word': 'docx',
      'powerpoint': 'pptx',
      'markdown': 'md',
      'md': 'md',
      'txt': 'txt'
    };

    return typeMap[fileType?.toLowerCase()] || 'bin';
  }

  /**
   * 清理过期的持久化文件
   * @param {number} maxAgeInDays - 最大保留天数，默认30天
   * @returns {Promise<number>} 清理的文件数量
   */
  async cleanupExpiredFiles(maxAgeInDays = 30) {
    await this.initialize();

    try {
      const files = await RNFS.readDir(this.persistentDocsDir);
      const maxAge = maxAgeInDays * 24 * 60 * 60 * 1000; // 转换为毫秒
      const now = Date.now();
      let cleanedCount = 0;

      for (const file of files) {
        try {
          const fileAge = now - new Date(file.mtime).getTime();
          if (fileAge > maxAge) {
            await RNFS.unlink(file.path);
            cleanedCount++;
            console.log('FilePersistenceService: 清理过期文件:', file.path);
          }
        } catch (error) {
          console.warn('FilePersistenceService: 清理文件失败:', file.path, error);
        }
      }

      console.log(`FilePersistenceService: 清理完成，删除了 ${cleanedCount} 个过期文件`);
      return cleanedCount;
    } catch (error) {
      console.error('FilePersistenceService: 清理过期文件失败:', error);
      return 0;
    }
  }

  /**
   * 获取持久化目录的使用情况
   * @returns {Promise<Object>} 目录使用情况信息
   */
  async getStorageInfo() {
    await this.initialize();

    try {
      const files = await RNFS.readDir(this.persistentDocsDir);
      let totalSize = 0;
      let fileCount = 0;

      for (const file of files) {
        if (file.isFile()) {
          totalSize += file.size;
          fileCount++;
        }
      }

      return {
        fileCount,
        totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        directory: this.persistentDocsDir
      };
    } catch (error) {
      console.error('FilePersistenceService: 获取存储信息失败:', error);
      return {
        fileCount: 0,
        totalSize: 0,
        totalSizeMB: '0.00',
        directory: this.persistentDocsDir
      };
    }
  }
}

// 创建单例实例
const filePersistenceService = new FilePersistenceService();

export default filePersistenceService;
