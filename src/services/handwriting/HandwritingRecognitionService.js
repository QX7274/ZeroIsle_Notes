import { NativeModules, Platform, findNodeHandle } from 'react-native';
import realmService from '../database/realmService';


class HandwritingRecognitionService {
  constructor() {
    this.isAvailable = Platform.select({
      ios: true,
      android: true,
      default: false,
    });

    this.cache = new Map();
    this.processingQueue = [];
    this.isProcessing = false;

    // 保存原生视图 tag（iOS 需要）
    this._reactTag = null;

    // Initialize native modules
    this.nativeModule = Platform.select({
      ios: NativeModules.NativeInfiniteCanvasView,
      android: NativeModules.HandwritingRecognitionModule,
      default: null,
    });
  }

  /**
   * 设置原生视图引用（仅 iOS 需要），可以传入 ref 或 reactTag
   */
  setNativeViewRef(refOrTag) {
    if (!refOrTag) {
      this._reactTag = null;
      return;
    }
    // 允许传入 number 或 ref
    this._reactTag = typeof refOrTag === 'number' ? refOrTag : findNodeHandle(refOrTag);
  }

  /**
   * Check if handwriting recognition is available on current platform
   */
  isHandwritingRecognitionAvailable() {
    return this.isAvailable && this.nativeModule !== null;
  }

  /**
   * Recognize handwriting from stroke data
   * @param {Array} strokes - Array of stroke objects with points
   * @param {Object} options - Recognition options (iOS: 需要提供 reactTag 或先调用 setNativeViewRef)
   * @returns {Promise<Object>} Recognition result
   */
  async recognizeStrokes(strokes, options = {}) {
    if (!this.isHandwritingRecognitionAvailable()) {
      throw new Error('Handwriting recognition not available on this platform');
    }

    const config = {
      language: options.language || 'auto',
      confidence: options.minConfidence || 0.5,
      realTime: options.realTime || false,
      ...options,
    };

    // Generate cache key
    const cacheKey = this.generateCacheKey(strokes, config);

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cachedResult = this.cache.get(cacheKey);
      return {
        ...cachedResult,
        cached: true,
      };
    }

    try {
      let result;

      if (Platform.OS === 'ios') {
        // iOS 需要视图 reactTag + 原生已记录的 strokeIds
        const reactTag = options.reactTag || this._reactTag;
        if (!reactTag) {
          throw new Error('iOS 手写识别需要提供 reactTag（传入 options.reactTag 或先调用 setNativeViewRef）');
        }
        const strokeIds = strokes.map(stroke => stroke.id || this.generateStrokeId());
        result = await this.nativeModule.recognizeHandwriting(reactTag, strokeIds);
      } else if (Platform.OS === 'android') {
        // Android 使用 ML Kit，直接传入点数据
        const strokesData = this.convertStrokesForAndroid(strokes);
        result = await this.nativeModule.recognizeHandwriting(strokesData);
      }

      // Process and enhance result
      const processedResult = this.processRecognitionResult(result, config);

      // Cache the result
      this.cacheResult(cacheKey, processedResult);

      return processedResult;

    } catch (error) {
      console.error('Handwriting recognition failed:', error);
      return this.getFallbackResult(strokes, error);
    }
  }

  /**
   * Real-time handwriting recognition for live writing
   * @param {Object} stroke - Single stroke object
   * @param {Object} context - Context information
   * @returns {Promise<Object>} Partial recognition result
   */
  async recognizeStrokeRealTime(stroke, context = {}) {
    if (!this.isHandwritingRecognitionAvailable()) {
      return { text: '', confidence: 0, partial: true };
    }

    try {
      const options = {
        realTime: true,
        context: context.previousText || '',
        language: context.language || 'auto',
        minConfidence: 0.3, // Lower threshold for real-time
      };

      let result;

      if (Platform.OS === 'ios') {
        // For iOS, we'll use the regular recognition with single stroke
        result = await this.recognizeStrokes([stroke], options);
      } else if (Platform.OS === 'android') {
        // Android has dedicated real-time method
        const strokeData = this.convertStrokeForAndroid(stroke);
        result = await this.nativeModule.recognizeStrokeRealTime(strokeData);
      }

      return {
        text: result.text || '',
        confidence: result.confidence || 0,
        suggestions: result.alternatives || [],
        partial: true,
      };

    } catch (error) {
      console.warn('Real-time recognition failed:', error);
      return { text: '', confidence: 0, partial: true, error: error.message };
    }
  }

  /**
   * Batch recognition for multiple stroke groups
   * @param {Array} strokeGroups - Array of stroke group arrays
   * @param {Object} options - Recognition options
   * @returns {Promise<Array>} Array of recognition results
   */
  async recognizeBatch(strokeGroups, options = {}) {
    if (!this.isHandwritingRecognitionAvailable()) {
      throw new Error('Handwriting recognition not available');
    }

    try {
      let results;

      if (Platform.OS === 'ios') {
        // Process each group separately on iOS
        results = await Promise.all(
          strokeGroups.map((group, index) =>
            this.recognizeStrokes(group, { ...options, groupIndex: index })
          )
        );
      } else if (Platform.OS === 'android') {
        // Android supports native batch processing
        const batchData = strokeGroups.map(group =>
          this.convertStrokesForAndroid(group)
        );
        results = await this.nativeModule.recognizeBatch(batchData);
      }

      return results.map((result, index) => ({
        groupIndex: index,
        text: result.text || '',
        confidence: result.confidence || 0,
        alternatives: result.alternatives || [],
        boundingBox: result.boundingBox || null,
      }));

    } catch (error) {
      console.error('Batch recognition failed:', error);
      throw error;
    }
  }

  /**
   * Convert strokes to Android ML Kit format
   * @param {Array} strokes - Stroke objects
   * @returns {Array} Android-compatible stroke data
   */
  convertStrokesForAndroid(strokes) {
    return strokes.map(stroke => ({
      points: stroke.points.map(point => ({
        x: point.x,
        y: point.y,
        timestamp: point.timestamp || Date.now(),
      })),
      id: stroke.id || this.generateStrokeId(),
    }));
  }

  /**
   * Convert single stroke to Android format
   * @param {Object} stroke - Single stroke object
   * @returns {Object} Android-compatible stroke data
   */
  convertStrokeForAndroid(stroke) {
    return {
      points: stroke.points.map(point => ({
        x: point.x,
        y: point.y,
        timestamp: point.timestamp || Date.now(),
      })),
      id: stroke.id || this.generateStrokeId(),
    };
  }

  /**
   * Process recognition result and add enhancements
   * @param {Object} result - Raw recognition result
   * @param {Object} config - Recognition configuration
   * @returns {Object} Enhanced result
   */
  processRecognitionResult(result, config) {
    const processedResult = {
      text: result.text || '',
      confidence: result.confidence || 0,
      alternatives: result.alternatives || [],
      language: result.language || config.language,
      timestamp: Date.now(),
    };

    // Apply confidence filtering
    if (processedResult.confidence < config.confidence) {
      processedResult.text = '';
      processedResult.lowConfidence = true;
    }

    // Add text processing enhancements
    if (processedResult.text) {
      processedResult.text = this.enhanceRecognizedText(processedResult.text);
    }

    return processedResult;
  }

  /**
   * Enhance recognized text with post-processing
   * @param {string} text - Raw recognized text
   * @returns {string} Enhanced text
   */
  enhanceRecognizedText(text) {
    // Basic text cleanup
    let enhanced = text.trim();

    // Remove excessive whitespace
    enhanced = enhanced.replace(/\s+/g, ' ');

    // Basic punctuation correction
    enhanced = enhanced.replace(/\s+([,.!?])/g, '$1');

    // Capitalize first letter of sentences
    enhanced = enhanced.replace(/(^|[.!?]\s+)([a-z])/g, (match, p1, p2) =>
      p1 + p2.toUpperCase()
    );

    return enhanced;
  }

  /**
   * Generate cache key for recognition result
   * @param {Array} strokes - Stroke data
   * @param {Object} config - Configuration
   * @returns {string} Cache key
   */
  generateCacheKey(strokes, config) {
    const strokeSignature = strokes.map(stroke =>
      `${stroke.points.length}-${stroke.id || ''}`
    ).join('|');

    const configSignature = `${config.language}-${config.confidence}`;

    return `${strokeSignature}-${configSignature}`;
  }

  /**
   * Cache recognition result
   * @param {string} key - Cache key
   * @param {Object} result - Recognition result
   */
  cacheResult(key, result) {
    // Implement LRU cache with size limit
    if (this.cache.size >= 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      ...result,
      cachedAt: Date.now(),
    });
  }

  /**
   * Generate fallback result when recognition fails
   * @param {Array} strokes - Original stroke data
   * @param {Error} error - Recognition error
   * @returns {Object} Fallback result
   */
  getFallbackResult(strokes, error) {
    return {
      text: '',
      confidence: 0,
      alternatives: [],
      error: error.message,
      fallback: true,
      strokeCount: strokes.length,
    };
  }

  /**
   * Generate unique stroke ID
   * @returns {string} Unique ID
   */
  generateStrokeId() {
    return realmService.createObjectId();
  }

  /**
   * Clear recognition cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: 100,
      hitRate: this.cacheHitRate || 0,
    };
  }
}

export default new HandwritingRecognitionService();
