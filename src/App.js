/**
 * 应用入口
 * 集成了Redux状态管理、主题管理、可访问性和导航等基础功能
 */
import React, { useEffect } from 'react';
import { StatusBar, Platform, LogBox } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store/index';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';

// 导入导航
import AppNavigator from './navigation/AppNavigator';
import { navigationRef, processNavigationQueue } from './navigation/navigationRef';

// 导入上下文提供者
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AccessibilityProvider } from './context/AccessibilityContext';

// 导入服务
import { offlineStorageService } from './services/offlineStorage';
import { analyticsService } from './services/analytics';

// 忽略特定的警告
LogBox.ignoreLogs([
  'ViewPropTypes will be removed',
  'ColorPropType will be removed',
]);

// 主应用容器
const AppContainer = () => {
  const { theme, isDarkMode } = useTheme();

  // 初始化服务
  useEffect(() => {
    const initServices = async () => {
      try {
        console.log('正在初始化服务...');

        // 初始化分析服务
        await analyticsService.init();
        console.log('分析服务初始化完成');

        // 初始化离线存储服务
        const offlineInitResult = await offlineStorageService.init();
        console.log('离线存储服务初始化' + (offlineInitResult ? '成功' : '失败'));

        // 记录应用启动事件
        analyticsService.trackEvent('app_launched', {
          timestamp: new Date().toISOString(),
          platform: Platform.OS,
          version: Platform.Version,
        });
      } catch (error) {
        console.error('初始化服务失败:', error);
      }
    };

    initServices();
  }, []);

  // 监听主题变化，更新状态栏
  useEffect(() => {
    StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(theme.colors.background);
      StatusBar.setTranslucent(true);
    }

    // 处理导航队列
    processNavigationQueue();
  }, [isDarkMode, theme]);

  return (
    <PaperProvider theme={theme}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
        translucent
      />
      <NavigationContainer ref={navigationRef}>
        <AppNavigator />
      </NavigationContainer>
    </PaperProvider>
  );
};

// 应用入口
const App = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <SafeAreaProvider>
            <ThemeProvider>
              <AccessibilityProvider>
                <AppContainer />
              </AccessibilityProvider>
            </ThemeProvider>
          </SafeAreaProvider>
        </PersistGate>
      </Provider>
    </GestureHandlerRootView>
  );
};

export default App;