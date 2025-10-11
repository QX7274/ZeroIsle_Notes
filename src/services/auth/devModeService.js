/**
 * 开发者模式服务
 * 提供开发者账户快速进入功能，不影响正常的令牌认证系统
 */

import { DEV_MODE_CONFIG } from '../../config';
import { STORAGE_KEYS } from '../../config';
import realmService from '../database/realmService';

class DevModeService {
  constructor() {
    this.isDevMode = DEV_MODE_CONFIG.ENABLED;
    this.devAccount = DEV_MODE_CONFIG.DEV_ACCOUNT;
    this.devModeStartTime = null;
    this.isActive = false;
  }

  /**
   * 检查是否可以启用开发者模式
   */
  canEnableDevMode() {
    // 只在开发环境启用
    if (!__DEV__) {
      console.warn('开发者模式只能在开发环境启用');
      return false;
    }

    // 检查是否允许在生产环境启用
    if (!DEV_MODE_CONFIG.SECURITY.ALLOW_IN_PRODUCTION && !__DEV__) {
      console.warn('当前环境不允许启用开发者模式');
      return false;
    }

    return true;
  }

  /**
   * 启用开发者模式
   */
  async enableDevMode() {
    try {
      if (!this.canEnableDevMode()) {
        throw new Error('无法启用开发者模式');
      }

      console.log('启用开发者模式...');

      // 记录开发者模式开始时间
      this.devModeStartTime = Date.now();
      this.isActive = true;

      // 保存开发者模式状态到本地存储
      await this.saveDevModeState();

      // 记录开发者操作日志
      if (DEV_MODE_CONFIG.SECURITY.LOG_DEV_ACTIONS) {
        this.logDevAction('enable_dev_mode', '启用开发者模式');
      }

      console.log('开发者模式已启用');
      return true;

    } catch (error) {
      console.error('启用开发者模式失败:', error);
      return false;
    }
  }

  /**
   * 禁用开发者模式
   */
  async disableDevMode() {
    try {
      console.log('禁用开发者模式...');

      this.isActive = false;
      this.devModeStartTime = null;

      // 清除开发者模式状态
      await this.clearDevModeState();

      // 记录开发者操作日志
      if (DEV_MODE_CONFIG.SECURITY.LOG_DEV_ACTIONS) {
        this.logDevAction('disable_dev_mode', '禁用开发者模式');
      }

      console.log('开发者模式已禁用');
      return true;

    } catch (error) {
      console.error('禁用开发者模式失败:', error);
      return false;
    }
  }

  /**
   * 检查开发者模式是否过期
   */
  isDevModeExpired() {
    if (!this.devModeStartTime || !this.isActive) {
      return true;
    }

    const expireTime = DEV_MODE_CONFIG.SECURITY.EXPIRE_AFTER_HOURS * 60 * 60 * 1000;
    const currentTime = Date.now();
    const elapsedTime = currentTime - this.devModeStartTime;

    if (elapsedTime > expireTime) {
      console.log('开发者模式已过期，自动禁用');
      this.disableDevMode();
      return true;
    }

    return false;
  }

  /**
   * 获取开发者账户信息（不包含令牌）
   */
  getDevAccount() {
    if (!this.isActive || this.isDevModeExpired()) {
      return null;
    }

    return {
      ...this.devAccount,
      // 不包含任何令牌信息
      isDevMode: true,
      devModeStartTime: this.devModeStartTime,
      remainingTime: this.getRemainingTime()
    };
  }

  /**
   * 获取剩余时间
   */
  getRemainingTime() {
    if (!this.devModeStartTime || !this.isActive) {
      return 0;
    }

    const expireTime = DEV_MODE_CONFIG.SECURITY.EXPIRE_AFTER_HOURS * 60 * 60 * 1000;
    const currentTime = Date.now();
    const elapsedTime = currentTime - this.devModeStartTime;
    const remainingTime = expireTime - elapsedTime;

    return Math.max(0, remainingTime);
  }

  /**
   * 检查是否应该跳过登录界面
   */
  shouldSkipLoginScreen() {
    return this.isActive && 
           !this.isDevModeExpired() && 
           DEV_MODE_CONFIG.FEATURES.SKIP_LOGIN_SCREEN;
  }

  /**
   * 获取开发者模式状态
   */
  getDevModeStatus() {
    return {
      isEnabled: this.isDevMode,
      isActive: this.isActive,
      isExpired: this.isDevModeExpired(),
      startTime: this.devModeStartTime,
      remainingTime: this.getRemainingTime(),
      features: DEV_MODE_CONFIG.FEATURES,
      security: DEV_MODE_CONFIG.SECURITY
    };
  }

  /**
   * 保存开发者模式状态
   */
  async saveDevModeState() {
    try {
      const state = {
        isActive: this.isActive,
        startTime: this.devModeStartTime,
        timestamp: Date.now()
      };

      const realm = await realmService.getRealm();
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "${STORAGE_KEYS.DEV_MODE_STATE}"`);
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(state);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: STORAGE_KEYS.DEV_MODE_STATE,
            value: JSON.stringify(state),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });
      console.log('开发者模式状态已保存');

    } catch (error) {
      console.error('保存开发者模式状态失败:', error);
    }
  }

  /**
   * 恢复开发者模式状态
   */
  async restoreDevModeState() {
    try {
      if (!this.canEnableDevMode()) {
        return false;
      }

      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered(`key = "${STORAGE_KEYS.DEV_MODE_STATE}"`);
      const state = item.length > 0 ? JSON.parse(item[0].value) : null;
      
      if (state && state.isActive) {
        this.isActive = state.isActive;
        this.devModeStartTime = state.startTime;
        
        // 检查是否过期
        if (this.isDevModeExpired()) {
          console.log('恢复的开发者模式已过期，自动禁用');
          await this.disableDevMode();
          return false;
        }

        console.log('开发者模式状态已恢复');
        return true;
      }

      return false;

    } catch (error) {
      console.error('恢复开发者模式状态失败:', error);
      return false;
    }
  }

  /**
   * 清除开发者模式状态
   */
  async clearDevModeState() {
    try {
      const realm = await realmService.getRealm();
      realm.write(() => {
        const item = realm.objects('StorageItem').filtered(`key = "${STORAGE_KEYS.DEV_MODE_STATE}"`);
        if (item.length > 0) realm.delete(item[0]);
      });
      console.log('开发者模式状态已清除');

    } catch (error) {
      console.error('清除开发者模式状态失败:', error);
    }
  }

  /**
   * 记录开发者操作日志
   */
  logDevAction(action, description) {
    try {
      const logEntry = {
        action,
        description,
        timestamp: new Date().toISOString(),
        devModeStartTime: this.devModeStartTime,
        remainingTime: this.getRemainingTime()
      };

      console.log('开发者操作日志:', logEntry);

      // 可以保存到本地存储或发送到日志服务
      this.saveDevActionLog(logEntry);

    } catch (error) {
      console.error('记录开发者操作日志失败:', error);
    }
  }

  /**
   * 保存开发者操作日志
   */
  async saveDevActionLog(logEntry) {
    try {
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered(`key = "${STORAGE_KEYS.DEV_ACTION_LOGS}"`);
      const logs = item.length > 0 ? JSON.parse(item[0].value) : [];
      logs.push(logEntry);

      // 只保留最近100条日志
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "${STORAGE_KEYS.DEV_ACTION_LOGS}"`);
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(logs);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: STORAGE_KEYS.DEV_ACTION_LOGS,
            value: JSON.stringify(logs),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });

    } catch (error) {
      console.error('保存开发者操作日志失败:', error);
    }
  }

  /**
   * 获取开发者操作日志
   */
  async getDevActionLogs() {
    try {
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered(`key = "${STORAGE_KEYS.DEV_ACTION_LOGS}"`);
      return item.length > 0 ? JSON.parse(item[0].value) : [];
    } catch (error) {
      console.error('获取开发者操作日志失败:', error);
      return [];
    }
  }

  /**
   * 清理过期的开发者操作日志
   */
  async cleanupExpiredLogs() {
    try {
      const logs = await this.getDevActionLogs();
      const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7天前

      const filteredLogs = logs.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime > cutoffTime;
      });

      if (filteredLogs.length !== logs.length) {
        const realm = await realmService.getRealm();
        realm.write(() => {
          const existingItem = realm.objects('StorageItem').filtered(`key = "${STORAGE_KEYS.DEV_ACTION_LOGS}"`);
          if (existingItem.length > 0) {
            existingItem[0].value = JSON.stringify(filteredLogs);
            existingItem[0].updated_at = new Date();
          } else {
            realm.create('StorageItem', {
              key: STORAGE_KEYS.DEV_ACTION_LOGS,
              value: JSON.stringify(filteredLogs),
              createdAt: new Date(),
              updated_at: new Date(),
            });
          }
        });
        console.log(`清理了 ${logs.length - filteredLogs.length} 条过期日志`);
      }

    } catch (error) {
      console.error('清理过期日志失败:', error);
    }
  }

  /**
   * 初始化开发者模式服务
   */
  async initialize() {
    try {
      if (!this.canEnableDevMode()) {
        return;
      }

      // 恢复开发者模式状态
      await this.restoreDevModeState();

      // 清理过期日志
      await this.cleanupExpiredLogs();

      console.log('开发者模式服务初始化完成');

    } catch (error) {
      console.error('开发者模式服务初始化失败:', error);
    }
  }
}

// 创建单例实例
const devModeService = new DevModeService();

// 初始化
devModeService.initialize().catch(error => {
  console.error('初始化开发者模式服务失败', error);
});

// 导出
export default devModeService;







