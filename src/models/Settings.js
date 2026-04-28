/**
 * 设置模型 - Realm版本
 * 用于存储用户设置
 */

import Realm from 'realm';

/**
 * 设置模型定义
 */
class Settings extends Realm.Object {
  static schema = {
    name: 'Settings',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      user_id: 'string',
      theme: { type: 'string', default: 'light' }, // 'light', 'dark', 'auto', 'custom'
      language: { type: 'string', default: 'zh-CN' },
      font_size: { type: 'string', default: 'medium' }, // 'small', 'medium', 'large', 'extra-large'
      font_family: { type: 'string', default: 'system' },
      auto_save: { type: 'bool', default: true },
      auto_save_interval: { type: 'int', default: 30000 }, // 30秒
      sync_enabled: { type: 'bool', default: true },
      sync_interval: { type: 'int', default: 300000 }, // 5分钟
      notifications_enabled: { type: 'bool', default: true },
      sound_enabled: { type: 'bool', default: true },
      editor_settings: { type: 'string', default: '{"spellCheck":true,"autoCorrect":true,"lineNumbers":true,"wordWrap":true,"highlightCurrentLine":true,"tabSize":2,"indentWithTabs":false,"showInvisibles":false,"useHardWraps":false,"showGutter":true,"showPrintMargin":false,"printMarginColumn":80,"scrollPastEnd":false,"behavioursEnabled":true,"wrapBehavioursEnabled":true,"autoScrollEditorIntoView":false,"copyWithEmptySelection":false,"useSoftTabs":true,"navigateWithinSoftTabs":false,"enableMultiselect":true,"enableEmmet":true,"enableBasicAutocompletion":true,"enableLiveAutocompletion":true,"enableSnippets":true,"showFoldWidgets":true,"fadeFoldWidgets":false,"showLineNumbers":true,"showRowNumbers":true,"fixedWidthGutter":false,"highlightGutterLine":true,"animatedScroll":false,"scrollSpeed":1,"fontSize":14}' }, // 存储为JSON字符串
      view_settings: { type: 'string', default: '{"showSidebar":true,"sidebarWidth":250,"showToolbar":true,"showStatusBar":true,"showMinimap":false,"minimapWidth":120,"showLineNumbers":true,"showFoldingControls":"mouseover","fontLigatures":false,"fontFamily":"Menlo, Monaco, \\"Courier New\\", monospace","fontSize":14,"lineHeight":1.5,"letterSpacing":0,"cursorStyle":"line","cursorWidth":2,"cursorBlinking":"blink","smoothScrolling":true,"mouseWheelZoom":true,"mouseWheelScrollSensitivity":1,"dragAndDrop":true,"links":true,"contextmenu":true,"quickSuggestions":true,"quickSuggestionsDelay":500,"parameterHints":true,"autoIndent":true,"formatOnType":false,"formatOnPaste":false,"tabCompletion":"on","wordBasedSuggestions":true,"wordWrap":"off","wordWrapColumn":80,"wrappingIndent":"same","wrappingStrategy":"simple"}' }, // 存储为JSON字符串
      privacy_settings: { type: 'string', default: '{"collectAnalytics":true,"collectCrashReports":true,"collectUsageData":true,"shareAnonymousData":false,"enableCookies":true,"enableLocalStorage":true,"enableSessionStorage":true,"enableIndexedDB":true,"enableServiceWorker":true,"enableCache":true,"enableHistory":true,"enableGeolocation":false,"enableNotifications":true,"enableMicrophone":false,"enableCamera":false,"enableBluetooth":false,"enableUSB":false,"enableSerial":false,"enableMIDI":false,"enableGamepad":false,"enableVR":false,"enableAR":false}' }, // 存储为JSON字符串
      security_settings: { type: 'string', default: '{"enableEncryption":false,"encryptionKey":"","encryptionAlgorithm":"AES-256-GCM","enablePasswordProtection":false,"passwordHash":"","passwordSalt":"","passwordAlgorithm":"react-native-bcrypt","passwordIterations":10,"enableTwoFactorAuth":false,"twoFactorAuthType":"totp","twoFactorAuthSecret":"","enableBiometricAuth":false,"enableAutoLock":false,"autoLockTimeout":300000,"enableScreenshotProtection":false,"enableClipboardProtection":false,"enableWatermark":false,"watermarkText":"","enableSessionTimeout":false,"sessionTimeout":3600000}' }, // 存储为JSON字符串
      accessibility_settings: { type: 'string', default: '{"highContrast":false,"largeText":false,"boldText":false,"reduceMotion":false,"reduceTransparency":false,"invertColors":false,"grayscale":false,"enableScreenReader":false,"enableKeyboardNavigation":true,"enableMouseKeys":false,"enableStickyKeys":false,"enableSlowKeys":false,"enableBounceKeys":false,"enableToggleKeys":false,"enableFilterKeys":false,"enableSwitchControl":false,"enableVoiceControl":false,"enableGestureControl":false,"enableEyeControl":false,"enableBrainControl":false}' }, // 存储为JSON字符串
      custom_settings: { type: 'string', default: '{}' }, // 存储为JSON字符串
      is_synced: { type: 'bool', default: false },
      created_at: 'date',
      updated_at: 'date',
    },
  };

  /**
   * 转换为JSON
   */
  toJSON() {
    // 解析JSON字符串
    const editorSettings = this.editor_settings ? JSON.parse(this.editor_settings) : {};
    const viewSettings = this.view_settings ? JSON.parse(this.view_settings) : {};
    const privacySettings = this.privacy_settings ? JSON.parse(this.privacy_settings) : {};
    const securitySettings = this.security_settings ? JSON.parse(this.security_settings) : {};
    const accessibilitySettings = this.accessibility_settings ? JSON.parse(this.accessibility_settings) : {};
    const customSettings = this.custom_settings ? JSON.parse(this.custom_settings) : {};

    return {
      _id: this._id,
      id: this._id,
      user_id: this.user_id,
      theme: this.theme,
      language: this.language,
      font_size: this.font_size,
      font_family: this.font_family,
      auto_save: this.auto_save,
      auto_save_interval: this.auto_save_interval,
      sync_enabled: this.sync_enabled,
      sync_interval: this.sync_interval,
      notifications_enabled: this.notifications_enabled,
      sound_enabled: this.sound_enabled,
      editor_settings: editorSettings,
      view_settings: viewSettings,
      privacy_settings: privacySettings,
      security_settings: securitySettings,
      accessibility_settings: accessibilitySettings,
      custom_settings: customSettings,
      is_synced: this.is_synced,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  /**
   * 更新设置
   * @param {Realm} realm Realm实例
   * @param {string} key 设置键
   * @param {any} value 设置值
   */
  updateSetting(realm, key, value) {
    if (!this.hasOwnProperty(key)) {
      throw new Error(`设置键 "${key}" 不存在`);
    }

    realm.write(() => {
      // 处理复杂对象
      if (key.endsWith('_settings')) {
        const currentSettings = this[key] ? JSON.parse(this[key]) : {};

        if (typeof value === 'object') {
          // 合并对象
          const newSettings = {
            ...currentSettings,
            ...value,
          };

          this[key] = JSON.stringify(newSettings);
        } else {
          throw new Error('设置值必须是对象');
        }
      } else {
        // 简单值直接赋值
        this[key] = value;
      }

      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新编辑器设置
   * @param {Realm} realm Realm实例
   * @param {Object} settings 编辑器设置
   */
  updateEditorSettings(realm, settings) {
    return this.updateSetting(realm, 'editor_settings', settings);
  }

  /**
   * 更新视图设置
   * @param {Realm} realm Realm实例
   * @param {Object} settings 视图设置
   */
  updateViewSettings(realm, settings) {
    return this.updateSetting(realm, 'view_settings', settings);
  }

  /**
   * 更新隐私设置
   * @param {Realm} realm Realm实例
   * @param {Object} settings 隐私设置
   */
  updatePrivacySettings(realm, settings) {
    return this.updateSetting(realm, 'privacy_settings', settings);
  }

  /**
   * 更新安全设置
   * @param {Realm} realm Realm实例
   * @param {Object} settings 安全设置
   */
  updateSecuritySettings(realm, settings) {
    return this.updateSetting(realm, 'security_settings', settings);
  }

  /**
   * 更新辅助功能设置
   * @param {Realm} realm Realm实例
   * @param {Object} settings 辅助功能设置
   */
  updateAccessibilitySettings(realm, settings) {
    return this.updateSetting(realm, 'accessibility_settings', settings);
  }

  /**
   * 更新自定义设置
   * @param {Realm} realm Realm实例
   * @param {Object} settings 自定义设置
   */
  updateCustomSettings(realm, settings) {
    return this.updateSetting(realm, 'custom_settings', settings);
  }

  /**
   * 重置所有设置为默认值
   * @param {Realm} realm Realm实例
   */
  resetToDefaults(realm) {
    realm.write(() => {
      this.theme = 'light';
      this.language = 'zh-CN';
      this.font_size = 'medium';
      this.font_family = 'system';
      this.auto_save = true;
      this.auto_save_interval = 30000;
      this.sync_enabled = true;
      this.sync_interval = 300000;
      this.notifications_enabled = true;
      this.sound_enabled = true;
      this.editor_settings = '{"spellCheck":true,"autoCorrect":true,"lineNumbers":true,"wordWrap":true,"highlightCurrentLine":true,"tabSize":2,"indentWithTabs":false,"showInvisibles":false,"useHardWraps":false,"showGutter":true,"showPrintMargin":false,"printMarginColumn":80,"scrollPastEnd":false,"behavioursEnabled":true,"wrapBehavioursEnabled":true,"autoScrollEditorIntoView":false,"copyWithEmptySelection":false,"useSoftTabs":true,"navigateWithinSoftTabs":false,"enableMultiselect":true,"enableEmmet":true,"enableBasicAutocompletion":true,"enableLiveAutocompletion":true,"enableSnippets":true,"showFoldWidgets":true,"fadeFoldWidgets":false,"showLineNumbers":true,"showRowNumbers":true,"fixedWidthGutter":false,"highlightGutterLine":true,"animatedScroll":false,"scrollSpeed":1,"fontSize":14}';
      this.view_settings = '{"showSidebar":true,"sidebarWidth":250,"showToolbar":true,"showStatusBar":true,"showMinimap":false,"minimapWidth":120,"showLineNumbers":true,"showFoldingControls":"mouseover","fontLigatures":false,"fontFamily":"Menlo, Monaco, \\"Courier New\\", monospace","fontSize":14,"lineHeight":1.5,"letterSpacing":0,"cursorStyle":"line","cursorWidth":2,"cursorBlinking":"blink","smoothScrolling":true,"mouseWheelZoom":true,"mouseWheelScrollSensitivity":1,"dragAndDrop":true,"links":true,"contextmenu":true,"quickSuggestions":true,"quickSuggestionsDelay":500,"parameterHints":true,"autoIndent":true,"formatOnType":false,"formatOnPaste":false,"tabCompletion":"on","wordBasedSuggestions":true,"wordWrap":"off","wordWrapColumn":80,"wrappingIndent":"same","wrappingStrategy":"simple"}';
      this.privacy_settings = '{"collectAnalytics":true,"collectCrashReports":true,"collectUsageData":true,"shareAnonymousData":false,"enableCookies":true,"enableLocalStorage":true,"enableSessionStorage":true,"enableIndexedDB":true,"enableServiceWorker":true,"enableCache":true,"enableHistory":true,"enableGeolocation":false,"enableNotifications":true,"enableMicrophone":false,"enableCamera":false,"enableBluetooth":false,"enableUSB":false,"enableSerial":false,"enableMIDI":false,"enableGamepad":false,"enableVR":false,"enableAR":false}';
      this.security_settings = '{"enableEncryption":false,"encryptionKey":"","encryptionAlgorithm":"AES-256-GCM","enablePasswordProtection":false,"passwordHash":"","passwordSalt":"","passwordAlgorithm":"react-native-bcrypt","passwordIterations":10,"enableTwoFactorAuth":false,"twoFactorAuthType":"totp","twoFactorAuthSecret":"","enableBiometricAuth":false,"enableAutoLock":false,"autoLockTimeout":300000,"enableScreenshotProtection":false,"enableClipboardProtection":false,"enableWatermark":false,"watermarkText":"","enableSessionTimeout":false,"sessionTimeout":3600000}';
      this.accessibility_settings = '{"highContrast":false,"largeText":false,"boldText":false,"reduceMotion":false,"reduceTransparency":false,"invertColors":false,"grayscale":false,"enableScreenReader":false,"enableKeyboardNavigation":true,"enableMouseKeys":false,"enableStickyKeys":false,"enableSlowKeys":false,"enableBounceKeys":false,"enableToggleKeys":false,"enableFilterKeys":false,"enableSwitchControl":false,"enableVoiceControl":false,"enableGestureControl":false,"enableEyeControl":false,"enableBrainControl":false}';
      this.custom_settings = '{}';
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 静态方法 - 获取用户设置
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   */
  static getByUserId(realm, userId) {
    return realm.objects('Settings').filtered(`user_id = "${userId}"`)[0];
  }

  /**
   * 静态方法 - 创建或获取用户设置
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   */
  static createOrGetByUserId(realm, userId) {
    let settings = this.getByUserId(realm, userId);

    if (!settings) {
      realm.write(() => {
        settings = realm.create('Settings', {
          _id: new Realm.BSON.ObjectId().toHexString(),
          user_id: userId,
          created_at: new Date(),
          updated_at: new Date(),
        });
      });
    }

    return settings;
  }
}

export default Settings;
