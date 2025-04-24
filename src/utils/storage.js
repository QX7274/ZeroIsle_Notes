import AsyncStorage from '@react-native-async-storage/async-storage';

const storage = {
  // 设置数据
  set: async (key, value) => {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      console.error('存储数据失败:', error);
    }
  },

  // 获取数据
  get: async (key) => {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('获取数据失败:', error);
      return null;
    }
  },

  // 删除数据
  remove: async (key) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('删除数据失败:', error);
    }
  },

  // 清空所有数据
  clear: async () => {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('清空数据失败:', error);
    }
  }
};

export { storage }; 