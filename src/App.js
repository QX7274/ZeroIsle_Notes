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
import { offlineDataService } from './services/storage';
import { dataService, sqliteService } from './services/database';

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

  // 初始化服务 - 只在组件挂载时执行一次
  useEffect(() => {
    // 标记服务是否已初始化，防止重复初始化
    let servicesInitialized = false;

    const initServices = async () => {
      // 防止重复初始化
      if (servicesInitialized) {
        console.log('服务已经初始化，跳过重复初始化');
        return;
      }

      try {
        console.log('正在初始化服务...');
        servicesInitialized = true;

        // 直接创建数据库文件和表，不依赖于导入的方法
        try {
          console.log('直接创建数据库文件和sync_info表...');

          // 导入必要的模块
          const SQLite = require('react-native-sqlite-storage');
          const RNFS = require('react-native-fs');
          SQLite.enablePromise(true);

          // 获取数据库文件路径
          let dbPath = '';
          if (Platform.OS === 'android') {
            dbPath = `${RNFS.DocumentDirectoryPath}/zeroislenotes.db`;
          } else {
            dbPath = `${RNFS.LibraryDirectoryPath}/LocalDatabase/zeroislenotes.db`;
          }

          console.log('数据库文件路径:', dbPath);

          // 检查文件是否存在
          const fileExists = await RNFS.exists(dbPath);
          console.log(`数据库文件是否存在: ${fileExists}`);

          // 如果文件不存在，创建目录和空文件
          if (!fileExists) {
            try {
              // 确保目录存在
              if (Platform.OS === 'ios') {
                const dirPath = `${RNFS.LibraryDirectoryPath}/LocalDatabase`;
                const dirExists = await RNFS.exists(dirPath);
                if (!dirExists) {
                  await RNFS.mkdir(dirPath);
                  console.log(`创建iOS数据库目录: ${dirPath}`);
                }
              }

                  // 直接创建空文件，不使用二进制头部
              await RNFS.writeFile(dbPath, '', 'utf8');
              console.log('创建空数据库文件成功');

              // 验证文件是否创建成功
              const fileExistsAfter = await RNFS.exists(dbPath);
              if (fileExistsAfter) {
                const fileInfo = await RNFS.stat(dbPath);
                console.log(`数据库文件已创建，大小: ${(fileInfo.size / 1024).toFixed(2)} KB`);
              } else {
                console.error('数据库文件创建失败');
                // 备选方案：尝试使用空字符串创建文件
                await RNFS.writeFile(dbPath, '', 'utf8');
                console.log('使用备选方案创建空数据库文件');
              }
            } catch (fileError) {
              console.error('创建数据库文件失败:', fileError);
            }
          }

          // 打开数据库
          console.log('尝试打开数据库...');
          const db = await SQLite.openDatabase({
            name: 'zeroislenotes.db',
            location: Platform.OS === 'ios' ? 'Library' : 'default',
            createFromLocation: 0,
          });

          console.log('数据库打开成功，尝试创建sync_info表');

          // 创建sync_info表
          await db.executeSql(`
            CREATE TABLE IF NOT EXISTS sync_info (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              table_name TEXT NOT NULL UNIQUE,
              last_sync_time TEXT,
              sync_status TEXT,
              error_message TEXT,
              created_at TEXT,
              updated_at TEXT
            )
          `);

          console.log('sync_info表创建成功');

          // 检查表是否已有记录
          const result = await db.executeSql('SELECT COUNT(*) as count FROM sync_info');
          const count = result[0].rows.item(0).count;

          if (count === 0) {
            console.log('sync_info表为空，初始化记录');
            const now = new Date().toISOString();
            const tables = ['users', 'notes', 'categories', 'tags', 'note_tags', 'reminders', 'settings', 'files'];

            // 使用事务批量插入
            await db.transaction(async (tx) => {
              for (const table of tables) {
                // 确保参数不为null
                const safeParams = [
                  table || '',
                  '',
                  'pending',
                  now || new Date().toISOString(),
                  now || new Date().toISOString()
                ];

                await tx.executeSql(
                  'INSERT INTO sync_info (table_name, last_sync_time, sync_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
                  safeParams
                );
              }
            });

            console.log('sync_info表初始化完成');
          } else {
            console.log(`sync_info表已有${count}条记录`);
          }

          // 创建离线队列表
          await db.executeSql(`
            CREATE TABLE IF NOT EXISTS offline_queue (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              operation_type TEXT NOT NULL,
              table_name TEXT NOT NULL,
              record_id TEXT,
              data TEXT,
              retry_count INTEGER DEFAULT 0,
              created_at TEXT,
              is_processed INTEGER DEFAULT 0,
              error_message TEXT
            )
          `);
          console.log('离线队列表创建成功');

          // 确保数据库文件被正确保存
          await db.executeSql('PRAGMA journal_mode=DELETE');
          await db.executeSql('PRAGMA synchronous=FULL');
          await db.close();
          console.log('数据库已关闭，确保更改被保存');

          // 验证数据库文件是否存在
          const fileExistsAfterClose = await RNFS.exists(dbPath);
          if (fileExistsAfterClose) {
            const fileInfo = await RNFS.stat(dbPath);
            console.log(`数据库文件已保存，大小: ${(fileInfo.size / 1024).toFixed(2)} KB`);
          } else {
            console.error('数据库文件保存失败');
          }
        } catch (syncTableError) {
          console.error('直接创建数据库和表失败:', syncTableError);
          // 继续执行，不阻塞应用启动
        }

        // 使用Promise.all和超时机制确保所有服务初始化不会阻塞应用
        const initPromises = [];

        // 初始化Firebase
        const firebasePromise = new Promise(async (resolve) => {
          try {
            const result = await initializeFirebase();
            console.log('Firebase 已经初始化' + (result ? '成功' : '失败'));
            resolve(true);
          } catch (error) {
            console.warn('Firebase 初始化失败，但应用将继续运行:', error);
            resolve(false);
          }
        });
        initPromises.push(firebasePromise);

        // 初始化离线数据服务
        const offlineDataPromise = new Promise(async (resolve) => {
          try {
            console.log('正在初始化离线数据服务...');
            offlineDataService.initialize();
            console.log('离线数据服务已初始化');
            resolve(true);
          } catch (error) {
            console.warn('离线数据服务初始化失败，但应用将继续运行:', error);
            resolve(false);
          }
        });
        initPromises.push(offlineDataPromise);

        // 初始化SQLite数据库服务 - 使用单独的Promise.race确保不会阻塞其他服务
        const sqlitePromise = new Promise(async (resolve) => {
          try {
            console.log('正在初始化SQLite数据库服务...');

            // 检查数据库状态并尝试修复
            try {
              console.log('检查数据库状态...');
              const dbPath = await sqliteService.getDatabasePath();
              const RNFS = require('react-native-fs');
              const fileExists = await RNFS.exists(dbPath);

              if (fileExists) {
                try {
                  const fileInfo = await RNFS.stat(dbPath);
                  console.log(`数据库文件存在，大小: ${(fileInfo.size / 1024).toFixed(2)} KB`);

                  // 如果文件大小异常（太小或太大），可能是损坏的
                  if (fileInfo.size < 1024) { // 小于1KB
                    console.warn('数据库文件异常小，可能是空文件或损坏，尝试重置');
                    await sqliteService.resetDatabase();
                  } else if (fileInfo.size > 100 * 1024 * 1024) { // 大于100MB
                    console.warn('数据库文件过大，可能导致性能问题，尝试检查完整性');
                    await sqliteService.checkAndRepairDatabase();
                  }
                } catch (fileError) {
                  console.warn('检查数据库文件失败:', fileError);
                }
              } else {
                console.log('数据库文件不存在，将在初始化时创建');
              }
            } catch (dbCheckError) {
              console.error('检查数据库状态失败:', dbCheckError);
            }

            // 不再需要单独的超时Promise，因为init方法内部已经有超时处理

            // 使用更简单、更可靠的方法初始化SQLite
            let sqliteResult = false;
            try {
              console.log('使用简化方法初始化SQLite数据库...');

              // 直接初始化SQLite服务，使用更长的超时时间
              const db = await sqliteService.init(60000);

              if (db) {
                console.log('SQLite数据库初始化成功，现在初始化数据服务');

                // 初始化数据服务
                try {
                  await dataService.init();
                  sqliteResult = true;
                  console.log('数据服务初始化成功');
                } catch (dataServiceError) {
                  console.error('数据服务初始化失败，但SQLite已初始化:', dataServiceError);
                  sqliteResult = true; // 仍然认为SQLite初始化成功
                }
              } else {
                console.warn('SQLite数据库初始化返回null，尝试备选方案');

                // 尝试强制创建sync_info表
                try {
                  const forceResult = await sqliteService.forceCreateSyncInfoTable();
                  console.log('强制创建sync_info表结果:', forceResult ? '成功' : '失败');

                  if (forceResult) {
                    // 再次尝试初始化数据服务
                    try {
                      await dataService.init();
                      sqliteResult = true;
                      console.log('使用备选方案后数据服务初始化成功');
                    } catch (retryDataServiceError) {
                      console.error('使用备选方案后数据服务初始化失败:', retryDataServiceError);
                    }
                  }
                } catch (forceError) {
                  console.error('强制创建sync_info表失败:', forceError);
                }
              }
            } catch (initError) {
              console.error('SQLite初始化过程中出错:', initError);

              // 最后尝试：重置数据库
              try {
                console.log('尝试重置数据库...');
                const resetResult = await sqliteService.resetDatabase();
                console.log('数据库重置结果:', resetResult ? '成功' : '失败');

                if (resetResult) {
                  // 再次尝试初始化数据服务
                  try {
                    await dataService.init();
                    sqliteResult = true;
                    console.log('重置后数据服务初始化成功');
                  } catch (postResetError) {
                    console.error('重置后数据服务初始化失败:', postResetError);
                  }
                }
              } catch (resetError) {
                console.error('重置数据库失败:', resetError);
              }
            }

            if (sqliteResult) {
              console.log('SQLite数据库服务初始化成功');
            } else {
              console.warn('SQLite数据库服务未成功初始化，应用将以降级模式运行');
            }
            resolve(sqliteResult);
          } catch (error) {
            console.warn('SQLite数据库服务初始化失败，但应用将继续运行:', error);
            resolve(false);
          }
        });
        initPromises.push(sqlitePromise);

        // 添加全局超时，确保即使某个服务卡住，应用也能继续运行
        const timeoutPromise = new Promise(resolve => {
          setTimeout(() => {
            console.log('服务初始化超时，但应用将继续运行');
            resolve(false);
          }, 20000); // 20秒超时
        });

        // 等待所有服务初始化完成或超时
        await Promise.race([
          Promise.all(initPromises),
          timeoutPromise
        ]);

        console.log('所有服务初始化完成或超时');
      } catch (error) {
        console.error('初始化服务失败:', error);
        // 即使出错也不抛出异常，避免阻塞应用启动
      }
    };

    // 使用setTimeout确保不会阻塞UI渲染
    const initTimeout = setTimeout(() => {
      initServices();
    }, 500); // 延迟500ms初始化，确保UI已渲染

    // 清理函数，在组件卸载时执行
    return () => {
      clearTimeout(initTimeout);
      console.log('正在清理服务...');

      // 销毁离线数据服务
      try {
        offlineDataService.destroy();
        console.log('离线数据服务已销毁');
      } catch (error) {
        console.error('销毁离线数据服务失败:', error);
      }

      // 关闭SQLite数据库连接
      try {
        sqliteService.close();
        console.log('SQLite数据库连接已关闭');
      } catch (error) {
        console.error('关闭SQLite数据库连接失败:', error);
      }
    };
  }, []); // 空依赖数组确保只在组件挂载时执行一次

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