/**
 * 现代化设置屏幕
 * 支持渐变背景和动画效果
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Switch,
  ScrollView,
  Animated,
  StatusBar,
  Platform
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { storage } from '../utils';
import { THEME, LANGUAGES } from '../config';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { SPACING, BORDER_RADIUS, SHADOW } from '../utils/constants/dimensions';
import { Button, Card } from '../components/common';

const SettingsScreen = ({ navigation }) => {
  const { colors, isDarkMode, theme, toggleTheme } = useTheme();
  const dispatch = useDispatch();
  const settings = useSelector(state => state.settings);

  // 状态管理
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 动画值
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // 渐变色
  const backgroundGradient = isDarkMode
    ? colors.gradients.header
    : ['#F8F9FA', '#E9ECEF'];

  // 处理动画效果
  useEffect(() => {
    // 设置状态栏
    StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('transparent');
      StatusBar.setTranslucent(true);
    }

    // 启动动画
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleThemeChange = async () => {
    toggleTheme();
  };

  const handleLanguageChange = async (language) => {
    await storage.set('language', language);
    dispatch({ type: 'CHANGE_LANGUAGE', payload: language });
  };

  const handleClearCache = async () => {
    try {
      await storage.remove('notes');
      await storage.remove('reminders');
      // 显示清除成功提示
    } catch (error) {
      console.error('清除缓存失败:', error);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);

    try {
      // 退出前的动画效果
      Animated.timing(fadeAnim, {
        toValue: 0.7,
        duration: 300,
        useNativeDriver: true,
      }).start();

      await storage.remove('token');
      await storage.remove('user');

      // 退出成功的动画效果
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.delay(300)
      ]).start(() => {
        setIsLoading(false);
        // 导航到登录页面
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      });
    } catch (error) {
      console.error('退出登录失败:', error);
      setIsLoading(false);

      // 退出失败的动画效果
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  // 显示退出确认对话框
  const confirmLogout = () => {
    setShowConfirmLogout(true);
  };

  return (
    <View style={styles.container}>
      {/* 渐变背景 */}
      <LinearGradient
        colors={backgroundGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* 设置内容 */}
      <Animated.View
        style={[
          styles.headerContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <Text style={styles.headerTitle}>设置</Text>
        <Text style={styles.headerSubtitle}>自定义您的应用体验</Text>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.settingsContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* 外观设置 */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialIcon name="palette" size={22} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                外观设置
              </Text>
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingLabelContainer}>
                <MaterialIcon name="dark-mode" size={20} color={colors.textSecondary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  深色模式
                </Text>
              </View>
              <Switch
                value={theme === THEME.DARK}
                onValueChange={handleThemeChange}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={theme === THEME.DARK ? colors.cardBackground : '#FFFFFF'}
                ios_backgroundColor={colors.border}
              />
            </View>
          </Card>

          {/* 语言设置 */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialIcon name="language" size={22} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                语言设置
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.settingItem,
                settings.language === LANGUAGES.ZH && styles.activeSettingItem
              ]}
              onPress={() => handleLanguageChange(LANGUAGES.ZH)}
            >
              <View style={styles.settingLabelContainer}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  简体中文
                </Text>
              </View>
              {settings.language === LANGUAGES.ZH && (
                <MaterialIcon name="check-circle" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={[
                styles.settingItem,
                settings.language === LANGUAGES.EN && styles.activeSettingItem
              ]}
              onPress={() => handleLanguageChange(LANGUAGES.EN)}
            >
              <View style={styles.settingLabelContainer}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  English
                </Text>
              </View>
              {settings.language === LANGUAGES.EN && (
                <MaterialIcon name="check-circle" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>
          </Card>

          {/* 其他设置 */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <MaterialIcon name="settings" size={22} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                其他设置
              </Text>
            </View>

            <TouchableOpacity
              style={styles.settingItem}
              onPress={handleClearCache}
            >
              <View style={styles.settingLabelContainer}>
                <MaterialIcon name="cleaning-services" size={20} color={colors.textSecondary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  清除缓存
                </Text>
              </View>
              <MaterialIcon name="chevron-right" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.settingItem}
              onPress={() => {}}
            >
              <View style={styles.settingLabelContainer}>
                <MaterialIcon name="info" size={20} color={colors.textSecondary} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  关于应用
                </Text>
              </View>
              <MaterialIcon name="chevron-right" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </Card>

          {/* 退出登录按钮 */}
          <Button
            title="退出登录"
            type="gradient"
            gradientType="error"
            rounded
            onPress={confirmLogout}
            style={styles.logoutButton}
          />

          {/* 版本信息 */}
          <Text style={[styles.versionText, { color: colors.textSecondary }]}>
            版本 1.0.0
          </Text>
        </Animated.View>
      </ScrollView>

      {/* 退出确认对话框 */}
      {showConfirmLogout && (
        <View style={styles.confirmOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setShowConfirmLogout(false)}
          />
          <Animated.View
            style={[
              styles.confirmDialog,
              { backgroundColor: colors.cardBackground }
            ]}
          >
            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              确认退出
            </Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              您确定要退出登录吗？
            </Text>
            <View style={styles.confirmButtons}>
              <Button
                title="取消"
                type="outline"
                rounded
                onPress={() => setShowConfirmLogout(false)}
                style={styles.confirmButton}
              />
              <Button
                title="确认"
                type="gradient"
                gradientType="error"
                rounded
                onPress={handleLogout}
                loading={isLoading}
                disabled={isLoading}
                style={styles.confirmButton}
              />
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // 基础容器样式
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.LARGE,
    paddingBottom: SPACING.XXLARGE,
  },
  settingsContainer: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },

  // 头部样式
  headerContainer: {
    width: '100%',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: SPACING.LARGE,
    paddingHorizontal: SPACING.LARGE,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: SPACING.SMALL,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.6)',
  },

  // 分区卡片样式
  sectionCard: {
    marginTop: SPACING.LARGE,
    padding: SPACING.MEDIUM,
    borderRadius: BORDER_RADIUS.LARGE,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.MEDIUM,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: SPACING.SMALL,
  },

  // 设置项样式
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.MEDIUM,
    paddingHorizontal: SPACING.SMALL,
    borderRadius: BORDER_RADIUS.MEDIUM,
  },
  activeSettingItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    marginLeft: SPACING.SMALL,
  },

  // 分隔线
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: SPACING.SMALL,
  },

  // 退出登录按钮
  logoutButton: {
    marginTop: SPACING.XLARGE,
    marginBottom: SPACING.MEDIUM,
  },

  // 版本信息
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    marginBottom: SPACING.LARGE,
  },

  // 确认对话框
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confirmDialog: {
    width: '80%',
    maxWidth: 400,
    borderRadius: BORDER_RADIUS.LARGE,
    padding: SPACING.LARGE,
    ...SHADOW.LARGE,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: SPACING.MEDIUM,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 16,
    marginBottom: SPACING.LARGE,
    textAlign: 'center',
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmButton: {
    flex: 1,
    marginHorizontal: SPACING.SMALL,
  },
});

export default SettingsScreen;