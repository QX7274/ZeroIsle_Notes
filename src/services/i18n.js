/**
 * 国际化（i18n）服务
 *
 * 提供多语言支持，包括：
 * - 语言检测
 * - 翻译管理
 * - 日期/数字格式化
 * - RTL支持
 *
 * 使用方法:
 * import { i18n, t } from '@/services/i18n';
 *
 * // 翻译文本
 * t('common.save') // => "保存" 或 "Save"
 *
 * // 切换语言
 * i18n.setLanguage('en');
 */

import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 支持的语言
export const SUPPORTED_LANGUAGES = {
    'zh-CN': {
        name: '简体中文',
        nativeName: '简体中文',
        isRTL: false,
    },
    'zh-TW': {
        name: '繁體中文',
        nativeName: '繁體中文',
        isRTL: false,
    },
    'en': {
        name: 'English',
        nativeName: 'English',
        isRTL: false,
    },
    'ja': {
        name: 'Japanese',
        nativeName: '日本語',
        isRTL: false,
    },
    'ko': {
        name: 'Korean',
        nativeName: '한국어',
        isRTL: false,
    },
};

// 默认语言
const DEFAULT_LANGUAGE = 'zh-CN';
const LANGUAGE_STORAGE_KEY = '@zeroislenotes:language';

// 翻译资源
const translations = {
    'zh-CN': {
        common: {
            save: '保存',
            cancel: '取消',
            delete: '删除',
            edit: '编辑',
            confirm: '确认',
            loading: '加载中...',
            success: '成功',
            error: '错误',
            warning: '警告',
            info: '提示',
            search: '搜索',
            settings: '设置',
            logout: '退出登录',
            login: '登录',
            register: '注册',
            back: '返回',
            next: '下一步',
            done: '完成',
            share: '分享',
            copy: '复制',
            paste: '粘贴',
            undo: '撤销',
            redo: '重做',
        },
        notes: {
            title: '笔记',
            newNote: '新建笔记',
            editNote: '编辑笔记',
            deleteNote: '删除笔记',
            allNotes: '所有笔记',
            favorites: '收藏',
            trash: '回收站',
            tags: '标签',
            categories: '分类',
            noNotes: '暂无笔记',
            searchNotes: '搜索笔记...',
            lastModified: '最后修改',
            createdAt: '创建时间',
            untitled: '无标题',
        },
        collaboration: {
            collaborating: '协作中',
            invite: '邀请协作',
            collaborators: '协作者',
            online: '在线',
            offline: '离线',
            joinedAt: '加入于',
            permission: '权限',
            read: '只读',
            write: '可编辑',
            admin: '管理员',
        },
        ai: {
            assistant: 'AI助手',
            thinking: '思考中...',
            summarize: '总结',
            expand: '扩展',
            translate: '翻译',
            improve: '改进',
            generate: '生成',
            askAnything: '问我任何问题...',
        },
        settings: {
            profile: '个人资料',
            account: '账户',
            notifications: '通知',
            theme: '主题',
            language: '语言',
            privacy: '隐私',
            security: '安全',
            about: '关于',
            darkMode: '深色模式',
            autoSave: '自动保存',
            syncEnabled: '同步已启用',
        },
        errors: {
            networkError: '网络错误，请检查网络连接',
            serverError: '服务器错误，请稍后重试',
            unauthorized: '未授权，请重新登录',
            notFound: '未找到',
            validationError: '验证错误',
            unknownError: '未知错误',
        },
        time: {
            justNow: '刚刚',
            minutesAgo: '{n}分钟前',
            hoursAgo: '{n}小时前',
            daysAgo: '{n}天前',
            weeksAgo: '{n}周前',
            monthsAgo: '{n}个月前',
            yearsAgo: '{n}年前',
        },
    },
    'en': {
        common: {
            save: 'Save',
            cancel: 'Cancel',
            delete: 'Delete',
            edit: 'Edit',
            confirm: 'Confirm',
            loading: 'Loading...',
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Info',
            search: 'Search',
            settings: 'Settings',
            logout: 'Logout',
            login: 'Login',
            register: 'Register',
            back: 'Back',
            next: 'Next',
            done: 'Done',
            share: 'Share',
            copy: 'Copy',
            paste: 'Paste',
            undo: 'Undo',
            redo: 'Redo',
        },
        notes: {
            title: 'Notes',
            newNote: 'New Note',
            editNote: 'Edit Note',
            deleteNote: 'Delete Note',
            allNotes: 'All Notes',
            favorites: 'Favorites',
            trash: 'Trash',
            tags: 'Tags',
            categories: 'Categories',
            noNotes: 'No notes yet',
            searchNotes: 'Search notes...',
            lastModified: 'Last Modified',
            createdAt: 'Created At',
            untitled: 'Untitled',
        },
        collaboration: {
            collaborating: 'Collaborating',
            invite: 'Invite',
            collaborators: 'Collaborators',
            online: 'Online',
            offline: 'Offline',
            joinedAt: 'Joined at',
            permission: 'Permission',
            read: 'Read Only',
            write: 'Can Edit',
            admin: 'Admin',
        },
        ai: {
            assistant: 'AI Assistant',
            thinking: 'Thinking...',
            summarize: 'Summarize',
            expand: 'Expand',
            translate: 'Translate',
            improve: 'Improve',
            generate: 'Generate',
            askAnything: 'Ask me anything...',
        },
        settings: {
            profile: 'Profile',
            account: 'Account',
            notifications: 'Notifications',
            theme: 'Theme',
            language: 'Language',
            privacy: 'Privacy',
            security: 'Security',
            about: 'About',
            darkMode: 'Dark Mode',
            autoSave: 'Auto Save',
            syncEnabled: 'Sync Enabled',
        },
        errors: {
            networkError: 'Network error, please check your connection',
            serverError: 'Server error, please try again later',
            unauthorized: 'Unauthorized, please login again',
            notFound: 'Not found',
            validationError: 'Validation error',
            unknownError: 'Unknown error',
        },
        time: {
            justNow: 'Just now',
            minutesAgo: '{n} minutes ago',
            hoursAgo: '{n} hours ago',
            daysAgo: '{n} days ago',
            weeksAgo: '{n} weeks ago',
            monthsAgo: '{n} months ago',
            yearsAgo: '{n} years ago',
        },
    },
};

class I18nService {
    constructor() {
        this.currentLanguage = DEFAULT_LANGUAGE;
        this.listeners = new Set();
        this._initialized = false;
    }

    /**
     * 初始化语言服务
     */
    async init() {
        if (this._initialized) {return;}

        try {
            // 从存储加载语言设置
            const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
            if (savedLanguage && SUPPORTED_LANGUAGES[savedLanguage]) {
                this.currentLanguage = savedLanguage;
            } else {
                // 尝试检测系统语言
                this.currentLanguage = this.detectSystemLanguage();
            }

            // 设置RTL
            const langConfig = SUPPORTED_LANGUAGES[this.currentLanguage];
            if (langConfig?.isRTL !== I18nManager.isRTL) {
                I18nManager.allowRTL(langConfig?.isRTL || false);
                I18nManager.forceRTL(langConfig?.isRTL || false);
            }

            this._initialized = true;
        } catch (error) {
            console.error('I18n init failed:', error);
            this._initialized = true;
        }
    }

    /**
     * 检测系统语言
     */
    detectSystemLanguage() {
        try {
            const { NativeModules, Platform } = require('react-native');

            let locale;
            if (Platform.OS === 'ios') {
                locale = NativeModules.SettingsManager?.settings?.AppleLocale ||
                    NativeModules.SettingsManager?.settings?.AppleLanguages?.[0];
            } else {
                locale = NativeModules.I18nManager?.localeIdentifier;
            }

            if (locale) {
                // 匹配支持的语言
                const langCode = locale.replace('_', '-');
                if (SUPPORTED_LANGUAGES[langCode]) {
                    return langCode;
                }
                // 尝试匹配主语言代码
                const primaryCode = langCode.split('-')[0];
                const match = Object.keys(SUPPORTED_LANGUAGES).find(
                    key => key.startsWith(primaryCode)
                );
                if (match) {return match;}
            }
        } catch (error) {
            console.error('Language detection failed:', error);
        }

        return DEFAULT_LANGUAGE;
    }

    /**
     * 获取当前语言
     */
    getLanguage() {
        return this.currentLanguage;
    }

    /**
     * 设置语言
     */
    async setLanguage(languageCode) {
        if (!SUPPORTED_LANGUAGES[languageCode]) {
            console.warn(`Language ${languageCode} is not supported`);
            // 业务语义：不支持的语言代码返回 false（非错误）
            return false;
        }

        this.currentLanguage = languageCode;

        try {
            await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);

            // 更新RTL
            const langConfig = SUPPORTED_LANGUAGES[languageCode];
            if (langConfig.isRTL !== I18nManager.isRTL) {
                I18nManager.allowRTL(langConfig.isRTL);
                I18nManager.forceRTL(langConfig.isRTL);
            }

            // 通知监听器
            this.listeners.forEach(listener => listener(languageCode));

            return true;
        } catch (error) {
            console.error('Failed to save language:', error);
            throw error;
        }
    }

    /**
     * 翻译文本
     */
    translate(key, params = {}) {
        const keys = key.split('.');
        let value = translations[this.currentLanguage];

        // 遍历键路径
        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                value = undefined;
                break;
            }
        }

        // 回退到默认语言
        if (value === undefined && this.currentLanguage !== DEFAULT_LANGUAGE) {
            value = translations[DEFAULT_LANGUAGE];
            for (const k of keys) {
                if (value && typeof value === 'object') {
                    value = value[k];
                } else {
                    value = undefined;
                    break;
                }
            }
        }

        // 如果还是未找到，返回键名
        if (value === undefined) {
            return key;
        }

        // 替换参数
        if (typeof value === 'string' && Object.keys(params).length > 0) {
            Object.entries(params).forEach(([paramKey, paramValue]) => {
                value = value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), paramValue);
            });
        }

        return value;
    }

    /**
     * 添加语言变化监听器
     */
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * 格式化日期
     */
    formatDate(date, format = 'short') {
        const d = new Date(date);
        const locale = this.currentLanguage.replace('-', '_');

        try {
            if (format === 'relative') {
                return this.formatRelativeTime(d);
            }

            const options = {
                short: { month: 'short', day: 'numeric' },
                medium: { year: 'numeric', month: 'short', day: 'numeric' },
                long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
                time: { hour: '2-digit', minute: '2-digit' },
                datetime: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
            };

            return d.toLocaleDateString(locale, options[format] || options.short);
        } catch (error) {
            return d.toLocaleDateString();
        }
    }

    /**
     * 格式化相对时间
     */
    formatRelativeTime(date) {
        const now = new Date();
        const d = new Date(date);
        const diffMs = now - d;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        const diffWeeks = Math.floor(diffDays / 7);
        const diffMonths = Math.floor(diffDays / 30);
        const diffYears = Math.floor(diffDays / 365);

        if (diffSeconds < 60) {
            return this.translate('time.justNow');
        } else if (diffMinutes < 60) {
            return this.translate('time.minutesAgo', { n: diffMinutes });
        } else if (diffHours < 24) {
            return this.translate('time.hoursAgo', { n: diffHours });
        } else if (diffDays < 7) {
            return this.translate('time.daysAgo', { n: diffDays });
        } else if (diffWeeks < 4) {
            return this.translate('time.weeksAgo', { n: diffWeeks });
        } else if (diffMonths < 12) {
            return this.translate('time.monthsAgo', { n: diffMonths });
        } else {
            return this.translate('time.yearsAgo', { n: diffYears });
        }
    }

    /**
     * 格式化数字
     */
    formatNumber(number, options = {}) {
        const locale = this.currentLanguage.replace('-', '_');
        try {
            return new Intl.NumberFormat(locale, options).format(number);
        } catch (error) {
            return number.toString();
        }
    }
}

// 单例实例
export const i18n = new I18nService();

// 翻译快捷函数
export const t = (key, params) => i18n.translate(key, params);

// React Hook
export const useTranslation = () => {
    const [, forceUpdate] = React.useState({});

    React.useEffect(() => {
        const unsubscribe = i18n.addListener(() => forceUpdate({}));
        return unsubscribe;
    }, []);

    return {
        t: (key, params) => i18n.translate(key, params),
        language: i18n.getLanguage(),
        setLanguage: (lang) => i18n.setLanguage(lang),
        formatDate: (date, format) => i18n.formatDate(date, format),
        formatNumber: (num, opts) => i18n.formatNumber(num, opts),
    };
};

export default i18n;
