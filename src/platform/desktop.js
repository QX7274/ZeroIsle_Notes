/**
 * Desktop (Electron) Platform Specific Configuration
 */

const isElectron = typeof window !== 'undefined' && window.process?.type === 'renderer';

/**
 * Initialize Electron IPC communication
 */
export const initIPC = () => {
    if (!isElectron) {return null;}

    const { ipcRenderer } = require('electron');
    return ipcRenderer;
};

/**
 * Desktop-specific menu configuration
 */
export const initApplicationMenu = (menuTemplate) => {
    if (!isElectron) {return;}

    const { Menu, remote } = require('electron');
    const menu = Menu.buildFromTemplate(menuTemplate);
    remote.getCurrentWindow().setMenu(menu);
};

/**
 * Desktop-specific tray icon
 */
export const initTray = (iconPath, contextMenu) => {
    if (!isElectron) {return null;}

    const { Tray, Menu, nativeImage, remote } = require('electron');
    const icon = nativeImage.createFromPath(iconPath);
    const tray = new remote.Tray(icon);

    if (contextMenu) {
        const menu = Menu.buildFromTemplate(contextMenu);
        tray.setContextMenu(menu);
    }

    return tray;
};

/**
 * Desktop-specific auto-updater
 */
export const initAutoUpdater = (options = {}) => {
    if (!isElectron) {return null;}

    const { autoUpdater } = require('electron-updater');

    autoUpdater.autoDownload = options.autoDownload ?? true;
    autoUpdater.autoInstallOnAppQuit = options.autoInstall ?? true;

    autoUpdater.on('update-available', (info) => {
        options.onUpdateAvailable?.(info);
    });

    autoUpdater.on('update-downloaded', (info) => {
        options.onUpdateDownloaded?.(info);
    });

    autoUpdater.on('error', (err) => {
        options.onError?.(err);
    });

    autoUpdater.checkForUpdates();

    return autoUpdater;
};

/**
 * Desktop-specific native dialogs
 */
export const showMessageBox = async (options) => {
    if (!isElectron) {return null;}

    const { dialog, remote } = require('electron');
    const dialogModule = dialog || remote.dialog;

    return await dialogModule.showMessageBox(remote?.getCurrentWindow?.(), options);
};

export const showErrorBox = (title, content) => {
    if (!isElectron) {return;}

    const { dialog, remote } = require('electron');
    const dialogModule = dialog || remote.dialog;
    dialogModule.showErrorBox(title, content);
};

/**
 * Desktop-specific window state persistence
 */
export const initWindowStatePersistence = () => {
    if (!isElectron) {return;}

    const Store = require('electron-store');
    const store = new Store({ name: 'window-state' });
    const { remote } = require('electron');
    const win = remote.getCurrentWindow();

    // Load saved state
    const savedState = store.get('windowState', {
        width: 1200,
        height: 800,
        x: undefined,
        y: undefined,
        isMaximized: false,
    });

    if (savedState.isMaximized) {
        win.maximize();
    } else {
        win.setBounds({
            width: savedState.width,
            height: savedState.height,
            x: savedState.x,
            y: savedState.y,
        });
    }

    // Save state on close
    const saveState = () => {
        const bounds = win.getBounds();
        store.set('windowState', {
            ...bounds,
            isMaximized: win.isMaximized(),
        });
    };

    win.on('close', saveState);
    win.on('resize', saveState);
    win.on('move', saveState);
};

/**
 * Desktop-specific global shortcuts
 */
export const registerGlobalShortcut = (accelerator, callback) => {
    if (!isElectron) {return false;}

    const { globalShortcut, remote } = require('electron');
    const shortcutModule = globalShortcut || remote.globalShortcut;

    return shortcutModule.register(accelerator, callback);
};

export const unregisterGlobalShortcut = (accelerator) => {
    if (!isElectron) {return;}

    const { globalShortcut, remote } = require('electron');
    const shortcutModule = globalShortcut || remote.globalShortcut;

    shortcutModule.unregister(accelerator);
};

/**
 * Desktop-specific app badge (macOS)
 */
export const setBadge = (count) => {
    if (!isElectron) {return;}

    const { app, remote } = require('electron');
    const appModule = app || remote.app;

    if (process.platform === 'darwin') {
        appModule.dock.setBadge(count > 0 ? String(count) : '');
    }
};

/**
 * Desktop-specific native notifications with actions
 */
export const showNativeNotification = (options) => {
    if (!isElectron) {return;}

    const { Notification } = require('electron');

    const notification = new Notification({
        title: options.title,
        body: options.body,
        icon: options.icon,
        silent: options.silent,
        actions: options.actions,
    });

    if (options.onClick) {
        notification.on('click', options.onClick);
    }

    if (options.onAction) {
        notification.on('action', (event, index) => {
            options.onAction(options.actions[index], index);
        });
    }

    notification.show();

    return notification;
};

export default {
    isElectron,
    initIPC,
    initApplicationMenu,
    initTray,
    initAutoUpdater,
    showMessageBox,
    showErrorBox,
    initWindowStatePersistence,
    registerGlobalShortcut,
    unregisterGlobalShortcut,
    setBadge,
    showNativeNotification,
};
