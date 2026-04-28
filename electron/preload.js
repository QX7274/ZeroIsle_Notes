/**
 * Electron Preload Script
 *
 * Exposes safe APIs to the renderer process via contextBridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // App info
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),

    // Auto-updater
    onUpdateAvailable: (callback) => ipcRenderer.on('update:available', (_, info) => callback(info)),
    onUpdateProgress: (callback) => ipcRenderer.on('update:progress', (_, progress) => callback(progress)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update:downloaded', (_, info) => callback(info)),
    installUpdate: () => ipcRenderer.send('update:install'),

    // Menu events
    onNewNote: (callback) => ipcRenderer.on('menu:new-note', callback),
    onSettings: (callback) => ipcRenderer.on('menu:settings', callback),
    onAbout: (callback) => ipcRenderer.on('menu:about', callback),

    // Remove listeners (for cleanup)
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});

// Indicate Electron environment
contextBridge.exposeInMainWorld('isElectron', true);
