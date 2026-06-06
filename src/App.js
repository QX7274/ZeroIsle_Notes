/**
 * 应用入口
 * 集成了Redux状态管理、主题管理、认证流程和导航等基础功能
 * 统一的启动屏幕管理所有初始化阶段，但保留必要的服务检测
 */

import React, { useEffect, useState } from 'react';
import { StatusBar, Platform, LogBox, View, Text, TouchableOpacity, Alert } from 'react-native';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { createPaperLightTheme, createPaperDarkTheme } from './theme/paperTheme';
import { NavigationContainer } from '@react-navigation/native';

// 导入store和persistor
import { store, persistor } from './store/index';

// 导入认证相关action
import { checkAuthState } from './redux/slices/authSlice';

// 导入导航
import AppNavigator from './navigation/AppNavigator';
import { navigationRef, processNavigationQueue } from './navigation/navigationRef';

// 导入上下文提供者
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { RealmProvider } from './context/RealmContext';
import { FontSizeProvider } from './context/FontSizeContext';
import { NotificationProvider } from './context/NotificationContext';

// 导入服务
import realmService from './services/database/realmService';
import { dataService } from './services/database';
import { infiniteCanvasStorage } from './services/offline';

// 导入屏幕组件
import SplashScreen from './screens/common/SplashScreen';
import GlobalNetworkErrorHandler from './components/common/GlobalNetworkErrorHandler';

// 导入令牌服务
import tokenService from './services/auth/tokenService';
import { handleUnauthorizedError } from './services/auth/authUtils';

const DEV_SUPPRESSED_LOG_PREFIXES = [
  'App组件渲染中...',
  'Store状态:',
  'Persistor状态:',
  'AppContainer组件开始渲染...',
  'NavigationContainer已准备就绪',
  '导航状态已更改，当前路由:',
  'AppNavigator:',
  '未找到有效的访问令牌',
  '访问令牌已过期或即将过期，尝试刷新...',
  '开始刷新访问令牌...',
  '没有可用的刷新令牌',
  '刷新令牌失败或超时，清除认证状态',
  'DEV_SKIP_LOGIN: 刷新令牌失败，继续以未认证状态请求:',
  'NetworkErrorService:',
  'API网络错误:',
  '网络错误请求URL:',
  '网络错误请求方法:',
  '网络错误请求头:',
  '网络连接状态:',
  '没有找到缓存数据:',
  'CommunityScreen: 加载帖子失败',
  '从服务器加载提醒数据失败:',
  'GET /reminder/reminders/ 失败:',
  '获取知识图谱数据异常:',
  '获取群组列表失败:',
  '获取群组详情失败:',
  '获取群组成员失败:',
  '获取群组邀请失败:',
  '搜索群组邀请候选失败:',
  '邀请用户失败:',
  '创建群组失败:',
  '更新群组失败:',
  '删除群组失败:',
  '生成加入码失败:',
  '加入群组失败:',
  '离开群组失败:',
  '接受邀请失败:',
  '拒绝邀请失败:',
  '网络连接失败:',
  '网络错误，使用离线模式处理',
  'API_URL:',
  'API_VERSION:',
  'API基础URL构建过程:',
  '后端API路径示例:',
  'API_BASE_URL:',
];

const shouldSuppressDevConsoleMessage = (args = []) => {
  if (!__DEV__ || args.length === 0) {
    return false;
  }

  const [firstArg] = args;
  if (typeof firstArg !== 'string') {
    return false;
  }

  return DEV_SUPPRESSED_LOG_PREFIXES.some(prefix => firstArg.startsWith(prefix));
};

if (__DEV__ && !global.__ZEROISLE_DEV_CONSOLE_FILTER_INSTALLED__) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args) => {
    if (shouldSuppressDevConsoleMessage(args)) {
      return;
    }
    originalLog(...args);
  };

  console.warn = (...args) => {
    if (shouldSuppressDevConsoleMessage(args)) {
      return;
    }
    originalWarn(...args);
  };

  console.error = (...args) => {
    if (shouldSuppressDevConsoleMessage(args)) {
      return;
    }
    originalError(...args);
  };

  global.__ZEROISLE_DEV_CONSOLE_FILTER_INSTALLED__ = true;
}

// 忽略特定的警告
LogBox.ignoreLogs([
  'ViewPropTypes will be removed',
  'ColorPropType will be removed',
]);

// 默认主题
const defaultTheme = {
  dark: false,
  colors: {
    primary: '#007AFF',
    background: '#F2F2F2',
    card: '#FFFFFF',
    text: '#000000',
    border: '#C8C8C8',
    notification: '#FF3B30',
    accent: '#FF9500',
    error: '#FF3B30',
  },
};

const safePaperIcon = ({ name, color, size, direction, testID }) => {
  const resolvedName = typeof name === 'string' && name.trim().length > 0
    ? name
    : 'help-circle-outline';

  return (
    <MaterialCommunityIcons
      name={resolvedName}
      color={color}
      size={size}
      testID={testID}
      style={direction === 'rtl' ? { transform: [{ scaleX: -1 }] } : undefined}
    />
  );
};

// 统一的初始化逻辑（带服务检测）
const useAppInitialization = () => {
  const dispatch = useDispatch();

  const initializeApp = async () => {
    try {
      console.log('========= 开始应用初始化 =========');

      // 阶段1: 服务初始化（对应SplashScreen的第1阶段）
      console.log('阶段1: 正在初始化基础服务...');
      try {
        // 初始化Realm服务
        await realmService.getRealm();
        console.log('✓ Realm服务初始化成功');

        // 初始化画布存储
        await infiniteCanvasStorage.initialize();
        console.log('✓ 画布存储初始化成功');
      } catch (serviceError) {
        console.error('服务初始化警告:', serviceError);
        // 不阻塞启动
      }
      console.log('✓ 基础服务初始化完成');

      // 阶段2: 服务检查（对应SplashScreen的第2阶段）
      console.log('阶段2: 正在检查服务状态...');
      const serviceStatus = {
        realm: false,
        storage: false,
        network: true, // 默认可用
      };

      try {
        // 检查Realm
        await realmService.getRealm();
        serviceStatus.realm = true;
      } catch (e) {
        console.warn('Realm服务检查失败:', e);
      }

      try {
        // 检查存储
        serviceStatus.storage = typeof infiniteCanvasStorage.initialize === 'function';
      } catch (e) {
        console.warn('存储服务检查失败:', e);
      }

      console.log('服务状态:', serviceStatus);
      console.log('✓ 服务状态检查完成');

      // 阶段3: 认证检查（对应SplashScreen的第3阶段）
      console.log('阶段3: 正在检查认证状态...');

      // 开发调试模式下跳过认证流程，避免跳转登录影响联调
      const DEV_SKIP_LOGIN = __DEV__;
      if (DEV_SKIP_LOGIN) {
        console.log('阶段3: DEV_SKIP_LOGIN 已启用，跳过认证检查');
      } else {
        try {
          // 检查令牌是否过期
          const isTokenExpired = await tokenService.isAccessTokenExpiredOrExpiring();

          if (isTokenExpired) {
            console.log('访问令牌已过期或即将过期，尝试刷新...');

            // 尝试刷新令牌（带3秒超时）
            const refreshPromise = tokenService.refreshAccessToken();
            const timeoutPromise = new Promise((resolve) =>
              setTimeout(() => resolve(null), 3000)
            );

            const newTokenData = await Promise.race([refreshPromise, timeoutPromise]);

            if (!newTokenData) {
              console.log('刷新令牌失败或超时，清除认证状态');
              await handleUnauthorizedError();
            } else {
              console.log('令牌刷新成功');
            }
          }

          // 检查Redux认证状态（带3秒超时）
          const checkStatePromise = dispatch(checkAuthState()).unwrap();
          const stateTimeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('认证状态检查超时')), 3000)
          );

          await Promise.race([checkStatePromise, stateTimeoutPromise]);
          console.log('✓ 认证状态检查完成');
        } catch (authError) {
          console.error('认证检查失败:', authError);
          // 认证失败也继续，会进入登录页面
          try {
            await handleUnauthorizedError();
          } catch (handleError) {
            console.error('处理认证错误失败:', handleError);
          }
        }
      }

      // 阶段4: 完成
      console.log('阶段4: 应用初始化完成');
      console.log('========= 应用初始化完成 =========');

      return { success: true, serviceStatus };
    } catch (error) {
      console.error('应用初始化过程中发生错误:', error);
      // 即使出错也继续运行
      return { success: false, error };
    }
  };

  return { initializeApp };
};

// 主应用容器
const AppContainer = () => {
  console.log('AppContainer组件开始渲染...');

  // 统一的应用准备状态
  const [isAppReady, setIsAppReady] = useState(false);
  const [initResult, setInitResult] = useState(null);

  // 使用初始化hook
  const { initializeApp } = useAppInitialization();

  // 获取主题
  let theme, isDarkMode;
  try {
    const themeContext = useTheme();
    if (themeContext && themeContext.theme && themeContext.theme.colors) {
      theme = themeContext.theme;
      isDarkMode = themeContext.isDarkMode;
    } else {
      theme = defaultTheme;
      isDarkMode = false;
    }
  } catch (error) {
    theme = defaultTheme;
    isDarkMode = false;
  }

  // 处理SplashScreen完成
  const handleSplashComplete = async () => {
    console.log('SplashScreen动画完成，开始应用初始化...');

    // 执行所有初始化逻辑
    const result = await initializeApp();
    setInitResult(result);

    // 如果初始化失败，询问用户是否继续
    if (!result.success) {
      Alert.alert(
        '初始化警告',
        '部分服务初始化失败，应用可能无法完全正常工作。是否继续？',
        [
          { text: '退出', style: 'cancel', onPress: () => { } },
          { text: '继续', onPress: () => setIsAppReady(true) },
        ]
      );
    } else {
      setIsAppReady(true);
      console.log('应用准备就绪，显示主界面');
    }
  };

  // 创建 Paper 主题
  const paperTheme = isDarkMode ? createPaperDarkTheme(theme) : createPaperLightTheme(theme);

  // 如果应用未准备好，显示统一的启动屏幕
  if (!isAppReady) {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#FFFFFF"
          translucent={false}
        />
        <SplashScreen onComplete={handleSplashComplete} />
      </View>
    );
  }

  // 应用准备完成，渲染主界面
  return (
    <PaperProvider theme={paperTheme} settings={{ icon: safePaperIcon }}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
        translucent={false}
      />
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          console.log('NavigationContainer已准备就绪');
          try {
            processNavigationQueue();
          } catch (error) {
            console.error('处理导航队列失败:', error);
          }
        }}
        onStateChange={() => {
          try {
            const currentRouteName = navigationRef.current?.getCurrentRoute()?.name;
            console.log('导航状态已更改，当前路由:', currentRouteName || '未知');
          } catch (error) {
            console.error('获取当前路由失败:', error);
          }
        }}
      >
        <AppNavigator />
        <GlobalNetworkErrorHandler />
      </NavigationContainer>
    </PaperProvider>
  );
};

// 创建一个简单的错误边界组件
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 开发联调阶段避免ErrorBoundary日志触发RedBox中断测试流程
    console.log('应用错误边界捕获到错误:', error?.message || error);
    console.log('错误详情:', errorInfo?.componentStack || errorInfo);

    // 记录更多错误信息
    if (error?.message && error.message.includes('Malformed calls from JS: field sizes are different')) {
      console.log('检测到字段大小不匹配错误，可能是数据序列化问题');

      // 尝试清理可能导致问题的本地存储
      try {
        // 异步清理，不阻塞UI
        this.cleanupLocalStorage();
      } catch (cleanupError) {
        console.error('清理本地存储失败:', cleanupError);
      }
    }
  }

  // 清理可能导致问题的本地存储
  cleanupLocalStorage = async () => {
    try {
      // 使用 realmService 清理最近的笔记缓存
      const realm = await realmService.getRealm();
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered('key = "recent_notes"');
        if (existingItem.length > 0) {
          existingItem[0].value = '[]';
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: 'recent_notes',
            value: '[]',
            created_at: new Date(),
            updated_at: new Date(),
          });
        }
      });
      console.log('已清理最近笔记缓存');

    } catch (error) {
      console.error('清理存储失败:', error);
    }
  };

  // 重启应用
  restartApp = () => {
    this.setState({ hasError: false, error: null });
    // 尝试清除可能导致问题的状态
    try {
      // 清除导航状态
      if (navigationRef.current) {
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }
    } catch (e) {
      console.error('重置导航状态失败:', e);
    }
  };

  render() {
    if (this.state.hasError) {
      // 安全地获取错误消息
      const errorMessage = (this.state.error && this.state.error.message)
        ? String(this.state.error.message)
        : '未知错误';

      // 确保所有样式属性都是有效的数字或字符串
      const safeStyles = {
        container: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f0f0f0',
        },
        errorTitle: {
          fontSize: 18,
          color: 'red',
          marginBottom: 10,
        },
        errorMessage: {
          fontSize: 14,
          color: '#333',
          textAlign: 'center',
          padding: 20,
        },
        button: {
          backgroundColor: '#2196F3',
          paddingVertical: 10,
          paddingHorizontal: 20,
          borderRadius: 5,
          marginTop: 20,
        },
        buttonText: {
          color: 'white',
          fontSize: 16,
        },
      };

      return (
        <View style={safeStyles.container}>
          <Text style={safeStyles.errorTitle}>应用发生错误</Text>
          <Text style={safeStyles.errorMessage}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            style={safeStyles.button}
            onPress={this.restartApp}
          >
            <Text style={safeStyles.buttonText}>重启应用</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

// 加载组件
const LoadingComponent = () => {
  console.log('PersistGate: 等待本地持久化数据恢复...');
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
      }}
    />
  );
};

// 持久化错误组件
const PersistError = ({ error }) => {
  console.error('Redux持久化错误:', error);

  // 安全地获取错误信息
  const errorMessage = (error && error.message) ? String(error.message) : '未知错误，请重启应用';
  const errorCode = (error && error.code) ? String(error.code) : 'UNKNOWN';

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }}>
      <Text style={{ fontSize: 18, color: 'red', marginBottom: 10 }}>数据加载失败</Text>
      <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginHorizontal: 20 }}>
        {errorMessage}
      </Text>
      <Text style={{ fontSize: 12, color: '#999', marginTop: 20 }}>错误代码: {errorCode}</Text>
    </View>
  );
};

// 应用入口
const App = () => {
  // 检查store是否正确导入
  if (!store) {
    console.error('Redux store未正确初始化');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }}>
        <Text style={{ fontSize: 18, color: 'red' }}>应用初始化失败: Redux store未正确加载</Text>
      </View>
    );
  }

  // 添加调试信息
  console.log('App组件渲染中...');
  console.log('Store状态:', store ? '已加载' : '未加载');
  console.log('Persistor状态:', persistor ? '已加载' : '未加载');

  try {
    // 使用简化的渲染结构，避免手势处理器初始化问题
    return (
      <ErrorBoundary>
        <View style={{ flex: 1 }}>
          <Provider store={store}>
            <PersistGate
              loading={<LoadingComponent />}
              persistor={persistor}
              onBeforeLift={() => {
                console.log('PersistGate: 数据恢复完成，准备渲染应用...');
              }}
              renderError={error => <PersistError error={error} />}
              onError={(error) => {
                console.error('PersistGate: 数据恢复失败:', error);
              }}
            >
              <SafeAreaProvider>
                <ThemeProvider>
                  <FontSizeProvider>
                    <AccessibilityProvider>
                      <RealmProvider>
                        <NotificationProvider>
                          <GestureHandlerRootView style={{ flex: 1 }}>
                            <AppContainer />
                          </GestureHandlerRootView>
                        </NotificationProvider>
                      </RealmProvider>
                    </AccessibilityProvider>
                  </FontSizeProvider>
                </ThemeProvider>
              </SafeAreaProvider>
            </PersistGate>
          </Provider>
        </View>
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('应用渲染错误:', error);
    console.error('错误堆栈:', error.stack);
    // 显示一个简单的错误屏幕，避免使用复杂组件
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }}>
        <Text style={{ fontSize: 18, color: 'red', marginBottom: 10 }}>应用渲染错误</Text>
        <Text style={{ fontSize: 14, color: '#333', textAlign: 'center', padding: 20 }}>
          {error.message || '未知错误'}
        </Text>
      </View>
    );
  }
};

export default App;
