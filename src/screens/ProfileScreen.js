/**
 * 个人中心主页
 * 显示用户头像、用户名和设置选项
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ToastAndroid,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from '../components/common/Typography';
import { GradientButton, Divider } from '../components/common';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from '../utils/haptics';
import userApi from '../services/api/userApi';
import { getProfile, updateProfile, logout } from '../store/slices/authSlice';

const ProfileScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  const [isLoading, setIsLoading] = useState(false);

  // 处理登录
  const handleLogin = () => {
    navigation.navigate('Auth', { screen: 'Login' });
  };

  // 加载用户资料
  useEffect(() => {
    if (user) {
      // 如果已经登录，刷新用户资料
      dispatch(getProfile());
    }
  }, [dispatch]);

  // 处理退出登录
  const handleLogout = () => {
    Alert.alert(
      '确认退出',
      '确定要退出登录吗？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.mediumFeedback();
              setIsLoading(true);

              // 调用登出操作
              await dispatch(logout()).unwrap();

              // 显示成功提示
              ToastAndroid.show('已成功退出登录', ToastAndroid.SHORT);

              setIsLoading(false);
            } catch (error) {
              setIsLoading(false);
              Alert.alert('错误', error.message || '退出登录失败');
            }
          },
        },
      ]
    );
  };

  // 渲染用户信息
  const renderUserInfo = () => {
    if (!user) {
      return (
        <View style={styles.userInfoContainer}>
          <View style={[styles.avatarContainer, { backgroundColor: colors.card }]}>
            <Icon name="person" size={60} color={colors.primary} />
          </View>
          <Text
            variant="heading"
            level="h5"
            style={styles.username}
          >
            未登录
          </Text>
          <Text
            variant="body"
            size="medium"
            color="textSecondary"
            style={styles.userDescription}
          >
            登录后可以同步数据和使用更多功能
          </Text>
          <GradientButton
            title="登录/注册"
            onPress={handleLogin}
            style={styles.loginButton}
          />
        </View>
      );
    }

    return (
      <View style={styles.userInfoContainer}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={() => navigation.navigate('ProfileSettings')}
        >
          {user.avatar ? (
            <Image
              source={{ uri: user.avatar }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.defaultAvatar, { backgroundColor: colors.card }]}>
              <Icon name="person" size={60} color={colors.primary} />
            </View>
          )}
        </TouchableOpacity>
        <Text
          variant="heading"
          level="h5"
          style={styles.username}
        >
          {user.username || '未设置用户名'}
        </Text>
        <Text
          variant="body"
          size="medium"
          color="textSecondary"
          style={styles.userDescription}
        >
          {user.bio || '这个人很懒，什么都没有留下...'}
        </Text>
      </View>
    );
  };

  // 渲染设置项
  const renderSettingItem = (icon, title, description, onPress) => {
    return (
      <TouchableOpacity
        style={[styles.settingItem, { backgroundColor: colors.card }]}
        onPress={onPress}
      >
        <View style={styles.settingContent}>
          <Icon
            name={icon}
            size={24}
            color={colors.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text
              variant="body"
              size="medium"
            >
              {title}
            </Text>
            <Text
              variant="caption"
              color="textSecondary"
            >
              {description}
            </Text>
          </View>
        </View>
        <Icon name="chevron-right" size={24} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  // 控制设置项的显示
  const [showSettings, setShowSettings] = useState(false);

  // 切换设置项显示状态
  const toggleSettings = () => {
    Haptics.lightFeedback();
    setShowSettings(!showSettings);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text
            variant="heading"
            level="h4"
            style={styles.headerTitle}
          >
            个人中心
          </Text>
        </View>

        {renderUserInfo()}

        {/* 设置按钮 */}
        <TouchableOpacity
          style={[styles.settingsToggle, { backgroundColor: colors.card }]}
          onPress={toggleSettings}
        >
          <Text
            variant="body"
            size="medium"
            style={styles.settingsToggleText}
          >
            {showSettings ? '隐藏设置' : '显示设置'}
          </Text>
          <Icon
            name={showSettings ? "keyboard-arrow-up" : "keyboard-arrow-down"}
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>

        {showSettings && (
          <View style={styles.settingsContainer}>
            {user && (
              <>
                {renderSettingItem(
                  'account-circle',
                  '个人资料',
                  '修改头像、用户名和个人简介',
                  () => navigation.navigate('ProfileSettings')
                )}

                {renderSettingItem(
                  'phone',
                  '手机绑定',
                  '绑定手机号码增强账号安全性',
                  () => navigation.navigate('BindPhone')
                )}

                {renderSettingItem(
                  'email',
                  '邮箱绑定',
                  '绑定邮箱便于找回密码',
                  () => navigation.navigate('BindEmail')
                )}
              </>
            )}

            {renderSettingItem(
              'color-lens',
              '主题设置',
              '自定义应用主题和外观',
              () => navigation.navigate('ThemeSettings')
            )}

            <Divider style={styles.divider} />

            {renderSettingItem(
              'help',
              '帮助与反馈',
              '获取帮助或提交反馈',
              () => Alert.alert('提示', '该功能正在开发中')
            )}

            {renderSettingItem(
              'info',
              '关于应用',
              '查看应用版本和信息',
              () => Alert.alert('关于应用', '零屿笔记 v1.0.0\n一款简洁高效的笔记应用')
            )}

            {user && (
              <GradientButton
                title="退出登录"
                onPress={handleLogout}
                type="error"
                style={styles.logoutButton}
                loading={isLoading}
              />
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    marginLeft: 8,
  },
  userInfoContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  defaultAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    marginBottom: 8,
  },
  userDescription: {
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  loginButton: {
    marginTop: 16,
    width: '80%',
  },
  // 设置切换按钮
  settingsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  settingsToggleText: {
    fontWeight: '500',
  },
  settingsContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
  divider: {
    marginVertical: 16,
  },
  logoutButton: {
    marginTop: 24,
    marginBottom: 16,
  },
});

export default ProfileScreen;
