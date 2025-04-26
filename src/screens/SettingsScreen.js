import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Animated
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useDispatch, useSelector } from 'react-redux';
import { storage } from '../utils';
import { THEME, LANGUAGES } from '../config';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Text } from '../components/common/Typography';
import { GradientButton } from '../components/common';
import * as Haptics from '../utils/haptics';
import * as Animations from '../utils/animations';

const SettingsScreen = ({ navigation }) => {
  const {
    colors,
    theme,
    isDarkMode,
    themeType,
    themeStyle,
    toggleTheme
  } = useTheme();
  const { getAccessibilityProps, isReduceMotionEnabled } = useAccessibility();
  const dispatch = useDispatch();
  const settings = useSelector(state => state.settings);

  // 动画值
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(20));

  // 启动进入动画
  useEffect(() => {
    if (!isReduceMotionEnabled) {
      Animations.fadeIn(fadeAnim, 1, 500);
      Animations.slideIn(slideAnim, 20, 0, 500);
    } else {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
    }
  }, []);

  const handleThemeChange = async () => {
    Haptics.mediumFeedback();
    toggleTheme();
  };

  const handleThemeSettings = () => {
    Haptics.lightFeedback();
    navigation.navigate('ThemeSettings');
  };

  const handleLanguageChange = async (language) => {
    Haptics.selectionFeedback();
    await storage.set('language', language);
    dispatch({ type: 'CHANGE_LANGUAGE', payload: language });
  };

  const handleClearCache = async () => {
    Haptics.warningFeedback();
    try {
      await storage.remove('notes');
      await storage.remove('reminders');
      // 显示清除成功提示
    } catch (error) {
      console.error('清除缓存失败:', error);
    }
  };

  const handleLogout = async () => {
    Haptics.heavyFeedback();
    try {
      await storage.remove('token');
      await storage.remove('user');
      // 导航到登录页面
    } catch (error) {
      console.error('退出登录失败:', error);
    }
  };

  return (
    <Animated.View
      style={[
        styles.animatedContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text
            variant="h2"
            size="large"
            style={styles.headerTitle}
          >
            设置
          </Text>
          <Text
            variant="body"
            size="medium"
            color="textSecondary"
            style={styles.headerDescription}
          >
            自定义应用的外观和行为
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="palette" size={20} color={colors.primary} />
            <Text
              variant="h3"
              size="medium"
              style={styles.sectionTitle}
            >
              外观设置
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: colors.card }]}
            onPress={handleThemeSettings}
            {...getAccessibilityProps(
              '主题设置',
              '打开主题设置页面',
              true
            )}
          >
            <View style={styles.settingContent}>
              <Icon
                name="color-lens"
                size={24}
                color={colors.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text
                  variant="body"
                  size="medium"
                >
                  主题设置
                </Text>
                <Text
                  variant="caption"
                  color="textSecondary"
                >
                  {themeStyle === 'modern' ? '现代风格' : '经典风格'} · {themeType === 'system' ? '跟随系统' : (isDarkMode ? '深色' : '浅色')}
                </Text>
              </View>
            </View>
            <Icon name="chevron-right" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.settingItem, { backgroundColor: colors.card }]}>
            <View style={styles.settingContent}>
              <Icon
                name="nightlight-round"
                size={24}
                color={colors.primary}
                style={styles.settingIcon}
              />
              <Text
                variant="body"
                size="medium"
              >
                深色模式
              </Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={handleThemeChange}
              trackColor={{ false: colors.border, true: colors.primary + '80' }}
              thumbColor={isDarkMode ? colors.primary : '#f4f3f4'}
              ios_backgroundColor="#767577"
              {...getAccessibilityProps(
                '切换深色模式',
                isDarkMode ? '关闭深色模式' : '开启深色模式',
                true
              )}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="language" size={20} color={colors.primary} />
            <Text
              variant="h3"
              size="medium"
              style={styles.sectionTitle}
            >
              语言设置
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: colors.card }]}
            onPress={() => handleLanguageChange(LANGUAGES.ZH)}
            {...getAccessibilityProps(
              '选择简体中文',
              '将应用语言设置为简体中文',
              true,
              settings.language === LANGUAGES.ZH
            )}
          >
            <View style={styles.settingContent}>
              <Icon
                name="translate"
                size={24}
                color={colors.primary}
                style={styles.settingIcon}
              />
              <Text
                variant="body"
                size="medium"
              >
                简体中文
              </Text>
            </View>
            {settings.language === LANGUAGES.ZH && (
              <Icon name="check" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: colors.card }]}
            onPress={() => handleLanguageChange(LANGUAGES.EN)}
            {...getAccessibilityProps(
              '选择英文',
              '将应用语言设置为英文',
              true,
              settings.language === LANGUAGES.EN
            )}
          >
            <View style={styles.settingContent}>
              <Icon
                name="translate"
                size={24}
                color={colors.primary}
                style={styles.settingIcon}
              />
              <Text
                variant="body"
                size="medium"
              >
                English
              </Text>
            </View>
            {settings.language === LANGUAGES.EN && (
              <Icon name="check" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="settings" size={20} color={colors.primary} />
            <Text
              variant="h3"
              size="medium"
              style={styles.sectionTitle}
            >
              其他设置
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: colors.card }]}
            onPress={handleClearCache}
            {...getAccessibilityProps(
              '清除缓存',
              '清除应用缓存数据',
              true
            )}
          >
            <View style={styles.settingContent}>
              <Icon
                name="delete-outline"
                size={24}
                color={colors.error}
                style={styles.settingIcon}
              />
              <Text
                variant="body"
                size="medium"
              >
                清除缓存
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.buttonContainer}>
          <GradientButton
            title="退出登录"
            onPress={handleLogout}
            type="error"
            style={styles.logoutButton}
            {...getAccessibilityProps(
              '退出登录',
              '退出当前账号',
              true
            )}
          />
        </View>
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  animatedContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    marginBottom: 8,
  },
  headerDescription: {
    marginBottom: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    marginLeft: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    // 阴影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 16,
  },
  settingTextContainer: {
    flex: 1,
  },
  buttonContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  logoutButton: {
    minWidth: 200,
  },
});

export default SettingsScreen;