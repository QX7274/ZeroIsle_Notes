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
  Linking,
  Animated,
  Pressable,
  InteractionManager,
  Modal,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from '../../components/common/Typography';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { updateSettings } from '../../redux/slices/settingsSlice';
import { logout } from '../../redux/slices/authSlice';
import { DEFAULT_SETTINGS } from '../../utils/constants/config';
import DeviceInfo from 'react-native-device-info';
import { cacheService } from '../../services/cache/cacheService';
import networkErrorService from '../../services/networkErrorService';
import { navigationRef } from '../../navigation/navigationRef';
import { CommonActions } from '@react-navigation/native';
import { showToast } from '../../components/common/ToastHelper';

const SettingItem = React.memo(({ icon, title, description, onPress, value, type = 'navigate', colors, getIconColor }) => {
  const scaleAnim = useMemo(() => new Animated.Value(1), []);
  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      friction: 5,
      tension: 300,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);
  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 400,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);
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
      <Animated.View style={{ transform: [{ scale: scaleAnim }], flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <View style={[styles.settingIcon, { backgroundColor: iconColor + '15' }]}>
          <Icon name={icon} size={24} color={iconColor} />
        </View>
        <View style={styles.settingInfo}>
          <Text variant="body" size="medium" bold>{title}</Text>
          {description ? <Text variant="caption" color="hint">{description}</Text> : null}
        </View>
        {type === 'navigate' ? <Icon name="chevron-right" size={24} color={colors.text} /> : null}
        {type === 'switch' ? (
          <Switch
            value={value}
            onValueChange={onPress}
            trackColor={{ false: colors.border, true: iconColor + '80' }}
            thumbColor={value ? iconColor : colors.card}
            ios_backgroundColor={colors.border}
            style={{ transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }] }}
          />
        ) : null}
        {type === 'value' ? <Text variant="body" size="small" color="hint">{value}</Text> : null}
      </Animated.View>
    </Pressable>
  );
});
SettingItem.displayName = 'SettingItem';

const SettingsScreen = ({ navigation }) => {
  const { theme, setThemeType } = useTheme();
  const { colors } = theme;
  const dispatch = useDispatch();
  const settings = useSelector((state) => state.settings);
  const user = useSelector((state) => state.auth.user);
  const [appVersion, setAppVersion] = useState('');
  const [cacheSize, setCacheSize] = useState('0 MB');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [dialogState, setDialogState] = useState({
    visible: false,
    title: '',
    message: '',
    primaryText: '知道了',
    secondaryText: '',
    primaryVariant: 'primary',
    onPrimaryPress: null,
    onSecondaryPress: null,
  });

  useEffect(() => {
    const loadData = async () => {
      await InteractionManager.runAfterInteractions();
      try {
        const version = await DeviceInfo.getVersion();
        const buildNumber = await DeviceInfo.getBuildNumber();
        setAppVersion(`${version} (${buildNumber})`);
      } catch {}
      try {
        const size = await cacheService.getCacheSize();
        setCacheSize(`${(size / (1024 * 1024)).toFixed(1)} MB`);
      } catch {
        setCacheSize('未知');
      }
    };
    loadData();
  }, []);

  const updateSetting = useCallback((key, value) => {
    dispatch(updateSettings({ ...settings, [key]: value }));
    if (key === 'theme') setThemeType(value);
  }, [dispatch, settings, setThemeType]);

  const closeDialog = useCallback(() => {
    setDialogState((current) => ({
      ...current,
      visible: false,
      onPrimaryPress: null,
      onSecondaryPress: null,
    }));
  }, []);

  const openDialog = useCallback(({
    title,
    message,
    primaryText = '知道了',
    secondaryText = '',
    primaryVariant = 'primary',
    onPrimaryPress = null,
    onSecondaryPress = null,
  }) => {
    setDialogState({
      visible: true,
      title,
      message,
      primaryText,
      secondaryText,
      primaryVariant,
      onPrimaryPress,
      onSecondaryPress,
    });
  }, []);

  const handleDialogPrimaryPress = useCallback(async () => {
    const action = dialogState.onPrimaryPress;
    closeDialog();
    if (action) {
      await action();
    }
  }, [closeDialog, dialogState.onPrimaryPress]);

  const handleDialogSecondaryPress = useCallback(async () => {
    const action = dialogState.onSecondaryPress;
    closeDialog();
    if (action) {
      await action();
    }
  }, [closeDialog, dialogState.onSecondaryPress]);

  const navigateTo = useCallback((name) => navigation.navigate(name), [navigation]);
  const handleLoginEntryPress = useCallback(() => {
    if (__DEV__) {
      showToast.info('当前为开发联调模式，登录入口已跳过');
      return;
    }

    let navigator = navigation;
    while (navigator?.getParent?.()) {
      navigator = navigator.getParent();
    }

    if (navigator?.dispatch) {
      navigator.dispatch(
        CommonActions.navigate({
          name: 'Auth',
        })
      );
      return;
    }

    if (navigationRef.current?.dispatch) {
      navigationRef.current.dispatch(
        CommonActions.navigate({
          name: 'Auth',
        })
      );
      return;
    }

    showToast.warning('登录入口暂时不可用，请稍后重试');
  }, [navigation]);
  const handleAutoSaveToggle = useCallback((value) => updateSetting('autoSave', value), [updateSetting]);

  const handleClearCache = useCallback(async () => {
    openDialog({
      title: '清理缓存',
      message: '确定要清理应用缓存吗？不会影响笔记数据。',
      primaryText: '清理',
      secondaryText: '取消',
      onPrimaryPress: async () => {
        const ok = await cacheService.clearCache();
        if (ok) {
          const size = await cacheService.getCacheSize();
          setCacheSize(`${(size / (1024 * 1024)).toFixed(1)} MB`);
          showToast.success('缓存已清理');
        } else {
          showToast.error('清理缓存失败，请稍后重试');
        }
      },
    });
  }, [openDialog]);

  const handleCheckUpdate = useCallback(async () => {
    setIsCheckingUpdate(true);
    try {
      const info = await cacheService.checkForUpdates();
      if (info.hasUpdate) {
        openDialog({
          title: '发现新版本',
          message: `检测到新版本 ${info.version}，是否前往更新？`,
          primaryText: '前往更新',
          secondaryText: '稍后再说',
          onPrimaryPress: async () => {
            try {
              await Linking.openURL(info.url);
            } catch (openError) {
              showToast.error('更新链接暂时无法打开，请稍后重试');
            }
          },
        });
      } else {
        openDialog({
          title: '检查更新',
          message: '当前已是最新版本。',
        });
      }
    } catch (error) {
      if (networkErrorService.isNetworkError(error)) {
        networkErrorService.handleApiError(error, { context: '检查更新', customMessage: '网络异常，无法检查更新' });
      } else {
        showToast.error('检查更新失败，请稍后重试');
      }
    } finally {
      setIsCheckingUpdate(false);
    }
  }, [openDialog]);

  const handleResetSettings = useCallback(() => {
    openDialog({
      title: '重置设置',
      message: '确定将所有设置恢复为默认值吗？',
      primaryText: '重置',
      secondaryText: '取消',
      primaryVariant: 'danger',
      onPrimaryPress: async () => {
          dispatch(updateSettings(DEFAULT_SETTINGS));
          setThemeType(DEFAULT_SETTINGS.theme);
          showToast.success('设置已恢复默认值');
      },
    });
  }, [dispatch, openDialog, setThemeType]);

  const handleLogout = useCallback(() => {
    openDialog({
      title: '退出登录',
      message: '确定退出当前账号吗？',
      primaryText: '退出登录',
      secondaryText: '取消',
      primaryVariant: 'danger',
      onPrimaryPress: async () => {
        dispatch(logout());
        showToast.info('已退出当前账号');
      },
    });
  }, [dispatch, openDialog]);

  const getIconColor = useCallback((iconName) => {
    const map = {
      'phone-android': '#4CAF50', email: '#2196F3', wechat: '#09BB07', chat: '#12B7F5', logout: '#F44336', person: '#9C27B0',
      palette: '#673AB7', 'format-size': '#3F51B5', 'cloud-off': '#FF9800', save: '#00BCD4', sync: '#3F51B5',
      'cleaning-services': '#607D8B', notifications: '#E91E63', info: '#795548', help: '#009688', 'new-releases': '#FF5722', 'system-update': '#4CAF50',
    };
    return map[iconName] || colors.primary;
  }, [colors.primary]);

  const renderSettingItem = useCallback((props) => <SettingItem {...props} colors={colors} getIconColor={getIconColor} />, [colors, getIconColor]);

  return (
    <View style={[styles.container, { backgroundColor: '#F3F8FF' }]} testID="state.settings.main.state.ready">
      <View testID="state.settings.main.visibility.visible" />
      <View testID={`state.settings.main.dialog.visibility.${dialogState.visible ? 'visible' : 'hidden'}`} />

      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <ScreenHeaderBackButton
          onPress={() => navigation.goBack()}
          testID="action.settings.main.back"
          style={styles.backButton}
        />
        <Text variant="heading" level="h5" style={styles.headerTitle}>应用设置</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} testID="list.settings.main.sections">
        <View style={styles.section}>
          <Text variant="heading" level="h6" style={styles.sectionTitle}>账户</Text>
          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            {user ? (
              <>
                <TouchableOpacity style={styles.profileItem} onPress={() => navigateTo('Profile')} testID="entry.settings.main.profile">
                  <View style={styles.profileInfo}>
                    <Text variant="heading" level="h6">{user.username || '未设置用户名'}</Text>
                    <Text variant="caption" color="hint">{user.email || '未设置邮箱'}</Text>
                  </View>
                  <Icon name="chevron-right" size={24} color={colors.text} />
                </TouchableOpacity>
                {renderSettingItem({ icon: 'phone-android', title: '手机绑定', description: user.phone ? `已绑定 ${user.phone}` : '未绑定', onPress: () => navigateTo('BindPhone') })}
                {renderSettingItem({ icon: 'email', title: '邮箱绑定', description: user.email ? `已绑定 ${user.email}` : '未绑定', onPress: () => navigateTo('BindEmail') })}
                {renderSettingItem({ icon: 'wechat', title: '微信绑定', description: user.wechat_openid ? '已绑定' : '未绑定', onPress: () => navigateTo('BindWechat') })}
                {renderSettingItem({ icon: 'chat', title: 'QQ绑定', description: user.qq_openid ? '已绑定' : '未绑定', onPress: () => navigateTo('BindQQ') })}
                {renderSettingItem({ icon: 'logout', title: '退出登录', description: '退出当前账号', onPress: handleLogout })}
              </>
            ) : (
              <TouchableOpacity style={styles.profileItem} onPress={handleLoginEntryPress} testID="entry.settings.main.login">
                <View style={styles.profileInfo}>
                  <Text variant="heading" level="h6">未登录</Text>
                  <Text variant="caption" color="hint">点击登录或注册</Text>
                </View>
                <Icon name="chevron-right" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="heading" level="h6" style={styles.sectionTitle}>外观</Text>
          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            {renderSettingItem({ icon: 'palette', title: '主题', description: settings.theme === 'light' ? '浅色' : settings.theme === 'dark' ? '深色' : '跟随系统', onPress: () => navigateTo('ThemeSettings') })}
            {renderSettingItem({ icon: 'format-size', title: '字体大小', description: settings.fontSize === 'small' ? '小' : settings.fontSize === 'medium' ? '中' : '大', onPress: () => navigateTo('FontSettings') })}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="heading" level="h6" style={styles.sectionTitle}>数据</Text>
          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            {renderSettingItem({ icon: 'cloud-off', title: '离线模式', description: settings.offlineMode ? '已启用' : '已禁用', onPress: () => navigateTo('OfflineData') })}
            {renderSettingItem({ icon: 'save', title: '自动保存', description: '编辑笔记时自动保存', onPress: handleAutoSaveToggle, value: settings.autoSave, type: 'switch' })}
            {renderSettingItem({ icon: 'sync', title: '数据同步', description: '管理云端数据同步', onPress: () => navigateTo('SyncSettings') })}
            {renderSettingItem({ icon: 'cleaning-services', title: '清理缓存', description: `当前缓存大小: ${cacheSize}`, onPress: handleClearCache })}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="heading" level="h6" style={styles.sectionTitle}>通知</Text>
          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            {renderSettingItem({ icon: 'notifications', title: '通知', description: settings.notificationEnabled ? '已启用' : '已禁用', onPress: () => navigateTo('NotificationSettings') })}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="heading" level="h6" style={styles.sectionTitle}>智能</Text>
          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            {renderSettingItem({ icon: 'assistant', title: 'AI 助手设置', description: '配置 AI 引擎与密钥', onPress: () => navigateTo('AIAssistantSettings') })}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="heading" level="h6" style={styles.sectionTitle}>关于</Text>
          <View style={[styles.sectionContent, { backgroundColor: colors.card }]}>
            {renderSettingItem({ icon: 'info', title: '关于 ZeroIsle Notes', onPress: () => navigateTo('About') })}
            {renderSettingItem({ icon: 'help', title: '帮助与反馈', onPress: () => navigateTo('Help') })}
            {renderSettingItem({ icon: 'new-releases', title: '版本', value: appVersion, onPress: () => {}, type: 'value' })}
            {renderSettingItem({ icon: 'system-update', title: '检查更新', description: isCheckingUpdate ? '正在检查...' : '检查是否有新版本可用', onPress: handleCheckUpdate })}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.resetButton, { backgroundColor: pressed ? colors.error + '20' : 'transparent', borderColor: colors.error + '40' }]}
          onPress={handleResetSettings}
          android_ripple={{ color: colors.error + '15', borderless: false }}
          testID="action.settings.main.resetAll"
        >
          <Icon name="restore" size={20} color={colors.error} />
          <Text variant="body" size="small" color="error" style={styles.resetButtonText}>重置所有设置</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={dialogState.visible}
        transparent
        animationType="fade"
        onRequestClose={closeDialog}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <View style={[
              styles.dialogIconWrap,
              dialogState.primaryVariant === 'danger' ? styles.dialogIconWrapDanger : null,
            ]}>
              <Icon
                name={dialogState.primaryVariant === 'danger' ? 'warning-amber' : 'info-outline'}
                size={28}
                color={dialogState.primaryVariant === 'danger' ? '#DC2626' : '#1D4ED8'}
              />
            </View>
            <Text style={styles.dialogTitle}>{dialogState.title}</Text>
            <Text style={styles.dialogMessage}>{dialogState.message}</Text>
            <View style={styles.dialogButtonRow}>
              {dialogState.secondaryText ? (
                <TouchableOpacity
                  style={styles.dialogSecondaryButton}
                  onPress={handleDialogSecondaryPress}
                  testID="action.settings.main.dialog.secondary"
                >
                  <Text style={styles.dialogSecondaryText}>{dialogState.secondaryText}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.dialogPrimaryButton,
                  dialogState.primaryVariant === 'danger' ? styles.dialogPrimaryButtonDanger : null,
                ]}
                onPress={handleDialogPrimaryPress}
                testID="action.settings.main.dialog.primary"
              >
                <Text style={styles.dialogPrimaryText}>{dialogState.primaryText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, paddingTop: 16, borderBottomWidth: 1,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
  },
  backButton: { width: 40, height: 40, marginLeft: -2 },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: '600', fontSize: 18 },
  headerRight: { width: 40 },
  content: { flex: 1, padding: 20 },
  section: { marginBottom: 30 },
  sectionTitle: { marginBottom: 12, marginLeft: 12, fontSize: 18, fontWeight: '700' },
  sectionContent: {
    borderRadius: 16, overflow: 'hidden', elevation: 5, shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6,
    borderWidth: 1, borderColor: 'rgba(76,141,255,0.10)',
  },
  profileItem: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  profileInfo: { flex: 1 },
  settingItem: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  settingIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: 20, borderRadius: 10 },
  settingInfo: { flex: 1 },
  resetButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, marginBottom: 40, marginTop: 12, marginHorizontal: 60, borderWidth: 1.5,
  },
  resetButtonText: { marginLeft: 8, fontWeight: '500', fontSize: 14, letterSpacing: 0.3 },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(76,141,255,0.18)',
    shadowColor: '#4B8CFF',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 6,
  },
  dialogIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: 'rgba(29,78,216,0.10)',
  },
  dialogIconWrapDanger: {
    backgroundColor: 'rgba(220,38,38,0.10)',
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#102A43',
  },
  dialogMessage: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: '#486581',
  },
  dialogButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  dialogSecondaryButton: {
    minWidth: 92,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginRight: 10,
    backgroundColor: 'rgba(148,163,184,0.14)',
  },
  dialogSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  dialogPrimaryButton: {
    minWidth: 110,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#1D4ED8',
  },
  dialogPrimaryButtonDanger: {
    backgroundColor: '#DC2626',
  },
  dialogPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default SettingsScreen;
