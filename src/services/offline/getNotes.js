/**
 * 从离线存储获取笔记的辅助函数
 */
// 已移除 offlineStorageService 导入，现在直接使用 realmService
import networkService from '../network/networkService';
import realmService from '../database/realmService';
import { DEV_MODE_CONFIG } from '../../config';

/**
 * 从离线存储获取所有笔记
 * @returns {Promise<Object>} 笔记列表和状态
 */
export const getNotesFromOfflineStorage = async () => {
  try {
    console.log('从离线存储获取笔记...');

    // 1. 获取网络状态
    const networkStatus = await networkService.checkConnection();
    const isOnline = Boolean(networkStatus);
    console.log('网络状态:', isOnline ? '在线' : '离线');

    // 2. 获取用户信息
    let user = null;
    try {
      const authStorage = require('../auth/authStorage').default;
      user = await authStorage.getUser();

      if (user && user.id) {
        console.log('从authStorage获取到用户信息:', user.username || user.id);
      } else {
        throw new Error('未获取到有效的用户信息，无法读取离线笔记');
      }
    } catch (userError) {
      const DEV_SKIP_LOGIN = __DEV__ && Boolean(DEV_MODE_CONFIG?.FEATURES?.SKIP_LOGIN_SCREEN);
      if (DEV_SKIP_LOGIN) {
        console.log('DEV_SKIP_LOGIN 模式：未获取到用户信息，返回空笔记列表以继续联调');
        return {
          success: true,
          data: [],
          isFirstUse: true,
          isOffline: !isOnline,
          message: '开发调试模式：未登录用户，暂无离线笔记',
        };
      }

      console.warn('获取用户信息失败:', userError);
      throw userError;
    }

    console.log('当前用户:', user.username || user.id);

    // 使用realmService获取笔记
    try {
      // realmService 不需要手动初始化

      const realm = await realmService.getRealm();
      const notes = realm.objects('Note').filtered('is_deleted = false');

      console.log('从离线存储获取到笔记数量:', notes ? notes.length : 0);

      // 验证笔记数组的有效性
      const validNotes = Array.isArray(notes) ? notes.filter(note =>
        note && typeof note === 'object' && (note._id || note.id)
      ) : [];

      if (validNotes.length === 0) {
        // 尝试获取最近导入的笔记
        try {
          console.log('尝试获取最近导入的笔记');
          const realm = await realmService.getRealm();
          const recentNotes = realm.objects('Note').filtered('is_deleted = false').sorted('updated_at', true).slice(0, 20);

          if (recentNotes && recentNotes.length > 0) {
            console.log(`找到${recentNotes.length}条最近导入的笔记`);
            return {
              success: true,
              data: recentNotes,
              isOffline: !isOnline,
              message: '显示最近导入的笔记',
            };
          }
        } catch (recentError) {
          console.warn('获取最近导入的笔记失败:', recentError);
        }

        return {
          success: true,
          data: [],
          isFirstUse: true,
          message: '首次使用或尚未创建笔记',
        };
      }

      return {
        success: true,
        data: validNotes,
        isOffline: !isOnline,
      };
    } catch (offlineError) {
      console.error('从离线存储获取笔记失败:', offlineError);

      // 尝试从本地存储中恢复最后一次成功的笔记列表
      try {
        console.log('尝试从本地存储中恢复最后一次成功的笔记列表');
        const lastNotesKey = 'last_successful_notes';
        const realm = await realmService.getRealm();
        const item = realm.objects('StorageItem').filtered(`key = "${lastNotesKey}"`);
        const lastNotesJson = item.length > 0 ? item[0].value : null;

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
              message: '显示上次缓存的笔记',
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

      throw new Error('获取笔记失败，请稍后重试');
    }
  } catch (error) {
    console.error('获取笔记列表失败:', error);
    throw error;
  }
};
