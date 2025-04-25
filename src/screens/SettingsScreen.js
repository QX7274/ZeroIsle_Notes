import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Switch,
  ScrollView
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { storage } from '../utils';
import { THEME, LANGUAGES } from '../config';
import Icon from 'react-native-vector-icons/Ionicons';

const SettingsScreen = () => {
  const { colors, theme, toggleTheme } = useTheme();
  const dispatch = useDispatch();
  const settings = useSelector(state => state.settings);

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
    try {
      await storage.remove('token');
      await storage.remove('user');
      // 导航到登录页面
    } catch (error) {
      console.error('退出登录失败:', error);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          外观设置
        </Text>
        <View style={[styles.settingItem, { backgroundColor: colors.card }]}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>
            深色模式
          </Text>
          <Switch
            value={theme === THEME.DARK}
            onValueChange={handleThemeChange}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          语言设置
        </Text>
        <View style={[styles.settingItem, { backgroundColor: colors.card }]}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>
            简体中文
          </Text>
          <TouchableOpacity
            onPress={() => handleLanguageChange(LANGUAGES.ZH)}
            style={styles.languageButton}
          >
            <Icon
              name={settings.language === LANGUAGES.ZH ? 'checkmark' : 'chevron-forward'}
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
        <View style={[styles.settingItem, { backgroundColor: colors.card }]}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>
            English
          </Text>
          <TouchableOpacity
            onPress={() => handleLanguageChange(LANGUAGES.EN)}
            style={styles.languageButton}
          >
            <Icon
              name={settings.language === LANGUAGES.EN ? 'checkmark' : 'chevron-forward'}
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          其他设置
        </Text>
        <TouchableOpacity
          style={[styles.settingItem, { backgroundColor: colors.card }]}
          onPress={handleClearCache}
        >
          <Text style={[styles.settingLabel, { color: colors.text }]}>
            清除缓存
          </Text>
          <Icon name="trash-outline" size={24} color={colors.notification} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.logoutButton, { backgroundColor: colors.notification }]}
        onPress={handleLogout}
      >
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  contentContainer: {
    padding: 16
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 2
  },
  settingLabel: {
    fontSize: 16
  },
  languageButton: {
    padding: 4
  },
  logoutButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold'
  }
});

export default SettingsScreen;