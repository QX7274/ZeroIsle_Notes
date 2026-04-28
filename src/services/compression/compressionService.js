/**
 * 数据压缩和加密服务
 * 提供数据压缩、解压缩、加密和解密功能
 */
import { Buffer } from 'buffer';
import { gzip, ungzip } from 'pako';
import CryptoJS from 'crypto-js';
import realmService from '../database/realmService';
import STORAGE_KEYS from '../../constants/storageKeys';
import { analyticsService } from '../analytics/analyticsService';

// 加密密钥存储键
const ENCRYPTION_KEY_STORAGE_KEY = STORAGE_KEYS.ENCRYPTION_KEY;

class CompressionService {
  constructor() {
    this.encryptionKey = null;
    this.initialized = false;
  }

  /**
   * 初始化服务
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async init() {
    try {
      // 获取或生成加密密钥
      await this.getOrCreateEncryptionKey();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('初始化压缩服务失败:', error);
      analyticsService.trackError(error, { operation: 'init_compression_service' });
      return false;
    }
  }

  /**
   * 获取或创建加密密钥
   * @returns {Promise<string>} 加密密钥
   */
  async getOrCreateEncryptionKey() {
    try {
      // 确保存储键有效
      if (!ENCRYPTION_KEY_STORAGE_KEY) {
        console.warn('加密密钥存储键未定义，使用默认键');
        const defaultKey = 'zeroisle_encryption_key';

        // 尝试从存储中获取密钥
        const realm = await realmService.getRealm();
        const item = realm.objects('StorageItem').filtered(`key = "${defaultKey}"`);
        const storedKey = item.length > 0 ? item[0].value : null;

        if (storedKey) {
          this.encryptionKey = storedKey;
          return storedKey;
        }

        // 生成新密钥
        const newKey = this.generateSecureKey();

        // 保存密钥
        realm.write(() => {
          const existingItem = realm.objects('StorageItem').filtered(`key = "${defaultKey}"`);
          if (existingItem.length > 0) {
            existingItem[0].value = newKey;
            existingItem[0].updated_at = new Date();
          } else {
            realm.create('StorageItem', {
              key: defaultKey,
              value: newKey,
              createdAt: new Date(),
              updated_at: new Date(),
            });
          }
        });

        this.encryptionKey = newKey;
        return newKey;
      }

      // 正常流程：尝试从存储中获取密钥
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered(`key = "${ENCRYPTION_KEY_STORAGE_KEY}"`);
      const storedKey = item.length > 0 ? item[0].value : null;

      if (storedKey) {
        this.encryptionKey = storedKey;
        return storedKey;
      }

      // 生成新密钥
      const newKey = this.generateSecureKey();

      // 保存密钥
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "${ENCRYPTION_KEY_STORAGE_KEY}"`);
        if (existingItem.length > 0) {
          existingItem[0].value = newKey;
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: ENCRYPTION_KEY_STORAGE_KEY,
            value: newKey,
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });

      this.encryptionKey = newKey;
      return newKey;
    } catch (error) {
      console.error('获取或创建加密密钥失败:', error);

      // 出错时使用内存中的临时密钥
      if (!this.encryptionKey) {
        this.encryptionKey = this.generateSecureKey();
        console.log('使用临时内存加密密钥');
      }

      return this.encryptionKey;
    }
  }

  /**
   * 生成安全的随机密钥
   * @returns {string} 随机密钥
   */
  generateSecureKey() {
    try {
      return CryptoJS.lib.WordArray.random(16).toString();
    } catch (error) {
      console.warn('使用CryptoJS生成随机密钥失败，使用备用方法:', error);

      // 备用方法：使用稳定的对象ID派生字符串
      const objectId = realmService.createObjectId();
      return objectId.toString().padEnd(32, objectId.toString());
    }
  }

  /**
   * 压缩数据
   * @param {Object|string} data - 要压缩的数据
   * @returns {Uint8Array} 压缩后的数据
   */
  compress(data) {
    try {
      // 将数据转换为字符串
      const jsonString = typeof data === 'string' ? data : JSON.stringify(data);

      // 压缩数据
      const compressed = gzip(jsonString);

      return compressed;
    } catch (error) {
      console.error('压缩数据失败:', error);
      analyticsService.trackError(error, { operation: 'compress_data' });
      throw error;
    }
  }

  /**
   * 解压缩数据
   * @param {Uint8Array} compressedData - 压缩的数据
   * @param {boolean} parseJson - 是否将结果解析为JSON对象
   * @returns {Object|string} 解压缩后的数据
   */
  decompress(compressedData, parseJson = true) {
    try {
      // 解压缩数据
      const decompressed = ungzip(compressedData);

      // 转换为字符串
      const jsonString = new TextDecoder().decode(decompressed);

      // 如果需要，解析为JSON对象
      return parseJson ? JSON.parse(jsonString) : jsonString;
    } catch (error) {
      console.error('解压缩数据失败:', error);
      analyticsService.trackError(error, { operation: 'decompress_data' });
      throw error;
    }
  }

  /**
   * 加密数据
   * @param {string|Uint8Array} data - 要加密的数据
   * @returns {string} 加密后的数据
   */
  encrypt(data) {
    try {
      if (!this.encryptionKey) {
        throw new Error('加密密钥未初始化');
      }

      // 如果是Uint8Array，转换为Base64字符串
      const dataString = data instanceof Uint8Array
        ? Buffer.from(data).toString('base64')
        : data;

      // 加密数据
      const encrypted = CryptoJS.AES.encrypt(dataString, this.encryptionKey).toString();

      return encrypted;
    } catch (error) {
      console.error('加密数据失败:', error);
      analyticsService.trackError(error, { operation: 'encrypt_data' });
      throw error;
    }
  }

  /**
   * 解密数据
   * @param {string} encryptedData - 加密的数据
   * @param {boolean} toUint8Array - 是否将结果转换为Uint8Array
   * @returns {string|Uint8Array} 解密后的数据
   */
  decrypt(encryptedData, toUint8Array = false) {
    try {
      if (!this.encryptionKey) {
        throw new Error('加密密钥未初始化');
      }

      // 解密数据
      const decrypted = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey).toString(CryptoJS.enc.Utf8);

      // 如果需要，转换为Uint8Array
      if (toUint8Array) {
        return Buffer.from(decrypted, 'base64');
      }

      return decrypted;
    } catch (error) {
      console.error('解密数据失败:', error);
      analyticsService.trackError(error, { operation: 'decrypt_data' });
      throw error;
    }
  }

  /**
   * 压缩并加密数据
   * @param {Object|string} data - 要处理的数据
   * @returns {string} 压缩并加密后的数据
   */
  compressAndEncrypt(data) {
    try {
      const compressed = this.compress(data);
      const encrypted = this.encrypt(compressed);
      return encrypted;
    } catch (error) {
      console.error('压缩并加密数据失败:', error);
      analyticsService.trackError(error, { operation: 'compress_and_encrypt' });
      throw error;
    }
  }

  /**
   * 解密并解压缩数据
   * @param {string} encryptedCompressedData - 加密并压缩的数据
   * @param {boolean} parseJson - 是否将结果解析为JSON对象
   * @returns {Object|string} 解密并解压缩后的数据
   */
  decryptAndDecompress(encryptedCompressedData, parseJson = true) {
    try {
      const decrypted = this.decrypt(encryptedCompressedData, true);
      const decompressed = this.decompress(decrypted, parseJson);
      return decompressed;
    } catch (error) {
      console.error('解密并解压缩数据失败:', error);
      analyticsService.trackError(error, { operation: 'decrypt_and_decompress' });
      throw error;
    }
  }
}

const compressionService = new CompressionService();

module.exports = compressionService;
module.exports.default = compressionService;
module.exports.compressionService = compressionService;
module.exports.CompressionService = CompressionService;

