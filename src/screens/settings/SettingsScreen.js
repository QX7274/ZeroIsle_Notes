/**
 * 设置屏幕
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  Animated,
  Pressable,
  InteractionManager,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { updateSettings } from '../../redux/slices/settingsSlice';
import { logout } from '../../redux/slices/authSlice';
import { DEFAULT_SETTINGS } from '../../utils/constants/config';
// 已移除 offlineStorageService 导入，现在直接使用 realmService
import DeviceInfo from 'react-native-device-info';
import { cacheService } from '../../services/cache/cacheService';
import networkErrorService from '../../services/networkErrorService';

// 优化的设置项组件 - 使用 React.memo 避免不必要的重渲染
const SettingItem = React.memo(({ icon, title, description, onPress, value, type = 'navigate', colors, getIconColor }) => {
  // 创建动画值 - 只在组件首次挂载时创建
  const scaleAnim = useMemo(() => new Animated.Value(1), []);

  // 处理按下效果
  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      friction: 5,
      tension: 300,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  // 处理释放效果
  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 400,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  // 获取图标颜色
  const iconColor = useMemo(() => getIconColor(icon), [icon, getIconColor]);

  return (
    <Pressable
      onPress={type !== 'switch' ? onPress : undefined}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={type === 'switch'}
      style={({ pressed }) => [
        styles.settingItem,
        {
          backgroundColor: pressed ? colors.card + '80' : colors.card,
          borderLeftWidth: 3,
          borderLeftColor: pressed ? iconColor : 'transparent',
        },
      ]}
    >
      <Animated.View style={{
        transform: [{ scale: scaleAnim }],
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
      }}>
        <View style={[
          styles.settingIcon,
          {
            backgroundColor: iconColor + '15',
          },
        ]}>
          <Icon name={icon} size={24} color={iconColor} />
        </View>

        <View style={styles.settingInfo}>
          <Text
            variant="body"
            size="medium"
            bold
          >
            {title}
          </Text>

          {description && (
            <Text
              variant="caption"
              color="hint"
            >
              {description}
            </Text>
          )}
        </View>

        {type === 'navigate' && (
          <Icon name="chevron-right" size={24} color={colors.text} />
        )}

        {type === 'switch' && (
          <Switch
            value={value}
            onValueChange={onPress}
            trackColor={{ false: colors.border, true: iconColor + '80' }}
            thumbColor={value ? iconColor : colors.card}
            ios_backgroundColor={colors.border}
            style={{ transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }] }}
          />
        )}

        {type === 'value' && (
          <Text
            variant="body"
            size="small"
            color="hint"
          >
            {value}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
});

SettingItem.displayName = 'SettingItem';

const SettingsScreen = ({ navigation }) => {
  const { theme, setThemeType } = useTheme();
  const { colors, dimensions } = theme;
  const dispatch = useDispatch();

  // 从Redux获取设置
  const settings = useSelector(state => state.settings);
  const user = useSelector(state => state.auth.user);

  // 本地状态
  const [appVersion, setAppVersion] = useState('');
  const [offlineStatus, setOfflineStatus] = useState({ isOnline: true, isOfflineMode: false });
  const [cacheSize, setCacheSize] = useState('0 MB');
  const [isCleaningCache, setIsCleaningCache] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  // 获取应用版本和缓存大小 - 使用 InteractionManager 延迟加载
  useEffect(() => {
    const loadDataAfterInteraction = async () => {
      // 等待导航动画完成后再加载数据
      await InteractionManager.runAfterInteractions();

      // 获取应用版本
      try {
        const version = await DeviceInfo.getVersion();
        const buildNumber = await DeviceInfo.getBuildNumber();
        setAppVersion(`${version} (${buildNumber})`);
      } catch (error) {
        console.error('获取版本号失败:', error);
      }

      // 获取缓存大小
      try {
        const size = await cacheService.getCacheSize();
        const sizeInMB = (size / (1024 * 1024)).toFixed(1);
        setCacheSize(`${sizeInMB} MB`);
      } catch (error) {
        console.error('获取缓存大小失败:', error);
        setCacheSize('未知');
      }
    };

    loadDataAfterInteraction();
  }, []);

  // 监听离线存储服务状态变化
  useEffect(() => {
    // 已移除 offlineStorageService 监听器，现在直接使用简化状态
    const unsubscribe = () => {}; // 空函数，保持接口兼容

    return () => unsubscribe();
  }, []);

  // 更新设置 - 使用 useCallback 优化
  const updateSetting = useCallback((key, value) => {
    const newSettings = { ...settings, [key]: value };
    dispatch(updateSettings(newSettings));

    // 特殊处理主题
    if (key === 'theme') {
      setThemeType(value);
    }

    // 特殊处理离线模式
    if (key === 'offlineMode') {
      // 已移除 offlineStorageService 调用，现在直接使用简化状态
      console.log('离线模式设置:', value);
    }

    // 处理个人简介离线编辑
    if (key === 'profile') {
      // 已移除 offlineStorageService 调用，现在直接使用简化状态
      console.log('配置文件保存:', value);
    }
  }, [settings, dispatch, setThemeType]);

  // 优化导航回调 - 使用 useCallback 避免每次渲染创建新函数
  const navigateToProfile = useCallback(() => navigation.navigate('Profile'), [navigation]);
  const navigateToBindPhone = useCallback(() => navigation.navigate('BindPhone'), [navigation]);
  const navigateToBindEmail = useCallback(() => navigation.navigate('BindEmail'), [navigation]);
  const navigateToBindWechat = useCallback(() => navigation.navigate('BindWechat'), [navigation]);
  const navigateToBindQQ = useCallback(() => navigation.navigate('BindQQ'), [navigation]);
  const navigateToThemeSettings = useCallback(() => navigation.navigate('ThemeSettings'), [navigation]);
  const navigateToFontSettings = useCallback(() => navigation.navigate('FontSettings'), [navigation]);
  const navigateToOfflineData = useCallback(() => navigation.navigate('OfflineData'), [navigation]);
  const navigateToSyncSettings = useCallback(() => navigation.navigate('SyncSettings'), [navigation]);
  const navigateToNotificationSettings = useCallback(() => navigation.navigate('NotificationSettings'), [navigation]);
  const navigateToAbout = useCallback(() => navigation.navigate('About'), [navigation]);
  const navigateToHelp = useCallback(() => navigation.navigate('Help'), [navigation]);
  const navigateToLogin = useCallback(() => navigation.navigate('Login'), [navigation]);

  // 优化自动保存回调
  const handleAutoSaveToggle = useCallback((value) => updateSetting('autoSave', value), [updateSetting]);

  // 渲染设置项 - 使用优化后的 SettingItem 组件
  const renderSettingItem = useCallback((props) => {
    return <SettingItem {...props} colors={colors} getIconColor={getIconColor} />;
  }, [colors, getIconColor]);

  // 处理清理缓存 - 使用 useCallback 优化
  const handleClearCache = useCallback(async () => {
    Alert.alert(
      '清理缓存',
      '确定要清理应用缓存吗？这将删除临时文件和图片缓存，但不会影响您的笔记数据。',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '清理',
          onPress: async () => {
            setIsCleaningCache(true);
            try {
              const success = await cacheService.clearCache();
              if (success) {
                // 更新缓存大小显示
                const size = await cacheService.getCacheSize();
                const sizeInMB = (size / (1024 * 1024)).toFixed(1);
                setCacheSize(`${sizeInMB} MB`);
                Alert.alert('成功', '缓存已清理');
              } else {
                Alert.alert('失败', '清理缓存失败，请稍后重试');
              }
            } catch (error) {
              console.error('清理缓存出错:', error);
              Alert.alert('错误', '清理缓存时发生错误');
            } finally {
              setIsCleaningCache(false);
            }
          },
        },
      ]
    );
  }, [cacheSize]);

  // 处理检查更新 - 使用 useCallback 优化
  const handleCheckUpdate = useCallback(async () => {
    setIsCheckingUpdate(true);
    try {
      const updateInfo = await cacheService.checkForUpdates();

      if (updateInfo.hasUpdate) {
        Alert.alert(
          '发现新版本',
          `有新版本可用: ${updateInfo.version}\n是否立即更新？`,
          [
            {
              text: '取消',
              style: 'cancel',
            },
            {
              text: '更新',
              onPress: () => {
                Linking.openURL(updateInfo.url);
              },
            },
          ]
        );
      } else {
        Alert.alert('检查更新', '您当前使用的已经是最新版本');
      }
    } catch (error) {
      console.error('检查更新出错:', error);

      // 使用网络错误服务处理错误
      if (networkErrorService.isNetworkError(error)) {
        networkErrorService.handleApiError(error, {
          context: '检查更新',
          customMessage: '网络连接失败，无法检查更新',
        });
      } else {
        Alert.alert('错误', '检查更新时发生错误，请稍后重试');
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);

  // 处理重置设置 - 使用 useCallback 优化
  const handleResetSettings = useCallback(() => {
    Alert.alert(
      '重置设置',
      '确定要将所有设置恢复为默认值吗？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '重置',
          onPress: () => {
            dispatch(updateSettings(DEFAULT_SETTINGS));
            setThemeType(DEFAULT_SETTINGS.theme);
            // 已移除 offlineStorageService 调用，现在直接使用简化状态
            console.log('重置离线模式设置');
          },
          style: 'destructive',
        },
      ]
    );
  }, [dispatch, setThemeType, settings]);

  // 处理退出登录 - 使用 useCallback 优化
  const handleLogout = useCallback(() => {
    Alert.alert(
      '退出登录',
      '确定要退出当前账号吗？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '退出',
          onPress: () => {
            dispatch(logout());
            // 退出登录后，导航会自动切换到登录页面
            Alert.alert('提示', '已成功退出登录');
          },
          style: 'destructive',
        },
      ]
    );
  }, [dispatch]);

  // 获取图标颜色 - 使用 useCallback 优化
  const getIconColor = useCallback((iconName) => {
    // 为不同类型的图标设置不同的颜色
    switch (iconName) {
      // 账户相关
      case 'phone-android': return '#4CAF50'; // 绿色
      case 'email': return '#2196F3'; // 蓝色
      case 'wechat': return '#09BB07'; // 微信绿
      case 'chat': return '#12B7F5'; // QQ蓝
      case 'logout': return '#F44336'; // 红色
      case 'person': return '#9C27B0'; // 紫色

      // 外观相关
      case 'palette': return '#673AB7'; // 深紫色
      case 'format-size': return '#3F51B5'; // 靛蓝色

      // 数据相关
      case 'cloud-off': return '#FF9800'; // 橙色
      case 'save': return '#00BCD4'; // 青色
      case 'backup': return '#3F51B5'; // 靛蓝色
      case 'cleaning-services': return '#607D8B'; // 蓝灰色

      // 通知相关
      case 'notifications': return '#E91E63'; // 粉红色

      // 关于相关
      case 'info': return '#795548'; // 棕色
      case 'help': return '#009688'; // 蓝绿色
      case 'new-releases': return '#FF5722'; // 深橙色
      case 'system-update': return '#4CAF50'; // 绿色

      // 默认颜色
      default: return colors.primary;
    }
  }, [colors.primary]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 顶部导航栏 */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.primary + '15' }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text
          variant="heading"
          level="h5"
          style={styles.headerTitle}
        >
          应用设置
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* 账户设置 */}
        <View style={styles.section}>
          <Text
            variant="heading"
            level="h6"
            style={styles.sectionTitle}
          >
            账户
          </Text>

          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            {user ? (
              <>
                <TouchableOpacity
                  style={styles.profileItem}
                  onPress={navigateToProfile}
                >
                  <View style={styles.profileInfo}>
                    <Text
                      variant="heading"
                      level="h6"
                    >
                      {user.username || '未设置用户名'}
                    </Text>
                    <Text
                      variant="caption"
                      color="hint"
                    >
                      {user.email || '未设置邮箱'}
                    </Text>
                  </View>

                  <Icon name="chevron-right" size={24} color={colors.text} />
                </TouchableOpacity>

                {/* 账号绑定选项 */}
                {renderSettingItem({
                  icon: 'phone-android',
                  title: '手机绑定',
                  description: user.phone ? `已绑定: ${user.phone}` : '未绑定',
                  onPress: navigateToBindPhone,
                  type: 'navigate',
                })}

                {renderSettingItem({
                  icon: 'email',
                  title: '邮箱绑定',
                  description: user.email ? `已绑定: ${user.email}` : '未绑定',
                  onPress: navigateToBindEmail,
                  type: 'navigate',
                })}

                {renderSettingItem({
                  icon: 'wechat',
                  title: '微信绑定',
                  description: user.wechat_openid ? '已绑定' : '未绑定',
                  onPress: navigateToBindWechat,
                  type: 'navigate',
                })}

                {renderSettingItem({
                  icon: 'chat',
                  title: 'QQ绑定',
                  description: user.qq_openid ? '已绑定' : '未绑定',
                  onPress: navigateToBindQQ,
                  type: 'navigate',
                })}

                {/* 退出登录按钮 */}
                {renderSettingItem({
                  icon: 'logout',
                  title: '退出登录',
                  description: '退出当前账号',
                  onPress: handleLogout,
                  type: 'navigate',
                })}
              </>
            ) : (
              <TouchableOpacity
                style={styles.profileItem}
                onPress={navigateToLogin}
              >
                <View style={styles.profileInfo}>
                  <Text
                    variant="heading"
                    level="h6"
                  >
                    未登录
                  </Text>
                  <Text
                    variant="caption"
                    color="hint"
                  >
                    点击登录或注册
                  </Text>
                </View>

                <Icon name="chevron-right" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 外观设置 */}
        <View style={styles.section}>
          <Text
            variant="heading"
            level="h6"
            style={styles.sectionTitle}
          >
            外观
          </Text>

          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            {renderSettingItem({
              icon: 'palette',
              title: '主题',
              description: settings.theme === 'light' ? '浅色' :
                          settings.theme === 'dark' ? '深色' : '跟随系统',
              onPress: navigateToThemeSettings,
              type: 'navigate',
            })}

            {renderSettingItem({
              icon: 'format-size',
              title: '字体大小',
              description: settings.fontSize === 'small' ? '小' :
                          settings.fontSize === 'medium' ? '中' : '大',
              onPress: navigateToFontSettings,
              type: 'navigate',
            })}
          </View>
        </View>

        {/* 数据设置 */}
        <View style={styles.section}>
          <Text
            variant="heading"
            level="h6"
            style={styles.sectionTitle}
          >
            数据
          </Text>

          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            {renderSettingItem({
              icon: 'cloud-off',
              title: '离线模式',
              description: settings.offlineMode ? '已启用' : '已禁用',
              onPress: navigateToOfflineData,
              type: 'navigate',
            })}

            {renderSettingItem({
              icon: 'save',
              title: '自动保存',
              description: '编辑笔记时自动保存',
              onPress: handleAutoSaveToggle,
              value: settings.autoSave,
              type: 'switch',
            })}

            {renderSettingItem({
              icon: 'sync',
              title: '数据同步',
              description: '管理云端数据同步',
              onPress: navigateToSyncSettings,
              type: 'navigate',
            })}

            {/* 备份与恢复功能已移除 */}

            {renderSettingItem({
              icon: 'cleaning-services',
              title: '清理缓存',
              description: `当前缓存大小: ${cacheSize}`,
              onPress: handleClearCache,
              type: 'navigate',
            })}
          </View>
        </View>

        {/* 通知设置 */}
        <View style={styles.section}>
          <Text
            variant="heading"
            level="h6"
            style={styles.sectionTitle}
          >
            通知
          </Text>

          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            {renderSettingItem({
              icon: 'notifications',
              title: '通知',
              description: settings.notificationEnabled ? '已启用' : '已禁用',
              onPress: navigateToNotificationSettings,
              type: 'navigate',
            })}
          </View>
        </View>

        {/* 关于 */}
        <View style={styles.section}>
          <Text
            variant="heading"
            level="h6"
            style={styles.sectionTitle}
          >
            关于
          </Text>

          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            {renderSettingItem({
              icon: 'info',
              title: '关于零屿笔记',
              onPress: navigateToAbout,
              type: 'navigate',
            })}

            {renderSettingItem({
              icon: 'help',
              title: '帮助与反馈',
              onPress: navigateToHelp,
              type: 'navigate',
            })}

            {renderSettingItem({
              icon: 'new-releases',
              title: '版本',
              value: appVersion,
              onPress: () => {},
              type: 'value',
            })}

            {renderSettingItem({
              icon: 'system-update',
              title: '检查更新',
              description: isCheckingUpdate ? '正在检查...' : '检查是否有新版本可用',
              onPress: handleCheckUpdate,
              type: 'navigate',
            })}
          </View>
        </View>

        {/* 重置设置 */}
        <Pressable
          style={({ pressed }) => [
            styles.resetButton,
            {
              backgroundColor: pressed ? colors.error + '20' : 'transparent',
              borderColor: colors.error + '40',
            },
          ]}
          onPress={handleResetSettings}
          android_ripple={{ color: colors.error + '15', borderless: false }}
        >
          <Icon name="restore" size={20} color={colors.error} />
          <Text
            variant="body"
            size="small"
            color="error"
            style={styles.resetButtonText}
          >
            重置所有设置
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 24,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 18,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    marginBottom: 12,
    marginLeft: 12,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionContent: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  profileInfo: {
    flex: 1,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  settingIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    borderRadius: 10,
  },
  // 基础图标容器样式
  iconContainer: {
    // 保留一个空的样式对象，以便代码结构保持一致
  },
  settingInfo: {
    flex: 1,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 40,
    marginTop: 12,
    marginHorizontal: 60,
    borderWidth: 1.5,
  },
  resetButtonText: {
    marginLeft: 8,
    fontWeight: '500',
    fontSize: 14,
    letterSpacing: 0.3,
  },
});

export default SettingsScreen;
