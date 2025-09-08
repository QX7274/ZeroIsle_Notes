import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import filePersistenceService from '../files/filePersistenceService';

/**
 * 文档选择器服务
 * 使用react-native-document-picker选择文档文件
 */
class DocumentPickerService {
  constructor() {
    this.supportedTypes = {
      word: [DocumentPicker.types.doc, DocumentPicker.types.docx],
      powerpoint: [DocumentPicker.types.ppt, DocumentPicker.types.pptx],
      pdf: [DocumentPicker.types.pdf],
      all: [DocumentPicker.types.allFiles]
    };
  }

  /**
   * 选择Word文档
   * @returns {Promise<Object>} 选择的文档信息
   */
  async pickWordDocument() {
    try {
      const result = await DocumentPicker.pick({
        type: this.supportedTypes.word,
        allowMultiSelection: false,
      });

      if (result && result.length > 0) {
        const document = result[0];
        return this.processSelectedDocument(document, 'word');
      }
      
      return null;
    } catch (error) {
      if (DocumentPicker.isCancel(error)) {
        console.log('用户取消选择Word文档');
        return null;
      }
      console.error('选择Word文档失败:', error);
      throw new Error(`选择Word文档失败: ${error.message}`);
    }
  }

  /**
   * 选择PPT文档
   * @returns {Promise<Object>} 选择的文档信息
   */
  async pickPPTDocument() {
    try {
      const result = await DocumentPicker.pick({
        type: this.supportedTypes.powerpoint,
        allowMultiSelection: false,
      });

      if (result && result.length > 0) {
        const document = result[0];
        return this.processSelectedDocument(document, 'powerpoint');
      }
      
      return null;
    } catch (error) {
      if (DocumentPicker.isCancel(error)) {
        console.log('用户取消选择PPT文档');
        return null;
      }
      console.error('选择PPT文档失败:', error);
      throw new Error(`选择PPT文档失败: ${error.message}`);
    }
  }

  /**
   * 选择PDF文档
   * @returns {Promise<Object>} 选择的文档信息
   */
  async pickPDFDocument() {
    try {
      const result = await DocumentPicker.pick({
        type: this.supportedTypes.pdf,
        allowMultiSelection: false,
      });

      if (result && result.length > 0) {
        const document = result[0];
        return this.processSelectedDocument(document, 'pdf');
      }
      
      return null;
    } catch (error) {
      if (DocumentPicker.isCancel(error)) {
        console.log('用户取消选择PDF文档');
        return null;
      }
      console.error('选择PDF文档失败:', error);
      throw new Error(`选择PDF文档失败: ${error.message}`);
    }
  }

  /**
   * 选择任意文档
   * @returns {Promise<Object>} 选择的文档信息
   */
  async pickAnyDocument() {
    try {
      const result = await DocumentPicker.pick({
        type: [...this.supportedTypes.word, ...this.supportedTypes.powerpoint, this.supportedTypes.pdf],
        allowMultiSelection: false,
      });

      if (result && result.length > 0) {
        const document = result[0];
        const documentType = this.getDocumentType(document.name);
        return this.processSelectedDocument(document, documentType);
      }
      
      return null;
    } catch (error) {
      if (DocumentPicker.isCancel(error)) {
        console.log('用户取消选择文档');
        return null;
      }
      console.error('选择文档失败:', error);
      throw new Error(`选择文档失败: ${error.message}`);
    }
  }

  /**
   * 处理选择的文档
   * @param {Object} document - 选择的文档对象
   * @param {string} type - 文档类型
   * @returns {Promise<Object>} 处理后的文档信息
   */
  async processSelectedDocument(document, type) {
    try {
      console.log('DocumentPickerService: 处理选择的文档:', document);

      // 获取文档信息
      const documentInfo = {
        uri: document.uri,
        name: document.name,
        type: document.type,
        size: document.size,
        documentType: type,
        lastModified: document.lastModified || Date.now(),
      };

      // 如果是content://协议，使用文件持久化服务复制到应用私有目录
      if (document.uri.startsWith('content://')) {
        console.log('DocumentPickerService: 检测到content://协议，使用持久化服务');

        try {
          // 使用带进度回调的持久化方法
          const persistedFile = await filePersistenceService.persistFile(
            document.uri,
            document.name || `document_${Date.now()}`,
            type,
            (progress) => {
              console.log('DocumentPickerService: 文件处理进度:', progress);
            }
          );

          console.log('DocumentPickerService: 文档持久化完成:', persistedFile);

          // 更新文档信息，使用持久化后的路径
          documentInfo.localPath = persistedFile.localPath;
          documentInfo.localUri = persistedFile.localUri;
          documentInfo.originalUri = persistedFile.originalUri;
          documentInfo.uri = persistedFile.localUri;
          documentInfo.fileName = persistedFile.fileName;
          documentInfo.uniqueFileName = persistedFile.uniqueFileName;
          documentInfo.isPersistent = persistedFile.isPersistent;
          documentInfo.persistedAt = persistedFile.createdAt;

        } catch (persistError) {
          console.error('DocumentPickerService: 文档持久化失败，回退到缓存目录:', persistError);

          // 如果持久化失败，回退到原来的缓存目录方式
          const fileName = document.name || `document_${Date.now()}`;
          const localPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

          console.log('DocumentPickerService: 复制文档到缓存目录:', localPath);
          await RNFS.copyFile(document.uri, localPath);

          documentInfo.localPath = localPath;
          documentInfo.originalUri = document.uri;
          documentInfo.uri = Platform.OS === 'android' ? `file://${localPath}` : localPath;
          documentInfo.isPersistent = false;
        }
      }

      // 验证文件是否存在
      const pathToCheck = documentInfo.localPath || documentInfo.uri.replace('file://', '');
      const exists = await RNFS.exists(pathToCheck);
      if (!exists) {
        throw new Error('文档文件不存在或无法访问');
      }

      console.log('DocumentPickerService: 文档处理完成:', documentInfo);
      return documentInfo;

    } catch (error) {
      console.error('DocumentPickerService: 处理文档失败:', error);
      throw new Error(`处理文档失败: ${error.message}`);
    }
  }

  /**
   * 根据文件名判断文档类型
   * @param {string} fileName - 文件名
   * @returns {string} 文档类型
   */
  getDocumentType(fileName) {
    if (!fileName) return 'unknown';
    
    const extension = fileName.toLowerCase().split('.').pop();
    
    if (['doc', 'docx'].includes(extension)) {
      return 'word';
    } else if (['ppt', 'pptx'].includes(extension)) {
      return 'powerpoint';
    } else if (extension === 'pdf') {
      return 'pdf';
    } else if (['md', 'markdown'].includes(extension)) {
      return 'markdown';
    }
    
    return 'unknown';
  }

  /**
   * 获取文档图标名称
   * @param {string} documentType - 文档类型
   * @returns {string} 图标名称
   */
  getDocumentIcon(documentType) {
    const icons = {
      word: 'description',
      powerpoint: 'slideshow',
      pdf: 'picture-as-pdf',
      markdown: 'notes',
      unknown: 'insert-drive-file'
    };
    
    return icons[documentType] || icons.unknown;
  }

  /**
   * 获取文档颜色
   * @param {string} documentType - 文档类型
   * @returns {string} 颜色值
   */
  getDocumentColor(documentType) {
    const colors = {
      word: '#1976D2',
      powerpoint: '#FF6F00',
      pdf: '#D32F2F',
      markdown: '#388E3C',
      unknown: '#757575'
    };
    
    return colors[documentType] || colors.unknown;
  }

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} 格式化的文件大小
   */
  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * 清理临时文件
   * @param {string} filePath - 文件路径
   */
  async cleanupTempFile(filePath) {
    try {
      if (filePath && filePath.includes(RNFS.CachesDirectoryPath)) {
        const exists = await RNFS.exists(filePath);
        if (exists) {
          await RNFS.unlink(filePath);
          console.log('DocumentPickerService: 清理临时文件:', filePath);
        }
      }
    } catch (error) {
      console.warn('DocumentPickerService: 清理临时文件失败:', error);
    }
  }
}

// 创建单例实例
const documentPickerService = new DocumentPickerService();

export default documentPickerService;
