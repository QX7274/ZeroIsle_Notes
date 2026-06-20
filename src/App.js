/**
 * 应用入口
 * 集成了Redux状态管理、主题管理、认证流程和导航等基础功能
 * 统一的启动屏幕管理所有初始化阶段，但保留必要的服务检测
 */

import React, { useEffect, useRef, useState } from 'react';
import { StatusBar, Platform, LogBox, View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
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

// 导入屏幕组件
import SplashScreen from './screens/common/SplashScreen';
import GlobalNetworkErrorHandler from './components/common/GlobalNetworkErrorHandler';

// 导入令牌服务
import tokenService from './services/auth/tokenService';
import { handleUnauthorizedError } from './services/auth/authUtils';
import { DEV_MODE_CONFIG } from './config';
import debugLog from './native/debugLog';

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
  'SplashScreen 超时未完成，触发初始化兜底放行',
  'SplashScreen 兜底初始化失败:',
  '检查通知权限超时，按未授权处理并继续初始化',
  '创建通知渠道超时，但应用将继续运行',
  '通知渠道创建失败，但应用将继续运行',
  '提醒通知服务初始化部分失败，但应用将继续运行',
  '通知渠道创建超时，已创建',
  'NotificationProvider: 通知服务延后初始化失败（已捕获，不阻塞应用）:',
  'PersistBootstrapGate: 持久化恢复超过',
  'PersistBootstrapGate: 当前以降级模式继续启动',
];

const shouldSuppressDevConsoleMessage = (args = []) => {
  if (!__DEV__ || args.length === 0) {
    return false;
  }

  const [firstArg] = args;
  const joinedMessage = args
    .map(arg => {
      if (typeof arg === 'string') {
        return arg;
      }
      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}`;
      }
      try {
        return JSON.stringify(arg);
      } catch (error) {
        return String(arg);
      }
    })
    .join(' ');

  if (typeof firstArg === 'string') {
    const matchesFirstArg = DEV_SUPPRESSED_LOG_PREFIXES.some(prefix => firstArg.startsWith(prefix));
    if (matchesFirstArg) {
      return true;
    }
  }

  return DEV_SUPPRESSED_LOG_PREFIXES.some(prefix => joinedMessage.includes(prefix));
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
  'SplashScreen 超时未完成，触发初始化兜底放行',
  '检查通知权限超时，按未授权处理并继续初始化',
  '创建通知渠道超时，但应用将继续运行',
  '通知渠道创建失败，但应用将继续运行',
  '提醒通知服务初始化部分失败，但应用将继续运行',
  'PersistBootstrapGate: 持久化恢复超过',
  'PersistBootstrapGate: 当前以降级模式继续启动',
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

const DebugRenderProbe = ({ name, children }) => {
  debugLog('info', 'AppRoot', {
    event: 'render-probe',
    name,
  });
  return children;
};

// 统一的初始化逻辑（带服务检测）
const useAppInitialization = () => {
  const dispatch = useDispatch();

  const initializeApp = async () => {
    try {
      console.log('========= 开始应用初始化 =========');
      const infiniteCanvasStorage = require('./services/offline/infiniteCanvasStorage').default;

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
      const DEV_SKIP_LOGIN = __DEV__ && Boolean(DEV_MODE_CONFIG?.FEATURES?.SKIP_LOGIN_SCREEN);
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
  debugLog('info', 'AppRoot', { event: 'app-container-render-start' });

  // 统一的应用准备状态
  const [isAppReady, setIsAppReady] = useState(false);
  const [initResult, setInitResult] = useState(null);
  const initStartedRef = useRef(false);

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

  const beginInitialization = async (trigger = 'splashComplete') => {
    if (initStartedRef.current) {
      console.log(`应用初始化已开始，忽略重复触发: ${trigger}`);
      debugLog('warn', 'AppRoot', {
        event: 'initialization-duplicate-trigger-ignored',
        trigger,
      });
      return;
    }

    initStartedRef.current = true;
    console.log(`开始应用初始化，触发源: ${trigger}`);
    debugLog('info', 'AppRoot', {
      event: 'initialization-begin',
      trigger,
    });

    // 执行所有初始化逻辑
    const result = await initializeApp();
    setInitResult(result);
    debugLog('info', 'AppRoot', {
      event: 'initialization-result',
      trigger,
      success: !!result?.success,
      hasError: !!result?.error,
    });

    // 如果初始化失败，询问用户是否继续
    if (!result.success) {
      Alert.alert(
        '初始化警告',
        '部分服务初始化失败，应用可能无法完全正常工作。是否继续？',
        [
          { text: '退出', style: 'cancel', onPress: () => { } },
          {
            text: '继续',
            onPress: () => {
              debugLog('warn', 'AppRoot', {
                event: 'initialization-continue-after-warning',
                trigger,
              });
              setIsAppReady(true);
            },
          },
        ]
      );
    } else {
      setIsAppReady(true);
      console.log('应用准备就绪，显示主界面');
      debugLog('info', 'AppRoot', {
        event: 'app-ready',
        trigger,
      });
    }
  };

  // 处理SplashScreen完成
  const handleSplashComplete = async () => {
    console.log('SplashScreen动画完成，开始应用初始化...');
    await beginInitialization('splashComplete');
  };

  useEffect(() => {
    if (isAppReady) {
      return undefined;
    }

    const splashFallbackTimer = setTimeout(() => {
      console.warn('SplashScreen 超时未完成，触发初始化兜底放行');
      beginInitialization('splashTimeoutFallback').catch(error => {
        console.error('SplashScreen 兜底初始化失败:', error);
        debugLog('error', 'AppRoot', {
          event: 'splash-timeout-fallback-failed',
          message: error?.message || 'unknown error',
        });
      });
    }, 4500);

    return () => clearTimeout(splashFallbackTimer);
  }, [isAppReady]);

  // 创建 Paper 主题
  const paperTheme = isDarkMode ? createPaperDarkTheme(theme) : createPaperLightTheme(theme);

  // 如果应用未准备好，显示统一的启动屏幕
  if (!isAppReady) {
    debugLog('info', 'AppRoot', {
      event: 'rendering-splash-screen',
      initStarted: initStartedRef.current,
      initSuccess: initResult?.success ?? null,
    });
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
          debugLog('info', 'AppRoot', {
            event: 'navigation-container-ready',
          });
          try {
            processNavigationQueue();
          } catch (error) {
            console.error('处理导航队列失败:', error);
            debugLog('error', 'AppRoot', {
              event: 'navigation-queue-process-failed',
              message: error?.message || 'unknown error',
            });
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
  debugLog('info', 'AppRoot', { event: 'persist-gate-loading-render' });
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
      }}
    />
  );
};

const PERSIST_BOOT_TIMEOUT_MS = 8000;

const PersistBootstrapGate = ({ children }) => {
  const [isBootstrapped, setIsBootstrapped] = useState(() => {
    try {
      return Boolean(persistor?.getState?.().bootstrapped);
    } catch (error) {
      console.error('PersistBootstrapGate: 读取初始持久化状态失败:', error);
      return false;
    }
  });
  const [didTimeout, setDidTimeout] = useState(false);
  const [persistError, setPersistError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe = null;

    const markBootstrapped = (reason) => {
      if (!isMounted) {
        return;
      }
      setIsBootstrapped(true);
      if (reason) {
        console.log(`PersistBootstrapGate: ${reason}`);
        debugLog('info', 'AppRoot', {
          event: 'persist-bootstrap-marked-ready',
          reason,
        });
      }
    };

    try {
      unsubscribe = persistor.subscribe(() => {
        try {
          const state = persistor.getState();
          if (state?.bootstrapped) {
            markBootstrapped('持久化数据恢复完成，继续启动应用');
          }
        } catch (error) {
          console.error('PersistBootstrapGate: 监听持久化状态失败:', error);
          debugLog('error', 'AppRoot', {
            event: 'persist-bootstrap-subscribe-callback-failed',
            message: error?.message || 'unknown error',
          });
          setPersistError(error);
          markBootstrapped('持久化状态监听失败，已降级放行');
        }
      });
    } catch (error) {
      console.error('PersistBootstrapGate: 订阅持久化状态失败:', error);
      debugLog('error', 'AppRoot', {
        event: 'persist-bootstrap-subscribe-failed',
        message: error?.message || 'unknown error',
      });
      setPersistError(error);
      markBootstrapped('持久化状态订阅失败，已降级放行');
    }

    const timeoutId = setTimeout(() => {
      if (!isMounted || isBootstrapped) {
        return;
      }
      console.warn(`PersistBootstrapGate: 持久化恢复超过 ${PERSIST_BOOT_TIMEOUT_MS}ms，跳过阻塞以避免白屏`);
      debugLog('warn', 'AppRoot', {
        event: 'persist-bootstrap-timeout-bypass',
        timeoutMs: PERSIST_BOOT_TIMEOUT_MS,
      });
      setDidTimeout(true);
      markBootstrapped('持久化恢复超时，已跳过门禁阻塞');
    }, PERSIST_BOOT_TIMEOUT_MS);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [isBootstrapped]);

  if (!isBootstrapped) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#F8FBFF',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 32,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 24,
            backgroundColor: '#EAF4FF',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <ActivityIndicator size="large" color="#4DA3FF" />
        </View>
        <Text
          style={{
            fontSize: 22,
            fontWeight: '700',
            color: '#17324D',
            marginBottom: 8,
          }}
        >
          正在恢复本地数据
        </Text>
        <Text
          style={{
            fontSize: 14,
            lineHeight: 22,
            textAlign: 'center',
            color: '#5C6F82',
            maxWidth: 360,
          }}
        >
          如果本地缓存恢复较慢，系统会在数秒后自动放行进入主界面，避免启动后长时间白屏。
        </Text>
      </View>
    );
  }

  if (didTimeout || persistError) {
    console.warn('PersistBootstrapGate: 当前以降级模式继续启动', {
      didTimeout,
      error: persistError?.message || null,
    });
    debugLog('warn', 'AppRoot', {
      event: 'persist-bootstrap-degraded-continue',
      didTimeout,
      error: persistError?.message || null,
    });
  }

  return children;
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
    debugLog('info', 'AppRoot', {
      event: 'app-render-start',
      hasStore: !!store,
      hasPersistor: !!persistor,
    });

    // 使用简化的渲染结构，避免手势处理器初始化问题
    return (
      <ErrorBoundary>
        <View style={{ flex: 1 }}>
          <Provider store={store}>
            <DebugRenderProbe name="provider-store">
              <PersistBootstrapGate>
                <DebugRenderProbe name="provider-persist-bootstrap-gate">
                  <PersistGate
                    loading={<LoadingComponent />}
                    persistor={persistor}
                    onBeforeLift={() => {
                      console.log('PersistGate: 数据恢复完成，准备渲染应用...');
                      debugLog('info', 'AppRoot', {
                        event: 'persist-gate-before-lift',
                      });
                    }}
                  >
                    <DebugRenderProbe name="provider-persist-gate-child">
                      <SafeAreaProvider>
                        <DebugRenderProbe name="provider-safe-area">
                          <ThemeProvider>
                            <DebugRenderProbe name="provider-theme">
                              <FontSizeProvider>
                                <DebugRenderProbe name="provider-font-size">
                                  <AccessibilityProvider>
                                    <DebugRenderProbe name="provider-accessibility">
                                      <RealmProvider>
                                        <DebugRenderProbe name="provider-realm">
                                          <NotificationProvider>
                                            <DebugRenderProbe name="provider-notification">
                                              <GestureHandlerRootView style={{ flex: 1 }}>
                                                <DebugRenderProbe name="provider-gesture-handler">
                                                  <AppContainer />
                                                </DebugRenderProbe>
                                              </GestureHandlerRootView>
                                            </DebugRenderProbe>
                                          </NotificationProvider>
                                        </DebugRenderProbe>
                                      </RealmProvider>
                                    </DebugRenderProbe>
                                  </AccessibilityProvider>
                                </DebugRenderProbe>
                              </FontSizeProvider>
                            </DebugRenderProbe>
                          </ThemeProvider>
                        </DebugRenderProbe>
                      </SafeAreaProvider>
                    </DebugRenderProbe>
                  </PersistGate>
                </DebugRenderProbe>
              </PersistBootstrapGate>
            </DebugRenderProbe>
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
