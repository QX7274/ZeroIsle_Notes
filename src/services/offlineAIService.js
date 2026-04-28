/**
 * Offline AI Service
 *
 * Provides offline AI capabilities using on-device models
 * Uses TensorFlow Lite / ONNX Runtime for model inference
 */

import { Platform } from 'react-native';

/**
 * Model types supported
 */
export const ModelType = {
    TEXT_CLASSIFICATION: 'text_classification',
    SENTIMENT_ANALYSIS: 'sentiment',
    NER: 'named_entity_recognition',
    SUMMARIZATION: 'summarization',
    KEYWORD_EXTRACTION: 'keyword_extraction',
    SIMILARITY: 'text_similarity',
};

/**
 * Model status
 */
export const ModelStatus = {
    NOT_LOADED: 'not_loaded',
    LOADING: 'loading',
    READY: 'ready',
    ERROR: 'error',
};

/**
 * Offline AI Service
 */
class OfflineAIService {
    constructor() {
        this.models = {};
        this.modelStatus = {};
        this.isInitialized = false;
    }

    /**
     * Initialize the service
     */
    async initialize() {
        if (this.isInitialized) {return;}

        try {
            // Check if TFLite is available
            this.hasTFLite = await this._checkTFLiteAvailability();
            this.isInitialized = true;
            console.log('[OfflineAI] Service initialized, TFLite:', this.hasTFLite);
        } catch (error) {
            console.error('[OfflineAI] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Check TensorFlow Lite availability
     */
    async _checkTFLiteAvailability() {
        try {
            if (Platform.OS === 'web') {
                // Web uses ONNX Runtime or TF.js
                return typeof window !== 'undefined' && window.ort !== undefined;
            }

            // React Native uses react-native-tflite
            const TFLite = require('react-native-tflite');
            return TFLite !== undefined;
        } catch {
            // 工具语义：运行环境不支持 TFLite 时返回 false（非错误）
            return false;
        }
    }

    /**
     * Load a model
     */
    async loadModel(modelType, modelPath) {
        if (this.modelStatus[modelType] === ModelStatus.READY) {
            return true;
        }

        this.modelStatus[modelType] = ModelStatus.LOADING;

        try {
            if (Platform.OS === 'web') {
                // Load ONNX model for web
                const session = await window.ort.InferenceSession.create(modelPath);
                this.models[modelType] = session;
            } else {
                // Load TFLite model for mobile
                const TFLite = require('react-native-tflite');
                await TFLite.loadModel({ model: modelPath });
                this.models[modelType] = TFLite;
            }

            this.modelStatus[modelType] = ModelStatus.READY;
            console.log(`[OfflineAI] Model loaded: ${modelType}`);
            return true;
        } catch (error) {
            console.error(`[OfflineAI] Failed to load model ${modelType}:`, error);
            this.modelStatus[modelType] = ModelStatus.ERROR;
            throw error;
        }
    }

    /**
     * Unload a model to free memory
     */
    async unloadModel(modelType) {
        if (this.models[modelType]) {
            delete this.models[modelType];
            this.modelStatus[modelType] = ModelStatus.NOT_LOADED;
        }
    }

    /**
     * Get model status
     */
    getModelStatus(modelType) {
        return this.modelStatus[modelType] || ModelStatus.NOT_LOADED;
    }

    /**
     * Text Classification
     */
    async classifyText(text, options = {}) {
        const { categories = [], threshold = 0.5 } = options;

        if (!this._isModelReady(ModelType.TEXT_CLASSIFICATION)) {
            throw new Error('离线分类模型未就绪');
        }

        try {
            const model = this.models[ModelType.TEXT_CLASSIFICATION];
            const result = await this._runInference(model, text);

            return result.scores
                .map((score, idx) => ({
                    category: categories[idx] || `Category ${idx}`,
                    score,
                }))
                .filter(r => r.score >= threshold)
                .sort((a, b) => b.score - a.score);
        } catch (error) {
            console.error('[OfflineAI] Classification error:', error);
            throw error;
        }
    }

    /**
     * Sentiment Analysis
     */
    async analyzeSentiment(text) {
        if (!this._isModelReady(ModelType.SENTIMENT_ANALYSIS)) {
            throw new Error('离线情感模型未就绪');
        }

        try {
            const model = this.models[ModelType.SENTIMENT_ANALYSIS];
            const result = await this._runInference(model, text);

            return {
                sentiment: result.label,
                score: result.score,
                confidence: result.confidence,
            };
        } catch (error) {
            console.error('[OfflineAI] Sentiment analysis error:', error);
            throw error;
        }
    }

    /**
     * Keyword Extraction
     */
    async extractKeywords(text, options = {}) {
        const { topK = 5, minLength = 2 } = options;

        // Use TF-IDF based extraction as fallback/offline method
        const words = text
            .toLowerCase()
            .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length >= minLength);

        // Calculate word frequency
        const wordFreq = {};
        words.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        });

        // Sort by frequency and return top K
        return Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, topK)
            .map(([word, count]) => ({
                keyword: word,
                score: count / words.length,
                count,
            }));
    }

    /**
     * Text Summarization (extractive)
     */
    async summarize(text, options = {}) {
        const { maxSentences = 3, minLength = 50 } = options;

        if (text.length < minLength) {
            return text;
        }

        // Simple extractive summarization
        const sentences = text
            .replace(/([.!?。！？])\s*/g, '$1\n')
            .split('\n')
            .filter(s => s.trim().length > 0);

        if (sentences.length <= maxSentences) {
            return text;
        }

        // Score sentences by word frequency
        const wordFreq = {};
        text.toLowerCase().split(/\s+/).forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        });

        const scoredSentences = sentences.map((sentence, idx) => {
            const words = sentence.toLowerCase().split(/\s+/);
            const score = words.reduce((acc, w) => acc + (wordFreq[w] || 0), 0) / words.length;
            return { sentence, score, idx };
        });

        // Get top sentences and maintain order
        const topSentences = scoredSentences
            .sort((a, b) => b.score - a.score)
            .slice(0, maxSentences)
            .sort((a, b) => a.idx - b.idx)
            .map(s => s.sentence);

        return topSentences.join(' ');
    }

    /**
     * Text Similarity (cosine similarity with simple embeddings)
     */
    async calculateSimilarity(text1, text2) {
        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));

        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);

        return intersection.size / union.size; // Jaccard similarity
    }

    /**
     * Helpers
     */
    _isModelReady(modelType) {
        return this.modelStatus[modelType] === ModelStatus.READY;
    }

    async _runInference(model, input) {
        if (!model) {
            throw new Error('离线模型未加载');
        }
        if (Platform.OS === 'web') {
            if (!model.run) {
                throw new Error('ONNX 推理会话不可用');
            }
            throw new Error('当前未配置可执行的离线推理输入格式');
        }
        if (!model.run || typeof model.run !== 'function') {
            throw new Error('TFLite 推理不可用');
        }
        throw new Error('当前未配置可执行的离线推理输入格式');
    }

}

// Export singleton instance
export const offlineAIService = new OfflineAIService();

export default offlineAIService;
