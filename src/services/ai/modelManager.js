/**
 * AI Model Manager
 *
 * Handles downloading, caching, and lifecycle management of on-device AI models.
 * Supports TensorFlow Lite (mobile) and ONNX (desktop/web).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const MODEL_CACHE_KEY = '@ai_models_cache';
const MODEL_VERSION_KEY = '@ai_models_version';

/**
 * Available model configurations
 */
export const MODEL_REGISTRY = {
    // Text classification for auto-categorization
    text_classification: {
        id: 'text_classification_v1',
        name: 'Text Classifier',
        description: 'Categorizes notes and content',
        size: '15MB',
        sizeBytes: 15 * 1024 * 1024,
        version: '1.0.0',
        urls: {
            tflite: 'https://cdn.zeroislenotes.com/models/text_classifier.tflite',
            onnx: 'https://cdn.zeroislenotes.com/models/text_classifier.onnx',
        },
    },
    // Sentiment analysis
    sentiment: {
        id: 'sentiment_v1',
        name: 'Sentiment Analyzer',
        description: 'Analyzes text sentiment',
        size: '8MB',
        sizeBytes: 8 * 1024 * 1024,
        version: '1.0.0',
        urls: {
            tflite: 'https://cdn.zeroislenotes.com/models/sentiment.tflite',
            onnx: 'https://cdn.zeroislenotes.com/models/sentiment.onnx',
        },
    },
    // Keyword extraction / NER
    keyword_extraction: {
        id: 'keyword_v1',
        name: 'Keyword Extractor',
        description: 'Extracts keywords and entities',
        size: '12MB',
        sizeBytes: 12 * 1024 * 1024,
        version: '1.0.0',
        urls: {
            tflite: 'https://cdn.zeroislenotes.com/models/keywords.tflite',
            onnx: 'https://cdn.zeroislenotes.com/models/keywords.onnx',
        },
    },
    // Text embedding for semantic search
    text_embedding: {
        id: 'embedding_v1',
        name: 'Text Embeddings',
        description: 'Generates semantic embeddings for search',
        size: '50MB',
        sizeBytes: 50 * 1024 * 1024,
        version: '1.0.0',
        urls: {
            tflite: 'https://cdn.zeroislenotes.com/models/embeddings.tflite',
            onnx: 'https://cdn.zeroislenotes.com/models/embeddings.onnx',
        },
        isPro: true, // Pro-only feature
    },
};

/**
 * Model Manager Service
 */
class ModelManager {
    constructor() {
        this.downloadedModels = {};
        this.downloadProgress = {};
        this.listeners = [];
        this.initialized = false;
    }

    /**
     * Initialize the model manager
     */
    async initialize() {
        if (this.initialized) {return;}

        try {
            // Load cached model info
            const cachedInfo = await AsyncStorage.getItem(MODEL_CACHE_KEY);
            if (cachedInfo) {
                this.downloadedModels = JSON.parse(cachedInfo);
            }
            this.initialized = true;
            console.log('[ModelManager] Initialized with cached models:', Object.keys(this.downloadedModels));
        } catch (error) {
            console.error('[ModelManager] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Get model file format based on platform
     */
    getModelFormat() {
        if (Platform.OS === 'web') {
            return 'onnx';
        }
        return 'tflite';
    }

    /**
     * Get model directory path
     */
    getModelDir() {
        if (Platform.OS === 'web') {
            return null; // Web uses IndexedDB
        }
        return `${FileSystem.documentDirectory}ai_models/`;
    }

    /**
     * Check if a model is downloaded
     */
    isModelDownloaded(modelType) {
        const model = MODEL_REGISTRY[modelType];
        if (!model) {return false;}
        return this.downloadedModels[model.id]?.downloaded === true;
    }

    /**
     * Get model status
     */
    getModelStatus(modelType) {
        const model = MODEL_REGISTRY[modelType];
        if (!model) {return { status: 'unknown' };}

        const cached = this.downloadedModels[model.id];
        if (!cached) {
            return { status: 'not_downloaded', model };
        }

        if (cached.version !== model.version) {
            return { status: 'update_available', model, currentVersion: cached.version };
        }

        return { status: 'ready', model, path: cached.path };
    }

    /**
     * Download a model
     */
    async downloadModel(modelType, onProgress) {
        const model = MODEL_REGISTRY[modelType];
        if (!model) {
            throw new Error(`Unknown model type: ${modelType}`);
        }

        const format = this.getModelFormat();
        const url = model.urls[format];
        if (!url) {
            throw new Error(`No ${format} model available for ${modelType}`);
        }

        console.log(`[ModelManager] Downloading ${model.name}...`);

        try {
            if (Platform.OS === 'web') {
                // Web: Store in IndexedDB via fetch
                const response = await fetch(url);
                const blob = await response.blob();
                // Store in IndexedDB (simplified - use idb library in production)
                await this._storeWebModel(model.id, blob);
            } else {
                // Mobile: Download to file system
                const modelDir = this.getModelDir();
                await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true });

                const downloadPath = `${modelDir}${model.id}.${format}`;

                const downloadResumable = FileSystem.createDownloadResumable(
                    url,
                    downloadPath,
                    {},
                    (progress) => {
                        const percent = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
                        this.downloadProgress[modelType] = percent;
                        onProgress?.(percent);
                        this._notifyListeners('progress', { modelType, progress: percent });
                    }
                );

                const result = await downloadResumable.downloadAsync();
                this.downloadedModels[model.id] = {
                    downloaded: true,
                    path: result.uri,
                    version: model.version,
                    downloadedAt: new Date().toISOString(),
                };
            }

            // Save cache info
            await AsyncStorage.setItem(MODEL_CACHE_KEY, JSON.stringify(this.downloadedModels));
            this._notifyListeners('downloaded', { modelType });

            console.log(`[ModelManager] ${model.name} downloaded successfully`);
            return true;
        } catch (error) {
            console.error(`[ModelManager] Download failed for ${model.name}:`, error);
            throw error;
        }
    }

    /**
     * Delete a downloaded model
     */
    async deleteModel(modelType) {
        const model = MODEL_REGISTRY[modelType];
        if (!model) {return;}

        const cached = this.downloadedModels[model.id];
        if (!cached) {return;}

        try {
            if (Platform.OS !== 'web' && cached.path) {
                await FileSystem.deleteAsync(cached.path, { idempotent: true });
            }

            delete this.downloadedModels[model.id];
            await AsyncStorage.setItem(MODEL_CACHE_KEY, JSON.stringify(this.downloadedModels));
            this._notifyListeners('deleted', { modelType });

            console.log(`[ModelManager] ${model.name} deleted`);
        } catch (error) {
            console.error('[ModelManager] Delete failed:', error);
            throw error;
        }
    }

    /**
     * Get total storage used by models
     */
    async getStorageUsed() {
        let total = 0;
        for (const [id, info] of Object.entries(this.downloadedModels)) {
            if (info.downloaded) {
                const model = Object.values(MODEL_REGISTRY).find(m => m.id === id);
                if (model) {
                    total += model.sizeBytes;
                }
            }
        }
        return total;
    }

    /**
     * Clear all cached models
     */
    async clearAllModels() {
        try {
            if (Platform.OS !== 'web') {
                const modelDir = this.getModelDir();
                await FileSystem.deleteAsync(modelDir, { idempotent: true });
            }
            this.downloadedModels = {};
            await AsyncStorage.setItem(MODEL_CACHE_KEY, JSON.stringify({}));
            this._notifyListeners('cleared', {});
        } catch (error) {
            console.error('[ModelManager] Clear all failed:', error);
            throw error;
        }
    }

    /**
     * Add event listener
     */
    addListener(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    _notifyListeners(event, data) {
        this.listeners.forEach(listener => listener(event, data));
    }

    async _storeWebModel(modelId, blob) {
        // Simplified - in production use idb or localforage
        console.log(`[ModelManager] Storing web model ${modelId}, size: ${blob.size}`);
        this.downloadedModels[modelId] = {
            downloaded: true,
            version: MODEL_REGISTRY[modelId]?.version,
            downloadedAt: new Date().toISOString(),
        };
    }
}

// Export singleton
export const modelManager = new ModelManager();
export default modelManager;
