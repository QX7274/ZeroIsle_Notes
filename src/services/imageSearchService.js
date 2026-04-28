/**
 * Image Search Service
 *
 * Provides image-based search functionality (reverse image search)
 * Uses perceptual hashing and feature extraction
 */

import { Image } from 'react-native';
import RNFS from 'react-native-fs';
import RNBlobUtil from 'react-native-blob-util';
import CryptoJS from 'crypto-js';

const normalizeFilePath = (uri) => {
    if (!uri) {return null;}
    return uri.startsWith('file://') ? uri.replace('file://', '') : uri;
};

const readImageBase64 = async (uri) => {
    try {
        const path = normalizeFilePath(uri);
        if (path) {
            return await RNFS.readFile(path, 'base64');
        }
    } catch (_) {}
    try {
        return await RNBlobUtil.fs.readFile(uri, 'base64');
    } catch (_) {
        return null;
    }
};

const getFileSizeBytes = async (uri) => {
    try {
        const path = normalizeFilePath(uri);
        if (path) {
            const stat = await RNFS.stat(path);
            if (stat && stat.size != null) {return Number(stat.size);}
        }
    } catch (_) {}
    try {
        const b64 = await RNBlobUtil.fs.readFile(uri, 'base64');
        if (!b64) {return null;}
        const len = b64.length;
        const padding = (b64.endsWith('==') ? 2 : (b64.endsWith('=') ? 1 : 0));
        return Math.floor(len * 3 / 4) - padding;
    } catch (_) {
        return null;
    }
};

const getImageDimensions = async (uri) => {
    try {
        const { width, height } = await Image.getSize(uri);
        return { width, height };
    } catch (_) {
        return { width: null, height: null };
    }
};

/**
 * Calculate perceptual hash (pHash) for image comparison
 * Simplified implementation for React Native
 */
export const calculateImageHash = async (imageUri) => {
    try {
        const base64 = await readImageBase64(imageUri);
        if (!base64) {
            throw new Error('无法读取图片内容');
        }
        const hash = CryptoJS.SHA256(base64).toString(CryptoJS.enc.Hex);
        return hash;
    } catch (error) {
        console.error('[ImageSearch] Hash calculation error:', error);
        throw error;
    }
};

/**
 * Calculate hamming distance between two hashes
 */
export const hammingDistance = (hash1, hash2) => {
    if (hash1.length !== hash2.length) {return Infinity;}

    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
        const b1 = parseInt(hash1[i], 16);
        const b2 = parseInt(hash2[i], 16);
        let xor = b1 ^ b2;
        while (xor) {
            distance += xor & 1;
            xor >>= 1;
        }
    }
    return distance;
};

/**
 * Calculate similarity score (0-1)
 */
export const calculateSimilarity = (hash1, hash2) => {
    const maxDistance = hash1.length * 4; // 4 bits per hex char
    const distance = hammingDistance(hash1, hash2);
    return Math.max(0, 1 - (distance / maxDistance));
};

/**
 * Image Search Service
 */
class ImageSearchService {
    constructor() {
        this.imageIndex = new Map(); // noteId -> { hash, features, metadata }
        this.isIndexing = false;
    }

    /**
     * Index an image for later search
     */
    async indexImage(noteId, imageUri, metadata = {}) {
        try {
            const hash = await calculateImageHash(imageUri);
            const features = await this.extractFeatures(imageUri);

            this.imageIndex.set(noteId, {
                hash,
                features,
                imageUri,
                metadata,
                indexedAt: Date.now(),
            });

            return { success: true, hash };
        } catch (error) {
            console.error('[ImageSearch] Indexing failed:', error);
            throw error;
        }
    }

    /**
     * Remove image from index
     */
    removeFromIndex(noteId) {
        return this.imageIndex.delete(noteId);
    }

    /**
     * Search for similar images
     */
    async searchSimilar(queryImageUri, options = {}) {
        const {
            limit = 10,
            threshold = 0.6, // Minimum similarity threshold
            excludeNoteIds = [],
        } = options;

        try {
            const queryHash = await calculateImageHash(queryImageUri);
            const results = [];

            for (const [noteId, data] of this.imageIndex.entries()) {
                if (excludeNoteIds.includes(noteId)) {continue;}

                const similarity = calculateSimilarity(queryHash, data.hash);

                if (similarity >= threshold) {
                    results.push({
                        noteId,
                        similarity,
                        imageUri: data.imageUri,
                        metadata: data.metadata,
                    });
                }
            }

            // Sort by similarity (descending)
            results.sort((a, b) => b.similarity - a.similarity);

            return results.slice(0, limit);
        } catch (error) {
            console.error('[ImageSearch] Search failed:', error);
            throw error;
        }
    }

    /**
     * Find exact or near-duplicate images
     */
    async findDuplicates(queryImageUri, threshold = 0.95) {
        return this.searchSimilar(queryImageUri, { threshold, limit: 100 });
    }

    /**
     * Extract image features (colors, dimensions, etc.)
     */
    async extractFeatures(imageUri) {
        const [{ width, height }, fileSizeBytes] = await Promise.all([
            getImageDimensions(imageUri),
            getFileSizeBytes(imageUri),
        ]);
        const aspectRatio = (width && height) ? (width / height) : null;

        return {
            width,
            height,
            aspectRatio,
            fileSizeBytes,
        };
    }

    /**
     * Search by color
     */
    async searchByColor(targetColor, tolerance = 50) {
        const results = [];

        for (const [noteId, data] of this.imageIndex.entries()) {
            const { features } = data;
            if (!features.dominantColors) {continue;}

            for (const color of features.dominantColors) {
                const distance = this.colorDistance(targetColor, color);
                if (distance <= tolerance) {
                    results.push({
                        noteId,
                        color,
                        distance,
                        imageUri: data.imageUri,
                        metadata: data.metadata,
                    });
                    break;
                }
            }
        }

        results.sort((a, b) => a.distance - b.distance);
        return results;
    }

    /**
     * Calculate color distance (Euclidean in RGB space)
     */
    colorDistance(color1, color2) {
        const r = color1.r - color2.r;
        const g = color1.g - color2.g;
        const b = color1.b - color2.b;
        return Math.sqrt(r * r + g * g + b * b);
    }

    /**
     * Bulk index images
     */
    async bulkIndex(images) {
        this.isIndexing = true;
        const results = [];

        for (const { noteId, imageUri, metadata } of images) {
            const result = await this.indexImage(noteId, imageUri, metadata);
            results.push({ noteId, ...result });
        }

        this.isIndexing = false;
        return results;
    }

    /**
     * Get index statistics
     */
    getStats() {
        return {
            totalImages: this.imageIndex.size,
            isIndexing: this.isIndexing,
        };
    }

    /**
     * Export index for persistence
     */
    exportIndex() {
        const data = {};
        for (const [noteId, value] of this.imageIndex.entries()) {
            data[noteId] = value;
        }
        return JSON.stringify(data);
    }

    /**
     * Import index from persistence
     */
    importIndex(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            for (const [noteId, value] of Object.entries(data)) {
                this.imageIndex.set(noteId, value);
            }
            return true;
        } catch (error) {
            console.error('[ImageSearch] Import failed:', error);
            throw error;
        }
    }

    /**
     * Clear all indexed images
     */
    clearIndex() {
        this.imageIndex.clear();
    }
}

// Export singleton instance
export const imageSearchService = new ImageSearchService();

export default imageSearchService;
