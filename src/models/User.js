/**
 * 用户模型 - Realm版本
 */

import Realm from 'realm';
import bcrypt from 'react-native-bcrypt';

/**
 * 用户模型定义
 */
class User extends Realm.Object {
  static schema = {
    name: 'User',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      username: 'string',
      email: 'string',
      password: 'string',
      name: { type: 'string', optional: true },
      avatar: { type: 'string', optional: true },
      bio: { type: 'string', optional: true },
      role: { type: 'string', default: 'user' }, // 'user', 'admin'
      is_active: { type: 'bool', default: true },
      is_verified: { type: 'bool', default: false },
      verification_token: { type: 'string', optional: true },
      reset_password_token: { type: 'string', optional: true },
      reset_password_expires: { type: 'date', optional: true },
      last_login: { type: 'date', optional: true },
      created_at: 'date',
      updated_at: 'date',
      settings: { type: 'string', default: '{}' }, // 存储为JSON字符串
      social: { type: 'string', default: '{}' }, // 存储为JSON字符串
      devices: { type: 'string', default: '[]' }, // 存储为JSON字符串
    },
  };

  /**
   * 加密密码
   * @param {Realm} realm Realm实例
   * @param {string} password 密码
   */
  static async hashPassword(password) {
    // 生成盐
    const salt = await bcrypt.genSalt(10);

    // 加密密码
    return bcrypt.hash(password, salt);
  }

  /**
   * 转换为JSON
   */
  toJSON() {
    // 解析JSON字符串
    const settings = this.settings ? JSON.parse(this.settings) : {};
    const social = this.social ? JSON.parse(this.social) : {};
    const devices = this.devices ? JSON.parse(this.devices) : [];

    // 删除社交令牌
    if (social.google) delete social.google.token;
    if (social.facebook) delete social.facebook.token;
    if (social.twitter) delete social.twitter.token;
    if (social.github) delete social.github.token;

    return {
      _id: this._id,
      id: this._id,
      username: this.username,
      email: this.email,
      name: this.name,
      avatar: this.avatar,
      bio: this.bio,
      role: this.role,
      is_active: this.is_active,
      is_verified: this.is_verified,
      last_login: this.last_login,
      created_at: this.created_at,
      updated_at: this.updated_at,
      settings: settings,
      social: social,
      devices: devices,
    };
  }

  /**
   * 验证密码
   * @param {string} password 密码
   * @returns {Promise<boolean>} 是否匹配
   */
  async comparePassword(password) {
    return bcrypt.compare(password, this.password);
  }

  /**
   * 生成验证令牌
   * @param {Realm} realm Realm实例
   */
  generateVerificationToken(realm) {
    const buffer = new Uint8Array(16);
    crypto.getRandomValues(buffer);
    const token = Array.from(buffer, byte => byte.toString(36)).join('').substring(0, 26);

    realm.write(() => {
      this.verification_token = token;
      this.updated_at = new Date();
    });

    return token;
  }

  /**
   * 生成密码重置令牌
   * @param {Realm} realm Realm实例
   * @param {number} expires 过期时间（小时）
   */
  generateResetPasswordToken(realm, expires = 1) {
    const buffer = new Uint8Array(16);
    crypto.getRandomValues(buffer);
    const token = Array.from(buffer, byte => byte.toString(36)).join('').substring(0, 26);

    realm.write(() => {
      this.reset_password_token = token;
      this.reset_password_expires = new Date(Date.now() + expires * 60 * 60 * 1000);
      this.updated_at = new Date();
    });

    return token;
  }

  /**
   * 更新最后登录时间
   * @param {Realm} realm Realm实例
   */
  updateLastLogin(realm) {
    realm.write(() => {
      this.last_login = new Date();
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 添加设备
   * @param {Realm} realm Realm实例
   * @param {Object} device 设备信息
   */
  addDevice(realm, device) {
    realm.write(() => {
      // 解析当前设备列表
      const devices = this.devices ? JSON.parse(this.devices) : [];

      // 查找现有设备
      const existingDeviceIndex = devices.findIndex(d => d.device_id === device.device_id);

      if (existingDeviceIndex >= 0) {
        // 更新现有设备
        devices[existingDeviceIndex] = {
          ...devices[existingDeviceIndex],
          device_name: device.device_name || devices[existingDeviceIndex].device_name,
          device_type: device.device_type || devices[existingDeviceIndex].device_type,
          last_active: new Date().toISOString(),
        };
      } else {
        // 添加新设备
        devices.push({
          ...device,
          last_active: new Date().toISOString(),
        });
      }

      // 保存为JSON字符串
      this.devices = JSON.stringify(devices);
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 移除设备
   * @param {Realm} realm Realm实例
   * @param {string} deviceId 设备ID
   */
  removeDevice(realm, deviceId) {
    realm.write(() => {
      // 解析当前设备列表
      const devices = this.devices ? JSON.parse(this.devices) : [];

      // 过滤掉指定设备
      const newDevices = devices.filter(d => d.device_id !== deviceId);

      // 保存为JSON字符串
      this.devices = JSON.stringify(newDevices);
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新设置
   * @param {Realm} realm Realm实例
   * @param {Object} settings 设置
   */
  updateSettings(realm, settings) {
    realm.write(() => {
      // 解析当前设置
      const currentSettings = this.settings ? JSON.parse(this.settings) : {};

      // 合并设置
      const newSettings = {
        ...currentSettings,
        ...settings,
      };

      // 保存为JSON字符串
      this.settings = JSON.stringify(newSettings);
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 静态方法 - 根据ID查找
   * @param {Realm} realm Realm实例
   * @param {string} id ID
   */
  static findById(realm, id) {
    return realm.objectForPrimaryKey('User', id);
  }

  /**
   * 静态方法 - 根据用户名查找
   * @param {Realm} realm Realm实例
   * @param {string} username 用户名
   */
  static findByUsername(realm, username) {
    const users = realm.objects('User')
      .filtered(`username = "${username}" AND is_active = true`);

    return users.length > 0 ? users[0] : null;
  }

  /**
   * 静态方法 - 根据邮箱查找
   * @param {Realm} realm Realm实例
   * @param {string} email 邮箱
   */
  static findByEmail(realm, email) {
    const users = realm.objects('User')
      .filtered(`email = "${email}" AND is_active = true`);

    return users.length > 0 ? users[0] : null;
  }

  /**
   * 静态方法 - 根据验证令牌查找
   * @param {Realm} realm Realm实例
   * @param {string} token 验证令牌
   */
  static findByVerificationToken(realm, token) {
    const users = realm.objects('User')
      .filtered(`verification_token = "${token}"`);

    return users.length > 0 ? users[0] : null;
  }

  /**
   * 静态方法 - 根据密码重置令牌查找
   * @param {Realm} realm Realm实例
   * @param {string} token 密码重置令牌
   */
  static findByResetPasswordToken(realm, token) {
    const now = new Date();

    const users = realm.objects('User')
      .filtered(`reset_password_token = "${token}" AND reset_password_expires > $0`, now);

    return users.length > 0 ? users[0] : null;
  }

  /**
   * 静态方法 - 根据社交ID查找
   * @param {Realm} realm Realm实例
   * @param {string} provider 提供商
   * @param {string} id ID
   */
  static findBySocialId(realm, provider, id) {
    // 由于social是JSON字符串，我们需要在应用层面进行过滤
    const users = realm.objects('User');

    // 过滤包含指定社交ID的用户
    const filteredUsers = Array.from(users).filter(user => {
      try {
        const social = JSON.parse(user.social || '{}');
        return social[provider] && social[provider].id === id;
      } catch (e) {
        return false;
      }
    });

    return filteredUsers.length > 0 ? filteredUsers[0] : null;
  }

  /**
   * 静态方法 - 创建用户
   * @param {Realm} realm Realm实例
   * @param {Object} userData 用户数据
   */
  static async createUser(realm, userData) {
    // 加密密码
    const hashedPassword = await this.hashPassword(userData.password);

    // 准备设置
    const settings = {
      theme: 'auto',
      language: 'zh-CN',
      notifications: true,
      default_view: 'grid',
      sort_notes_by: 'updated_at',
      sort_direction: 'desc',
      ...(userData.settings || {}),
    };

    // 创建用户
    let user;
    realm.write(() => {
      user = realm.create('User', {
        _id: new Realm.BSON.ObjectId().toHexString(),
        username: userData.username,
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        avatar: userData.avatar,
        bio: userData.bio,
        role: userData.role || 'user',
        is_active: true,
        is_verified: false,
        created_at: new Date(),
        updated_at: new Date(),
        settings: JSON.stringify(settings),
        social: JSON.stringify(userData.social || {}),
        devices: JSON.stringify(userData.devices || []),
      });
    });

    return user;
  }
}

export default User;
