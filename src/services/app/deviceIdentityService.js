/**
 * 设备标识服务 - 提供稳定的设备 ID
 * 用于多端同步幂等判定与冲突审计
 */

import secureStorage from '../../utils/secureStorage';
import { logService } from '../../utils/logService';

import { v4 as uuidv4 } from 'uuid';

class DeviceIdentityService {
  constructor() {
    this.deviceId = null;
    this.STORAGE_KEY = 'device_identity_id';
  }

  /**
   * 获取或生成设备 ID
   * @returns {Promise<string>} 设备唯一标识
   */
  async getDeviceId() {
    if (this.deviceId) {
      return this.deviceId;
    }

    try {
      // 1. 尝试从安全存储获取
      let id = await secureStorage.getItem(this.STORAGE_KEY);
      
      if (!id) {
        // 2. 首次生成
        id = `dev_${uuidv4()}`;
        await secureStorage.setItem(this.STORAGE_KEY, id);
        logService.info(`[DeviceIdentity] 首次生成设备ID: ${id}`);
      } else {
        logService.info(`[DeviceIdentity] 加载现有设备ID: ${id}`);
      }

      this.deviceId = id;
      return id;
    } catch (error) {
      logService.error('[DeviceIdentity] 获取设备ID失败，回退到临时ID', error);
      // 极端失败情况下的回退，不持久化
      return `temp_${uuidv4()}`;
    }
  }

  /**
   * 重置设备 ID (仅限调试或账号解绑)
   */
  async resetDeviceId() {
    try {
      await secureStorage.removeItem(this.STORAGE_KEY);
      this.deviceId = null;
    } catch (error) {
      logService.error('[DeviceIdentity] 重置设备ID失败', error);
    }
  }
}

export const deviceIdentityService = new DeviceIdentityService();
export default deviceIdentityService;

