/**
 * 文件服务 - 提供文件操作功能
 */

import { logService } from '../utils/logService';
import RNFS from 'react-native-fs';
import PDFLib from 'react-native-pdf';
import DocViewer from 'react-native-doc-viewer';
import XLSX from 'xlsx';
import { firebaseStorage } from '../firebase/firebaseStorage';
import Share from 'react-native-share';
import { Platform } from 'react-native';

// 模拟文件系统操作
// 实际项目中应使用react-native-fs或类似库
class FileService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.baseDir = '';
  }

  /**
   * 初始化文件服务
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 获取应用文档目录
        this.baseDir = Platform.OS === 'ios' 
          ? RNFS.DocumentDirectoryPath 
          : RNFS.ExternalDirectoryPath;
        
        this.initialized = true;
        logService.info('文件服务初始化成功');
        resolve();
      } catch (error) {
        logService.error('文件服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 读取文件内容
   * @param {string} path 文件路径
   * @returns {Promise<string>} 文件内容
   */
  async readFile(path) {
    try {
      await this.initialize();
      
      // 读取文件内容
      return await RNFS.readFile(path, 'utf8');
    } catch (error) {
      logService.error(`读取文件失败: ${path}`, error);
      throw error;
    }
  }

  /**
   * 写入文件内容
   * @param {string} path 文件路径
   * @param {string} content 文件内容
   * @returns {Promise<boolean>} 是否成功
   */
  async writeFile(path, content) {
    try {
      await this.initialize();
      
      // 写入文件内容
      await RNFS.writeFile(path, content, 'utf8');
      
      return true;
    } catch (error) {
      logService.error(`写入文件失败: ${path}`, error);
      throw error;
    }
  }

  /**
   * 删除文件
   * @param {string} path 文件路径
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteFile(path) {
    try {
      await this.initialize();
      
      // 删除文件
      await RNFS.unlink(path);
      
      return true;
    } catch (error) {
      logService.error(`删除文件失败: ${path}`, error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   * @param {string} path 文件路径
   * @returns {Promise<boolean>} 是否存在
   */
  async exists(path) {
    try {
      await this.initialize();
      
      // 检查文件是否存在
      return await RNFS.exists(path);
    } catch (error) {
      logService.error(`检查文件是否存在失败: ${path}`, error);
      throw error;
    }
  }

  /**
   * 创建目录
   * @param {string} path 目录路径
   * @returns {Promise<boolean>} 是否成功
   */
  async mkdir(path) {
    try {
      await this.initialize();
      
      // 创建目录
      await RNFS.mkdir(path);
      
      return true;
    } catch (error) {
      logService.error(`创建目录失败: ${path}`, error);
      throw error;
    }
  }

  /**
   * 读取目录内容
   * @param {string} path 目录路径
   * @returns {Promise<Array>} 文件列表
   */
  async readDir(path) {
    try {
      await this.initialize();
      
      // 读取目录内容
      return await RNFS.readDir(path);
    } catch (error) {
      logService.error(`读取目录失败: ${path}`, error);
      throw error;
    }
  }

  /**
   * 下载文件从URL
   * @param {string} url 文件URL
   * @param {string} destinationPath 目标路径
   * @param {Function} onProgress 进度回调函数
   * @returns {Promise<boolean>} 是否成功
   */
  async downloadFileFromURL(url, destinationPath, onProgress) {
    try {
      await this.initialize();

      const downloadOptions = {
        fromUrl: url,
        toFile: destinationPath,
        background: true,
        discretionary: true,
        progress: (res) => {
          if (onProgress) {
            const progress = res.bytesWritten / res.contentLength;
            onProgress(progress);
          }
        }
      };

      const downloadResult = await RNFS.downloadFile(downloadOptions).promise;
      return downloadResult.statusCode === 200;
    } catch (error) {
      logService.error(`从URL下载文件失败: ${url}`, error);
      throw error;
    }
  }

  /**
   * 上传文件到Firebase存储
   * @param {string} localPath 本地文件路径
   * @param {string} remotePath 远程存储路径
   * @param {Function} onProgress 进度回调函数
   * @returns {Promise<string>} 下载URL
   */
  async uploadFileToFirebase(localPath, remotePath, onProgress) {
    try {
      await this.initialize();
      return await firebaseStorage.uploadFile(localPath, remotePath, { onProgress });
    } catch (error) {
      logService.error(`上传文件到Firebase失败: ${localPath}`, error);
      throw error;
    }
  }

  /**
   * 从Firebase存储下载文件
   * @param {string} remotePath 远程存储路径
   * @param {string} localPath 本地文件路径
   * @param {Function} onProgress 进度回调函数
   * @returns {Promise<boolean>} 是否成功
   */
  async downloadFileFromFirebase(remotePath, localPath, onProgress) {
    try {
      await this.initialize();
      return await firebaseStorage.downloadFile(remotePath, localPath, { onProgress });
    } catch (error) {
      logService.error(`从Firebase下载文件失败: ${remotePath}`, error);
      throw error;
    }
  }

  /**
   * 分享文件
   * @param {string} filePath 文件路径
   * @param {Object} options 分享选项
   * @returns {Promise<boolean>} 是否成功
   */
  async shareFile(filePath, options = {}) {
    try {
      await this.initialize();

      if (!await this.exists(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      const shareOptions = {
        title: options.title || '分享文件',
        url: `file://${filePath}`,
        type: options.mimeType || 'application/octet-stream',
        ...options
      };

      const result = await Share.open(shareOptions);
      return result.success;
    } catch (error) {
      logService.error(`分享文件失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 获取文件元数据
   * @param {string} path 文件路径
   * @returns {Promise<Object>} 文件元数据
   */
  async getFileMetadata(path) {
    try {
      await this.initialize();
      return await RNFS.stat(path);
    } catch (error) {
      logService.error(`获取文件元数据失败: ${path}`, error);
      throw error;
    }
  }

  /**
   * 复制文件
   * @param {string} source 源文件路径
   * @param {string} destination 目标文件路径
   * @returns {Promise<boolean>} 是否成功
   */
  async copyFile(source, destination) {
    try {
      await this.initialize();
      await RNFS.copyFile(source, destination);
      return true;
    } catch (error) {
      logService.error(`复制文件失败: ${source} -> ${destination}`, error);
      throw error;
    }
  }

  /**
   * 移动文件
   * @param {string} source 源文件路径
   * @param {string} destination 目标文件路径
   * @returns {Promise<boolean>} 是否成功
   */
  async moveFile(source, destination) {
    try {
      await this.initialize();
      await RNFS.moveFile(source, destination);
      return true;
    } catch (error) {
      logService.error(`移动文件失败: ${source} -> ${destination}`, error);
      throw error;
    }
  }

  /**
   * 获取文件大小
   * @param {string} path 文件路径
   * @returns {Promise<number>} 文件大小(字节)
   */
  async getFileSize(path) {
    try {
      const stats = await this.getFileMetadata(path);
      return stats.size;
    } catch (error) {
      logService.error(`获取文件大小失败: ${path}`, error);
      throw error;
    }
  }

  /**
   * 获取文件修改时间
   * @param {string} path 文件路径
   * @returns {Promise<Date>} 修改时间
   */
  async getFileModifiedTime(path) {
    try {
      const stats = await this.getFileMetadata(path);
      return new Date(stats.mtime);
    } catch (error) {
      logService.error(`获取文件修改时间失败: ${path}`, error);
      throw error;
    }
  }

  /**
   * 获取文件扩展名
   * @param {string} path 文件路径
   * @returns {string} 扩展名
   */
  getFileExtension(path) {
    try {
      const parts = path.split('.');
      return parts.length > 1 ? parts.pop().toLowerCase() : '';
    } catch (error) {
      logService.error(`获取文件扩展名失败: ${path}`, error);
      return '';
    }
  }

  /**
   * 获取文件名（不含路径）
   * @param {string} path 文件路径
   * @returns {string} 文件名
   */
  getFileName(path) {
    try {
      const parts = path.split('/');
      return parts.pop();
    } catch (error) {
      logService.error(`获取文件名失败: ${path}`, error);
      return '';
    }
  }

  /**
   * 从PDF文件中提取文本
   * @param {string} path PDF文件路径
   * @returns {Promise<string>} 提取的文本内容
   */
  async extractTextFromPDF(path) {
    try {
      await this.initialize();
      const absPath = this._getAbsPath(path);
      logService.info(`从PDF提取文本: ${absPath}`);
      
      // 处理Windows路径格式
      const winPath = absPath.replace(/\//g, '\\');
      
      // 使用react-native-pdf提取文本
      const text = await new Promise((resolve, reject) => {
        PDFLib.getDocument({ uri: `file://${winPath}` }).then((pdf) => {
          const numPages = pdf.getNumPages();
          let textContent = '';
          
          const extractPageText = async (pageNum) => {
            if (pageNum > numPages) {
              resolve(textContent);
              return;
            }
            
            pdf.getPage(pageNum).then((page) => {
              page.getTextContent().then((content) => {
                textContent += content.items.map(item => item.str).join(' ');
                extractPageText(pageNum + 1);
              }).catch(reject);
            }).catch(reject);
          };
          
          extractPageText(1);
        }).catch(reject);
      });
      
      return text;
    } catch (error) {
      logService.error(`从PDF提取文本失败: ${path}`, error);
      throw error;
    }
  }

  /**
   * 从Word文件中提取文本
   * @param {string} path Word文件路径
   * @returns {Promise<string>} 提取的文本内容
   */
  async extractTextFromWord(path) {
    try {
      await this.initialize();
      const absPath = this._getAbsPath(path);
      logService.info(`从Word提取文本: ${absPath}`);
      
      // 处理Windows路径格式
      const winPath = absPath.replace(/\//g, '\\');
      
      // 使用react-native-doc-viewer提取Word内容
      const result = await DocViewer.getFileInfo({
        fileType: 'doc',
        url: `file://${winPath}`,
        fileNameOptional: this.getFileName(path)
      });
      
      return result.text;
    } catch (error) {
      logService.error(`从Word提取文本失败: ${path}`, error);
      throw error;
    }
  }

  /**
   * 转换文档为PDF格式
   * @param {string} sourcePath 源文件路径
   * @param {string} destinationPath 目标PDF路径
   * @returns {Promise<boolean>} 是否成功
   */
  async convertToPDF(sourcePath, destinationPath) {
    try {
      await this.initialize();
      const absSource = this._getAbsPath(sourcePath);
      const absDest = this._getAbsPath(destinationPath);
      logService.info(`转换为PDF: ${absSource} -> ${absDest}`);
      
      // 处理Windows路径格式
      const winSourcePath = absSource.replace(/\//g, '\\');
      const winDestPath = absDest.replace(/\//g, '\\');
      
      // 根据文件类型使用不同的转换方法
      const extension = this.getFileExtension(sourcePath).toLowerCase();
      
      if (['doc', 'docx'].includes(extension)) {
        // Word转PDF实现
        await DocViewer.convertDocToPDF({
          sourcePath: `file://${winSourcePath}`,
          destinationPath: `file://${winDestPath}`
        });
      } else if (['xls', 'xlsx'].includes(extension)) {
        // Excel转PDF实现
        const workbook = XLSX.readFile(winSourcePath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // 简单HTML转换示例，实际项目可能需要更完善的库
        const html = XLSX.utils.sheet_to_html(worksheet);
        await this.writeFile(winDestPath.replace('.pdf', '.html'), html);
        
        // 这里需要实际PDF转换库
        logService.warn('Excel转PDF功能需要额外的PDF转换库支持');
      } else {
        throw new Error(`不支持的文件格式: ${extension}`);
      }
      
      return await this.exists(absDest);
    } catch (error) {
      logService.error(`转换为PDF失败: ${sourcePath} -> ${destinationPath}`, error);
      throw error;
    }
  }

  /**
   * 获取文件MIME类型
   * @param {string} path 文件路径
   * @returns {string} MIME类型
   */
  getMimeType(path) {
    const extension = this.getFileExtension(path);
    
    const mimeTypes = {
      'txt': 'text/plain',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'text/javascript',
      'json': 'application/json',
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'mp3': 'audio/mpeg',
      'mp4': 'video/mp4',
      'wav': 'audio/wav',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      'tar': 'application/x-tar',
      'gz': 'application/gzip',
      'md': 'text/markdown',
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  }

  /**
   * 打开文件并获取内容
   * @param {string} path 文件路径
   * @returns {Promise<Object>} 文件内容和元数据
   */
  async openFile(path) {
    try {
      await this.initialize();
      const absPath = this._getAbsPath(path);
      logService.info(`打开文件: ${absPath}`);

      if (!await this.exists(absPath)) {
        throw new Error(`文件不存在: ${path}`);
      }

      const metadata = await this.getFileMetadata(absPath);
      const extension = this.getFileExtension(path).toLowerCase();
      const mimeType = this.getMimeType(path);
      let content = null;

      // 根据文件类型获取内容
      if (['pdf'].includes(extension)) {
        content = await this.extractTextFromPDF(absPath);
      } else if (['doc', 'docx'].includes(extension)) {
        content = await this.extractTextFromWord(absPath);
      } else if (['txt', 'html', 'css', 'js', 'json', 'md'].includes(extension)) {
        content = await this.readFile(absPath);
      } else {
        // 对于不支持文本提取的文件类型，返回基本信息
        logService.warn(`不支持的文本提取格式: ${extension}`);
      }

      return {
        path: absPath,
        name: this.getFileName(path),
        extension,
        mimeType,
        size: metadata.size,
        modifiedTime: new Date(metadata.mtime),
        content
      };
    } catch (error) {
      logService.error(`打开文件失败: ${path}`, error);
      throw error;
    }
  }

  /**
   * 获取绝对路径
   * @param {string} path 文件路径
   * @returns {string} 绝对路径
   */
  _getAbsPath(path) {
    if (path.startsWith('/') || path.includes(':')) {
      return path;
    }
    return `${this.baseDir}/${path}`;
  }

  /**
   * 合并PDF文件
   * @param {string[]} sourcePaths 源PDF文件路径数组
   * @param {string} destinationPath 目标PDF路径
   * @returns {Promise<boolean>} 是否成功
   */
  async mergePDFs(sourcePaths, destinationPath) {
    try {
      await this.initialize();
      const absDests = this._getAbsPath(destinationPath);
      logService.info(`合并PDF文件: ${sourcePaths.length}个文件 -> ${absDests}`);
      
      // 处理Windows路径格式
      const winDestPath = absDests.replace(/\//g, '\\');
      
      // 加载所有源PDF文件
      const pdfDocs = [];
      for (const path of sourcePaths) {
        const absPath = this._getAbsPath(path);
        const winPath = absPath.replace(/\//g, '\\');
        const pdfData = await RNFS.readFile(winPath, 'base64');
        pdfDocs.push(await PDFLib.PDFDocument.load(pdfData));
      }
      
      // 创建新的PDF文档
      const mergedPdf = await PDFLib.PDFDocument.create();
      
      // 将所有页面添加到新文档
      for (const pdfDoc of pdfDocs) {
        const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
      }
      
      // 保存合并后的PDF
      const mergedPdfBytes = await mergedPdf.save();
      await RNFS.writeFile(winDestPath, mergedPdfBytes.toString('base64'), 'base64');
      
      return true;
    } catch (error) {
      logService.error(`合并PDF失败`, error);
      throw error;
    }
  }
}

export const fileService = new FileService();