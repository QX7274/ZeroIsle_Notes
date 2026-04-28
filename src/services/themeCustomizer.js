/**
 * 自定义主题服务
 *
 * 允许用户创建和保存自定义主题配色
 *
 * 使用方法:
 * import { ThemeCustomizer, useCustomTheme } from '@/services/themeCustomizer';
 *
 * // 创建自定义主题
 * const myTheme = ThemeCustomizer.createTheme({
 *   name: '我的主题',
 *   primary: '#6366F1',
 *   background: '#0F172A',
 * });
 *
 * // 应用主题
 * ThemeCustomizer.applyTheme(myTheme);
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';

const CUSTOM_THEMES_KEY = '@zeroislenotes:custom_themes';
const ACTIVE_THEME_KEY = '@zeroislenotes:active_theme';

// 预设主题
export const PRESET_THEMES = {
    default: {
        id: 'default',
        name: '默认',
        isDark: false,
        colors: {
            primary: '#6366F1',
            secondary: '#8B5CF6',
            background: '#FFFFFF',
            surface: '#F8FAFC',
            text: '#1E293B',
            textSecondary: '#64748B',
            border: '#E2E8F0',
            success: '#10B981',
            warning: '#F59E0B',
            error: '#EF4444',
            info: '#3B82F6',
        },
    },

    darkDefault: {
        id: 'darkDefault',
        name: '暗夜',
        isDark: true,
        colors: {
            primary: '#818CF8',
            secondary: '#A78BFA',
            background: '#0F172A',
            surface: '#1E293B',
            text: '#F1F5F9',
            textSecondary: '#94A3B8',
            border: '#334155',
            success: '#34D399',
            warning: '#FBBF24',
            error: '#F87171',
            info: '#60A5FA',
        },
    },

    ocean: {
        id: 'ocean',
        name: '海洋',
        isDark: false,
        colors: {
            primary: '#0891B2',
            secondary: '#06B6D4',
            background: '#F0FDFA',
            surface: '#CCFBF1',
            text: '#134E4A',
            textSecondary: '#5EEAD4',
            border: '#99F6E4',
            success: '#10B981',
            warning: '#F59E0B',
            error: '#EF4444',
            info: '#0891B2',
        },
    },

    sunset: {
        id: 'sunset',
        name: '日落',
        isDark: false,
        colors: {
            primary: '#F97316',
            secondary: '#FB923C',
            background: '#FFFBEB',
            surface: '#FEF3C7',
            text: '#78350F',
            textSecondary: '#D97706',
            border: '#FDE68A',
            success: '#10B981',
            warning: '#F59E0B',
            error: '#EF4444',
            info: '#3B82F6',
        },
    },

    forest: {
        id: 'forest',
        name: '森林',
        isDark: false,
        colors: {
            primary: '#059669',
            secondary: '#10B981',
            background: '#ECFDF5',
            surface: '#D1FAE5',
            text: '#064E3B',
            textSecondary: '#34D399',
            border: '#A7F3D0',
            success: '#059669',
            warning: '#F59E0B',
            error: '#EF4444',
            info: '#3B82F6',
        },
    },

    midnight: {
        id: 'midnight',
        name: '午夜',
        isDark: true,
        colors: {
            primary: '#A855F7',
            secondary: '#C084FC',
            background: '#1E1033',
            surface: '#2D1B4E',
            text: '#F3E8FF',
            textSecondary: '#C4B5FD',
            border: '#4C1D95',
            success: '#34D399',
            warning: '#FBBF24',
            error: '#F87171',
            info: '#60A5FA',
        },
    },

    rose: {
        id: 'rose',
        name: '玫瑰',
        isDark: false,
        colors: {
            primary: '#E11D48',
            secondary: '#F43F5E',
            background: '#FFF1F2',
            surface: '#FFE4E6',
            text: '#881337',
            textSecondary: '#FB7185',
            border: '#FECDD3',
            success: '#10B981',
            warning: '#F59E0B',
            error: '#E11D48',
            info: '#3B82F6',
        },
    },

    amoled: {
        id: 'amoled',
        name: 'AMOLED',
        isDark: true,
        colors: {
            primary: '#6366F1',
            secondary: '#818CF8',
            background: '#000000',
            surface: '#0A0A0A',
            text: '#FFFFFF',
            textSecondary: '#A1A1AA',
            border: '#27272A',
            success: '#22C55E',
            warning: '#EAB308',
            error: '#EF4444',
            info: '#3B82F6',
        },
    },
};

class ThemeCustomizerService {
    constructor() {
        this.customThemes = {};
        this.activeThemeId = 'default';
        this.listeners = new Set();
        this._initialized = false;
    }

    /**
     * 初始化
     */
    async init() {
        if (this._initialized) {return;}

        try {
            // 加载自定义主题
            const themesJson = await AsyncStorage.getItem(CUSTOM_THEMES_KEY);
            if (themesJson) {
                this.customThemes = JSON.parse(themesJson);
            }

            // 加载活动主题
            const activeTheme = await AsyncStorage.getItem(ACTIVE_THEME_KEY);
            if (activeTheme) {
                this.activeThemeId = activeTheme;
            }

            this._initialized = true;
        } catch (error) {
            console.error('Theme init failed:', error);
            this._initialized = true;
        }
    }

    /**
     * 获取所有可用主题
     */
    getAllThemes() {
        return {
            ...PRESET_THEMES,
            ...this.customThemes,
        };
    }

    /**
     * 获取当前主题
     */
    getCurrentTheme() {
        const allThemes = this.getAllThemes();
        return allThemes[this.activeThemeId] || PRESET_THEMES.default;
    }

    /**
     * 设置活动主题
     */
    async setActiveTheme(themeId) {
        const allThemes = this.getAllThemes();
        if (!allThemes[themeId]) {
            console.warn(`Theme ${themeId} not found`);
            // 业务语义：目标主题不存在时返回 false（非错误）
            return false;
        }

        this.activeThemeId = themeId;

        try {
            await AsyncStorage.setItem(ACTIVE_THEME_KEY, themeId);
            this._notifyListeners();
            return true;
        } catch (error) {
            console.error('Failed to save active theme:', error);
            throw error;
        }
    }

    /**
     * 创建自定义主题
     */
    createTheme(config) {
        const id = `custom_${Date.now()}`;

        const theme = {
            id,
            name: config.name || '自定义主题',
            isDark: config.isDark || false,
            isCustom: true,
            colors: {
                primary: config.primary || PRESET_THEMES.default.colors.primary,
                secondary: config.secondary || config.primary || PRESET_THEMES.default.colors.secondary,
                background: config.background || (config.isDark ? '#0F172A' : '#FFFFFF'),
                surface: config.surface || (config.isDark ? '#1E293B' : '#F8FAFC'),
                text: config.text || (config.isDark ? '#F1F5F9' : '#1E293B'),
                textSecondary: config.textSecondary || (config.isDark ? '#94A3B8' : '#64748B'),
                border: config.border || (config.isDark ? '#334155' : '#E2E8F0'),
                success: config.success || '#10B981',
                warning: config.warning || '#F59E0B',
                error: config.error || '#EF4444',
                info: config.info || '#3B82F6',
            },
        };

        return theme;
    }

    /**
     * 保存自定义主题
     */
    async saveCustomTheme(theme) {
        this.customThemes[theme.id] = theme;

        try {
            await AsyncStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(this.customThemes));
            return true;
        } catch (error) {
            console.error('Failed to save custom theme:', error);
            throw error;
        }
    }

    /**
     * 删除自定义主题
     */
    async deleteCustomTheme(themeId) {
        if (!this.customThemes[themeId]) {
            // 业务语义：目标自定义主题不存在时返回 false（非错误）
            return false;
        }

        delete this.customThemes[themeId];

        // 如果删除的是当前主题，切换到默认
        if (this.activeThemeId === themeId) {
            await this.setActiveTheme('default');
        }

        try {
            await AsyncStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(this.customThemes));
            return true;
        } catch (error) {
            console.error('Failed to delete custom theme:', error);
            throw error;
        }
    }

    /**
     * 从颜色生成主题
     */
    generateThemeFromColor(primaryColor, isDark = false) {
        // 简单的颜色派生算法
        const adjustBrightness = (hex, percent) => {
            const num = parseInt(hex.replace('#', ''), 16);
            const amt = Math.round(2.55 * percent);
            const R = Math.min(255, Math.max(0, (num >> 16) + amt));
            const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
            const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
            return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
        };

        return this.createTheme({
            name: '自动生成',
            isDark,
            primary: primaryColor,
            secondary: adjustBrightness(primaryColor, 20),
        });
    }

    /**
     * 添加监听器
     */
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * 通知监听器
     */
    _notifyListeners() {
        const theme = this.getCurrentTheme();
        this.listeners.forEach(listener => listener(theme));
    }
}

// 单例
export const ThemeCustomizer = new ThemeCustomizerService();

// React Hook
export const useCustomTheme = () => {
    const [theme, setTheme] = React.useState(ThemeCustomizer.getCurrentTheme());

    React.useEffect(() => {
        ThemeCustomizer.init();
        const unsubscribe = ThemeCustomizer.addListener(setTheme);
        return unsubscribe;
    }, []);

    return {
        theme,
        colors: theme.colors,
        isDark: theme.isDark,
        setTheme: (id) => ThemeCustomizer.setActiveTheme(id),
        allThemes: ThemeCustomizer.getAllThemes(),
        createTheme: (config) => ThemeCustomizer.createTheme(config),
        saveTheme: (t) => ThemeCustomizer.saveCustomTheme(t),
        deleteTheme: (id) => ThemeCustomizer.deleteCustomTheme(id),
    };
};

export default ThemeCustomizer;
