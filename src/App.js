/**
 * 应用入口
 * 集成了Redux状态管理、主题管理、可访问性和导航等基础功能
 */
import React, { useEffect } from 'react';
import { StatusBar, Platform, LogBox } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';

// 导入导航
import AppNavigator from './navigation/AppNavigator';
import { navigationRef, processNavigationQueue } from './navigation/navigationRef';

// 导入上下文提供者
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AccessibilityProvider } from './context/AccessibilityContext';

// 忽略特定的警告
LogBox.ignoreLogs([
  'ViewPropTypes will be removed',
  'ColorPropType will be removed',
]);

// 主应用容器
const AppContainer = () => {
  const { theme, isDarkMode } = useTheme();

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
      <AppNavigator />
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