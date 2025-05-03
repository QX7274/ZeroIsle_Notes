/**
 * 离线AI处理服务
 * 提供基于TensorFlow.js的离线AI处理功能
 */
import * as tf from '@tensorflow/tfjs';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';
import { analyticsService } from './analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 模型状态
const MODEL_STATUS = {
  NOT_LOADED: 'not_loaded',
  LOADING: 'loading',
  LOADED: 'loaded',
  FAILED: 'failed',
};

// 模型类型
const MODEL_TYPES = {
  HANDWRITING: 'handwriting',
  HANDWRITING_CHINESE: 'handwriting_chinese',
  TEXT_CLASSIFICATION: 'text_classification',
  SHAPE_RECOGNITION: 'shape_recognition',
};

// 模型缓存键
const MODEL_CACHE_KEYS = {
  [MODEL_TYPES.HANDWRITING]: 'offline_model_handwriting',
  [MODEL_TYPES.HANDWRITING_CHINESE]: 'offline_model_handwriting_chinese',
  [MODEL_TYPES.TEXT_CLASSIFICATION]: 'offline_model_text_classification',
  [MODEL_TYPES.SHAPE_RECOGNITION]: 'offline_model_shape_recognition',
};

// 字符映射（用于手写识别）
const CHAR_MAPS = {
  // 英文数字和符号
  [MODEL_TYPES.HANDWRITING]: {
    // 0-9
    ...Array.from({ length: 10 }, (_, i) => ({ [i]: String.fromCharCode(i + 48) })).reduce((acc, val) => ({ ...acc, ...val }), {}),
    // A-Z
    ...Array.from({ length: 26 }, (_, i) => ({ [i + 10]: String.fromCharCode(i + 65) })).reduce((acc, val) => ({ ...acc, ...val }), {}),
    // a-z
    ...Array.from({ length: 26 }, (_, i) => ({ [i + 36]: String.fromCharCode(i + 97) })).reduce((acc, val) => ({ ...acc, ...val }), {}),
    // 常用符号
    62: '.',
    63: ',',
    64: '?',
    65: '!',
    66: '@',
    67: '#',
    68: '$',
    69: '%',
  },
  // 中文常用字符
  [MODEL_TYPES.HANDWRITING_CHINESE]: {
    // 这里应该是中文字符映射，实际应用中应该有更完整的映射表
    // 这里只是示例
    0: '的',
    1: '一',
    2: '是',
    3: '在',
    4: '不',
    5: '了',
    6: '有',
    7: '和',
    8: '人',
    9: '这',
    // ... 更多中文字符
  }
};

class OfflineAIService {
  constructor() {
    this.models = {};
    this.modelStatus = {};
    this.modelMetadata = {};
    this.vocabularies = {};
    this.modelPaths = {
      [MODEL_TYPES.HANDWRITING]: {
        modelJson: require('../../assets/models/handwriting/model.json'),
        modelWeights: require('../../assets/models/handwriting/weights.bin'),
        metadata: {
          version: '1.0.0',
          inputShape: [28, 28, 1],
          outputClasses: 70,
        },
      },
      [MODEL_TYPES.HANDWRITING_CHINESE]: {
        modelJson: require('../../assets/models/handwriting_chinese/model.json'),
        modelWeights: require('../../assets/models/handwriting_chinese/weights.bin'),
        metadata: {
          version: '1.0.0',
          inputShape: [64, 64, 1],
          outputClasses: 3755, // 常用汉字数量
        },
      },
      [MODEL_TYPES.SHAPE_RECOGNITION]: {
        modelJson: require('../../assets/models/shape_recognition/model.json'),
        modelWeights: require('../../assets/models/shape_recognition/weights.bin'),
        metadata: {
          version: '1.0.0',
          inputShape: [28, 28, 1],
          outputClasses: 10, // 基本形状数量
        },
      },
    };
    
    // 初始化模型状态
    Object.values(MODEL_TYPES).forEach(type => {
      this.modelStatus[type] = MODEL_STATUS.NOT_LOADED;
    });
  }

  /**
   * 初始化TensorFlow.js
   * @returns {Promise<boolean>} - 初始化结果
   */
  async initTensorFlow() {
    try {
      await tf.ready();
      console.log('TensorFlow.js已准备就绪');
      return true;
    } catch (error) {
      console.error('TensorFlow.js初始化失败:', error);
      analyticsService.trackError(error, { action: 'tf_init' });
      return false;
    }
  }

  /**
   * 加载模型
   * @param {string} modelType - 模型类型
   * @returns {Promise<boolean>} - 加载结果
   */
  async loadModel(modelType) {
    // 检查模型是否已加载
    if (this.modelStatus[modelType] === MODEL_STATUS.LOADED) {
      return true;
    }
    
    // 检查模型是否正在加载
    if (this.modelStatus[modelType] === MODEL_STATUS.LOADING) {
      // 等待模型加载完成
      return new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (this.modelStatus[modelType] === MODEL_STATUS.LOADED) {
            clearInterval(checkInterval);
            resolve(true);
          } else if (this.modelStatus[modelType] === MODEL_STATUS.FAILED) {
            clearInterval(checkInterval);
            resolve(false);
          }
        }, 100);
      });
    }
    
    // 开始加载模型
    this.modelStatus[modelType] = MODEL_STATUS.LOADING;
    
    try {
      // 初始化TensorFlow.js
      await this.initTensorFlow();
      
      // 加载模型元数据
      await this._loadModelMetadata(modelType);
      
      // 尝试从缓存加载模型
      let model = await this._loadModelFromCache(modelType);
      
      // 如果缓存加载失败，从资源加载
      if (!model) {
        console.log(`从资源加载模型: ${modelType}`);
        
        // 根据模型类型加载不同的模型
        switch (modelType) {
          case MODEL_TYPES.HANDWRITING:
            model = await this._loadHandwritingModel();
            break;
          case MODEL_TYPES.HANDWRITING_CHINESE:
            model = await this._loadHandwritingChineseModel();
            break;
          case MODEL_TYPES.SHAPE_RECOGNITION:
            model = await this._loadShapeRecognitionModel();
            break;
          case MODEL_TYPES.TEXT_CLASSIFICATION:
            model = await this._loadTextClassificationModel();
            break;
          default:
            throw new Error(`未知的模型类型: ${modelType}`);
        }
        
        // 保存模型到缓存
        await this._saveModelToCache(model, modelType);
      }
      
      // 保存模型
      this.models[modelType] = model;
      
      // 更新模型状态
      this.modelStatus[modelType] = MODEL_STATUS.LOADED;
      console.log(`模型已加载: ${modelType}`);
      
      // 记录事件
      analyticsService.trackEvent('model_loaded', { modelType });
      
      return true;
    } catch (error) {
      // 更新模型状态
      this.modelStatus[modelType] = MODEL_STATUS.FAILED;
      console.error(`模型加载失败: ${modelType}`, error);
      analyticsService.trackError(error, { action: 'model_load', modelType });
      return false;
    }
  }

  /**
   * 从缓存加载模型
   * @param {string} modelType - 模型类型
   * @returns {Promise<tf.LayersModel|null>} - 模型或null
   * @private
   */
  async _loadModelFromCache(modelType) {
    try {
      // 获取缓存键
      const cacheKey = MODEL_CACHE_KEYS[modelType];
      if (!cacheKey) return null;
      
      // 检查缓存是否存在
      const modelInfo = await AsyncStorage.getItem(cacheKey);
      if (!modelInfo) return null;
      
      // 解析模型信息
      const { modelPath, version } = JSON.parse(modelInfo);
      
      // 检查版本是否匹配
      const currentVersion = this.modelPaths[modelType]?.metadata?.version || '1.0.0';
      if (version !== currentVersion) {
        console.log(`模型版本不匹配: ${version} != ${currentVersion}`);
        return null;
      }
      
      // 加载模型
      return await tf.loadLayersModel(`indexeddb://${modelType}`);
    } catch (error) {
      console.error(`从缓存加载模型失败: ${modelType}`, error);
      return null;
    }
  }
  
  /**
   * 将模型保存到缓存
   * @param {tf.LayersModel} model - 模型
   * @param {string} modelType - 模型类型
   * @returns {Promise<boolean>} - 保存结果
   * @private
   */
  async _saveModelToCache(model, modelType) {
    try {
      // 获取缓存键
      const cacheKey = MODEL_CACHE_KEYS[modelType];
      if (!cacheKey) return false;
      
      // 保存模型
      await model.save(`indexeddb://${modelType}`);
      
      // 保存模型信息
      const modelInfo = {
        modelPath: `indexeddb://${modelType}`,
        version: this.modelPaths[modelType]?.metadata?.version || '1.0.0',
        timestamp: Date.now()
      };
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(modelInfo));
      
      return true;
    } catch (error) {
      console.error(`保存模型到缓存失败: ${modelType}`, error);
      return false;
    }
  }
  
  /**
   * 加载模型元数据和词汇表
   * @param {string} modelType - 模型类型
   * @returns {Promise<boolean>} - 加载结果
   * @private
   */
  async _loadModelMetadata(modelType) {
    try {
      // 加载元数据
      this.modelMetadata[modelType] = this.modelPaths[modelType]?.metadata || {};
      
      // 加载词汇表（如果有）
      if (this.modelPaths[modelType]?.vocabulary) {
        this.vocabularies[modelType] = this.modelPaths[modelType].vocabulary;
      }
      
      return true;
    } catch (error) {
      console.error(`加载模型元数据失败: ${modelType}`, error);
      return false;
    }
  }

  /**
   * 加载手写识别模型
   * @returns {Promise<tf.LayersModel>} - 模型
   * @private
   */
  async _loadHandwritingModel() {
    const { modelJson, modelWeights } = this.modelPaths[MODEL_TYPES.HANDWRITING];
    return await tf.loadLayersModel(bundleResourceIO(modelJson, modelWeights));
  }
  
  /**
   * 加载中文手写识别模型
   * @returns {Promise<tf.LayersModel>} - 模型
   * @private
   */
  async _loadHandwritingChineseModel() {
    const { modelJson, modelWeights } = this.modelPaths[MODEL_TYPES.HANDWRITING_CHINESE];
    return await tf.loadLayersModel(bundleResourceIO(modelJson, modelWeights));
  }
  
  /**
   * 加载形状识别模型
   * @returns {Promise<tf.LayersModel>} - 模型
   * @private
   */
  async _loadShapeRecognitionModel() {
    const { modelJson, modelWeights } = this.modelPaths[MODEL_TYPES.SHAPE_RECOGNITION];
    return await tf.loadLayersModel(bundleResourceIO(modelJson, modelWeights));
  }

  /**
   * 加载文本分类模型
   * @returns {Promise<tf.LayersModel>} - 模型
   * @private
   */
  async _loadTextClassificationModel() {
    // 这里应该使用实际的模型文件
    // 在实际应用中，模型文件应该打包到应用中
    const modelJson = require('../../assets/models/text_classification/model.json');
    const modelWeights = require('../../assets/models/text_classification/weights.bin');
    
    return await tf.loadLayersModel(bundleResourceIO(modelJson, modelWeights));
  }

  /**
   * 识别手写文本
   * @param {ImageData} imageData - 图像数据
   * @param {Object} options - 识别选项
   * @param {string} options.language - 语言，'en'或'zh'
   * @param {boolean} options.multiChar - 是否识别多个字符
   * @returns {Promise<string|Array>} - 识别结果
   */
  async recognizeHandwriting(imageData, options = {}) {
    try {
      const { language = 'en', multiChar = false } = options;
      
      // 选择模型类型
      const modelType = language === 'zh' ? MODEL_TYPES.HANDWRITING_CHINESE : MODEL_TYPES.HANDWRITING;
      
      // 加载模型
      const modelLoaded = await this.loadModel(modelType);
      if (!modelLoaded) {
        throw new Error(`手写识别模型加载失败: ${modelType}`);
      }
      
      // 预处理图像
      const inputShape = this.modelMetadata[modelType].inputShape;
      const tensor = this._preprocessImage(imageData, inputShape);
      
      // 进行预测
      const predictions = await this.models[modelType].predict(tensor);
      
      // 后处理预测结果
      let result;
      if (multiChar) {
        // 多字符识别
        result = this._postprocessMultiCharResult(predictions, modelType);
      } else {
        // 单字符识别
        result = this._postprocessHandwritingResult(predictions, modelType);
      }
      
      // 释放张量
      tensor.dispose();
      predictions.dispose();
      
      // 记录事件
      analyticsService.trackEvent('handwriting_recognized', {
        language,
        multiChar,
        resultLength: typeof result === 'string' ? result.length : result.length,
      });
      
      return result;
    } catch (error) {
      console.error('手写识别失败:', error);
      analyticsService.trackError(error, { action: 'recognize_handwriting' });
      throw error;
    }
  }
  
  /**
   * 识别形状
   * @param {ImageData} imageData - 图像数据
   * @returns {Promise<string>} - 识别结果
   */
  async recognizeShape(imageData) {
    try {
      // 加载模型
      const modelLoaded = await this.loadModel(MODEL_TYPES.SHAPE_RECOGNITION);
      if (!modelLoaded) {
        throw new Error('形状识别模型加载失败');
      }
      
      // 预处理图像
      const inputShape = this.modelMetadata[MODEL_TYPES.SHAPE_RECOGNITION].inputShape;
      const tensor = this._preprocessImage(imageData, inputShape);
      
      // 进行预测
      const predictions = await this.models[MODEL_TYPES.SHAPE_RECOGNITION].predict(tensor);
      
      // 后处理预测结果
      const result = this._postprocessShapeResult(predictions);
      
      // 释放张量
      tensor.dispose();
      predictions.dispose();
      
      // 记录事件
      analyticsService.trackEvent('shape_recognized', {
        shape: result,
      });
      
      return result;
    } catch (error) {
      console.error('形状识别失败:', error);
      analyticsService.trackError(error, { action: 'recognize_shape' });
      throw error;
    }
  }

  /**
   * 预处理图像
   * @param {ImageData} imageData - 图像数据
   * @param {Array} inputShape - 输入形状 [height, width, channels]
   * @returns {tf.Tensor} - 预处理后的张量
   * @private
   */
  _preprocessImage(imageData, inputShape = [28, 28, 1]) {
    // 将图像转换为张量
    const tensor = tf.browser.fromPixels(imageData, inputShape[2]);
    
    // 调整大小
    const resized = tf.image.resizeBilinear(tensor, [inputShape[0], inputShape[1]]);
    
    // 归一化
    const normalized = resized.div(255.0);
    
    // 添加批次维度
    const batched = normalized.expandDims(0);
    
    // 释放中间张量
    tensor.dispose();
    resized.dispose();
    normalized.dispose();
    
    return batched;
  }

  /**
   * 后处理手写识别结果
   * @param {tf.Tensor} predictions - 预测结果
   * @param {string} modelType - 模型类型
   * @returns {string} - 后处理后的结果
   * @private
   */
  _postprocessHandwritingResult(predictions, modelType) {
    // 获取预测结果
    const values = predictions.dataSync();
    
    // 获取最大值索引
    const maxIndex = values.indexOf(Math.max(...values));
    
    // 将索引转换为字符
    const charMap = CHAR_MAPS[modelType] || {};
    return charMap[maxIndex] || String.fromCharCode(maxIndex + 48);
  }
  
  /**
   * 后处理多字符识别结果
   * @param {tf.Tensor} predictions - 预测结果
   * @param {string} modelType - 模型类型
   * @returns {Array} - 后处理后的结果数组
   * @private
   */
  _postprocessMultiCharResult(predictions, modelType) {
    // 获取预测结果
    const values = predictions.dataSync();
    const outputClasses = this.modelMetadata[modelType].outputClasses;
    
    // 获取前5个最可能的结果
    const indices = [];
    const probs = [];
    
    // 复制值数组并获取索引
    const valuesCopy = [...values];
    for (let i = 0; i < 5; i++) {
      const maxValue = Math.max(...valuesCopy);
      const maxIndex = valuesCopy.indexOf(maxValue);
      
      // 计算实际类别索引
      const classIndex = maxIndex % outputClasses;
      
      // 添加到结果
      indices.push(classIndex);
      probs.push(maxValue);
      
      // 将已处理的值设为-1，避免重复选择
      valuesCopy[maxIndex] = -1;
    }
    
    // 将索引转换为字符
    const charMap = CHAR_MAPS[modelType] || {};
    return indices.map((index, i) => ({
      char: charMap[index] || String.fromCharCode(index + 48),
      probability: probs[i]
    }));
  }
  
  /**
   * 后处理形状识别结果
   * @param {tf.Tensor} predictions - 预测结果
   * @returns {string} - 后处理后的结果
   * @private
   */
  _postprocessShapeResult(predictions) {
    // 获取预测结果
    const values = predictions.dataSync();
    
    // 获取最大值索引
    const maxIndex = values.indexOf(Math.max(...values));
    
    // 将索引转换为形状名称
    const shapes = ['圆形', '矩形', '三角形', '直线', '箭头', '星形', '椭圆', '菱形', '五边形', '六边形'];
    return shapes[maxIndex] || '未知形状';
  }

  /**
   * 分类文本
   * @param {string} text - 文本
   * @returns {Promise<string>} - 分类结果
   */
  async classifyText(text) {
    try {
      // 加载模型
      const modelLoaded = await this.loadModel(MODEL_TYPES.TEXT_CLASSIFICATION);
      if (!modelLoaded) {
        throw new Error('文本分类模型加载失败');
      }
      
      // 预处理文本
      const tensor = this._preprocessText(text);
      
      // 进行预测
      const predictions = await this.models[MODEL_TYPES.TEXT_CLASSIFICATION].predict(tensor);
      
      // 后处理预测结果
      const result = this._postprocessTextClassificationResult(predictions);
      
      // 释放张量
      tensor.dispose();
      predictions.dispose();
      
      // 记录事件
      analyticsService.trackEvent('text_classified', {
        textLength: text.length,
        result,
      });
      
      return result;
    } catch (error) {
      console.error('文本分类失败:', error);
      analyticsService.trackError(error, { action: 'classify_text' });
      throw error;
    }
  }

  /**
   * 预处理文本
   * @param {string} text - 文本
   * @returns {tf.Tensor} - 预处理后的张量
   * @private
   */
  _preprocessText(text) {
    // 这里应该使用实际的文本预处理逻辑
    // 在实际应用中，应该使用词嵌入或其他文本表示方法
    
    // 简单示例：将文本转换为ASCII码，然后归一化
    const charCodes = [];
    for (let i = 0; i < text.length; i++) {
      charCodes.push(text.charCodeAt(i) / 255.0);
    }
    
    // 填充或截断到固定长度
    const maxLength = 100;
    const paddedCodes = charCodes.slice(0, maxLength);
    while (paddedCodes.length < maxLength) {
      paddedCodes.push(0);
    }
    
    // 创建张量
    return tf.tensor2d([paddedCodes], [1, maxLength]);
  }

  /**
   * 后处理文本分类结果
   * @param {tf.Tensor} predictions - 预测结果
   * @returns {string} - 后处理后的结果
   * @private
   */
  _postprocessTextClassificationResult(predictions) {
    // 获取预测结果
    const values = predictions.dataSync();
    
    // 获取最大值索引
    const maxIndex = values.indexOf(Math.max(...values));
    
    // 将索引转换为类别
    // 这里假设模型输出是文本类别
    const categories = ['正面', '负面', '中性'];
    return categories[maxIndex];
  }

  /**
   * 获取模型状态
   * @param {string} modelType - 模型类型
   * @returns {string} - 模型状态
   */
  getModelStatus(modelType) {
    return this.modelStatus[modelType] || MODEL_STATUS.NOT_LOADED;
  }

  /**
   * 卸载模型
   * @param {string} modelType - 模型类型
   * @returns {Promise<boolean>} - 卸载结果
   */
  async unloadModel(modelType) {
    try {
      if (this.models[modelType]) {
        this.models[modelType].dispose();
        delete this.models[modelType];
      }
      
      this.modelStatus[modelType] = MODEL_STATUS.NOT_LOADED;
      
      // 记录事件
      analyticsService.trackEvent('model_unloaded', { modelType });
      
      return true;
    } catch (error) {
      console.error(`模型卸载失败: ${modelType}`, error);
      analyticsService.trackError(error, { action: 'model_unload', modelType });
      return false;
    }
  }
  
  /**
   * 保存手写笔迹
   * @param {Array} paths - 笔迹路径数组
   * @param {string} imageUri - 图像URI
   * @param {string} recognizedText - 识别的文本
   * @returns {Promise<string>} - 保存的ID
   */
  async saveHandwritingStrokes(paths, imageUri, recognizedText = '') {
    try {
      // 生成ID
      const id = Date.now().toString();
      
      // 创建记录
      const record = {
        id,
        paths,
        imageUri,
        recognizedText,
        timestamp: new Date().toISOString(),
      };
      
      // 获取历史记录
      const history = await this.getHandwritingHistory();
      
      // 添加新记录
      const updatedHistory = [record, ...history];
      
      // 限制历史记录数量
      const limitedHistory = updatedHistory.slice(0, 50);
      
      // 保存历史记录
      await AsyncStorage.setItem('handwriting_strokes_history', JSON.stringify(limitedHistory));
      
      // 记录事件
      analyticsService.trackEvent('handwriting_strokes_saved', {
        pathsCount: paths.length,
        hasRecognizedText: !!recognizedText,
      });
      
      return id;
    } catch (error) {
      console.error('保存手写笔迹失败:', error);
      analyticsService.trackError(error, { action: 'save_handwriting_strokes' });
      throw error;
    }
  }
  
  /**
   * 获取手写笔迹历史
   * @returns {Promise<Array>} - 历史记录
   */
  async getHandwritingHistory() {
    try {
      const history = await AsyncStorage.getItem('handwriting_strokes_history');
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('获取手写笔迹历史失败:', error);
      return [];
    }
  }
  
  /**
   * 删除手写笔迹历史
   * @param {string} id - 记录ID
   * @returns {Promise<boolean>} - 删除结果
   */
  async deleteHandwritingHistory(id) {
    try {
      // 获取历史记录
      const history = await this.getHandwritingHistory();
      
      // 过滤掉要删除的记录
      const updatedHistory = history.filter(item => item.id !== id);
      
      // 保存更新后的历史记录
      await AsyncStorage.setItem('handwriting_strokes_history', JSON.stringify(updatedHistory));
      
      return true;
    } catch (error) {
      console.error('删除手写笔迹历史失败:', error);
      return false;
    }
  }
  
  /**
   * 清空手写笔迹历史
   * @returns {Promise<boolean>} - 清空结果
   */
  async clearHandwritingHistory() {
    try {
      await AsyncStorage.removeItem('handwriting_strokes_history');
      return true;
    } catch (error) {
      console.error('清空手写笔迹历史失败:', error);
      return false;
    }
  }
}

// 导出模型类型和状态
export const MODEL_TYPES_EXPORT = MODEL_TYPES;
export const MODEL_STATUS_EXPORT = MODEL_STATUS;

// 创建单例
export const offlineAIService = new OfflineAIService();
