/**
 * ZeroIsle Notes - Electron Main Process
 *
 * This file is the entry point for the Electron desktop application.
 */

const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

// Store for window state persistence
const store = new Store({ name: 'window-state' });

// Global references
let mainWindow = null;
let tray = null;

const isDev = process.env.NODE_ENV === 'development';

/**
 * Create the main application window
 */
function createWindow() {
    // Restore window state
    const windowState = store.get('windowState', {
        width: 1200,
        height: 800,
        x: undefined,
        y: undefined,
        isMaximized: false,
    });

    mainWindow = new BrowserWindow({
        width: windowState.width,
        height: windowState.height,
        x: windowState.x,
        y: windowState.y,
        minWidth: 800,
        minHeight: 600,
        title: '零屿笔记 - ZeroIsle Notes',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        backgroundColor: '#1a1a2e',
        show: false, // Show when ready
    });

    // Restore maximized state
    if (windowState.isMaximized) {
        mainWindow.maximize();
    }

    // Load the app
    if (isDev) {
        mainWindow.loadURL('http://127.0.0.1:8081/shared-screen-lab/');
        mainWindow.webContents.openDevTools();
    } else {
        // 生产模式下加载打包好的 web 产物。
        //
        // 背景：electron-builder.yml 声明收录 web-build/**，但仓库中并无该目录，
        // 也没有任何脚本生成它（详见 docs/发布物与管理后台解耦说明.md 第 3 节）。
        // 此前这里会直接 loadFile 一个不存在的路径，表现为窗口白屏 + 一条难以定位的
        // ENOENT，排查成本高。现改为在加载前显式校验，缺失时给出可操作的错误信息。
        const webBuildEntry = path.join(__dirname, '../web-build/index.html');
        if (!fs.existsSync(webBuildEntry)) {
            const detail =
                '未找到桌面端 web 产物：' + webBuildEntry + '\n\n' +
                'electron-builder.yml 要求打包 web-build/**，但当前仓库没有该目录，' +
                '也没有生成它的构建脚本，因此该包无法正常显示界面。\n\n' +
                '处置建议：先确认 web-build 的产出方式（参见 ' +
                'docs/发布物与管理后台解耦说明.md 第 3.4 节的三个候选方案），' +
                '或在暂不交付桌面端时移除 electron-builder 配置。';
            log.error(detail);
            dialog.showErrorBox('零屿笔记桌面端启动失败', detail);
            app.quit();
            return;
        }
        mainWindow.loadFile(webBuildEntry);
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Save window state on close/resize/move
    const saveWindowState = () => {
        if (!mainWindow.isMinimized()) {
            const bounds = mainWindow.getBounds();
            store.set('windowState', {
                ...bounds,
                isMaximized: mainWindow.isMaximized(),
            });
        }
    };

    mainWindow.on('close', saveWindowState);
    mainWindow.on('resize', saveWindowState);
    mainWindow.on('move', saveWindowState);

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

/**
 * Create application menu
 */
function createMenu() {
    const template = [
        {
            label: '文件',
            submenu: [
                { label: '新建笔记', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('menu:new-note') },
                { type: 'separator' },
                { label: '设置', accelerator: 'CmdOrCtrl+,', click: () => mainWindow?.webContents.send('menu:settings') },
                { type: 'separator' },
                { role: 'quit', label: '退出' },
            ],
        },
        {
            label: '编辑',
            submenu: [
                { role: 'undo', label: '撤销' },
                { role: 'redo', label: '重做' },
                { type: 'separator' },
                { role: 'cut', label: '剪切' },
                { role: 'copy', label: '复制' },
                { role: 'paste', label: '粘贴' },
                { role: 'selectAll', label: '全选' },
            ],
        },
        {
            label: '视图',
            submenu: [
                { role: 'reload', label: '重新加载' },
                { role: 'toggleDevTools', label: '开发者工具' },
                { type: 'separator' },
                { role: 'resetZoom', label: '重置缩放' },
                { role: 'zoomIn', label: '放大' },
                { role: 'zoomOut', label: '缩小' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: '全屏' },
            ],
        },
        {
            label: '帮助',
            submenu: [
                { label: '检查更新', click: () => autoUpdater.checkForUpdatesAndNotify() },
                { type: 'separator' },
                { label: '关于', click: () => mainWindow?.webContents.send('menu:about') },
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

/**
 * Create system tray
 */
function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.resize({ width: 16, height: 16 }));

    const contextMenu = Menu.buildFromTemplate([
        { label: '显示窗口', click: () => mainWindow?.show() },
        { type: 'separator' },
        { label: '退出', click: () => app.quit() },
    ]);

    tray.setToolTip('零屿笔记');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        mainWindow?.show();
    });
}

/**
 * Setup auto-updater
 */
function setupAutoUpdater() {
    autoUpdater.on('checking-for-update', () => {
        log.info('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
        log.info('Update available:', info);
        mainWindow?.webContents.send('update:available', info);
    });

    autoUpdater.on('update-not-available', (info) => {
        log.info('Update not available:', info);
    });

    autoUpdater.on('download-progress', (progress) => {
        mainWindow?.webContents.send('update:progress', progress);
    });

    autoUpdater.on('update-downloaded', (info) => {
        log.info('Update downloaded:', info);
        mainWindow?.webContents.send('update:downloaded', info);
    });

    autoUpdater.on('error', (err) => {
        log.error('Update error:', err);
    });

    // Check for updates after launch
    if (!isDev) {
        setTimeout(() => {
            autoUpdater.checkForUpdatesAndNotify();
        }, 5000);
    }
}

/**
 * IPC Handlers
 */
function setupIPC() {
    ipcMain.handle('app:getVersion', () => app.getVersion());
    ipcMain.handle('app:getPlatform', () => process.platform);

    ipcMain.on('update:install', () => {
        autoUpdater.quitAndInstall();
    });
}

// Deep linking configuration
if (!app.isDefaultProtocolClient('zeroisle')) {
    // Define custom protocol handler. Deep linking works on packaged versions of the application!
    app.setAsDefaultProtocolClient('zeroisle');
}

// Force single instance application
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) {mainWindow.restore();}
            mainWindow.focus();
        }

        // Handle protocol for Windows
        const url = commandLine.find(arg => arg.startsWith('zeroisle://'));
        if (url) {
            mainWindow?.webContents.send('deep-link', url);
        }
    });

    // Handle protocol for macOS
    app.on('open-url', (event, url) => {
        event.preventDefault();
        if (mainWindow) {
            if (mainWindow.isMinimized()) {mainWindow.restore();}
            mainWindow.focus();
            mainWindow.webContents.send('deep-link', url);
        }
    });

    // App lifecycle
    app.whenReady().then(() => {
        createWindow();
        createMenu();
        createTray();
        setupAutoUpdater();
        setupIPC();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('before-quit', () => {
        tray?.destroy();
    });
}
