/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider } from 'react-redux';
import store from './redux/store';
import { ThemeProvider } from './context/ThemeContext';
import { storage } from './utils';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';

// 导入屏幕组件
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import HomeScreen from './screens/HomeScreen';
import NoteScreen from './screens/NoteScreen';
import ReminderScreen from './screens/ReminderScreen';
import SettingsScreen from './screens/SettingsScreen';

const Stack = createStackNavigator();

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await storage.get('token');
        const userData = await storage.get('user');
        if (token && userData) {
          setUser(userData);
        }
      } catch (error) {
        console.error('认证检查失败:', error);
      }
    };
    
    checkAuth();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <ThemeProvider>
          <PaperProvider>
            <NavigationContainer>
              <Stack.Navigator
                initialRouteName={user ? 'Home' : 'Login'}
                screenOptions={{
                  headerShown: false,
                }}
              >
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="Note" component={NoteScreen} />
                <Stack.Screen name="Reminder" component={ReminderScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </PaperProvider>
        </ThemeProvider>
      </Provider>
    </GestureHandlerRootView>
  );
};

export default App;
