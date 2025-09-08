/**
 * 手写持久化管理器
 * 用于保存和加载手写数据
 */
export class HandwritingPersistence {
  constructor() {
    this.storageKey = 'handwriting_data';
  }

  /**
   * 保存手写数据
   * @param {Object} handwritingData - 手写数据
   * @returns {Promise<boolean>} 保存是否成功
   */
  async saveHandwriting(handwritingData) {
    try {
      const key = this.generateStorageKey(handwritingData.metadata);
      const dataString = JSON.stringify(handwritingData);
      
      // 使用 AsyncStorage 或 localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, dataString);
      } else {
        // React Native 环境
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem(key, dataString);
      }
      
      console.log(`手写数据已保存: ${key}`);
      return true;
    } catch (error) {
      console.error('保存手写数据失败:', error);
      return false;
    }
  }

  /**
   * 加载手写数据
   * @param {Object} metadata - 元数据
   * @returns {Promise<Object|null>} 手写数据
   */
  async loadHandwriting(metadata) {
    try {
      const key = this.generateStorageKey(metadata);
      let dataString;
      
      // 使用 AsyncStorage 或 localStorage
      if (typeof localStorage !== 'undefined') {
        dataString = localStorage.getItem(key);
      } else {
        // React Native 环境
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        dataString = await AsyncStorage.getItem(key);
      }
      
      if (dataString) {
        const handwritingData = JSON.parse(dataString);
        console.log(`手写数据已加载: ${key}`);
        return handwritingData;
      }
      
      return null;
    } catch (error) {
      console.error('加载手写数据失败:', error);
      return null;
    }
  }

  /**
   * 删除手写数据
   * @param {Object} metadata - 元数据
   * @returns {Promise<boolean>} 删除是否成功
   */
  async deleteHandwriting(metadata) {
    try {
      const key = this.generateStorageKey(metadata);
      
      // 使用 AsyncStorage 或 localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      } else {
        // React Native 环境
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.removeItem(key);
      }
      
      console.log(`手写数据已删除: ${key}`);
      return true;
    } catch (error) {
      console.error('删除手写数据失败:', error);
      return false;
    }
  }

  /**
   * 生成存储键
   * @param {Object} metadata - 元数据
   * @returns {string} 存储键
   */
  generateStorageKey(metadata) {
    const { fileType, documentId, pageNumber } = metadata;
    return `${this.storageKey}_${fileType}_${documentId}_${pageNumber}`;
  }

  /**
   * 列出所有手写数据
   * @returns {Promise<Array>} 手写数据列表
   */
  async listHandwritingData() {
    try {
      let keys;
      
      // 使用 AsyncStorage 或 localStorage
      if (typeof localStorage !== 'undefined') {
        keys = Object.keys(localStorage).filter(key => key.startsWith(this.storageKey));
      } else {
        // React Native 环境
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        keys = await AsyncStorage.getAllKeys();
        keys = keys.filter(key => key.startsWith(this.storageKey));
      }
      
      return keys;
    } catch (error) {
      console.error('列出手写数据失败:', error);
      return [];
    }
  }
}