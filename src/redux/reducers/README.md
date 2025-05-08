# Redux Reducers

本目录包含零屿笔记应用的传统Redux reducers，用于管理应用状态。注意，应用主要使用Redux Toolkit的slices进行状态管理，这些传统reducers是为了兼容性和特定用例而保留的。

## 文件结构

- **userReducer.js**: 用户状态reducer，管理用户资料和偏好设置

## 主要功能

### 用户Reducer (userReducer.js)

用户reducer管理用户相关的状态，包括：

- **用户资料**: 存储用户的基本信息
- **用户偏好**: 存储用户的偏好设置
- **认证状态**: 跟踪用户的认证状态

## 状态结构

用户reducer的状态结构如下：

```javascript
{
  profile: {
    id: String,           // 用户ID
    username: String,     // 用户名
    email: String,        // 邮箱
    phone: String,        // 手机号
    avatar: String,       // 头像URL
    bio: String,          // 个人简介
    createdAt: Date,      // 创建时间
    updatedAt: Date       // 更新时间
  },
  preferences: {
    theme: String,        // 主题偏好
    fontSize: String,     // 字体大小
    language: String,     // 语言偏好
    notificationEnabled: Boolean, // 通知开关
    autoSave: Boolean,    // 自动保存开关
    defaultView: String   // 默认视图模式
  },
  isAuthenticated: Boolean // 认证状态
}
```

## 支持的Actions

用户reducer支持以下actions：

- **SET_USER**: 设置用户资料
- **UPDATE_USER**: 更新用户资料
- **SET_PREFERENCES**: 设置用户偏好
- **UPDATE_PREFERENCES**: 更新用户偏好
- **LOGOUT**: 用户登出，重置状态

## 与Redux Toolkit的集成

虽然这是一个传统的Redux reducer，但它可以与Redux Toolkit创建的store无缝集成：

```javascript
import { configureStore } from '@reduxjs/toolkit';
import userReducer from './reducers/userReducer';
import authSlice from './slices/authSlice';
import notesSlice from './slices/notesSlice';

const store = configureStore({
  reducer: {
    user: userReducer,
    auth: authSlice.reducer,
    notes: notesSlice.reducer
  }
});
```

## 使用方法

```javascript
import { useSelector, useDispatch } from 'react-redux';

function ProfileScreen() {
  const dispatch = useDispatch();
  const { profile, preferences } = useSelector(state => state.user);
  
  // 更新用户资料
  const updateProfile = (newData) => {
    dispatch({
      type: 'UPDATE_USER',
      payload: newData
    });
  };
  
  // 更新用户偏好
  const updatePreferences = (newPreferences) => {
    dispatch({
      type: 'UPDATE_PREFERENCES',
      payload: newPreferences
    });
  };
  
  // 用户登出
  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
  };
  
  return (
    // 组件JSX
  );
}
```

## 迁移到Redux Toolkit

为了保持代码库的一致性，建议逐步将传统reducers迁移到Redux Toolkit的slices。迁移示例：

```javascript
// 传统reducer
const userReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'SET_USER':
      return {
        ...state,
        profile: action.payload,
        isAuthenticated: !!action.payload,
      };
    // 其他case...
    default:
      return state;
  }
};

// 迁移到Redux Toolkit slice
import { createSlice } from '@reduxjs/toolkit';

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.profile = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    // 其他reducers...
  }
});

export const { setUser } = userSlice.actions;
export default userSlice.reducer;
```

## 注意事项

- 传统reducers不支持直接修改状态，必须返回新的状态对象
- 与Redux Toolkit的slices不同，传统reducers需要手动处理所有状态更新逻辑
- 传统reducers不包含内置的异步处理，需要配合中间件（如redux-thunk）使用
- 为了保持代码一致性，建议使用Redux Toolkit的createAction创建action creators
