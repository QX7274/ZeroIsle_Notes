/**
 * 设置屏幕
 */
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { updateSettings } from '../../redux/slices/settingsSlice';
import { logout } from '../../redux/slices/authSlice';
import { DEFAULT_SETTINGS } from '../../utils/constants/config';
import { offlineStorageService } from '../../services/offline';
import DeviceInfo from 'react-native-device-info';
import { cacheService } from '../../services/cache/cacheService';

const SettingsScreen = ({ navigation }) => {
  const { theme, setTheme } = useTheme();
  const { colors, dimensions } = theme;
  const dispatch = useDispatch();

  // 从Redux获取设置
  const settings = useSelector(state => state.settings);
  const user = useSelector(state => state.auth.user);

  // 本地状态
  const [appVersion, setAppVersion] = useState('');
  const [offlineStatus, setOfflineStatus] = useState(offlineStorageService.getStatus());
  const [cacheSize, setCacheSize] = useState('0 MB');
  const [isCleaningCache, setIsCleaningCache] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  // 获取应用版本和缓存大小
  useEffect(() => {
    const getVersion = async () => {
      const version = await DeviceInfo.getVersion();
      const buildNumber = await DeviceInfo.getBuildNumber();
      setAppVersion(`${version} (${buildNumber})`);
    };

    const getCacheSize = async () => {
      try {
        const size = await cacheService.getCacheSize();
        // 转换为MB并保留1位小数
        const sizeInMB = (size / (1024 * 1024)).toFixed(1);
        setCacheSize(`${sizeInMB} MB`);
      } catch (error) {
        console.error('获取缓存大小失败:', error);
        setCacheSize('未知');
      }
    };

    getVersion();
    getCacheSize();
  }, []);

  // 监听离线存储服务状态变化
  useEffect(() => {
    const unsubscribe = offlineStorageService.addListener(event => {
      if (['connectionChange', 'offlineModeChange'].includes(event.type)) {
        setOfflineStatus(offlineStorageService.getStatus());
        // 当网络恢复时，同步本地存储的个人简介
        if (event.type === 'connectionChange' && !event.isOffline) {
          const localProfile = offlineStorageService.getLocalProfile();
          if (localProfile) {
            dispatch(updateSettings({ ...settings, profile: localProfile }));
            offlineStorageService.syncProfile(localProfile);
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // 更新设置
  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    dispatch(updateSettings(newSettings));

    // 特殊处理主题
    if (key === 'theme') {
      setTheme(value);
    }

    // 特殊处理离线模式
    if (key === 'offlineMode') {
      offlineStorageService.setOfflineMode(value);
    }

    // 处理个人简介离线编辑
    if (key === 'profile') {
      if (offlineStorageService.getStatus().isOffline) {
        // 离线状态下保存到本地存储
        offlineStorageService.saveLocalProfile(value);
      } else {
        // 在线状态下同步到云端
        offlineStorageService.syncProfile(value);
      }
    }
  };

  // 处理清理缓存
  const handleClearCache = async () => {
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
  };

  // 处理检查更新
  const handleCheckUpdate = async () => {
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
      Alert.alert('错误', '检查更新时发生错误，请稍后重试');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // 处理重置设置
  const handleResetSettings = () => {
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
            setTheme(DEFAULT_SETTINGS.theme);
            offlineStorageService.setOfflineMode(DEFAULT_SETTINGS.offlineMode);
          },
          style: 'destructive',
        },
      ]
    );
  };

  // 处理退出登录
  const handleLogout = () => {
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
  };

  // 获取图标颜色
  const getIconColor = (iconName) => {
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
  };

  // 获取图标样式 - 所有图标使用相同的基础样式
  const getIconStyle = () => {
    return styles.iconContainer;
  };

  // 渲染设置项
  const renderSettingItem = ({ icon, title, description, onPress, value, type = 'navigate' }) => {
    // 创建动画值
    const [scaleAnim] = useState(new Animated.Value(1));

    // 处理按下效果
    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.97,
        friction: 5,
        tension: 300,
        useNativeDriver: true,
      }).start();
    };

    // 处理释放效果
    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 400,
        useNativeDriver: true,
      }).start();
    };

    // 获取图标颜色
    const iconColor = getIconColor(icon);

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
          }
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
            }
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
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
                  onPress={() => navigation.navigate('Profile')}
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
                  onPress: () => navigation.navigate('BindPhone'),
                  type: 'navigate',
                })}

                {renderSettingItem({
                  icon: 'email',
                  title: '邮箱绑定',
                  description: user.email ? `已绑定: ${user.email}` : '未绑定',
                  onPress: () => navigation.navigate('BindEmail'),
                  type: 'navigate',
                })}

                {renderSettingItem({
                  icon: 'wechat',
                  title: '微信绑定',
                  description: user.wechat_openid ? '已绑定' : '未绑定',
                  onPress: () => navigation.navigate('BindWechat'),
                  type: 'navigate',
                })}

                {renderSettingItem({
                  icon: 'chat',
                  title: 'QQ绑定',
                  description: user.qq_openid ? '已绑定' : '未绑定',
                  onPress: () => navigation.navigate('BindQQ'),
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
                onPress={() => navigation.navigate('Login')}
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
              onPress: () => navigation.navigate('ThemeSettings'),
              type: 'navigate',
            })}

            {renderSettingItem({
              icon: 'format-size',
              title: '字体大小',
              description: settings.fontSize === 'small' ? '小' :
                          settings.fontSize === 'medium' ? '中' : '大',
              onPress: () => navigation.navigate('FontSettings'),
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
              onPress: () => navigation.navigate('OfflineData'),
              type: 'navigate',
            })}

            {renderSettingItem({
              icon: 'save',
              title: '自动保存',
              description: '编辑笔记时自动保存',
              onPress: (value) => updateSetting('autoSave', value),
              value: settings.autoSave,
              type: 'switch',
            })}

            {renderSettingItem({
              icon: 'sync',
              title: '数据同步',
              description: '管理云端数据同步',
              onPress: () => navigation.navigate('SyncSettings'),
              type: 'navigate',
            })}

            {renderSettingItem({
              icon: 'backup',
              title: '备份与恢复',
              description: '管理笔记备份',
              onPress: () => navigation.navigate('BackupRestore'),
              type: 'navigate',
            })}

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
              onPress: () => navigation.navigate('NotificationSettings'),
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
              onPress: () => navigation.navigate('About'),
              type: 'navigate',
            })}

            {renderSettingItem({
              icon: 'help',
              title: '帮助与反馈',
              onPress: () => navigation.navigate('Help'),
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
              backgroundColor: pressed ? colors.error + '30' : colors.error + '15',
              transform: [{ scale: pressed ? 0.98 : 1 }],
            }
          ]}
          onPress={handleResetSettings}
          android_ripple={{ color: colors.error + '20', borderless: false }}
        >
          <Icon name="restore" size={24} color={colors.error} />
          <Text
            variant="body"
            size="medium"
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
    padding: 18,
    borderRadius: 16,
    marginBottom: 40,
    marginTop: 20,
    marginHorizontal: 20,
    elevation: 4,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.2)',
  },
  resetButtonText: {
    marginLeft: 12,
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});

export default SettingsScreen;
