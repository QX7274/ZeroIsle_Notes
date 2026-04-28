/**
 * Web Platform Specific Configuration
 *
 * Entry point for web platform
 */

// Web-specific polyfills and setup
if (typeof window !== 'undefined') {
    // Polyfill for requestAnimationFrame
    window.requestAnimationFrame = window.requestAnimationFrame
        || window.mozRequestAnimationFrame
        || window.webkitRequestAnimationFrame
        || window.msRequestAnimationFrame
        || ((fn) => setTimeout(fn, 16));

    // Console styling for web
    console.log(
        '%c零屿笔记 Web版',
        'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px 20px; font-size: 16px; border-radius: 8px;'
    );
}

/**
 * Web-specific service worker registration
 */
export const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', registration.scope);
            return registration;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            return null;
        }
    }
    return null;
};

/**
 * Web-specific PWA install prompt
 */
let deferredPrompt = null;

export const initPWAInstallPrompt = () => {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
    });
};

export const showPWAInstallPrompt = async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        return outcome === 'accepted';
    }
    return false;
};

export const isPWAInstalled = () => {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone
        || document.referrer.includes('android-app://');
};

/**
 * Web-specific keyboard shortcuts
 */
export const initGlobalKeyboardShortcuts = (handlers) => {
    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const alt = e.altKey;

        // Build shortcut key
        let shortcut = '';
        if (ctrl) {shortcut += 'ctrl+';}
        if (shift) {shortcut += 'shift+';}
        if (alt) {shortcut += 'alt+';}
        shortcut += key;

        if (handlers[shortcut]) {
            e.preventDefault();
            handlers[shortcut](e);
        }
    });
};

/**
 * Web-specific drag and drop
 */
export const initDragAndDrop = (dropZone, options = {}) => {
    const {
        onDragEnter = () => { },
        onDragLeave = () => { },
        onDrop = () => { },
        acceptTypes = ['*/*'],
    } = options;

    const handleDragEnter = (e) => {
        e.preventDefault();
        onDragEnter(e);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        onDragLeave(e);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        const filteredFiles = files.filter(file =>
            acceptTypes.includes('*/*') || acceptTypes.some(type => file.type.match(type))
        );
        onDrop(filteredFiles, e);
    };

    dropZone.addEventListener('dragenter', handleDragEnter);
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    return () => {
        dropZone.removeEventListener('dragenter', handleDragEnter);
        dropZone.removeEventListener('dragover', handleDragOver);
        dropZone.removeEventListener('dragleave', handleDragLeave);
        dropZone.removeEventListener('drop', handleDrop);
    };
};

/**
 * Web visibility API
 */
export const onVisibilityChange = (callback) => {
    document.addEventListener('visibilitychange', () => {
        callback(document.visibilityState === 'visible');
    });
};

/**
 * Web-specific media query hooks
 */
export const getPreferredColorScheme = () => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const onColorSchemeChange = (callback) => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
        callback(e.matches ? 'dark' : 'light');
    });
};

/**
 * Web-specific full screen API
 */
export const toggleFullScreen = async (element = document.documentElement) => {
    if (!document.fullscreenElement) {
        await element.requestFullscreen?.() || element.webkitRequestFullscreen?.();
        return true;
    } else {
        await document.exitFullscreen?.() || document.webkitExitFullscreen?.();
        return false;
    }
};

export default {
    registerServiceWorker,
    initPWAInstallPrompt,
    showPWAInstallPrompt,
    isPWAInstalled,
    initGlobalKeyboardShortcuts,
    initDragAndDrop,
    onVisibilityChange,
    getPreferredColorScheme,
    onColorSchemeChange,
    toggleFullScreen,
};
