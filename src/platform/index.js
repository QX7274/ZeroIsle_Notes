/**
 * Platform Abstraction Layer
 *
 * Provides unified API for platform-specific features across:
 * - React Native (iOS/Android)
 * - Web (React.js)
 * - Desktop (Electron)
 */
/* global Notification, localStorage */

import { Platform, Dimensions, Linking } from 'react-native';

const getRuntimeRequire = () => {
    const runtimeScope = typeof global !== 'undefined'
        ? global
        : typeof window !== 'undefined'
            ? window
            : null;

    if (!runtimeScope) {
        return null;
    }

    if (typeof runtimeScope.require === 'function') {
        return runtimeScope.require.bind(runtimeScope);
    }

    if (runtimeScope.window && typeof runtimeScope.window.require === 'function') {
        return runtimeScope.window.require.bind(runtimeScope.window);
    }

    return null;
};

const getOptionalModule = (moduleName) => {
    const runtimeRequire = getRuntimeRequire();
    if (!runtimeRequire) {
        return null;
    }

    try {
        return runtimeRequire(moduleName);
    } catch (error) {
        return null;
    }
};

const getElectronModule = () => {
    if (!isDesktop()) {
        return null;
    }

    return getOptionalModule('electron');
};

/**
 * Platform detection
 */
export const PlatformType = {
    IOS: 'ios',
    ANDROID: 'android',
    WEB: 'web',
    MACOS: 'macos',
    WINDOWS: 'windows',
    LINUX: 'linux',
};

/**
 * Get current platform
 */
export const getCurrentPlatform = () => {
    if (Platform.OS === 'ios') {return PlatformType.IOS;}
    if (Platform.OS === 'android') {return PlatformType.ANDROID;}
    if (Platform.OS === 'web') {return PlatformType.WEB;}
    if (Platform.OS === 'macos') {return PlatformType.MACOS;}
    if (Platform.OS === 'windows') {return PlatformType.WINDOWS;}
    return PlatformType.WEB;
};

/**
 * Check if running on mobile
 */
export const isMobile = () => {
    const platform = getCurrentPlatform();
    return platform === PlatformType.IOS || platform === PlatformType.ANDROID;
};

/**
 * Check if running on desktop
 */
export const isDesktop = () => {
    const platform = getCurrentPlatform();
    return [PlatformType.MACOS, PlatformType.WINDOWS, PlatformType.LINUX].includes(platform);
};

/**
 * Check if running on web
 */
export const isWeb = () => getCurrentPlatform() === PlatformType.WEB;

/**
 * Platform-specific file system access
 */
export const FileSystem = {
    /**
     * Pick a file from device
     */
    pickFile: async (options = {}) => {
        const {
            type = '*/*',
            multiple = false,
        } = options;

        if (isMobile()) {
            // React Native implementation
            const DocumentPickerModule = getOptionalModule('react-native-document-picker');
            const DocumentPicker = DocumentPickerModule?.default || DocumentPickerModule;
            if (!DocumentPicker) {
                throw new Error('Document picker is unavailable in the current runtime.');
            }
            try {
                const result = await DocumentPicker.pick({
                    type: [type],
                    allowMultiSelection: multiple,
                });
                return result;
            } catch (err) {
                if (DocumentPicker.isCancel(err)) {
                    return null;
                }
                throw err;
            }
        } else if (isWeb()) {
            // Web implementation
            return new Promise((resolve) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = type;
                input.multiple = multiple;
                input.onchange = (e) => {
                    resolve(Array.from(e.target.files));
                };
                input.click();
            });
        } else if (isDesktop()) {
            // Electron implementation
            const electron = getElectronModule();
            const dialog = electron?.remote?.dialog;
            if (!dialog) {
                throw new Error('Electron dialog is unavailable in the current runtime.');
            }
            const result = await dialog.showOpenDialog({
                properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
                filters: [{ name: 'Files', extensions: [type.replace('*/', '')] }],
            });
            return result.filePaths;
        }
    },

    /**
     * Save file to device
     */
    saveFile: async (data, filename, options = {}) => {
        const { mimeType = 'application/octet-stream' } = options;

        if (isMobile()) {
            const RNFS = require('react-native-fs');
            const path = `${RNFS.DocumentDirectoryPath}/${filename}`;
            await RNFS.writeFile(path, data, 'utf8');
            return path;
        } else if (isWeb()) {
            const blob = new Blob([data], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            return filename;
        } else if (isDesktop()) {
            const electron = getElectronModule();
            const dialog = electron?.remote?.dialog;
            if (!dialog) {
                throw new Error('Electron dialog is unavailable in the current runtime.');
            }
            const fs = getOptionalModule('fs');
            if (!fs) {
                throw new Error('Electron file system bridge is unavailable in the current runtime.');
            }
            const result = await dialog.showSaveDialog({
                defaultPath: filename,
            });
            if (result.filePath) {
                fs.writeFileSync(result.filePath, data);
                return result.filePath;
            }
            return null;
        }
    },
};

/**
 * Platform-specific notifications
 */
export const Notifications = {
    /**
     * Request notification permission
     */
    requestPermission: async () => {
        if (isMobile()) {
            // Use react-native push notification library
            return true; // Handled by native module
        } else if (isWeb()) {
            const WebNotification = typeof Notification !== 'undefined' ? Notification : null;
            if (WebNotification) {
                const permission = await WebNotification.requestPermission();
                return permission === 'granted';
            }
            return false;
        } else if (isDesktop()) {
            return true; // Electron notifications don't need permission
        }
        return false;
    },

    /**
     * Show local notification
     */
    show: async (title, body, options = {}) => {
        if (isMobile()) {
            const PushNotification = require('react-native-push-notification');
            PushNotification.localNotification({
                title,
                message: body,
                ...options,
            });
        } else if (isWeb()) {
            const WebNotification = typeof Notification !== 'undefined' ? Notification : null;
            if (WebNotification && WebNotification.permission === 'granted') {
                const notification = new WebNotification(title, { body, ...options });
                return notification;
            }
        } else if (isDesktop()) {
            const electron = getElectronModule();
            const ElectronNotification = electron?.Notification;
            if (!ElectronNotification) {
                throw new Error('Electron Notification is unavailable in the current runtime.');
            }
            new ElectronNotification({ title, body }).show();
        }
    },
};

/**
 * Platform-specific clipboard
 */
export const Clipboard = {
    /**
     * Copy text to clipboard
     */
    copy: async (text) => {
        if (isMobile()) {
            const { default: RNClipboard } = require('@react-native-clipboard/clipboard');
            RNClipboard.setString(text);
        } else if (isWeb()) {
            await navigator.clipboard.writeText(text);
        } else if (isDesktop()) {
            const electron = getElectronModule();
            const clipboard = electron?.clipboard;
            if (!clipboard) {
                throw new Error('Electron clipboard is unavailable in the current runtime.');
            }
            clipboard.writeText(text);
        }
    },

    /**
     * Read text from clipboard
     */
    paste: async () => {
        if (isMobile()) {
            const { default: RNClipboard } = require('@react-native-clipboard/clipboard');
            return await RNClipboard.getString();
        } else if (isWeb()) {
            return await navigator.clipboard.readText();
        } else if (isDesktop()) {
            const electron = getElectronModule();
            const clipboard = electron?.clipboard;
            if (!clipboard) {
                throw new Error('Electron clipboard is unavailable in the current runtime.');
            }
            return clipboard.readText();
        }
        return '';
    },
};

/**
 * Platform-specific sharing
 */
export const Share = {
    /**
     * Share content
     */
    share: async (content) => {
        const { title, message, url } = content;

        if (isMobile()) {
            const { Share: RNShare } = require('react-native');
            return await RNShare.share({ title, message, url });
        } else if (isWeb()) {
            if (navigator.share) {
                return await navigator.share({ title, text: message, url });
            }
            // Fallback to clipboard
            await Clipboard.copy(url || message);
            return { action: 'copied' };
        } else if (isDesktop()) {
            // Desktop fallback - copy to clipboard
            await Clipboard.copy(url || message);
            return { action: 'copied' };
        }
    },
};

/**
 * Platform-specific biometric authentication
 */
export const Biometrics = {
    /**
     * Check if biometrics is available
     */
    isAvailable: async () => {
        if (isMobile()) {
            try {
                const TouchID = getOptionalModule('react-native-touch-id');
                if (!TouchID || typeof TouchID.isSupported !== 'function') {
                    return { available: false };
                }
                const biometryType = await TouchID.isSupported();
                return { available: true, type: biometryType };
            } catch {
                return { available: false };
            }
        } else if (isDesktop()) {
            // Check for Windows Hello or Touch ID on Mac
            return { available: false }; // Implement per platform
        }
        return { available: false };
    },

    /**
     * Authenticate with biometrics
     */
    authenticate: async (reason = '请验证身份') => {
        if (isMobile()) {
            const TouchID = getOptionalModule('react-native-touch-id');
            if (!TouchID || typeof TouchID.authenticate !== 'function') {
                return false;
            }
            const config = {
                title: '身份验证',
                imageColor: '#3b82f6',
                fallbackLabel: '使用密码',
            };
            return await TouchID.authenticate(reason, config);
        }
        return false;
    },
};

/**
 * Platform-specific storage
 */
export const Storage = {
    /**
     * Get item from storage
     */
    getItem: async (key) => {
        if (isMobile()) {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            return await AsyncStorage.getItem(key);
        } else if (isWeb()) {
            return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
        } else if (isDesktop()) {
            const Store = getOptionalModule('electron-store');
            if (!Store) {
                return null;
            }
            const store = new Store();
            return store.get(key);
        }
        return null;
    },

    /**
     * Set item in storage
     */
    setItem: async (key, value) => {
        if (isMobile()) {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            await AsyncStorage.setItem(key, value);
        } else if (isWeb()) {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(key, value);
            }
        } else if (isDesktop()) {
            const Store = getOptionalModule('electron-store');
            if (!Store) {
                return;
            }
            const store = new Store();
            store.set(key, value);
        }
    },

    /**
     * Remove item from storage
     */
    removeItem: async (key) => {
        if (isMobile()) {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            await AsyncStorage.removeItem(key);
        } else if (isWeb()) {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(key);
            }
        } else if (isDesktop()) {
            const Store = getOptionalModule('electron-store');
            if (!Store) {
                return;
            }
            const store = new Store();
            store.delete(key);
        }
    },
};

/**
 * Platform-specific window management (Desktop only)
 */
export const Window = {
    /**
     * Minimize window
     */
    minimize: () => {
        if (isDesktop()) {
            const getCurrentWindow = getElectronModule()?.remote?.getCurrentWindow;
            if (!getCurrentWindow) {
                return;
            }
            getCurrentWindow().minimize();
        }
    },

    /**
     * Maximize window
     */
    maximize: () => {
        if (isDesktop()) {
            const getCurrentWindow = getElectronModule()?.remote?.getCurrentWindow;
            if (!getCurrentWindow) {
                return;
            }
            const win = getCurrentWindow();
            if (win.isMaximized()) {
                win.unmaximize();
            } else {
                win.maximize();
            }
        }
    },

    /**
     * Close window
     */
    close: () => {
        if (isDesktop()) {
            const getCurrentWindow = getElectronModule()?.remote?.getCurrentWindow;
            if (!getCurrentWindow) {
                return;
            }
            getCurrentWindow().close();
        }
    },

    /**
     * Set window title
     */
    setTitle: (title) => {
        if (isDesktop()) {
            const getCurrentWindow = getElectronModule()?.remote?.getCurrentWindow;
            if (!getCurrentWindow) {
                return;
            }
            getCurrentWindow().setTitle(title);
        } else if (isWeb()) {
            document.title = title;
        }
    },
};

/**
 * Get screen dimensions
 */
export const getScreenDimensions = () => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
};

/**
 * Open URL
 */
export const openURL = async (url) => {
    if (isMobile()) {
        await Linking.openURL(url);
    } else if (isWeb()) {
        window.open(url, '_blank');
    } else if (isDesktop()) {
        const shell = getElectronModule()?.shell;
        if (!shell) {
            return;
        }
        shell.openExternal(url);
    }
};

export default {
    PlatformType,
    getCurrentPlatform,
    isMobile,
    isDesktop,
    isWeb,
    FileSystem,
    Notifications,
    Clipboard,
    Share,
    Biometrics,
    Storage,
    Window,
    getScreenDimensions,
    openURL,
};
