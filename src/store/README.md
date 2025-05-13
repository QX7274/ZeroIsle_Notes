# 状态管理

本目录包含零屿笔记应用的状态管理相关文件，基于Redux进行全局状态管理，并集成了Redux Persist进行状态持久化。

## 文件结构

- **index.js**: 状态管理入口文件，导出配置好的store和persistor

## 主要功能

### 状态管理入口 (index.js)

状态管理入口文件提供以下主要功能：

- **导出Redux Store**: 导出配置好的Redux存储
- **导出Redux Persistor**: 导出配置好的持久化存储
- **集成Redux Persist**: 集成Redux Persist进行状态持久化
- **配置持久化选项**: 设置持久化的超时和调试信息

## 状态结构

应用的状态结构主要包括以下部分：

- **auth**: 认证相关状态，包含用户信息、登录状态等
- **notes**: 笔记相关状态，包含笔记列表、当前编辑笔记等
- **ui**: UI相关状态，包含主题设置、当前屏幕等
- **knowledgeGraph**: 知识图谱相关状态，包含节点和关系数据
- **mindMap**: 思维导图相关状态，包含思维导图数据
- **community**: 社区相关状态，包含帖子列表、评论等
- **search**: 搜索相关状态，包含搜索结果、搜索历史等
- **tags**: 标签相关状态，包含标签列表、标签关系等
- **groups**: 群组相关状态，包含群组列表、成员信息等
- **aiAssistant**: AI助手相关状态，包含对话历史、设置等
- **reminders**: 提醒相关状态，包含提醒列表、提醒设置等
- **settings**: 设置相关状态，包含应用设置、用户偏好等
- **user**: 用户相关状态，包含用户资料、偏好设置等

## 持久化配置

状态持久化配置如下：

- **持久化键**: 'root'，用于MongoDB中的存储键
- **持久化白名单**: ['auth', 'settings', 'user']，只持久化这些reducer
- **超时设置**: 10000毫秒（10秒），避免无限等待
- **调试模式**: 在开发环境中启用，方便调试

## 与Redux的集成

状态管理与Redux的集成主要包括：

- **导入Redux Store**: 从redux/store.js导入配置好的store
- **添加持久化功能**: 使用persistStore创建持久化存储
- **提供调试信息**: 在控制台输出store导入状态和持久化完成信息

## 与其他模块的交互

状态管理与以下模块有交互：

- **Redux模块**: 提供状态管理的核心功能
- **存储模块**: 通过MongoDB进行状态持久化
- **应用入口**: 在App.js中使用Provider提供状态

## 使用方法

```javascript
import React from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import AppNavigator from './navigation/AppNavigator';
import LoadingScreen from './screens/LoadingScreen';

export default function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={<LoadingScreen />} persistor={persistor}>
        <AppNavigator />
      </PersistGate>
    </Provider>
  );
}
```

在组件中使用Redux状态：

```javascript
import React from 'react';
import { View, Text, Button } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { login, logout } from '../redux/slices/authSlice';

export default function AuthScreen() {
  const dispatch = useDispatch();
  const { isLoggedIn, user } = useSelector(state => state.auth);

  const handleLogin = () => {
    dispatch(login({ username: 'testuser', token: 'test-token' }));
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <View>
      {isLoggedIn ? (
        <>
          <Text>欢迎, {user.username}!</Text>
          <Button title="退出登录" onPress={handleLogout} />
        </>
      ) : (
        <Button title="登录" onPress={handleLogin} />
      )}
    </View>
  );
}
```

## 注意事项

- 状态管理是应用的核心部分，应谨慎修改
- 持久化状态应只包含必要的数据，避免存储过多数据
- 考虑状态的初始化顺序，确保依赖关系正确
- 在开发过程中使用Redux DevTools进行调试
- 考虑状态的版本控制，处理版本升级时的状态迁移
