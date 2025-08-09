/**
 * 从离线存储获取笔记的辅助函数
 */
import { offlineStorageService } from './offlineStorageService';
import NetInfo from '@react-native-community/netinfo';

/**
 * 从离线存储获取所有笔记
 * @returns {Promise<Object>} 笔记列表和状态
 */
export const getNotesFromOfflineStorage = async () => {
  try {
    console.log('从离线存储获取笔记...');
    const startTime = Date.now();

    // 1. 获取网络状态
    const networkStatus = await NetInfo.fetch();
    const isOnline = networkStatus && networkStatus.isConnected && networkStatus.isInternetReachable;
    console.log('网络状态:', isOnline ? '在线' : '离线');

    // 2. 获取用户信息
    let user = null;
    try {
      // 尝试获取用户信息，但不抛出错误
      // 从authStorage获取用户信息
      const authStorage = require('../auth/authStorage').default;
      user = await authStorage.getUser();

      if (user && user.id) {
        console.log('从authStorage获取到用户信息:', user.username || user.id);
      } else {
        console.log('未找到用户信息，使用默认用户');
        user = { id: 'default_user', username: 'Guest', isGuest: true };
      }
    } catch (userError) {
      console.warn('获取用户信息失败:', userError);
      // 返回一个默认用户对象，避免后续代码出错
      user = { id: 'default_user', username: 'Guest', isGuest: true };
    }

    console.log('当前用户:', user.username || user.id);

    // 使用offlineStorageService获取笔记
    try {
      await offlineStorageService.initialize();

      // 设置较长的超时，确保有足够时间加载数据
      const timeoutPromise = new Promise(resolve => {
        setTimeout(() => {
          console.log('获取笔记超时，返回空数组');
          resolve([]);
        }, 15000); // 15秒超时，增加等待时间
      });

      // 使用Promise.race确保不会一直等待
      const notesPromise = offlineStorageService.getNotes();
      const notes = await Promise.race([notesPromise, timeoutPromise]);

      console.log('从离线存储获取到笔记数量:', notes ? notes.length : 0);

      // 验证笔记数组的有效性
      const validNotes = Array.isArray(notes) ? notes.filter(note =>
        note && typeof note === 'object' && (note._id || note.id)
      ) : [];

      if (validNotes.length === 0) {
        // 尝试获取最近导入的笔记
        try {
          console.log('尝试获取最近导入的笔记');
          const recentNotes = await offlineStorageService.getRecentNotes(20);

          if (recentNotes && recentNotes.length > 0) {
            console.log(`找到${recentNotes.length}条最近导入的笔记`);
            return {
              success: true,
              data: recentNotes,
              isOffline: !isOnline,
              message: '显示最近导入的笔记'
            };
          }
        } catch (recentError) {
          console.warn('获取最近导入的笔记失败:', recentError);
        }

        return {
          success: true,
          data: [],
          isFirstUse: true,
          message: '欢迎使用！点击右下角"+"按钮创建您的第一条笔记'
        };
      }

      return {
        success: true,
        data: validNotes,
        isOffline: !isOnline
      };
    } catch (offlineError) {
      console.error('从离线存储获取笔记失败:', offlineError);

      // 尝试从本地存储中恢复最后一次成功的笔记列表
      try {
        console.log('尝试从本地存储中恢复最后一次成功的笔记列表');
        const lastNotesKey = 'last_successful_notes';
        const lastNotesJson = await offlineStorageService.getItem(lastNotesKey);

        if (lastNotesJson) {
          // 导入JSON工具函数
          const { safeParseJSON } = require('../../utils/jsonUtils');

          // 使用安全的JSON解析函数
          const lastNotes = safeParseJSON(lastNotesJson, []);

          if (Array.isArray(lastNotes) && lastNotes.length > 0) {
            console.log(`从本地存储中恢复了${lastNotes.length}条笔记`);
            return {
              success: true,
              data: lastNotes,
              isOffline: true,
              isRecovered: true,
              message: '显示上次缓存的笔记'
            };
          } else {
            console.warn('解析的缓存笔记不是数组或为空');
          }
        } else {
          console.log('本地存储中没有找到缓存的笔记');
        }
      } catch (recoveryError) {
        console.error('从本地存储中恢复笔记失败:', recoveryError);
      }

      return {
        success: true,
        data: [],
        isOffline: true,
        message: '获取笔记失败，请稍后重试'
      };
    }
  } catch (error) {
    console.error('获取笔记列表失败:', error);
    return {
      success: true,
      data: [],
      message: '获取笔记失败，请稍后重试'
    };
  }
};
