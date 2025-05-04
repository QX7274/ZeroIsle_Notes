import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import Share from 'react-native-share';
import { analyticsService } from '../analytics/analyticsService';

class FileService {
  constructor() {
    this.documentDirectory = RNFS.DocumentDirectoryPath;
    this.cacheDirectory = RNFS.CachesDirectoryPath;
    this.externalDirectory = Platform.OS === 'android' ? RNFS.ExternalDirectoryPath : RNFS.DocumentDirectoryPath;
    this.downloadDirectory = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
  }

  // 读取文件内容
  async readFile(filePath, encoding = 'utf8') {
    try {
      const content = await RNFS.readFile(filePath, encoding);
      analyticsService.trackFileAction('read', { filePath });
      return content;
    } catch (error) {
      console.error('读取文件错误:', error);
      analyticsService.trackError(error, { action: 'read_file', filePath });
      throw error;
    }
  }

  // 读取文件为Base64
  async readAsBase64(filePath) {
    try {
      const content = await RNFS.readFile(filePath, 'base64');
      analyticsService.trackFileAction('read_base64', { filePath });
      return content;
    } catch (error) {
      console.error('读取文件为Base64错误:', error);
      analyticsService.trackError(error, { action: 'read_file_base64', filePath });
      throw error;
    }
  }

  // 写入文件
  async writeFile(filePath, content, encoding = 'utf8') {
    try {
      await RNFS.writeFile(filePath, content, encoding);
      analyticsService.trackFileAction('write', { filePath });
      return filePath;
    } catch (error) {
      console.error('写入文件错误:', error);
      analyticsService.trackError(error, { action: 'write_file', filePath });
      throw error;
    }
  }

  // 删除文件
  async deleteFile(filePath) {
    try {
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        return false;
      }
      
      await RNFS.unlink(filePath);
      analyticsService.trackFileAction('delete', { filePath });
      return true;
    } catch (error) {
      console.error('删除文件错误:', error);
      analyticsService.trackError(error, { action: 'delete_file', filePath });
      throw error;
    }
  }

  // 复制文件
  async copyFile(sourcePath, destinationPath) {
    try {
      await RNFS.copyFile(sourcePath, destinationPath);
      analyticsService.trackFileAction('copy', { sourcePath, destinationPath });
      return destinationPath;
    } catch (error) {
      console.error('复制文件错误:', error);
      analyticsService.trackError(error, { action: 'copy_file', sourcePath, destinationPath });
      throw error;
    }
  }

  // 移动文件
  async moveFile(sourcePath, destinationPath) {
    try {
      await RNFS.moveFile(sourcePath, destinationPath);
      analyticsService.trackFileAction('move', { sourcePath, destinationPath });
      return destinationPath;
    } catch (error) {
      console.error('移动文件错误:', error);
      analyticsService.trackError(error, { action: 'move_file', sourcePath, destinationPath });
      throw error;
    }
  }

  // 创建目录
  async mkdir(dirPath, options = { intermediates: true }) {
    try {
      await RNFS.mkdir(dirPath, options);
      analyticsService.trackFileAction('mkdir', { dirPath });
      return dirPath;
    } catch (error) {
      console.error('创建目录错误:', error);
      analyticsService.trackError(error, { action: 'mkdir', dirPath });
      throw error;
    }
  }

  // 读取目录内容
  async readDir(dirPath) {
    try {
      const items = await RNFS.readDir(dirPath);
      analyticsService.trackFileAction('read_dir', { dirPath });
      return items;
    } catch (error) {
      console.error('读取目录错误:', error);
      analyticsService.trackError(error, { action: 'read_dir', dirPath });
      throw error;
    }
  }

  // 检查文件是否存�?
  async exists(path) {
    try {
      return await RNFS.exists(path);
    } catch (error) {
      console.error('检查文件存在错�?', error);
      analyticsService.trackError(error, { action: 'exists', path });
      throw error;
    }
  }

  // 获取文件信息
  async stat(path) {
    try {
      const stat = await RNFS.stat(path);
      analyticsService.trackFileAction('stat', { path });
      return stat;
    } catch (error) {
      console.error('获取文件信息错误:', error);
      analyticsService.trackError(error, { action: 'stat', path });
      throw error;
    }
  }

  // 下载文件
  async downloadFile(url, filePath, progressCallback) {
    try {
      const options = {
        fromUrl: url,
        toFile: filePath,
        background: true,
        progressDivider: 10,
      };
      
      const { jobId, promise } = RNFS.downloadFile(options);
      
      if (progressCallback) {
        RNFS.addListener(`DownloadProgress-${jobId}`, (data) => {
          progressCallback(data.bytesWritten / data.contentLength);
        });
      }
      
      const result = await promise;
      
      if (result.statusCode === 200) {
        analyticsService.trackFileAction('download', { url, filePath });
        return filePath;
      } else {
        throw new Error(`下载失败，状态码: ${result.statusCode}`);
      }
    } catch (error) {
      console.error('下载文件错误:', error);
      analyticsService.trackError(error, { action: 'download_file', url, filePath });
      throw error;
    }
  }

  // 上传文件
  async uploadFile(url, filePath, method = 'POST', headers = {}, formData = {}) {
    try {
      const files = [{
        name: 'file',
        filename: filePath.split('/').pop(),
        filepath: filePath,
        filetype: this.getMimeType(filePath),
      }];
      
      const result = await RNFS.uploadFiles({
        toUrl: url,
        files,
        method,
        headers,
        fields: formData,
      }).promise;
      
      if (result.statusCode >= 200 && result.statusCode < 300) {
        analyticsService.trackFileAction('upload', { url, filePath });
        return JSON.parse(result.body);
      } else {
        throw new Error(`上传失败，状态码: ${result.statusCode}`);
      }
    } catch (error) {
      console.error('上传文件错误:', error);
      analyticsService.trackError(error, { action: 'upload_file', url, filePath });
      throw error;
    }
  }

  // 分享文件
  async shareFile(filePath, options = {}) {
    try {
      const url = Platform.OS === 'android' ? `file://${filePath}` : filePath;
      const mimeType = this.getMimeType(filePath);
      
      const shareOptions = {
        url,
        type: mimeType,
        title: options.title || '分享文件',
        subject: options.subject,
        message: options.message,
      };
      
      const result = await Share.open(shareOptions);
      analyticsService.trackFileAction('share', { filePath });
      return result;
    } catch (error) {
      if (error.message.includes('User did not share')) {
        // 用户取消分享，不算错�?
        return { success: false, message: '用户取消分享' };
      }
      
      console.error('分享文件错误:', error);
      analyticsService.trackError(error, { action: 'share_file', filePath });
      throw error;
    }
  }

  // 获取文件MIME类型
  getMimeType(filePath) {
    const extension = filePath.split('.').pop().toLowerCase();
    const mimeTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      mp3: 'audio/mpeg',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      zip: 'application/zip',
      json: 'application/json',
      xml: 'application/xml',
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  }
}

export const fileService = new FileService();

