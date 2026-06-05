/**
 * 通知设置屏幕
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { updateSettings } from '../../redux/slices/settingsSlice';
import {
  checkNotificationPermission as checkNotificationPermissionUtil,
  requestNotificationPermission,
} from '../../utils/permissions';
import { BORDER, ELEVATION, RADIUS, SIZE, SPACING } from '../../theme/tokens';

const NotificationSettingsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const colors = theme.colors || theme;
  const dispatch = useDispatch();
  const settings = useSelector((state) => state.settings || {});

  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const pageState = isLoading ? 'busy' : 'ready';

  // 兼容旧字段 notifications 与新字段 notificationEnabled
  const masterEnabled = useMemo(() => {
    if (typeof settings.notificationEnabled === 'boolean') {
      return settings.notificationEnabled;
    }
    if (typeof settings.notifications === 'boolean') {
      return settings.notifications;
    }
    return false;
  }, [settings.notificationEnabled, settings.notifications]);

  useEffect(() => {
    loadNotificationPermission();
  }, []);

  const loadNotificationPermission = async () => {
    try {
      const permission = await checkNotificationPermissionUtil();
      setHasPermission(permission);
    } catch (error) {
      console.error('检查通知权限失败:', error);
      setHasPermission(false);
    }
  };

  const setSettingsPatch = (patch) => {
    dispatch(updateSettings(patch));
  };

  const updateNotificationSetting = (key, value) => {
    if ((key === 'notificationEnabled' || key === 'notifications') && value && !hasPermission) {
      requestPermission();
      return;
    }

    if (key === 'notificationEnabled' || key === 'notifications') {
      setSettingsPatch({ notificationEnabled: value, notifications: value });
      return;
    }

    setSettingsPatch({ [key]: value });
  };

  const requestPermission = async () => {
    setIsLoading(true);
    try {
      const permission = await requestNotificationPermission(5000);
      setHasPermission(permission);

      if (permission) {
        updateNotificationSetting('notificationEnabled', true);
      } else {
        Alert.alert('通知权限', '无法获取通知权限，请在系统设置中手动开启。', [
          { text: '稍后再说', style: 'cancel' },
          {
            text: '去设置',
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            },
          },
        ]);
      }
    } catch (error) {
      console.error('请求通知权限失败:', error);
      Alert.alert('错误', '请求通知权限失败，请稍后重试。');
    } finally {
      setIsLoading(false);
    }
  };

  const baseDisabled = !hasPermission || !masterEnabled;

  const renderSwitchItem = ({ icon, title, description, key, disabled = false }) => (
    <View style={[styles.settingItem, { borderBottomColor: colors.border || '#D4E5FF' }]}>
      <View style={styles.settingInfo}>
        <View style={styles.settingHeader}>
          <Icon name={icon} size={SIZE.icon.sm} color={disabled ? colors.textSecondary : colors.text} />
          <Text style={[styles.settingTitle, { color: disabled ? colors.textSecondary : colors.text }]}>
            {title}
          </Text>
        </View>
        <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
          {description}
        </Text>
      </View>
      <Switch
        value={settings[key] ?? false}
        onValueChange={(value) => updateNotificationSetting(key, value)}
        trackColor={{ false: '#C9DDFB', true: '#7CB2FF' }}
        thumbColor={(settings[key] ?? false) ? '#1D4ED8' : '#F7FAFF'}
        disabled={disabled}
      />
    </View>
  );

  const renderPriorityItem = (value, icon, label, color) => (
    <TouchableOpacity
      style={[styles.priorityItem, { borderBottomColor: colors.border || '#D4E5FF' }]}
      onPress={() => updateNotificationSetting('notificationPriority', value)}
      disabled={baseDisabled}
      testID={`action.settings.notification.priority.${value}`}
    >
      <View style={styles.priorityInfo}>
        <Icon name={icon} size={SIZE.icon.sm} color={color} />
        <Text style={[styles.priorityText, { color: baseDisabled ? colors.textSecondary : colors.text }]}>
          {label}
        </Text>
      </View>
      <View style={styles.priorityCheck}>
        {settings.notificationPriority === value ? (
          <Icon name="check" size={SIZE.icon.sm} color={colors.primary || '#1D4ED8'} />
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container} testID={`state.settings.notification.state.${pageState}`}>
      <View testID="state.settings.notification.visibility.visible" />
      <View testID={`state.settings.notification.permission.visibility.${hasPermission ? 'granted' : 'denied'}`} />
      <View testID={`state.settings.notification.requestBusy.visibility.${isLoading ? 'visible' : 'hidden'}`} />
      <View testID={`state.settings.notification.masterSwitch.${masterEnabled ? 'on' : 'off'}`} />
      <View testID={`state.settings.notification.priority.${settings.notificationPriority || 'unknown'}`} />

      <ScrollView style={styles.content} testID="list.settings.notification.sections">
        <View style={[styles.card, styles.permissionCard]}>
          <View style={styles.permissionHeader}>
            <Icon
              name={hasPermission ? 'notifications-active' : 'notifications-off'}
              size={SIZE.icon.md}
              color={hasPermission ? '#16A34A' : '#DC2626'}
            />
            <Text style={[styles.permissionTitle, { color: colors.text }]}>
              {hasPermission ? '通知权限已启用' : '通知权限未启用'}
            </Text>
          </View>
          <Text style={[styles.permissionDescription, { color: colors.textSecondary }]}>
            {hasPermission
              ? '系统已允许应用发送通知。你可以按需配置提醒类型与优先级。'
              : '请先授予系统通知权限，否则将无法接收提醒、同步和更新通知。'}
          </Text>
          {!hasPermission ? (
            <TouchableOpacity
              style={[styles.permissionButton, { backgroundColor: colors.primary || '#1D4ED8' }]}
              onPress={requestPermission}
              disabled={isLoading}
              testID="action.settings.notification.requestPermission"
            >
              <Text style={styles.permissionButtonText}>{isLoading ? '请求中...' : '授权通知权限'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>通知类型</Text>
        <View style={styles.card}>
          {renderSwitchItem({
            icon: 'notifications',
            title: '启用通知',
            description: '统一控制应用通知总开关。',
            key: 'notificationEnabled',
            disabled: !hasPermission,
          })}
          {renderSwitchItem({
            icon: 'event-note',
            title: '提醒通知',
            description: '接收日程与待办提醒。',
            key: 'reminderNotification',
            disabled: baseDisabled,
          })}
          {renderSwitchItem({
            icon: 'sync',
            title: '同步通知',
            description: '接收同步成功或失败状态提醒。',
            key: 'syncNotification',
            disabled: baseDisabled,
          })}
          {renderSwitchItem({
            icon: 'forum',
            title: '社区通知',
            description: '接收评论、回复与互动提醒。',
            key: 'communityNotification',
            disabled: baseDisabled,
          })}
          {renderSwitchItem({
            icon: 'update',
            title: '更新通知',
            description: '接收版本更新与新功能信息。',
            key: 'updateNotification',
            disabled: baseDisabled,
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>通知时间</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.timeSettingItem}
            onPress={() => navigation.navigate('NotificationTimeSettings')}
            disabled={baseDisabled}
            testID="entry.settings.notification.timeWindow"
          >
            <View style={styles.settingInfo}>
              <View style={styles.settingHeader}>
                <Icon name="access-time" size={SIZE.icon.sm} color={baseDisabled ? colors.textSecondary : colors.text} />
                <Text style={[styles.settingTitle, { color: baseDisabled ? colors.textSecondary : colors.text }]}>
                  免打扰时段
                </Text>
              </View>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                设置不接收通知的时间范围。
              </Text>
            </View>
            <Icon name="chevron-right" size={SIZE.icon.md} color={baseDisabled ? colors.textSecondary : colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>通知渠道</Text>
        <View style={styles.card}>
          {renderSwitchItem({
            icon: 'smartphone',
            title: '推送通知',
            description: '通过系统推送接收通知。',
            key: 'pushNotificationEnabled',
            disabled: baseDisabled,
          })}
          {renderSwitchItem({
            icon: 'email',
            title: '邮件通知',
            description: '通过邮件接收重要通知摘要。',
            key: 'emailNotificationEnabled',
            disabled: baseDisabled,
          })}
          {renderSwitchItem({
            icon: 'inbox',
            title: '应用内通知',
            description: '在应用内显示提醒与消息。',
            key: 'inAppNotificationEnabled',
            disabled: baseDisabled,
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>通知优先级</Text>
        <View style={styles.card}>
          {renderPriorityItem('high', 'priority-high', '高优先级', '#DC2626')}
          {renderPriorityItem('medium', 'notifications', '中优先级', '#F59E0B')}
          {renderPriorityItem('low', 'notifications-none', '低优先级', '#94A3B8')}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>声音与振动</Text>
        <View style={styles.card}>
          {renderSwitchItem({
            icon: 'volume-up',
            title: '通知声音',
            description: '收到通知时播放提示音。',
            key: 'notificationSound',
            disabled: baseDisabled,
          })}
          {renderSwitchItem({
            icon: 'vibration',
            title: '振动提醒',
            description: '收到通知时进行振动。',
            key: 'notificationVibration',
            disabled: baseDisabled,
          })}
          {renderSwitchItem({
            icon: 'flash-on',
            title: 'LED 指示灯',
            description: '未读通知时闪烁提示灯（设备支持时）。',
            key: 'notificationLED',
            disabled: baseDisabled,
          })}
        </View>

        <Text style={[styles.note, { color: colors.textSecondary }]}>
          提示：即使已在应用内开启通知，也请在系统设置中确认通知权限和渠道配置已允许。
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F8FF',
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
    marginLeft: 2,
  },
  card: {
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: '#D4E5FF',
    overflow: 'hidden',
    ...ELEVATION.sm,
  },
  permissionCard: {
    padding: SPACING.md,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  permissionTitle: {
    marginLeft: SPACING.sm,
    fontSize: 16,
    fontWeight: '700',
  },
  permissionDescription: {
    fontSize: 13,
    lineHeight: 20,
  },
  permissionButton: {
    marginTop: SPACING.md,
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
  },
  settingInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  settingTitle: {
    marginLeft: SPACING.sm,
    fontSize: 14,
    fontWeight: '600',
  },
  settingDescription: {
    marginLeft: 28,
    fontSize: 12,
    lineHeight: 18,
  },
  timeSettingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  priorityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: BORDER.width.thin,
  },
  priorityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityText: {
    marginLeft: SPACING.sm,
    fontSize: 14,
  },
  priorityCheck: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  note: {
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
    fontSize: 12,
    lineHeight: 18,
  },
});

export default NotificationSettingsScreen;
