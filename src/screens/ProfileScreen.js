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

  // 获取默认头像
  const getDefaultAvatar = () => {
    // 默认头像列表，可以根据用户ID或用户名生成不同的默认头像
    const defaultAvatars = [
      require('../assets/images/default_avatar.png')
    ];

    // 如果用户已登录，根据用户ID选择一个默认头像
    if (user && user.id) {
      const avatarIndex = parseInt(user.id.toString().slice(-1)) % defaultAvatars.length;
      return defaultAvatars[avatarIndex];
    }

    // 未登录用户使用第一个默认头像
    return defaultAvatars[0];
  };

  // 渲染用户信息
  const renderUserInfo = () => {
    if (!user) {
      return (
        <View
          style={[
            styles.userInfoContainer,
            {
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: `${colors.border}80`,
            }
          ]}
        >
          <View style={styles.userInfoContent}>
            <View
              style={[
                styles.avatarContainer,
                {
                  backgroundColor: `${colors.primary}10`,
                  borderColor: `${colors.primary}30`,
                }
              ]}
            >
              <Image
                source={getDefaultAvatar()}
                style={styles.avatar}
                defaultSource={require('../assets/images/default_avatar.png')}
              />
            </View>
            <View style={styles.userTextContainer}>
              <Text
                variant="heading"
                level="h5"
                style={[styles.username, { color: colors.text }]}
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
            </View>
          </View>
          <GradientButton
            title="登录/注册"
            onPress={handleLogin}
            style={styles.loginButton}
            gradientType="primary"
            elevated={true}
          />
        </View>
      );
    }

    return (
      <View
        style={[
          styles.userInfoContainer,
          {
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: `${colors.border}80`,
          }
        ]}
      >
        <View style={styles.userInfoContent}>
          <TouchableOpacity
            style={[
              styles.avatarContainer,
              {
                backgroundColor: colors.background,
                borderColor: `${colors.primary}30`,
              }
            ]}
            onPress={() => navigation.navigate('ProfileSettings')}
            activeOpacity={0.8}
          >
            {user.avatar ? (
              // 用户上传的头像
              <Image
                source={{ uri: user.avatar }}
                style={styles.avatar}
              />
            ) : user.wechat_avatar ? (
              // 微信头像
              <Image
                source={{ uri: user.wechat_avatar }}
                style={styles.avatar}
              />
            ) : user.qq_avatar ? (
              // QQ头像
              <Image
                source={{ uri: user.qq_avatar }}
                style={styles.avatar}
              />
            ) : (
              // 默认头像
              <Image
                source={getDefaultAvatar()}
                style={styles.avatar}
                defaultSource={require('../assets/images/default_avatar.png')}
              />
            )}
            <View style={[
              styles.editAvatarBadge,
              {
                backgroundColor: colors.primary,
                borderColor: colors.card,
              }
            ]}>
              <Icon name="edit" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <View style={styles.userTextContainer}>
            <Text
              variant="heading"
              level="h5"
              style={[styles.username, { color: colors.text }]}
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
        </View>
      </View>
    );
  };

  // 渲染设置项
  const renderSettingItem = (icon, title, description, onPress) => {
    return (
      <TouchableOpacity
        style={[styles.settingItem, { backgroundColor: colors.card }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.settingContent}>
          <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}15` }]}>
            <Icon
              name={icon}
              size={18}
              color={colors.primary}
            />
          </View>
          <View style={styles.settingTextContainer}>
            <Text
              variant="body"
              size="medium"
              style={{ fontWeight: '600', fontSize: 16, marginBottom: 4 }}
            >
              {title}
            </Text>
            <Text
              variant="caption"
              color="textSecondary"
              style={{ fontSize: 13, lineHeight: 18 }}
            >
              {description}
            </Text>
          </View>
        </View>
        <Icon name="chevron-right" size={22} color={colors.textSecondary} style={{ opacity: 0.7 }} />
      </TouchableOpacity>
    );
  };

  // 渲染设置按钮
  const renderSettingsButton = () => {
    return (
      <TouchableOpacity
        style={[styles.settingsButton, { backgroundColor: colors.card }]}
        onPress={() => navigation.navigate('Settings')}
      >
        <Icon name="settings-outline" size={24} color={colors.primary} />
        <Text
          variant="body"
          size="medium"
          style={[styles.settingsButtonText, { color: colors.text }]}
        >
          设置
        </Text>
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: `${colors.primary}15`,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
            }}>
              <Icon name="person" size={20} color={colors.primary} />
            </View>
            <Text
              variant="heading"
              level="h4"
              style={styles.headerTitle}
            >
              个人中心
            </Text>
          </View>
        </View>

        {renderUserInfo()}

        <View style={styles.contentContainer}>
          {/* 主要功能区域 */}
          <View style={styles.mainFunctionsContainer}>
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
          </View>

          {/* 设置按钮 - 放在底部 */}
          <View style={styles.bottomSettingsContainer}>
            <TouchableOpacity
              style={[
                styles.settingsToggle,
                {
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: `${colors.primary}20`,
                }
              ]}
              onPress={toggleSettings}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[
                  styles.settingIcon,
                  {
                    backgroundColor: `${colors.primary}15`,
                    marginRight: 12,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                  }
                ]}>
                  <Icon
                    name="settings"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <Text
                  variant="body"
                  size="medium"
                  style={styles.settingsToggleText}
                >
                  {showSettings ? '隐藏设置选项' : '显示设置选项'}
                </Text>
              </View>
              <Icon
                name={showSettings ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                size={24}
                color={colors.primary}
              />
            </TouchableOpacity>

            {showSettings && (
              <View style={styles.settingsContainer}>
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
          </View>
        </View>
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
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  headerTitle: {
    marginLeft: 4,
    fontSize: 28,
    fontWeight: '700',
  },
  userInfoContainer: {
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 24,
    padding: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  userInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    position: 'relative',
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4361EE',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 6,
    shadowColor: '#4361EE',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  userTextContainer: {
    marginLeft: 24,
    flex: 1,
  },
  username: {
    marginBottom: 8,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  userDescription: {
    marginBottom: 12,
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.8,
  },
  loginButton: {
    marginTop: 24,
    width: '100%',
    height: 54,
    borderRadius: 27,
    elevation: 6,
    shadowColor: '#4361EE',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  // 内容容器
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  // 主要功能区域
  mainFunctionsContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  // 底部设置区域
  bottomSettingsContainer: {
    marginTop: 40,
  },
  // 设置切换按钮
  settingsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 24,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  settingsToggleText: {
    fontWeight: '600',
    fontSize: 18,
  },
  settingsContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 24,
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(67, 97, 238, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#4361EE',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  settingTextContainer: {
    flex: 1,
  },
  divider: {
    marginVertical: 24,
    height: 1,
    opacity: 0.1,
  },
  logoutButton: {
    marginTop: 32,
    marginBottom: 24,
    height: 54,
    borderRadius: 27,
    elevation: 6,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 24,
    marginHorizontal: 20,
    marginTop: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  settingsButtonText: {
    marginLeft: 12,
    fontWeight: '600',
    fontSize: 18,
  },
});

export default ProfileScreen;
