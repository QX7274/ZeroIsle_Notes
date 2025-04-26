/**
 * 设置状态reducer
 */

// 初始状态
const initialState = {
  theme: 'system', // 主题：light, dark, system
  language: 'zh', // 语言：zh, en
  fontSize: 'medium', // 字体大小：small, medium, large
  notifications: true, // 是否启用通知
  autoSync: true, // 是否自动同步
  syncInterval: 30, // 同步间隔（分钟）
};

// 设置reducer
const settingsReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'SET_THEME':
      return {
        ...state,
        theme: action.payload,
      };
    case 'SET_LANGUAGE':
      return {
        ...state,
        language: action.payload,
      };
    case 'SET_FONT_SIZE':
      return {
        ...state,
        fontSize: action.payload,
      };
    case 'TOGGLE_NOTIFICATIONS':
      return {
        ...state,
        notifications: !state.notifications,
      };
    case 'SET_NOTIFICATIONS':
      return {
        ...state,
        notifications: action.payload,
      };
    case 'TOGGLE_AUTO_SYNC':
      return {
        ...state,
        autoSync: !state.autoSync,
      };
    case 'SET_AUTO_SYNC':
      return {
        ...state,
        autoSync: action.payload,
      };
    case 'SET_SYNC_INTERVAL':
      return {
        ...state,
        syncInterval: action.payload,
      };
    case 'RESET_SETTINGS':
      return initialState;
    case 'UPDATE_SETTINGS':
      return {
        ...state,
        ...action.payload,
      };
    default:
      return state;
  }
};

export default settingsReducer;
