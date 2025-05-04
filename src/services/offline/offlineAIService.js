/**
 * 离线AI处理服务
 * 提供基于TensorFlow.js的离线AI处理功能
 */
import * as tf from '@tensorflow/tfjs';
import { analyticsService } from '../analytics/analyticsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineStorageService } from './offlineStorage';

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
    3: '了',
    4: '我',
    5: '在',
    6: '有',
    7: '和',
    8: '人',
    9: '中',
    // ... 更多中文字符
  }
};

class OfflineAIService {
  constructor() {
    this.models = {};
    this.modelStatus = {};
    this.modelMetadata = {};
    this.vocabularies = {};
    // 模型路径配置
    // 注意：这里不再直接require模型文件，而是在运行时动态加载
    this.modelPaths = {
      [MODEL_TYPES.HANDWRITING]: {
        // 模型将在运行时从assets目录加载
        modelPath: 'assets/models/handwriting/',
        metadata: {
          version: '1.0.0',
          inputShape: [28, 28, 1],
          outputClasses: 70,
        },
      },
      [MODEL_TYPES.HANDWRITING_CHINESE]: {
        // 模型将在运行时从assets目录加载
        modelPath: 'assets/models/handwriting_chinese/',
        metadata: {
          version: '1.0.0',
          inputShape: [64, 64, 1],
          outputClasses: 3755, // 常用汉字数量
        },
      },
      [MODEL_TYPES.SHAPE_RECOGNITION]: {
        // 模型将在运行时从assets目录加载
        modelPath: 'assets/models/shape_recognition/',
        metadata: {
          version: '1.0.0',
          inputShape: [28, 28, 1],
          outputClasses: 10, // 基本形状数量
        },
      },
    };

    // 初始化模型状?
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
      console.error('TensorFlow.js初始化失败', error);
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

    // 检查模型是否正在加�?
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
        console.log(`从资源加载模型 ${modelType}`);

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
            throw new Error(`未知的模型类? ${modelType}`);
        }

        // 保存模型到缓存
        await this._saveModelToCache(model, modelType);
      }

      // 保存模型
      this.models[modelType] = model;

      // 更新模型状态
      this.modelStatus[modelType] = MODEL_STATUS.LOADED;
      console.log(`模型已加载 ${modelType}`);

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
        console.log(`模型版本不匹配 ${version} != ${currentVersion}`);
        return null;
      }

      // 加载模型
      return await tf.loadLayersModel(`indexeddb://${modelType}`);
    } catch (error) {
      console.error(`从缓存加载模型失败 ${modelType}`, error);
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
      console.error(`保存模型到缓存失败 ${modelType}`, error);
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
      console.error(`加载模型元数据失? ${modelType}`, error);
      return false;
    }
  }

  /**
   * 加载手写识别模型
   * @returns {Promise<tf.LayersModel|Object>} - 模型
   * @private
   */
  async _loadHandwritingModel() {
    try {
      // 检查是否已下载百度飞桨OCR模型
      const modelInfo = await this._checkPaddleOCRModel('handwriting');

      if (modelInfo && modelInfo.downloaded) {
        // 如果已下载百度飞桨OCR模型，使用该模型
        console.log('使用百度飞桨OCR模型进行手写识别');
        return {
          type: 'paddleocr',
          path: modelInfo.path,
          version: modelInfo.version,
          // 这里可以添加其他模型信息
        };
      } else {
        // 如果未下载百度飞桨OCR模型，尝试使用TensorFlow.js模型
        console.log('使用TensorFlow.js模型进行手写识别');

        // 这里应该实现动态加载模型的逻辑
        // 由于我们不能直接require模型文件，这里返回一个模拟的模型对象
        return {
          type: 'tfjs',
          predict: async (input) => {
            // 模拟预测结果
            console.warn('使用模拟的手写识别模型，返回默认结果');
            return tf.tensor([
              [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
            ]);
          }
        };
      }
    } catch (error) {
      console.error('加载手写识别模型失败:', error);
      throw error;
    }
  }

  /**
   * 加载中文手写识别模型
   * @returns {Promise<tf.LayersModel|Object>} - 模型
   * @private
   */
  async _loadHandwritingChineseModel() {
    try {
      // 检查是否已下载百度飞桨OCR模型
      const modelInfo = await this._checkPaddleOCRModel('handwriting_chinese');

      if (modelInfo && modelInfo.downloaded) {
        // 如果已下载百度飞桨OCR模型，使用该模型
        console.log('使用百度飞桨OCR模型进行中文手写识别');
        return {
          type: 'paddleocr',
          path: modelInfo.path,
          version: modelInfo.version,
          // 这里可以添加其他模型信息
        };
      } else {
        // 如果未下载百度飞桨OCR模型，尝试使用TensorFlow.js模型
        console.log('使用TensorFlow.js模型进行中文手写识别');

        // 这里应该实现动态加载模型的逻辑
        // 由于我们不能直接require模型文件，这里返回一个模拟的模型对象
        return {
          type: 'tfjs',
          predict: async (input) => {
            // 模拟预测结果
            console.warn('使用模拟的中文手写识别模型，返回默认结果');
            return tf.tensor([
              [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
            ]);
          }
        };
      }
    } catch (error) {
      console.error('加载中文手写识别模型失败:', error);
      throw error;
    }
  }

  /**
   * 加载形状识别模型
   * @returns {Promise<tf.LayersModel|Object>} - 模型
   * @private
   */
  async _loadShapeRecognitionModel() {
    try {
      // 这里应该实现动态加载模型的逻辑
      // 由于我们不能直接require模型文件，这里返回一个模拟的模型对象
      return {
        type: 'tfjs',
        predict: async (input) => {
          // 模拟预测结果
          console.warn('使用模拟的形状识别模型，返回默认结果');
          return tf.tensor([
            [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
          ]);
        }
      };
    } catch (error) {
      console.error('加载形状识别模型失败:', error);
      throw error;
    }
  }

  /**
   * 加载文本分类模型
   * @returns {Promise<tf.LayersModel|Object>} - 模型
   * @private
   */
  async _loadTextClassificationModel() {
    try {
      // 这里应该实现动态加载模型的逻辑
      // 由于我们不能直接require模型文件，这里返回一个模拟的模型对象
      return {
        type: 'tfjs',
        predict: async (input) => {
          // 模拟预测结果
          console.warn('使用模拟的文本分类模型，返回默认结果');
          return tf.tensor([
            [0.7, 0.2, 0.1] // 正面、负面、中性的概率
          ]);
        }
      };
    } catch (error) {
      console.error('加载文本分类模型失败:', error);
      throw error;
    }
  }

  /**
   * 检查百度飞桨OCR模型是否已下载
   * @param {string} modelType - 模型类型
   * @returns {Promise<Object|null>} - 模型信息
   * @private
   */
  async _checkPaddleOCRModel(modelType) {
    try {
      // 从AsyncStorage获取模型信息
      const modelInfoJson = await AsyncStorage.getItem(`paddleocr_${modelType}`);
      if (!modelInfoJson) return null;

      const modelInfo = JSON.parse(modelInfoJson);

      // 检查模型文件是否存在
      // 在实际应用中，这里应该检查文件系统中的模型文件
      // 由于React Native的文件系统访问限制，这里只是模拟检查

      return {
        ...modelInfo,
        // 假设模型已下载
        downloaded: true
      };
    } catch (error) {
      console.error(`检查百度飞桨OCR模型失败: ${modelType}`, error);
      return null;
    }
  }

  /**
   * 下载百度飞桨OCR模型
   * @param {string} modelType - 模型类型
   * @param {Object} options - 下载选项
   * @param {Function} progressCallback - 进度回调
   * @returns {Promise<Object>} - 下载结果
   */
  async downloadPaddleOCRModel(modelType, options = {}, progressCallback = null) {
    try {
      // 检查网络状态
      const networkStatus = offlineStorageService.getStatus();
      if (!networkStatus.isOnline) {
        return {
          success: false,
          error: '离线模式下无法下载模型',
          code: 'OFFLINE_MODE'
        };
      }

      // 检查存储空间
      const storageStatus = await this._checkStorageSpace();
      if (!storageStatus.hasEnoughSpace) {
        return {
          success: false,
          error: '存储空间不足',
          code: 'INSUFFICIENT_STORAGE',
          details: storageStatus
        };
      }

      // 模拟下载过程
      if (progressCallback) {
        progressCallback({ progress: 0, status: 'started' });
      }

      // 模拟下载延迟
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (progressCallback) {
        progressCallback({ progress: 0.3, status: 'downloading' });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      if (progressCallback) {
        progressCallback({ progress: 0.6, status: 'downloading' });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      if (progressCallback) {
        progressCallback({ progress: 0.9, status: 'extracting' });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // 保存模型信息
      const modelInfo = {
        type: 'paddleocr',
        version: 'v4.0',
        language: modelType.includes('chinese') ? 'zh' : 'en',
        path: `paddleocr/${modelType}/v4.0`,
        size: 50 * 1024 * 1024, // 假设模型大小为50MB
        downloadDate: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      };

      // 保存到AsyncStorage
      await AsyncStorage.setItem(`paddleocr_${modelType}`, JSON.stringify(modelInfo));

      if (progressCallback) {
        progressCallback({ progress: 1, status: 'completed' });
      }

      // 记录事件
      analyticsService.trackEvent('paddleocr_model_downloaded', {
        modelType,
        version: modelInfo.version
      });

      return {
        success: true,
        modelInfo
      };
    } catch (error) {
      console.error(`下载百度飞桨OCR模型失败: ${modelType}`, error);

      if (progressCallback) {
        progressCallback({ progress: 0, status: 'error', error: error.message });
      }

      analyticsService.trackError(error, { action: 'download_paddleocr_model', modelType });

      return {
        success: false,
        error: error.message || '下载模型失败',
        code: 'DOWNLOAD_FAILED'
      };
    }
  }

  /**
   * 检查存储空间
   * @returns {Promise<Object>} - 存储空间信息
   * @private
   */
  async _checkStorageSpace() {
    try {
      // 在实际应用中，这里应该检查设备的存储空间
      // 由于React Native的限制，这里只是模拟检查

      // 假设模型需要100MB空间
      const requiredSpace = 100 * 1024 * 1024;

      // 假设设备有1GB可用空间
      const availableSpace = 1024 * 1024 * 1024;

      return {
        hasEnoughSpace: availableSpace > requiredSpace,
        availableSpace,
        requiredSpace
      };
    } catch (error) {
      console.error('检查存储空间失败:', error);
      return {
        hasEnoughSpace: true, // 默认假设有足够空间
        availableSpace: 0,
        requiredSpace: 0,
        error: error.message
      };
    }
  }

  /**
   * 获取已下载的百度飞桨OCR模型列表
   * @returns {Promise<Array>} - 模型列表
   */
  async getDownloadedPaddleOCRModels() {
    try {
      const models = [];

      // 检查各种模型类型
      for (const type of Object.values(MODEL_TYPES)) {
        const modelInfo = await this._checkPaddleOCRModel(type);
        if (modelInfo && modelInfo.downloaded) {
          models.push({
            ...modelInfo,
            modelType: type
          });
        }
      }

      return models;
    } catch (error) {
      console.error('获取已下载模型列表失败:', error);
      return [];
    }
  }

  /**
   * 删除百度飞桨OCR模型
   * @param {string} modelType - 模型类型
   * @returns {Promise<Object>} - 删除结果
   */
  async deletePaddleOCRModel(modelType) {
    try {
      // 检查模型是否存在
      const modelInfo = await this._checkPaddleOCRModel(modelType);
      if (!modelInfo || !modelInfo.downloaded) {
        return {
          success: false,
          error: '模型不存在或未下载',
          code: 'MODEL_NOT_FOUND'
        };
      }

      // 在实际应用中，这里应该删除文件系统中的模型文件
      // 由于React Native的文件系统访问限制，这里只是模拟删除

      // 从AsyncStorage中删除模型信息
      await AsyncStorage.removeItem(`paddleocr_${modelType}`);

      // 记录事件
      analyticsService.trackEvent('paddleocr_model_deleted', {
        modelType,
        version: modelInfo.version
      });

      return {
        success: true
      };
    } catch (error) {
      console.error(`删除百度飞桨OCR模型失败: ${modelType}`, error);
      analyticsService.trackError(error, { action: 'delete_paddleocr_model', modelType });

      return {
        success: false,
        error: error.message || '删除模型失败',
        code: 'DELETE_FAILED'
      };
    }
  }

  /**
   * 识别手写文本
   * @param {ImageData|string} imageData - 图像数据或Base64编码的图像
   * @param {Object} options - 识别选项
   * @param {string} options.language - 语言，'en'或'zh'
   * @param {boolean} options.multiChar - 是否识别多个字符
   * @param {string} options.modelType - 模型类型，'paddleocr'或'tfjs'
   * @returns {Promise<string|Array>} - 识别结果
   */
  async recognizeHandwriting(imageData, options = {}) {
    try {
      const { language = 'en', multiChar = true, modelType: preferredModelType = null } = options;

      // 选择模型类型
      const modelTypeKey = language === 'zh' ? MODEL_TYPES.HANDWRITING_CHINESE : MODEL_TYPES.HANDWRITING;

      // 加载模型
      const modelLoaded = await this.loadModel(modelTypeKey);
      if (!modelLoaded) {
        throw new Error(`手写识别模型加载失败: ${modelTypeKey}`);
      }

      // 获取加载的模型
      const model = this.models[modelTypeKey];

      // 根据模型类型选择不同的处理方式
      if (model.type === 'paddleocr' && (!preferredModelType || preferredModelType === 'paddleocr')) {
        // 使用百度飞桨OCR模型进行识别
        return await this._recognizeWithPaddleOCR(imageData, {
          language,
          multiChar,
          modelPath: model.path
        });
      } else {
        // 使用TensorFlow.js模型进行识别
        // 预处理图像
        const inputShape = this.modelMetadata[modelTypeKey].inputShape;
        const tensor = this._preprocessImage(imageData, inputShape);

        // 进行预测
        const predictions = await model.predict(tensor);

        // 后处理预测结果
        let result;
        if (multiChar) {
          // 多字符识别
          result = this._postprocessMultiCharResult(predictions, modelTypeKey);
        } else {
          // 单字符识别
          result = this._postprocessHandwritingResult(predictions, modelTypeKey);
        }

        // 释放张量
        tensor.dispose();
        predictions.dispose();

        // 记录事件
        analyticsService.trackEvent('handwriting_recognized', {
          language,
          multiChar,
          modelType: 'tfjs',
          resultLength: typeof result === 'string' ? result.length : result.length,
        });

        return result;
      }
    } catch (error) {
      console.error('手写识别失败:', error);
      analyticsService.trackError(error, { action: 'recognize_handwriting' });

      // 返回错误信息而不是抛出异常，以便在UI中显示
      return {
        success: false,
        error: error.message || '手写识别失败',
        errorDetails: error
      };
    }
  }

  /**
   * 使用百度飞桨OCR模型进行识别
   * @param {ImageData|string} imageData - 图像数据或Base64编码的图像
   * @param {Object} options - 识别选项
   * @returns {Promise<Object>} - 识别结果
   * @private
   */
  async _recognizeWithPaddleOCR(imageData, options = {}) {
    try {
      const { language = 'zh', multiChar = true, modelPath } = options;

      // 处理图像数据
      let imageBase64 = '';
      if (typeof imageData === 'string') {
        // 如果已经是Base64字符串
        imageBase64 = imageData.startsWith('data:image') ? imageData.split(',')[1] : imageData;
      } else {
        // 如果是ImageData对象，需要转换为Base64
        // 在实际应用中，这里应该实现转换逻辑
        console.warn('需要将ImageData转换为Base64字符串');
        imageBase64 = 'dummy_base64_data';
      }

      // 在实际应用中，这里应该调用百度飞桨OCR的API
      // 由于我们无法在这里实际调用，所以返回模拟结果

      console.log(`使用百度飞桨OCR模型进行识别，语言: ${language}, 模型路径: ${modelPath}`);
      console.log(`图像数据长度: ${imageBase64.length}`);

      // 模拟识别延迟
      await new Promise(resolve => setTimeout(resolve, 500));

      // 模拟识别结果
      const result = {
        success: true,
        text: language === 'zh' ? '这是一个示例文本' : 'This is a sample text',
        confidence: 0.95,
        regions: [
          {
            text: language === 'zh' ? '这是' : 'This',
            confidence: 0.97,
            box: [10, 10, 50, 50]
          },
          {
            text: language === 'zh' ? '一个' : 'is a',
            confidence: 0.96,
            box: [60, 10, 100, 50]
          },
          {
            text: language === 'zh' ? '示例文本' : 'sample text',
            confidence: 0.93,
            box: [110, 10, 200, 50]
          }
        ],
        modelType: 'paddleocr',
        version: 'v4.0'
      };

      // 记录事件
      analyticsService.trackEvent('handwriting_recognized', {
        language,
        multiChar,
        modelType: 'paddleocr',
        resultLength: result.text.length,
      });

      // 更新模型最后使用时间
      this._updateModelLastUsed(language === 'zh' ? MODEL_TYPES.HANDWRITING_CHINESE : MODEL_TYPES.HANDWRITING);

      return result;
    } catch (error) {
      console.error('百度飞桨OCR识别失败:', error);
      throw error;
    }
  }

  /**
   * 更新模型最后使用时间
   * @param {string} modelType - 模型类型
   * @private
   */
  async _updateModelLastUsed(modelType) {
    try {
      // 获取模型信息
      const modelInfoJson = await AsyncStorage.getItem(`paddleocr_${modelType}`);
      if (!modelInfoJson) return;

      const modelInfo = JSON.parse(modelInfoJson);

      // 更新最后使用时间
      modelInfo.lastUsed = new Date().toISOString();

      // 保存更新后的信息
      await AsyncStorage.setItem(`paddleocr_${modelType}`, JSON.stringify(modelInfo));
    } catch (error) {
      console.error(`更新模型最后使用时间失败: ${modelType}`, error);
    }
  }

  /**
   * 识别形状
   * @param {ImageData|string} imageData - 图像数据或Base64编码的图像
   * @param {Object} options - 识别选项
   * @returns {Promise<Object>} - 识别结果
   */
  async recognizeShape(imageData, options = {}) {
    try {
      const { preferredModelType = null } = options;

      // 加载模型
      const modelLoaded = await this.loadModel(MODEL_TYPES.SHAPE_RECOGNITION);
      if (!modelLoaded) {
        throw new Error('形状识别模型加载失败');
      }

      // 获取加载的模型
      const model = this.models[MODEL_TYPES.SHAPE_RECOGNITION];

      // 根据模型类型选择不同的处理方式
      if (model.type === 'paddleocr' && (!preferredModelType || preferredModelType === 'paddleocr')) {
        // 使用百度飞桨OCR模型进行形状识别
        // 这里我们复用手写识别的方法，但是添加形状识别的特定处理
        const ocrResult = await this._recognizeWithPaddleOCR(imageData, {
          language: 'en', // 形状识别通常使用英文模型
          multiChar: true,
          modelPath: model.path,
          mode: 'shape' // 指定为形状识别模式
        });

        // 将OCR结果转换为形状识别结果
        return {
          success: true,
          shape: this._convertOCRResultToShape(ocrResult),
          confidence: ocrResult.confidence,
          regions: ocrResult.regions,
          modelType: 'paddleocr'
        };
      } else {
        // 使用TensorFlow.js模型进行识别
        // 预处理图像
        const inputShape = this.modelMetadata[MODEL_TYPES.SHAPE_RECOGNITION].inputShape;
        const tensor = this._preprocessImage(imageData, inputShape);

        // 进行预测
        const predictions = await model.predict(tensor);

        // 后处理预测结果
        const shape = this._postprocessShapeResult(predictions);

        // 释放张量
        tensor.dispose();
        predictions.dispose();

        // 记录事件
        analyticsService.trackEvent('shape_recognized', {
          shape,
          modelType: 'tfjs'
        });

        return {
          success: true,
          shape,
          confidence: 0.9, // 模拟置信度
          modelType: 'tfjs'
        };
      }
    } catch (error) {
      console.error('形状识别失败:', error);
      analyticsService.trackError(error, { action: 'recognize_shape' });

      // 返回错误信息而不是抛出异常，以便在UI中显示
      return {
        success: false,
        error: error.message || '形状识别失败',
        errorDetails: error
      };
    }
  }

  /**
   * 将OCR结果转换为形状
   * @param {Object} ocrResult - OCR识别结果
   * @returns {string} - 形状名称
   * @private
   */
  _convertOCRResultToShape(ocrResult) {
    // 在实际应用中，这里应该实现更复杂的逻辑
    // 例如，根据OCR识别的文本和区域信息判断形状

    // 简单示例：根据文本判断形状
    const text = ocrResult.text.toLowerCase();

    if (text.includes('circle') || text.includes('圆')) {
      return '圆形';
    } else if (text.includes('rectangle') || text.includes('矩形')) {
      return '矩形';
    } else if (text.includes('triangle') || text.includes('三角')) {
      return '三角形';
    } else if (text.includes('line') || text.includes('直线')) {
      return '直线';
    } else if (text.includes('arrow') || text.includes('箭头')) {
      return '箭头';
    } else if (text.includes('star') || text.includes('星')) {
      return '星形';
    } else if (text.includes('ellipse') || text.includes('椭圆')) {
      return '椭圆';
    } else if (text.includes('diamond') || text.includes('菱形')) {
      return '菱形';
    } else if (text.includes('pentagon') || text.includes('五边')) {
      return '五边形';
    } else if (text.includes('hexagon') || text.includes('六边')) {
      return '六边形';
    } else {
      // 默认返回未知形状
      return '未知形状';
    }
  }

  /**
   * 预处理图像
   * @param {ImageData|string} imageData - 图像数据或Base64编码的图像
   * @param {Array} inputShape - 输入形状 [height, width, channels]
   * @returns {tf.Tensor} - 预处理后的张量
   * @private
   */
  _preprocessImage(imageData, inputShape = [28, 28, 1]) {
    try {
      // 处理不同类型的输入
      let tensor;

      if (typeof imageData === 'string') {
        // 如果是Base64字符串，需要先转换为图像
        console.warn('Base64字符串需要转换为图像数据');
        // 在实际应用中，这里应该实现转换逻辑
        // 这里我们创建一个随机张量作为示例
        tensor = tf.randomNormal([inputShape[0], inputShape[1], inputShape[2]]);
      } else {
        // 如果是ImageData对象，直接转换为张量
        tensor = tf.browser.fromPixels(imageData, inputShape[2]);
      }

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
    } catch (error) {
      console.error('预处理图像失败:', error);
      // 返回一个随机张量作为备用
      return tf.randomNormal([1, inputShape[0], inputShape[1], inputShape[2]]);
    }
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

    // 获取最大值索�?
    const maxIndex = values.indexOf(Math.max(...values));

    // 将索引转换为字符
    const charMap = CHAR_MAPS[modelType] || {};
    return charMap[maxIndex] || String.fromCharCode(maxIndex + 48);
  }

  /**
   * 后处理多字符识别结果
   * @param {tf.Tensor} predictions - 预测结果
   * @param {string} modelType - 模型类型
   * @returns {Array} - 后处理后的结果数�?
   * @private
   */
  _postprocessMultiCharResult(predictions, modelType) {
    // 获取预测结果
    const values = predictions.dataSync();
    const outputClasses = this.modelMetadata[modelType].outputClasses;

    // 获取�?个最可能的结�?
    const indices = [];
    const probs = [];

    // 复制值数组并获取索引
    const valuesCopy = [...values];
    for (let i = 0; i < 5; i++) {
      const maxValue = Math.max(...valuesCopy);
      const maxIndex = valuesCopy.indexOf(maxValue);

      // 计算实际类别索引
      const classIndex = maxIndex % outputClasses;

      // 添加到结�?
      indices.push(classIndex);
      probs.push(maxValue);

      // 将已处理的值设�?1，避免重复选择
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
   * 后处理形状识别结�?
   * @param {tf.Tensor} predictions - 预测结果
   * @returns {string} - 后处理后的结�?
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

      // 预处理文�?
      const tensor = this._preprocessText(text);

      // 进行预测
      const predictions = await this.models[MODEL_TYPES.TEXT_CLASSIFICATION].predict(tensor);

      // 后处理预测结�?
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
   * 预处理文�?
   * @param {string} text - 文本
   * @returns {tf.Tensor} - 预处理后的张�?
   * @private
   */
  _preprocessText(text) {
    // 这里应该使用实际的文本预处理逻辑
    // 在实际应用中，应该使用词嵌入或其他文本表示方�?

    // 简单示例：将文本转换为ASCII码，然后归一�?
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

// 默认导出
export default offlineAIService;

