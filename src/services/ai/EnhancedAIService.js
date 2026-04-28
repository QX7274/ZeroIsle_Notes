import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import CryptoJS from 'crypto-js';
import { API_BASE_URL, API_ENDPOINTS } from '../../config/api';

class EnhancedAIService {
  constructor() {
    this.cache = new Map();
    this.requestQueue = [];
    this.isProcessing = false;
    this.apiProviders = {
      primary: 'openai',
    };

    // Performance monitoring
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      averageResponseTime: 0,
      errorRate: 0,
    };

    // Initialize cache from storage
    this.cacheInitPromise = this.initializeCache();
  }

  /**
   * Initialize cache from persistent storage
   */
  async initializeCache() {
    try {
      const cachedData = await AsyncStorage.getItem('ai_cache');
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        Object.entries(parsed).forEach(([key, value]) => {
          // Only restore recent cache entries (last 24 hours)
          if (Date.now() - value.timestamp < 24 * 60 * 60 * 1000) {
            this.cache.set(key, value);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to initialize AI cache:', error);
      throw error;
    }
  }

  /**
   * Enhanced AI text processing with intelligent caching and optimization
   * @param {string} text - Input text to process
   * @param {string} toolType - Type of AI tool (translate, summarize, etc.)
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result
   */
  async processTextEnhanced(text, toolType, options = {}) {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(text, toolType, options);

      // Check cache first
      const cachedResult = await this.getCachedResult(cacheKey);
      if (cachedResult) {
        this.metrics.cacheHits++;
        return {
          ...cachedResult,
          cached: true,
          responseTime: Date.now() - startTime,
        };
      }

      // Check for similar requests in cache
      const similarResult = await this.findSimilarCachedResult(text, toolType);
      if (similarResult && similarResult.similarity > 0.8) {
        this.metrics.cacheHits++;
        return {
          ...similarResult.result,
          cached: true,
          similarity: similarResult.similarity,
          responseTime: Date.now() - startTime,
        };
      }

      // Add to processing queue
      const result = await this.queueRequest({
        text,
        toolType,
        options,
        cacheKey,
        startTime,
      });

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(responseTime, true);

      return result;

    } catch (error) {
      this.updateMetrics(Date.now() - startTime, false);
      throw error;
    }
  }

  /**
   * Queue management for AI requests
   * @param {Object} request - Request object
   * @returns {Promise<Object>} Processing result
   */
  async queueRequest(request) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        ...request,
        resolve,
        reject,
      });

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued requests with batching and optimization
   */
  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Group similar requests for batch processing
      const batches = this.groupSimilarRequests(this.requestQueue);

      for (const batch of batches) {
        await this.processBatch(batch);
      }

    } finally {
      this.isProcessing = false;

      // Process remaining queue if any
      if (this.requestQueue.length > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  /**
   * Group similar requests for batch processing
   * @param {Array} requests - Array of requests
   * @returns {Array} Grouped batches
   */
  groupSimilarRequests(requests) {
    const batches = [];
    const processed = new Set();

    for (let i = 0; i < requests.length; i++) {
      if (processed.has(i)) {continue;}

      const batch = [requests[i]];
      processed.add(i);

      // Find similar requests
      for (let j = i + 1; j < requests.length; j++) {
        if (processed.has(j)) {continue;}

        if (this.areRequestsSimilar(requests[i], requests[j])) {
          batch.push(requests[j]);
          processed.add(j);
        }
      }

      batches.push(batch);
    }

    return batches;
  }

  /**
   * Process a batch of similar requests
   * @param {Array} batch - Batch of requests
   */
  async processBatch(batch) {
    try {
      if (batch.length === 1) {
        // Single request processing
        await this.processSingleRequest(batch[0]);
      } else {
        // Batch processing optimization
        await this.processBatchRequests(batch);
      }

      // Remove processed requests from queue
      batch.forEach(request => {
        const index = this.requestQueue.indexOf(request);
        if (index > -1) {
          this.requestQueue.splice(index, 1);
        }
      });

    } catch (error) {
      // Handle batch errors
      batch.forEach(request => {
        request.reject(error);
        const index = this.requestQueue.indexOf(request);
        if (index > -1) {
          this.requestQueue.splice(index, 1);
        }
      });
    }
  }

  /**
   * Process multiple similar requests as a batch
   * @param {Array} requests - Similar requests
   */
  async processBatchRequests(requests) {
    // Combine texts for batch processing
    const combinedText = requests.map(req => req.text).join('\n---\n');
    const toolType = requests[0].toolType;

    try {
      // Process combined text
      const batchResult = await this.callAIProvider(combinedText, toolType, {
        batch: true,
        count: requests.length,
      });

      // Split result back to individual responses
      const individualResults = this.splitBatchResult(batchResult, requests.length);

      // Resolve each request with its result
      requests.forEach((request, index) => {
        const result = individualResults[index] || { text: '', confidence: 0 };

        // Cache individual result
        this.cacheResult(request.cacheKey, result);

        request.resolve({
          ...result,
          responseTime: Date.now() - request.startTime,
          batched: true,
        });
      });

    } catch (error) {
      // Fallback to individual processing
      for (const request of requests) {
        try {
          await this.processSingleRequest(request);
        } catch (individualError) {
          request.reject(individualError);
        }
      }
    }
  }

  /**
   * Process a single AI request
   * @param {Object} request - Request object
   */
  async processSingleRequest(request) {
    try {
      const result = await this.callAIProvider(request.text, request.toolType, request.options);

      // Cache the result
      await this.cacheResult(request.cacheKey, result);

      request.resolve({
        ...result,
        responseTime: Date.now() - request.startTime,
      });

    } catch (error) {
      request.reject(error);
    }
  }

  /**
   * Call AI provider with retry logic and provider switching
   * @param {string} text - Input text
   * @param {string} toolType - Tool type
   * @param {Object} options - Options
   * @returns {Promise<Object>} AI result
   */
  /**
   * Call AI provider - Strictly proxies to Backend
   * @param {string} text - Input text
   * @param {string} toolType - Tool type
   * @param {Object} options - Options
   * @returns {Promise<Object>} AI result
   */
  async callAIProvider(text, toolType, options = {}) {
    try {
      return await this.callBackendAI(text, toolType, options);
    } catch (error) {
      console.warn('Backend AI call failed:', error.message);
      throw error;
    }
  }

  /**
   * Backend API integration
   * @param {string} text - Input text
   * @param {string} toolType - Tool type
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
   */
  async callBackendAI(text, toolType, options = {}) {
    const prompt = this.generateOptimizedPrompt(text, toolType, options);

    // Ensure we have a valid token
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('No auth token available for AI request');
    }

    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AI_ASSISTANT.PROCESS}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: prompt,
        tool: toolType,
        // Backend decides actual model, but we can pass preference
        model: options.model || 'gpt-3.5-turbo',
        temperature: 0.3,
        max_tokens: this.getMaxTokens(toolType),
        ...options,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI process API error: ${response.status}`);
    }

    const payload = await response.json();
    // 统一解析 {code, message, data}
    if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'code')) {
      if (payload.code !== 0) {
        throw new Error(payload.message || 'AI处理失败');
      }
      return this.processAIResponse(payload.data, toolType);
    }
    // 兼容旧结构（直接是结果对象）
    return this.processAIResponse(payload, toolType);
  }

  /**
   * Generate optimized prompt for better AI performance
   * @param {string} text - Input text
   * @param {string} toolType - Tool type
   * @param {Object} options - Options
   * @returns {string} Optimized prompt
   */
  generateOptimizedPrompt(text, toolType, options = {}) {
    const basePrompts = {
      translate: `Translate the following text to ${options.targetLanguage || 'Chinese'}. Maintain the original meaning and tone:`,
      summarize: 'Create a concise summary of the following text, highlighting key points:',
      explain: 'Explain the following content in simple, clear terms:',
      rewrite: 'Rewrite the following text to improve clarity and readability:',
      grammar: 'Check and correct grammar, spelling, and punctuation in the following text:',
      code_recognition: 'Identify and format any code snippets in the following text:',
      math_formula: 'Convert any mathematical expressions in the following text to LaTeX format:',
      extract_keywords: 'Extract the most important keywords and phrases from the following text:',
      simplify: 'Simplify the following complex text for easier understanding:',
    };

    const basePrompt = basePrompts[toolType] || 'Process the following text:';

    // Add context if available
    let contextualPrompt = basePrompt;
    if (options.context) {
      contextualPrompt += `\n\nContext: ${options.context}`;
    }

    return `${contextualPrompt}\n\n${text}`;
  }

  /**
   * Generate cache key for AI requests
   * @param {string} text - Input text
   * @param {string} toolType - Tool type
   * @param {Object} options - Options
   * @returns {string} Cache key
   */
  generateCacheKey(text, toolType, options = {}) {
    const content = `${toolType}:${text}:${JSON.stringify(options)}`;
    return CryptoJS.SHA256(content).toString();
  }

  /**
   * Get cached result if available
   * @param {string} cacheKey - Cache key
   * @returns {Object|null} Cached result or null
   */
  async getCachedResult(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour TTL
      return cached.result;
    }
    return null;
  }

  /**
   * Find similar cached results using text similarity
   * @param {string} text - Input text
   * @param {string} toolType - Tool type
   * @returns {Object|null} Similar result with similarity score
   */
  async findSimilarCachedResult(text, toolType) {
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const [key, cached] of this.cache.entries()) {
      if (cached.toolType === toolType) {
        const similarity = this.calculateTextSimilarity(text, cached.originalText);
        if (similarity > bestSimilarity && similarity > 0.7) {
          bestSimilarity = similarity;
          bestMatch = cached;
        }
      }
    }

    return bestMatch ? { result: bestMatch.result, similarity: bestSimilarity } : null;
  }

  /**
   * Calculate text similarity using simple algorithm
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {number} Similarity score (0-1)
   */
  calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) {return 0;}

    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Cache AI result with persistence and LRU eviction
   * @param {string} cacheKey - Cache key
   * @param {Object} result - Result to cache
   */
  async cacheResult(cacheKey, result) {
    const cacheEntry = {
      result,
      timestamp: Date.now(),
      toolType: result.toolType || 'unknown',
      originalText: result.originalText || '',
    };

    // LRU Eviction: If cache exceeds 50 items, remove the oldest one
    if (this.cache.size >= 50 && !this.cache.has(cacheKey)) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    // Setting a key that already exists will move it to the end (newest) in a Map
    if (this.cache.has(cacheKey)) {
      this.cache.delete(cacheKey);
    }
    this.cache.set(cacheKey, cacheEntry);

    // Persist to storage (debounced)
    clearTimeout(this.persistTimeout);
    this.persistTimeout = setTimeout(() => {
      this.persistCache();
    }, 5000);
  }

  /**
   * Persist cache to storage
   */
  async persistCache() {
    try {
      const cacheObject = {};
      for (const [key, value] of this.cache.entries()) {
        cacheObject[key] = value;
      }
      await AsyncStorage.setItem('ai_cache', JSON.stringify(cacheObject));
    } catch (error) {
      console.warn('Failed to persist AI cache:', error);
      throw error;
    }
  }

  /**
   * Update performance metrics
   * @param {number} responseTime - Response time in ms
   * @param {boolean} success - Whether request was successful
   */
  updateMetrics(responseTime, success) {
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) /
      this.metrics.totalRequests;

    if (!success) {
      this.metrics.errorRate =
        (this.metrics.errorRate * (this.metrics.totalRequests - 1) + 1) /
        this.metrics.totalRequests;
    }
  }

  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.cacheHits / this.metrics.totalRequests,
      cacheSize: this.cache.size,
    };
  }

  /**
   * Clear cache and reset metrics
   */
  clearCache() {
    this.cache.clear();
    AsyncStorage.removeItem('ai_cache');
  }
}

export default new EnhancedAIService();
