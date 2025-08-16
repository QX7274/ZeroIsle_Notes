import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { API_URL } from '../../config';

/**
 * 文档转换服务
 * 将Word/PPT文档转换为PDF格式以便在应用内查看
 * 使用后端Python服务进行真实的文档转换
 */
class DocumentConverter {
  constructor() {
    this.conversionCache = new Map();
    // 使用统一的API配置
    this.baseUrl = API_URL;
    this.apiUrl = `${this.baseUrl}/api/v1/document-converter`;

    console.log('DocumentConverter: 初始化，后端地址:', this.baseUrl);
    console.log('DocumentConverter: API地址:', this.apiUrl);
  }

  /**
   * 检查文档转换服务状态
   * @returns {Promise<boolean>} - 服务是否可用
   */
  async checkServiceStatus() {
    try {
      const response = await fetch(`${this.baseUrl}/api.json`, {
        method: 'GET',
        timeout: 5000,
      });
      return response.ok;
    } catch (error) {
      console.error('DocumentConverter: 服务状态检查失败:', error);
      return false;
    }
  }

  /**
   * 将Word文档转换为PDF
   * @param {string} docPath - Word文档路径
   * @param {function} onProgress - 进度回调函数
   * @returns {Promise<string>} - 转换后的PDF路径
   */
  async convertWordToPDF(docPath, onProgress = () => {}) {
    try {
      console.log('DocumentConverter: 开始转换Word文档:', docPath);

      // 检查缓存
      const cacheKey = this.getCacheKey(docPath);
      if (this.conversionCache.has(cacheKey)) {
        console.log('DocumentConverter: 使用缓存的PDF');
        return this.conversionCache.get(cacheKey);
      }

      // 使用后端API进行真实转换
      const pdfPath = await this.convertDocumentWithAPI(docPath, 'word', onProgress);

      // 缓存结果
      this.conversionCache.set(cacheKey, pdfPath);

      console.log('DocumentConverter: Word转换完成:', pdfPath);
      return pdfPath;

    } catch (error) {
      console.error('DocumentConverter: Word转换失败:', error);
      // 如果API转换失败，尝试使用fallback处理
      return await this.handleConversionFallback(docPath, 'word', onProgress, error);
    }
  }

  /**
   * 将PPT文档转换为PDF
   * @param {string} pptPath - PPT文档路径
   * @param {function} onProgress - 进度回调函数
   * @returns {Promise<string>} - 转换后的PDF路径
   */
  async convertPPTToPDF(pptPath, onProgress = () => {}) {
    try {
      console.log('DocumentConverter: 开始转换PPT文档:', pptPath);

      // 检查缓存
      const cacheKey = this.getCacheKey(pptPath);
      if (this.conversionCache.has(cacheKey)) {
        console.log('DocumentConverter: 使用缓存的PDF');
        return this.conversionCache.get(cacheKey);
      }

      // 使用后端API进行真实转换
      const pdfPath = await this.convertDocumentWithAPI(pptPath, 'ppt', onProgress);

      // 缓存结果
      this.conversionCache.set(cacheKey, pdfPath);

      console.log('DocumentConverter: PPT转换完成:', pdfPath);
      return pdfPath;

    } catch (error) {
      console.error('DocumentConverter: PPT转换失败:', error);
      // 如果API转换失败，尝试使用fallback处理
      return await this.handleConversionFallback(pptPath, 'ppt', onProgress, error);
    }
  }

  /**
   * 处理转换失败的fallback逻辑
   * @param {string} sourcePath - 源文件路径
   * @param {string} type - 文档类型
   * @param {function} onProgress - 进度回调
   * @param {Error} originalError - 原始错误
   * @returns {Promise<string>} - 返回处理结果路径或抛出错误
   */
  async handleConversionFallback(sourcePath, type, onProgress, originalError) {
    onProgress(50, '正在尝试备用处理方案...');

    // 对于开发和测试，当服务器不可用时，我们返回null表示使用预览模式
    if (originalError.message.includes('服务暂时不可用') ||
        originalError.message.includes('无法连接到文档转换服务器')) {
      onProgress(100, '将以预览模式显示文档');
      // 返回null，让查看器知道需要使用预览模式
      return null;
    }

    // 其他错误直接抛出
    throw new Error(`${type === 'word' ? 'Word' : 'PPT'}文档转换失败: ${originalError.message}`);
  }

  /**
   * 使用后端API进行文档转换
   * @param {string} sourcePath - 源文档路径
   * @param {string} type - 文档类型 ('word' 或 'ppt')
   * @param {function} onProgress - 进度回调函数
   * @returns {Promise<string>} - 转换后的PDF路径
   */
  async convertDocumentWithAPI(sourcePath, type, onProgress) {
    try {
      onProgress(10, '正在准备上传文档...');

      // 检查网络连接和服务器状态 - 使用Promise.race确保不阻塞UI
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('连接超时')), 8000) // 增加到8秒
        );

        const fetchPromise = fetch(`${this.baseUrl}/`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'ZeroIsle-Notes-App',
            'Cache-Control': 'no-cache',
          },
        });

        const testResponse = await Promise.race([fetchPromise, timeoutPromise]);
        if (!testResponse.ok) {
          throw new Error(`服务器连接失败: ${testResponse.status}`);
        }
        console.log('DocumentConverter: 网络连接检查成功');
      } catch (networkError) {
        console.error('DocumentConverter: 网络连接检查失败:', networkError);
        console.log('DocumentConverter: 尝试连接的URL:', this.baseUrl);
        // 立即抛出错误，不等待，避免阻塞UI
        throw new Error('文档转换服务暂时不可用，请稍后重试。您可以继续使用其他功能。');
      }

      // 创建FormData
      const formData = new FormData();

      // 读取文件并添加到FormData
      const fileInfo = await RNFS.stat(sourcePath);
      const fileName = sourcePath.split('/').pop();

      formData.append('file', {
        uri: Platform.OS === 'android' ? `file://${sourcePath}` : sourcePath,
        type: this.getMimeType(fileName),
        name: fileName,
      });

      onProgress(30, '正在上传文档到服务器...');

      // 发送转换请求，添加超时设置
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

      const response = await fetch(`${this.apiUrl}/convert/`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        // 不设置Content-Type，让浏览器自动设置正确的multipart边界
      });

      clearTimeout(timeoutId);

      onProgress(60, '正在处理转换结果...');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '服务器转换失败');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '转换失败');
      }

      onProgress(80, '正在下载转换后的PDF...');

      // 下载转换后的PDF
      const pdfUrl = `${this.baseUrl}${result.pdf_url}`;
      const fileName_converted = `${fileName.replace(/\.[^/.]+$/, '')}_converted_${Date.now()}.pdf`;
      const localPdfPath = `${RNFS.CachesDirectoryPath}/${fileName_converted}`;

      const downloadResult = await RNFS.downloadFile({
        fromUrl: pdfUrl,
        toFile: localPdfPath,
      }).promise;

      if (downloadResult.statusCode !== 200) {
        throw new Error('PDF下载失败');
      }

      onProgress(100, '转换完成！');

      console.log('DocumentConverter: API转换完成:', localPdfPath);
      return localPdfPath;

    } catch (error) {
      console.error('DocumentConverter: API转换失败:', error);

      // 根据错误类型提供更具体的错误信息
      if (error.name === 'AbortError') {
        throw new Error('文档转换超时，请检查网络连接或稍后重试');
      } else if (error.message.includes('Network request failed')) {
        throw new Error('网络请求失败，请检查网络连接和服务器状态');
      } else if (error.message.includes('无法连接')) {
        throw new Error(error.message);
      } else {
        throw new Error(`文档转换失败: ${error.message}`);
      }
    }
  }

  /**
   * 创建模拟PDF内容
   * 在实际应用中，这里应该返回真实的转换结果
   */
  async createMockPDF(sourcePath, type) {
    // 这是一个最小的PDF文件的base64编码
    // 在实际应用中，应该使用真实的文档转换结果
    const minimalPDF = `JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPJ4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSA0IDAgUgo+Pgo+PgovQ29udGVudHMgNSAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9MZW5ndGggNDQKPj4Kc3RyZWFtCkJUCi9GMSAxMiBUZgoxMDAgNzAwIFRkCihEb2N1bWVudCBDb252ZXJ0ZWQpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjQ1IDAwMDAwIG4gCjAwMDAwMDAzMjIgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA2Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo0MTYKJSVFT0Y=`;
    
    return minimalPDF;
  }

  /**
   * 获取文件MIME类型
   * @param {string} fileName - 文件名
   * @returns {string} - MIME类型
   */
  getMimeType(fileName) {
    const extension = fileName.toLowerCase().split('.').pop();
    const mimeTypes = {
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }

  /**
   * 获取进度消息
   */
  getProgressMessage(progress, type) {
    const typeText = type === 'word' ? 'Word文档' : 'PPT演示文稿';

    if (progress <= 20) {
      return `正在分析${typeText}结构...`;
    } else if (progress <= 40) {
      return `正在解析${typeText}内容...`;
    } else if (progress <= 60) {
      return `正在转换为PDF格式...`;
    } else if (progress <= 80) {
      return `正在优化PDF布局...`;
    } else if (progress < 100) {
      return `正在完成转换...`;
    } else {
      return `${typeText}转换完成！`;
    }
  }

  /**
   * 生成缓存键
   */
  getCacheKey(filePath) {
    return `${filePath}_${Platform.OS}`;
  }

  /**
   * 清理转换缓存
   */
  async clearCache() {
    try {
      const cacheDir = RNFS.CachesDirectoryPath;
      const files = await RNFS.readDir(cacheDir);
      
      for (const file of files) {
        if (file.name.includes('_converted_') && file.name.endsWith('.pdf')) {
          await RNFS.unlink(file.path);
          console.log('DocumentConverter: 清理缓存文件:', file.name);
        }
      }
      
      this.conversionCache.clear();
      console.log('DocumentConverter: 缓存清理完成');
      
    } catch (error) {
      console.error('DocumentConverter: 缓存清理失败:', error);
    }
  }

  /**
   * 获取缓存大小
   */
  async getCacheSize() {
    try {
      const cacheDir = RNFS.CachesDirectoryPath;
      const files = await RNFS.readDir(cacheDir);
      
      let totalSize = 0;
      for (const file of files) {
        if (file.name.includes('_converted_') && file.name.endsWith('.pdf')) {
          totalSize += file.size;
        }
      }
      
      return totalSize;
      
    } catch (error) {
      console.error('DocumentConverter: 获取缓存大小失败:', error);
      return 0;
    }
  }

  /**
   * 检查文档是否支持转换
   */
  isSupportedDocument(filePath) {
    const extension = filePath.toLowerCase().split('.').pop();
    return ['doc', 'docx', 'ppt', 'pptx'].includes(extension);
  }

  /**
   * 获取文档类型
   */
  getDocumentType(filePath) {
    const extension = filePath.toLowerCase().split('.').pop();
    if (['doc', 'docx'].includes(extension)) {
      return 'word';
    } else if (['ppt', 'pptx'].includes(extension)) {
      return 'ppt';
    }
    return 'unknown';
  }
}

// 创建单例实例
const documentConverter = new DocumentConverter();

export default documentConverter;
