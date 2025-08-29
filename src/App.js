/**
 * 应用入口
 * 集成了Redux状态管理、主题管理、认证流程和导航等基础功能
 */

import React, { useEffect, useState } from 'react';
import { StatusBar, Platform, LogBox, View, Text, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { createPaperLightTheme, createPaperDarkTheme } from './theme/paperTheme';
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
import { RealmProvider } from './context/RealmContext';
import { FontSizeProvider } from './context/FontSizeContext';

// 导入服务
import { initializeFirebase } from './services/firebase/firebaseInit';
import { offlineDataService } from './services/storage';
import { dataService } from './services/database';
import { infiniteCanvasStorage, offlineStorageService } from './services/offline';
// 使用MongoDB Realm替代AsyncStorage
import { realmStorageService } from './services/storage/realmStorageService';
import STORAGE_KEYS from './constants/storageKeys';
import { patchDateTimePicker } from './utils/patchDateTimePicker';
import './utils/cryptoPolyfill'; // 导入加密模块 polyfill
import { fixServiceInitialization } from './services/initFix'; // 导入服务初始化修复
import { ensureAllServicesInitialized, checkAllServices } from './services/serviceChecker'; // 导入服务检查器

// 导入屏幕组件
import { SplashScreen } from './screens/common';
import { ServiceStatusChecker } from './components/common';

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

// 导入令牌服务
import tokenService from './services/auth/tokenService';
import { handleUnauthorizedError } from './services/auth/authUtils';

// 认证状态检查组件
const AuthStateManager = () => {
  const dispatch = useDispatch();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // 检查认证状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('正在检查认证状态...');

        // 检查开发模式
        const { DEV_CONFIG } = require('./config');
        if (DEV_CONFIG.SKIP_LOGIN) {
          console.log('开发模式：跳过令牌检查，直接进行认证状态检查');
          // 在开发模式下，直接检查Redux认证状态，不进行令牌验证
          await dispatch(checkAuthState()).unwrap();
          return;
        }

        // 首先检查令牌是否过期
        const isTokenExpired = await tokenService.isAccessTokenExpiredOrExpiring();

        if (isTokenExpired) {
          console.log('访问令牌已过期或即将过期，尝试刷新...');

          // 尝试刷新令牌
          const newTokenData = await tokenService.refreshAccessToken();

          if (!newTokenData) {
            console.log('刷新令牌失败，清除认证状态');
            // 处理未授权错误，清除认证状态并导航到登录页面
            await handleUnauthorizedError();
          } else {
            console.log('令牌刷新成功');
          }
        }

        // 检查Redux中的认证状态
        await dispatch(checkAuthState()).unwrap();
      } catch (error) {
        console.error('检查认证状态失败:', error);

        // 在开发模式下，即使出错也不阻止应用启动
        const { DEV_CONFIG } = require('./config');
        if (DEV_CONFIG.SKIP_LOGIN) {
          console.log('开发模式：认证检查失败，但继续启动应用');
        }
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [dispatch]);

  // 如果正在检查认证状态，显示加载指示器
  if (isCheckingAuth) {
    return <SplashScreen message="正在加载..." />;
  }

  return null;
};

// 主应用容器
const AppContainer = () => {
  console.log('AppContainer组件开始渲染...');

  // 应用状态
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [showServiceChecker, setShowServiceChecker] = useState(false);
  const [servicesInitialized, setServicesInitialized] = useState(false);

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

      // 确保所有必需服务已初始化
      try {
        console.log('确保所有必需服务已初始化...');
        const servicesInitialized = await ensureAllServicesInitialized();

        if (!servicesInitialized) {
          console.error('必需服务初始化失败，应用可能无法正常工作');
          // 显示错误提示
          Alert.alert(
            '初始化错误',
            '某些必需服务初始化失败，应用可能无法正常工作。请重启应用。',
            [{ text: '确定', style: 'cancel' }]
          );
        } else {
          console.log('所有必需服务已初始化');
        }
      } catch (serviceError) {
        console.error('服务初始化检查失败:', serviceError);
        // 继续执行，不阻塞应用启动
      }

      // 导入realmInitializer
      const { realmInitializer } = require('./services/database/realmInitializer');

      try {
        console.log('正在初始化服务...');
        servicesInitialized = true;

        // 应用 DateTimePicker 补丁
        try {
          console.log('正在应用 DateTimePicker 补丁...');
          await patchDateTimePicker();
          console.log('DateTimePicker 补丁应用完成');
        } catch (patchError) {
          console.error('应用 DateTimePicker 补丁失败:', patchError);
          // 继续执行，不阻塞应用启动
        }

        // 初始化MongoDB连接和存储服务
        try {
          console.log('初始化MongoDB连接和存储服务...');

          // 初始化无限画布存储服务
          try {
            console.log('初始化无限画布存储服务...');
            await infiniteCanvasStorage.initialize();
            console.log('无限画布存储服务初始化完成');
          } catch (canvasError) {
            console.error('初始化无限画布存储服务失败:', canvasError);
            // 继续执行，不阻塞应用启动
          }

          // 初始化Realm数据库
          try {
            console.log('初始化Realm数据库...');
            const { realmInitializer } = require('./services/database/realmInitializer');
            await realmInitializer.initialize();
            console.log('Realm数据库初始化完成');

            // 检查网络连接并尝试同步
            await realmInitializer.checkNetworkAndSync();

            // 确保所有服务正确初始化
            try {
              console.log('再次检查所有服务初始化状态...');
              const servicesInitialized = await ensureAllServicesInitialized();

              if (!servicesInitialized) {
                console.error('必需服务初始化失败，应用可能无法正常工作');
                // 显示错误提示
                Alert.alert(
                  '初始化错误',
                  '某些必需服务初始化失败，应用可能无法正常工作。请重启应用。',
                  [{ text: '确定', style: 'cancel' }]
                );
              } else {
                console.log('所有必需服务已初始化');
              }
            } catch (serviceError) {
              console.error('服务初始化检查失败:', serviceError);
              // 继续执行，不阻塞应用启动
            }
          } catch (realmError) {
            console.error('初始化Realm数据库失败:', realmError);
            // 继续执行，不阻塞应用启动
          }

          // 初始化MongoDB数据服务
          try {
            console.log('初始化MongoDB数据服务...');
            await dataService.initialize();
            console.log('MongoDB数据服务初始化完成');
          } catch (mongoError) {
            console.error('初始化MongoDB数据服务失败:', mongoError);
            // 继续执行，不阻塞应用启动
          }

          console.log('MongoDB连接和存储服务初始化完成');
        } catch (dbError) {
          console.error('初始化数据库服务失败:', dbError);
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

            // 初始化离线存储服务和无限画布存储服务
            try {
              console.log('正在初始化存储服务...');

              // 步骤1: 首先确保offlineStorageService已经初始化
              try {
                console.log('确保offlineStorageService已初始化...');
                if (!offlineStorageService.initialized) {
                  console.log('offlineStorageService未初始化，开始初始化...');
                  await offlineStorageService.initialize();
                  console.log('offlineStorageService初始化完成');
                } else {
                  console.log('offlineStorageService已经初始化');
                }
              } catch (offlineInitError) {
                console.error('offlineStorageService初始化失败:', offlineInitError);
                // 继续执行，尝试添加兼容方法
              }

              // 步骤2: 确保关键方法存在
              try {
                console.log('检查并确保关键方法存在...');

                // 确保getCanvas方法存在
                if (typeof offlineStorageService.getCanvas !== 'function') {
                  console.log('添加getCanvas兼容方法');
                  offlineStorageService.getCanvas = async function(canvasId) {
                    console.log(`开始获取画布，ID: ${canvasId || '未提供'}`);

                    // 防御性检查：确保canvasId不为null或undefined
                    if (!canvasId) {
                      console.warn('offlineStorageService.getCanvas: canvasId为null或undefined，创建空画布');
                      return this._createEmptyCanvas(Date.now().toString());
                    }

                    // 使用安全的参数值
                    const safeCanvasId = String(canvasId || '');
                    console.log(`使用安全的画布ID: ${safeCanvasId}`);

                    // 尝试方法1: 使用getCanvasById方法
                    let canvas = null;
                    if (typeof this.getCanvasById === 'function') {
                      try {
                        console.log(`尝试使用getCanvasById方法获取画布: ${safeCanvasId}`);
                        canvas = await this.getCanvasById(safeCanvasId);
                        if (canvas) {
                          console.log(`使用getCanvasById方法成功获取画布: ${safeCanvasId}`);
                          return this._ensureCanvasProperties(canvas);
                        }
                        console.log(`getCanvasById方法未找到画布: ${safeCanvasId}，尝试备选方案`);
                      } catch (getByIdError) {
                        console.error(`offlineStorageService.getCanvasById调用失败:`, getByIdError);
                        // 继续执行，尝试备选方案
                      }
                    } else {
                      console.warn('offlineStorageService.getCanvasById方法未定义，尝试备选方案');
                    }

                    // 尝试方法2: 直接从存储中获取
                    try {
                      console.log(`尝试从所有画布中查找: ${safeCanvasId}`);
                      const canvases = await this.getCanvases();

                      // 防御性检查：确保canvases是数组
                      if (Array.isArray(canvases)) {
                        canvas = canvases.find(c => c && c.id === safeCanvasId);
                        if (canvas) {
                          console.log(`在所有画布中找到画布: ${safeCanvasId}`);
                          return this._ensureCanvasProperties(canvas);
                        }
                        console.log(`在所有画布中未找到画布: ${safeCanvasId}`);
                      } else {
                        console.warn('getCanvases返回的不是数组');
                      }
                    } catch (fallbackError) {
                      console.error(`从所有画布中查找失败:`, fallbackError);
                    }

                    // 如果所有方法都失败，创建一个空画布
                    console.log(`所有获取方法都失败，创建空画布: ${safeCanvasId}`);
                    return this._createEmptyCanvas(safeCanvasId);
                  };
                }

                // 确保_ensureCanvasProperties方法存在
                if (typeof offlineStorageService._ensureCanvasProperties !== 'function') {
                  console.log('添加_ensureCanvasProperties兼容方法');
                  offlineStorageService._ensureCanvasProperties = function(canvas) {
                    if (!canvas) return this._createEmptyCanvas(Date.now().toString());

                    return {
                      id: canvas.id,
                      title: canvas.title || '新画布',
                      description: canvas.description || '',
                      elements: canvas.elements || [],
                      layers: canvas.layers || [{ id: 'default', name: '默认图层', visible: true, locked: false }],
                      activeLayer: canvas.activeLayer || 'default',
                      viewState: canvas.viewState || {},
                      createdAt: canvas.createdAt || new Date().toISOString(),
                      updatedAt: canvas.updatedAt || new Date().toISOString()
                    };
                  };
                }

                // 确保_createEmptyCanvas方法存在
                if (typeof offlineStorageService._createEmptyCanvas !== 'function') {
                  console.log('添加_createEmptyCanvas兼容方法');
                  offlineStorageService._createEmptyCanvas = function(canvasId) {
                    // 防御性检查：确保canvasId不为null或undefined
                    const safeCanvasId = String(canvasId || Date.now().toString());
                    console.log(`兼容_createEmptyCanvas创建空画布: ${safeCanvasId}`);

                    const now = new Date().toISOString();

                    return {
                      id: safeCanvasId,
                      title: '新画布',
                      description: '',
                      elements: [],
                      layers: [{ id: 'default', name: '默认图层', visible: true, locked: false }],
                      activeLayer: 'default',
                      viewState: {},
                      createdAt: now,
                      updatedAt: now,
                      // 添加额外的元数据，以便于调试
                      isEmptyCanvas: true,
                      createdBy: 'App.js._createEmptyCanvas'
                    };
                  };
                }

                // 确保getCanvasById方法存在
                if (typeof offlineStorageService.getCanvasById !== 'function') {
                  console.log('添加getCanvasById兼容方法');
                  offlineStorageService.getCanvasById = async function(id) {
                    try {
                      console.log(`尝试通过ID获取画布: ${id || '未提供'}`);

                      // 防御性检查：确保id不为null或undefined
                      if (!id) {
                        console.warn('getCanvasById: id为null或undefined');
                        return null;
                      }

                      // 使用安全的参数值
                      const safeId = String(id || '');

                      const canvases = await this.getCanvases();

                      // 防御性检查：确保canvases是数组
                      if (!Array.isArray(canvases)) {
                        console.warn('getCanvasById: canvases不是数组');
                        return null;
                      }

                      // 防御性查找：确保每个canvas都有id属性
                      const canvas = canvases.find(c => c && c.id === safeId);

                      if (canvas) {
                        console.log(`成功找到画布: ${safeId}`);
                        return canvas;
                      } else {
                        console.log(`未找到画布: ${safeId}`);
                        return null;
                      }
                    } catch (error) {
                      console.error(`获取画布(ID: ${id || '未提供'})失败:`, error);
                      return null;
                    }
                  };
                }

                // 确保getCanvases方法存在
                if (typeof offlineStorageService.getCanvases !== 'function') {
                  console.log('添加getCanvases兼容方法');
                  offlineStorageService.getCanvases = async function() {
                    console.log('使用兼容的getCanvases方法');
                    try {
                      // 防御性检查：确保STORAGE_KEYS.CANVAS_CACHE不为undefined
                      const storageKey = STORAGE_KEYS.CANVAS_CACHE || 'zeroisle_canvas_cache';
                      console.log(`尝试从存储中获取画布，使用键: ${storageKey}`);

                      const canvasesJson = await realmStorageService.getItem(storageKey);

                      // 防御性检查：确保JSON解析不会失败
                      if (!canvasesJson) {
                        console.log('存储中没有找到画布数据，返回空数组');
                        return [];
                      }

                      try {
                        const canvases = JSON.parse(canvasesJson);

                        // 确保返回的是数组
                        if (!Array.isArray(canvases)) {
                          console.warn('解析的画布数据不是数组，返回空数组');
                          return [];
                        }

                        console.log(`成功获取${canvases.length}个画布`);
                        return canvases;
                      } catch (parseError) {
                        console.error('解析画布JSON数据失败:', parseError);
                        return [];
                      }
                    } catch (error) {
                      console.error('兼容getCanvases获取失败:', error);
                      return [];
                    }
                  };
                }
              } catch (methodError) {
                console.error('添加兼容方法失败:', methodError);
                // 继续执行，尝试初始化infiniteCanvasStorage
              }

              // 步骤3: 初始化infiniteCanvasStorage
              try {
                console.log('开始初始化infiniteCanvasStorage...');
                await infiniteCanvasStorage.initTables();
                console.log('infiniteCanvasStorage初始化完成');
              } catch (canvasStorageError) {
                console.error('infiniteCanvasStorage初始化失败:', canvasStorageError);
                // 继续执行，不阻塞应用启动
              }

              console.log('存储服务初始化完成');
            } catch (storageError) {
              console.error('存储服务初始化过程中发生错误，但应用将继续运行:', storageError);

              // 最后的紧急兼容措施
              try {
                console.log('添加紧急兼容方法...');

                if (typeof offlineStorageService._createEmptyCanvas !== 'function') {
                  console.log('添加紧急兼容的_createEmptyCanvas方法');
                  offlineStorageService._createEmptyCanvas = function(canvasId) {
                    // 防御性检查：确保canvasId不为null或undefined
                    const safeCanvasId = String(canvasId || Date.now().toString());
                    console.log(`紧急兼容_createEmptyCanvas创建空画布: ${safeCanvasId}`);

                    const now = new Date().toISOString();

                    return {
                      id: safeCanvasId,
                      title: '新画布',
                      description: '',
                      elements: [],
                      layers: [{ id: 'default', name: '默认图层', visible: true, locked: false }],
                      activeLayer: 'default',
                      viewState: {},
                      createdAt: now,
                      updatedAt: now,
                      // 添加额外的元数据，以便于调试
                      isEmptyCanvas: true,
                      createdBy: 'App.js.紧急兼容._createEmptyCanvas'
                    };
                  };
                }

                if (typeof offlineStorageService._ensureCanvasProperties !== 'function') {
                  console.log('添加紧急兼容的_ensureCanvasProperties方法');
                  offlineStorageService._ensureCanvasProperties = function(canvas) {
                    if (!canvas) return this._createEmptyCanvas(Date.now().toString());

                    return {
                      id: canvas.id,
                      title: canvas.title || '新画布',
                      description: canvas.description || '',
                      elements: canvas.elements || [],
                      layers: canvas.layers || [{ id: 'default', name: '默认图层', visible: true, locked: false }],
                      activeLayer: canvas.activeLayer || 'default',
                      viewState: canvas.viewState || {},
                      createdAt: canvas.createdAt || new Date().toISOString(),
                      updatedAt: canvas.updatedAt || new Date().toISOString(),
                      // 添加额外的元数据，以便于调试
                      ensuredBy: 'App.js.紧急兼容._ensureCanvasProperties'
                    };
                  };
                }

                if (typeof offlineStorageService.getCanvas !== 'function') {
                  console.log('添加紧急兼容的getCanvas方法');
                  offlineStorageService.getCanvas = async function(canvasId) {
                    // 防御性检查：确保canvasId不为null或undefined
                    const safeCanvasId = String(canvasId || Date.now().toString());
                    console.log(`紧急兼容getCanvas获取画布: ${safeCanvasId}`);

                    try {
                      // 尝试从AsyncStorage直接获取
                      const storageKey = STORAGE_KEYS.CANVAS_CACHE || 'zeroisle_canvas_cache';
                      const canvasesJson = await realmStorageService.getItem(storageKey);

                      if (canvasesJson) {
                        try {
                          const canvases = JSON.parse(canvasesJson);
                          if (Array.isArray(canvases)) {
                            const canvas = canvases.find(c => c && c.id === safeCanvasId);
                            if (canvas) {
                              console.log(`紧急兼容getCanvas找到画布: ${safeCanvasId}`);
                              return this._ensureCanvasProperties(canvas);
                            }
                          }
                        } catch (parseError) {
                          console.error('紧急兼容getCanvas解析JSON失败:', parseError);
                        }
                      }
                    } catch (storageError) {
                      console.error('紧急兼容getCanvas从存储获取失败:', storageError);
                    }

                    // 如果所有方法都失败，创建一个空画布
                    return this._createEmptyCanvas(safeCanvasId);
                  };
                }

                if (typeof offlineStorageService.getCanvasById !== 'function') {
                  console.log('添加紧急兼容的getCanvasById方法');
                  offlineStorageService.getCanvasById = async function(id) {
                    try {
                      console.log(`紧急兼容getCanvasById获取画布: ${id || '未提供'}`);

                      // 防御性检查：确保id不为null或undefined
                      if (!id) {
                        console.warn('紧急兼容getCanvasById: id为null或undefined');
                        return null;
                      }

                      // 使用安全的参数值
                      const safeId = String(id || '');

                      try {
                        // 尝试从AsyncStorage直接获取
                        const storageKey = STORAGE_KEYS.CANVAS_CACHE || 'zeroisle_canvas_cache';
                        const canvasesJson = await realmStorageService.getItem(storageKey);

                        if (canvasesJson) {
                          try {
                            const canvases = JSON.parse(canvasesJson);
                            if (Array.isArray(canvases)) {
                              const canvas = canvases.find(c => c && c.id === safeId);
                              if (canvas) {
                                console.log(`紧急兼容getCanvasById找到画布: ${safeId}`);
                                return canvas;
                              }
                            }
                          } catch (parseError) {
                            console.error('紧急兼容getCanvasById解析JSON失败:', parseError);
                          }
                        }
                      } catch (storageError) {
                        console.error('紧急兼容getCanvasById从存储获取失败:', storageError);
                      }

                      console.log(`紧急兼容getCanvasById未找到画布: ${safeId}`);
                      return null;
                    } catch (error) {
                      console.error(`紧急兼容getCanvasById错误:`, error);
                      return null;
                    }
                  };
                }

                if (typeof offlineStorageService.getCanvases !== 'function') {
                  console.log('添加紧急兼容的getCanvases方法');
                  offlineStorageService.getCanvases = async function() {
                    console.log('使用紧急兼容的getCanvases方法');
                    try {
                      // 防御性检查：确保STORAGE_KEYS.CANVAS_CACHE不为undefined
                      const storageKey = STORAGE_KEYS.CANVAS_CACHE || 'zeroisle_canvas_cache';
                      console.log(`紧急兼容getCanvases尝试从存储中获取画布，使用键: ${storageKey}`);

                      const canvasesJson = await realmStorageService.getItem(storageKey);

                      // 防御性检查：确保JSON解析不会失败
                      if (!canvasesJson) {
                        console.log('紧急兼容getCanvases存储中没有找到画布数据，返回空数组');
                        return [];
                      }

                      try {
                        const canvases = JSON.parse(canvasesJson);

                        // 确保返回的是数组
                        if (!Array.isArray(canvases)) {
                          console.warn('紧急兼容getCanvases解析的画布数据不是数组，返回空数组');
                          return [];
                        }

                        console.log(`紧急兼容getCanvases成功获取${canvases.length}个画布`);
                        return canvases;
                      } catch (parseError) {
                        console.error('紧急兼容getCanvases解析画布JSON数据失败:', parseError);
                        return [];
                      }
                    } catch (error) {
                      console.error('紧急兼容getCanvases获取失败:', error);
                      return [];
                    }
                  };
                }
              } catch (emergencyError) {
                console.error('添加紧急兼容方法失败:', emergencyError);
              }
            }

            resolve(true);
          } catch (error) {
            console.warn('离线数据服务初始化失败，但应用将继续运行:', error);
            resolve(false);
          }
        });
        initPromises.push(offlineDataPromise);

        // 初始化MongoDB数据库服务
        const mongoDBPromise = new Promise(async (resolve) => {
          try {
            console.log('正在初始化MongoDB数据库服务...');

            // 尝试初始化数据服务
            try {
              await dataService.initialize();
              console.log('MongoDB数据服务初始化成功');
              resolve(true);
            } catch (dataServiceError) {
              console.error('MongoDB数据服务初始化失败:', dataServiceError);
              resolve(false);
            }
          } catch (error) {
            console.warn('MongoDB数据库服务初始化失败，但应用将继续运行:', error);
            resolve(false);
          }
        });
        initPromises.push(mongoDBPromise);

        // 等待所有服务初始化完成
        // 不再使用超时机制，确保所有服务都必须初始化完成
        console.log('等待所有服务初始化完成...');
        try {
          await Promise.all(initPromises);
          console.log('所有服务初始化完成');
        } catch (initError) {
          console.error('服务初始化失败:', initError);
          // 显示错误提示
          Alert.alert(
            '初始化错误',
            '某些服务初始化失败，应用可能无法正常工作。请重启应用。',
            [{ text: '确定', style: 'cancel' }]
          );
        }

        console.log('所有服务初始化流程已完成');

        // 设置初始化完成状态
        setIsInitialized(true);
        setShowSplash(false);

        // 显示服务检查器
        setTimeout(() => {
          setShowServiceChecker(true);
        }, 500);
      } catch (error) {
        console.error('初始化服务失败:', error);
        // 即使出错也不抛出异常，避免阻塞应用启动

        // 设置初始化完成状态，即使出错也继续
        setIsInitialized(true);
        setShowSplash(false);

        // 显示服务检查器
        setTimeout(() => {
          setShowServiceChecker(true);
        }, 500);
      }
    };

    // 显示启动屏幕
    setShowSplash(true);

    // 使用setTimeout确保不会阻塞UI渲染
    const initTimeout = setTimeout(() => {
      initServices();
    }, 1000); // 延迟1000ms初始化，确保启动屏幕已显示

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

      // 关闭Realm数据库
      try {
        const { realmInitializer } = require('./services/database/realmInitializer');
        realmInitializer.close();
        console.log('Realm数据库已关闭');
      } catch (realmError) {
        console.error('关闭Realm数据库失败:', realmError);
      }

      // 关闭MongoDB数据库连接
      try {
        if (dataService && typeof dataService.disconnect === 'function') {
          dataService.disconnect();
          console.log('MongoDB数据库连接已关闭');
        }
      } catch (error) {
        console.error('关闭MongoDB数据库连接失败:', error);
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

  // 创建 Paper 主题
  const paperTheme = isDarkMode ? createPaperDarkTheme(theme) : createPaperLightTheme(theme);

  // 处理服务检查完成
  const handleServiceCheckComplete = (success) => {
    console.log('服务检查完成，结果:', success ? '成功' : '失败');
    setServicesInitialized(success);
    setShowServiceChecker(false);
    setIsLoading(false);
    setIsInitialized(true);
  };

  // 在初始化完成后显示服务检查器
  useEffect(() => {
    if (isInitialized && !showServiceChecker && !servicesInitialized) {
      console.log('显示服务检查器...');
      setShowServiceChecker(true);
    }
  }, [isInitialized, showServiceChecker, servicesInitialized]);

  // 如果正在显示服务检查器，则渲染服务检查器
  if (showServiceChecker) {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={theme.colors.background}
          translucent
        />
        <ServiceStatusChecker onComplete={handleServiceCheckComplete} />
      </View>
    );
  }

  // 如果正在显示启动屏幕，则渲染启动屏幕
  if (showSplash) {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={theme.colors.background}
          translucent
        />
        <SplashScreen
          message="应用初始化中..."
          onFinish={() => {
            console.log('启动屏幕动画完成');
            setShowSplash(false);
            setIsInitialized(true);
          }}
        />
      </View>
    );
  }

  // 正常渲染应用
  return (
    <PaperProvider theme={paperTheme}>
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
        fallback={<SplashScreen message="导航加载中..." />}
      >
        <AuthStateManager />
        <AppNavigator />
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
    console.error('应用错误边界捕获到错误:', error);
    console.error('错误详情:', errorInfo);
    
    // 记录更多错误信息
    if (error.message && error.message.includes('Malformed calls from JS: field sizes are different')) {
      console.error('检测到字段大小不匹配错误，可能是数据序列化问题');
      
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
      // 导入存储服务
      const { default: offlineStorageService } = require('./services/offline/offlineStorageService');
      
      // 清理最近的笔记缓存
      await offlineStorageService.setItem('recent_notes', '[]');
      console.log('已清理最近笔记缓存');
      
    } catch (error) {
      console.error('清理存储失败:', error);
    }
  }

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
      // 确保所有样式属性都是有效的数字或字符串
      const safeStyles = {
        container: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f0f0f0'
        },
        errorTitle: {
          fontSize: 18,
          color: 'red',
          marginBottom: 10
        },
        errorMessage: {
          fontSize: 14,
          color: '#333',
          textAlign: 'center',
          padding: 20
        },
        button: {
          backgroundColor: '#2196F3',
          paddingVertical: 10,
          paddingHorizontal: 20,
          borderRadius: 5,
          marginTop: 20
        },
        buttonText: {
          color: 'white',
          fontSize: 16
        }
      };
      
      return (
        <View style={safeStyles.container}>
          <Text style={safeStyles.errorTitle}>应用发生错误</Text>
          <Text style={safeStyles.errorMessage}>
            {this.state.error?.message || '未知错误'}
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
  console.log('显示启动屏幕...');
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
                  <FontSizeProvider>
                    <AccessibilityProvider>
                      <RealmProvider>
                        <GestureHandlerRootView style={{ flex: 1 }}>
                          <AppContainer />
                        </GestureHandlerRootView>
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