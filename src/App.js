/**
 * 应用入口
 * 集成了Redux状态管理、主题管理、认证流程和导航等基础功能
 */
import React, { useEffect, useState } from 'react';
import { StatusBar, Platform, LogBox, View, Text, ActivityIndicator } from 'react-native';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';

// 导入store和persistor
import { store, persistor } from './store/index';

// 导入认证相关action
import { checkAuthState } from './redux/slices/authSlice';

// 导入导航
import AppNavigator from './navigation/AppNavigator';
import AuthNavigator from './navigation/AuthNavigator';
import { navigationRef, processNavigationQueue } from './navigation/navigationRef';

// 导入上下文提供者
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AccessibilityProvider } from './context/AccessibilityContext';

// 导入服务
import { initializeFirebase } from './services/firebase/firebaseInit';

// 导入屏幕组件
import { SplashScreen } from './screens/common';

// 调试信息
console.log('App.js: store导入状态:', store ? '成功' : '失败');

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
  }
};

// 认证状态检查组件
const AuthStateManager = () => {
  const dispatch = useDispatch();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // 检查认证状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('正在检查认证状态...');
        await dispatch(checkAuthState()).unwrap();
      } catch (error) {
        console.error('检查认证状态失败:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [dispatch]);

  // 如果正在检查认证状态，显示加载指示器
  if (isCheckingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 20, fontSize: 16, color: '#333' }}>正在加载...</Text>
      </View>
    );
  }

  return null;
};

// 主应用容器
const AppContainer = () => {
  console.log('AppContainer组件开始渲染...');

  // 获取认证状态
  const { token, user, isAuthenticated: authState } = useSelector(state => {
    // 添加安全检查，确保state.auth存在
    if (!state || !state.auth) {
      console.warn('AppContainer: Redux状态不完整，auth状态不存在');
      return { token: null, user: null, isAuthenticated: false };
    }
    return state.auth;
  });

  // 优先使用Redux中的isAuthenticated状态，如果不存在则根据token和user判断
  const isAuthenticated = authState !== undefined ? authState : (!!token && !!user);
  console.log('认证状态:', isAuthenticated ? '已登录' : '未登录');
  console.log('认证详情 - token:', !!token, 'user:', !!user, 'authState:', authState);

  // 使用try-catch包装useTheme调用
  let theme, isDarkMode;
  try {
    console.log('尝试加载主题...');
    const themeContext = useTheme();

    // 检查主题上下文是否存在
    if (!themeContext) {
      console.warn('主题上下文不存在，使用默认主题');
      theme = defaultTheme;
      isDarkMode = false;
    } else {
      // 检查主题对象是否存在
      if (!themeContext.theme || !themeContext.theme.colors) {
        console.warn('主题对象不完整，使用默认主题');
        theme = defaultTheme;
      } else {
        theme = themeContext.theme;
      }

      // 检查isDarkMode是否存在
      if (typeof themeContext.isDarkMode !== 'boolean') {
        console.warn('isDarkMode不存在，默认使用浅色模式');
        isDarkMode = false;
      } else {
        isDarkMode = themeContext.isDarkMode;
      }

      console.log('主题加载成功:', theme.dark ? '深色' : '浅色');
    }
  } catch (error) {
    console.error('主题加载失败:', error.message);
    // 使用默认主题
    theme = defaultTheme;
    isDarkMode = false;
    console.log('使用默认主题');
  }

  // 初始化服务
  useEffect(() => {
    const initServices = async () => {
      try {
        console.log('正在初始化服务...');

        // 使用Promise.all和超时机制确保所有服务初始化不会阻塞应用
        const initPromises = [];

        // 初始化Firebase
        const firebasePromise = new Promise(async (resolve) => {
          try {
            const result = await initializeFirebase();
            console.log('Firebase 初始化' + (result ? '成功' : '失败'));
            resolve(true);
          } catch (error) {
            console.warn('Firebase 初始化失败，但应用将继续运行:', error);
            resolve(false);
          }
        });
        initPromises.push(firebasePromise);

        // 初始化通知服务 - 这里不需要额外代码，因为NotificationService在导入时已自动初始化
        // 但我们可以添加一个检查，确保通知服务已经初始化
        const notificationPromise = new Promise(async (resolve) => {
          try {
            // 等待一小段时间，确保通知服务有足够时间初始化
            setTimeout(() => {
              console.log('通知服务初始化检查完成');
              resolve(true);
            }, 1000);
          } catch (error) {
            console.warn('通知服务初始化检查失败，但应用将继续运行:', error);
            resolve(false);
          }
        });
        initPromises.push(notificationPromise);

        // 添加全局超时，确保即使某个服务卡住，应用也能继续运行
        const timeoutPromise = new Promise(resolve => {
          setTimeout(() => {
            // 使用console.log代替console.warn，避免显示警告
            console.log('服务初始化超时，但应用将继续运行');
            resolve(false);
          }, 10000); // 10秒超时，增加超时时间以适应更慢的设备
        });

        // 等待所有服务初始化完成或超时
        await Promise.race([
          Promise.all(initPromises),
          timeoutPromise
        ]);

        console.log('所有服务初始化完成或超时');
      } catch (error) {
        console.error('初始化服务失败:', error);
        console.error('错误堆栈:', error.stack);
        // 即使出错也不抛出异常，避免阻塞应用启动
      }
    };

    // 使用setTimeout确保不会阻塞UI渲染
    setTimeout(() => {
      initServices();
    }, 0);
  }, []);

  // 监听主题变化，更新状态栏
  useEffect(() => {
    try {
      StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(theme.colors.background);
        StatusBar.setTranslucent(true);
      }

      // 处理导航队列
      processNavigationQueue();
    } catch (error) {
      console.error('状态栏更新失败:', error.message);
    }
  }, [isDarkMode, theme]);

  console.log('AppContainer准备渲染UI...');

  return (
    <PaperProvider theme={theme}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
        translucent
      />
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          console.log('NavigationContainer已准备就绪');
          // 处理导航队列
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
        fallback={
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }}>
            <Text style={{ fontSize: 18 }}>导航加载中...</Text>
          </View>
        }
      >
        <AuthStateManager />
        {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
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
    console.error('应用错误边界捕获到错误:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }}>
          <Text style={{ fontSize: 18, color: 'red', marginBottom: 10 }}>应用发生错误</Text>
          <Text style={{ fontSize: 14, color: '#333', textAlign: 'center', padding: 20 }}>
            {this.state.error?.message || '未知错误'}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// 加载组件
const LoadingComponent = () => {
  console.log('显示加载组件...');
  return <SplashScreen message="应用初始化中..." />;
};

// 持久化错误组件
const PersistError = ({ error }) => {
  console.error('Redux持久化错误:', error);
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }}>
      <Text style={{ fontSize: 18, color: 'red', marginBottom: 10 }}>数据加载失败</Text>
      <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginHorizontal: 20 }}>
        {error?.message || '未知错误，请重启应用'}
      </Text>
      <Text style={{ fontSize: 12, color: '#999', marginTop: 20 }}>错误代码: {error?.code || 'UNKNOWN'}</Text>
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
                  <AccessibilityProvider>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <AppContainer />
                    </GestureHandlerRootView>
                  </AccessibilityProvider>
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