/**
 * Theme Presets
 * Collection of pre-designed themes for quick selection
 */

export const THEME_PRESETS = {
    // Default Light Theme
    light: {
        id: 'light',
        name: '经典浅色',
        icon: 'wb-sunny',
        isDark: false,
        colors: {
            primary: '#2563eb',
            secondary: '#64748b',
            background: '#ffffff',
            card: '#f8fafc',
            text: '#1e293b',
            textSecondary: '#64748b',
            textHint: '#94a3b8',
            border: '#e2e8f0',
            success: '#22c55e',
            warning: '#f59e0b',
            error: '#ef4444',
            info: '#3b82f6',
        },
    },

    // Default Dark Theme
    dark: {
        id: 'dark',
        name: '经典深色',
        icon: 'nightlight-round',
        isDark: true,
        colors: {
            primary: '#3b82f6',
            secondary: '#94a3b8',
            background: '#0f172a',
            card: '#1e293b',
            text: '#f1f5f9',
            textSecondary: '#94a3b8',
            textHint: '#64748b',
            border: '#334155',
            success: '#4ade80',
            warning: '#fbbf24',
            error: '#f87171',
            info: '#60a5fa',
        },
    },

    // Ocean Blue
    ocean: {
        id: 'ocean',
        name: '海洋蓝',
        icon: 'water',
        isDark: false,
        colors: {
            primary: '#0891b2',
            secondary: '#06b6d4',
            background: '#f0f9ff',
            card: '#e0f2fe',
            text: '#0c4a6e',
            textSecondary: '#0369a1',
            textHint: '#7dd3fc',
            border: '#bae6fd',
            success: '#14b8a6',
            warning: '#f59e0b',
            error: '#f43f5e',
            info: '#06b6d4',
        },
    },

    // Forest Green
    forest: {
        id: 'forest',
        name: '森林绿',
        icon: 'park',
        isDark: false,
        colors: {
            primary: '#16a34a',
            secondary: '#22c55e',
            background: '#f0fdf4',
            card: '#dcfce7',
            text: '#14532d',
            textSecondary: '#15803d',
            textHint: '#86efac',
            border: '#bbf7d0',
            success: '#22c55e',
            warning: '#eab308',
            error: '#dc2626',
            info: '#0ea5e9',
        },
    },

    // Sunset Orange
    sunset: {
        id: 'sunset',
        name: '日落橙',
        icon: 'wb-twilight',
        isDark: false,
        colors: {
            primary: '#ea580c',
            secondary: '#f97316',
            background: '#fff7ed',
            card: '#ffedd5',
            text: '#7c2d12',
            textSecondary: '#c2410c',
            textHint: '#fdba74',
            border: '#fed7aa',
            success: '#84cc16',
            warning: '#f59e0b',
            error: '#dc2626',
            info: '#0ea5e9',
        },
    },

    // Purple Dream
    purple: {
        id: 'purple',
        name: '梦幻紫',
        icon: 'auto-awesome',
        isDark: true,
        colors: {
            primary: '#a855f7',
            secondary: '#c084fc',
            background: '#1e1b4b',
            card: '#312e81',
            text: '#e9d5ff',
            textSecondary: '#c4b5fd',
            textHint: '#8b5cf6',
            border: '#4c1d95',
            success: '#4ade80',
            warning: '#fbbf24',
            error: '#fb7185',
            info: '#818cf8',
        },
    },

    // Rose Pink
    rose: {
        id: 'rose',
        name: '玫瑰粉',
        icon: 'local-florist',
        isDark: false,
        colors: {
            primary: '#db2777',
            secondary: '#ec4899',
            background: '#fdf2f8',
            card: '#fce7f3',
            text: '#831843',
            textSecondary: '#be185d',
            textHint: '#f9a8d4',
            border: '#fbcfe8',
            success: '#22c55e',
            warning: '#f59e0b',
            error: '#e11d48',
            info: '#06b6d4',
        },
    },

    // OLED Black
    oled: {
        id: 'oled',
        name: 'OLED黑',
        icon: 'brightness-2',
        isDark: true,
        colors: {
            primary: '#3b82f6',
            secondary: '#6b7280',
            background: '#000000',
            card: '#111111',
            text: '#ffffff',
            textSecondary: '#a1a1aa',
            textHint: '#71717a',
            border: '#262626',
            success: '#22c55e',
            warning: '#f59e0b',
            error: '#ef4444',
            info: '#3b82f6',
        },
    },

    // Sepia (Reading Mode)
    sepia: {
        id: 'sepia',
        name: '护眼棕',
        icon: 'menu-book',
        isDark: false,
        colors: {
            primary: '#92400e',
            secondary: '#b45309',
            background: '#fefce8',
            card: '#fef9c3',
            text: '#713f12',
            textSecondary: '#a16207',
            textHint: '#ca8a04',
            border: '#fde047',
            success: '#65a30d',
            warning: '#d97706',
            error: '#dc2626',
            info: '#0284c7',
        },
    },

    // Nord
    nord: {
        id: 'nord',
        name: 'Nord极光',
        icon: 'ac-unit',
        isDark: true,
        colors: {
            primary: '#88c0d0',
            secondary: '#81a1c1',
            background: '#2e3440',
            card: '#3b4252',
            text: '#eceff4',
            textSecondary: '#d8dee9',
            textHint: '#4c566a',
            border: '#434c5e',
            success: '#a3be8c',
            warning: '#ebcb8b',
            error: '#bf616a',
            info: '#5e81ac',
        },
    },
};

// Helper to get all theme presets as array
export const getThemePresetList = () => Object.values(THEME_PRESETS);

// Get theme by ID
export const getThemeById = (id) => THEME_PRESETS[id] || THEME_PRESETS.light;

export default THEME_PRESETS;
