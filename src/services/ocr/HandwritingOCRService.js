/**
 * 手写OCR服务
 * 将手写笔迹转换为文字
 */

import RNTextDetector from 'react-native-text-detector';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

class HandwritingOCRService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * 初始化OCR服务
   */
  async initialize() {
    try {
      if (this.isInitialized) return true;
      
      // 检查设备是否支持文本检测
      const isSupported = await RNTextDetector.isSupported();
      if (!isSupported) {
        console.warn('HandwritingOCRService: 设备不支持文本检测');
        return false;
      }
      
      this.isInitialized = true;
      console.log('HandwritingOCRService: 初始化成功');
      return true;
    } catch (error) {
      console.error('HandwritingOCRService: 初始化失败:', error);
      return false;
    }
  }

  /**
   * 将笔迹转换为图片
   * @param {Array} strokes - 笔迹数组
   * @param {number} width - 画布宽度
   * @param {number} height - 画布高度
   * @returns {Promise<string>} 图片路径
   */
  async strokesToImage(strokes, width = 800, height = 600) {
    try {
      // 创建SVG内容
      const svgContent = this.createSVGFromStrokes(strokes, width, height);
      
      // 保存SVG文件
      const svgPath = `${RNFS.CachesDirectoryPath}/handwriting_${Date.now()}.svg`;
      await RNFS.writeFile(svgPath, svgContent, 'utf8');
      
      // 如果需要转换为PNG，可以使用react-native-svg-transformer
      // 这里暂时返回SVG路径
      return svgPath;
    } catch (error) {
      console.error('HandwritingOCRService: 笔迹转图片失败:', error);
      throw error;
    }
  }

  /**
   * 从笔迹创建SVG
   * @param {Array} strokes - 笔迹数组
   * @param {number} width - 宽度
   * @param {number} height - 高度
   * @returns {string} SVG内容
   */
  createSVGFromStrokes(strokes, width, height) {
    let pathElements = '';
    
    strokes.forEach((stroke, index) => {
      if (!stroke.points || stroke.points.length === 0) return;
      
      let pathData = `M ${stroke.points[0].x} ${stroke.points[0].y}`;
      
      for (let i = 1; i < stroke.points.length; i++) {
        pathData += ` L ${stroke.points[i].x} ${stroke.points[i].y}`;
      }
      
      pathElements += `
        <path 
          d="${pathData}" 
          stroke="${stroke.color || '#000000'}" 
          stroke-width="${stroke.width || 2}" 
          fill="none" 
          stroke-linecap="round" 
          stroke-linejoin="round"
        />`;
    });
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  ${pathElements}
</svg>`;
  }

  /**
   * 识别图片中的文字
   * @param {string} imagePath - 图片路径
   * @returns {Promise<Object>} 识别结果
   */
  async recognizeText(imagePath) {
    try {
      await this.initialize();
      
      if (!this.isInitialized) {
        throw new Error('OCR服务未初始化');
      }
      
      // 使用RNTextDetector识别文字
      const result = await RNTextDetector.detectFromUri(imagePath);
      
      if (result && result.length > 0) {
        // 提取所有识别到的文字
        const recognizedText = result.map(item => item.text).join(' ');
        
        return {
          success: true,
          text: recognizedText,
          details: result,
          confidence: this.calculateAverageConfidence(result)
        };
      } else {
        return {
          success: false,
          text: '',
          error: '未识别到文字内容'
        };
      }
    } catch (error) {
      console.error('HandwritingOCRService: 文字识别失败:', error);
      return {
        success: false,
        text: '',
        error: error.message
      };
    }
  }

  /**
   * 计算平均置信度
   * @param {Array} results - 识别结果
   * @returns {number} 平均置信度
   */
  calculateAverageConfidence(results) {
    if (!results || results.length === 0) return 0;
    
    const totalConfidence = results.reduce((sum, item) => {
      return sum + (item.confidence || 0);
    }, 0);
    
    return totalConfidence / results.length;
  }

  /**
   * 从笔迹识别文字（主要方法）
   * @param {Array} strokes - 笔迹数组
   * @param {number} width - 画布宽度
   * @param {number} height - 画布高度
   * @returns {Promise<Object>} 识别结果
   */
  async recognizeFromStrokes(strokes, width = 800, height = 600) {
    try {
      if (!strokes || strokes.length === 0) {
        return {
          success: false,
          text: '',
          error: '没有手写内容'
        };
      }
      
      console.log('HandwritingOCRService: 开始识别手写内容，笔迹数量:', strokes.length);
      
      // 将笔迹转换为图片
      const imagePath = await this.strokesToImage(strokes, width, height);
      
      // 识别图片中的文字
      const result = await this.recognizeText(imagePath);
      
      // 清理临时文件
      try {
        await RNFS.unlink(imagePath);
      } catch (cleanupError) {
        console.warn('HandwritingOCRService: 清理临时文件失败:', cleanupError);
      }
      
      return result;
    } catch (error) {
      console.error('HandwritingOCRService: 手写识别失败:', error);
      return {
        success: false,
        text: '',
        error: error.message
      };
    }
  }

  /**
   * 将笔迹转换为文本（主要接口）
   * @param {Array} strokes - 笔迹数组
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 转换结果
   */
  async convertStrokesToText(strokes, options = {}) {
    try {
      // 确保服务已初始化
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          return {
            success: false,
            text: '',
            error: 'OCR服务初始化失败'
          };
        }
      }

      // 验证输入
      if (!strokes || !Array.isArray(strokes) || strokes.length === 0) {
        return {
          success: false,
          text: '',
          error: '没有可转换的笔迹'
        };
      }

      // 设置默认选项
      const {
        width = 800,
        height = 600,
        language = 'zh-CN',
        minConfidence = 0.5
      } = options;

      console.log(`HandwritingOCRService: 开始转换 ${strokes.length} 个笔迹为文本`);

      // 调用识别方法
      const result = await this.recognizeFromStrokes(strokes, width, height);

      if (result.success && result.confidence >= minConfidence) {
        console.log('HandwritingOCRService: 转换成功:', result.text);
        return {
          success: true,
          text: result.text,
          confidence: result.confidence,
          language: language
        };
      } else {
        console.warn('HandwritingOCRService: 转换失败或置信度过低:', result);
        return {
          success: false,
          text: '',
          error: result.error || '识别置信度过低'
        };
      }
    } catch (error) {
      console.error('HandwritingOCRService: 转换笔迹为文本失败:', error);
      return {
        success: false,
        text: '',
        error: error.message
      };
    }
  }

  /**
   * 检查OCR服务是否可用
   * @returns {Promise<boolean>} 是否可用
   */
  async isAvailable() {
    try {
      return await RNTextDetector.isSupported();
    } catch (error) {
      console.error('HandwritingOCRService: 检查可用性失败:', error);
      return false;
    }
  }

  /**
   * 获取支持的语言列表
   * @returns {Promise<Array>} 支持的语言
   */
  async getSupportedLanguages() {
    try {
      // react-native-text-detector 通常支持多种语言
      // 具体支持的语言取决于设备和系统
      return ['zh-CN', 'en', 'ja', 'ko']; // 常见的支持语言
    } catch (error) {
      console.error('HandwritingOCRService: 获取支持语言失败:', error);
      return ['en']; // 默认英语
    }
  }

  /**
   * 清理缓存文件
   */
  async cleanup() {
    try {
      const cacheDir = RNFS.CachesDirectoryPath;
      const files = await RNFS.readDir(cacheDir);
      
      // 删除手写相关的临时文件
      const handwritingFiles = files.filter(file => 
        file.name.startsWith('handwriting_') && 
        (file.name.endsWith('.svg') || file.name.endsWith('.png'))
      );
      
      for (const file of handwritingFiles) {
        try {
          await RNFS.unlink(file.path);
        } catch (deleteError) {
          console.warn('HandwritingOCRService: 删除文件失败:', file.path, deleteError);
        }
      }
      
      console.log(`HandwritingOCRService: 清理了 ${handwritingFiles.length} 个临时文件`);
    } catch (error) {
      console.error('HandwritingOCRService: 清理缓存失败:', error);
    }
  }
}

// 创建单例实例
const handwritingOCRService = new HandwritingOCRService();

export default handwritingOCRService;
export { HandwritingOCRService };
