/**
 * 通知设置屏幕
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { updateSettings } from '../../redux/slices/settingsSlice';
import { requestNotificationPermission } from '../../utils/permissions';
import { SPACING, RADIUS, ELEVATION, SIZE, BORDER } from '../../theme/tokens';

const NotificationSettingsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  // Ensure we have the correct color object
  const colors = theme.colors || theme;
  const dispatch = useDispatch();

  // 从Redux获取设置
  const settings = useSelector(state => state.settings);

  // 本地状态
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 检查通知权限
  useEffect(() => {
    checkNotificationPermission();
  }, []);

  // 检查通知权限
  const checkNotificationPermission = async () => {
    try {
      const permission = await requestNotificationPermission(false);
      setHasPermission(permission);
    } catch (error) {
      console.error('检查通知权限失败:', error);
      setHasPermission(false);
    }
  };

  // 请求通知权限
  const requestPermission = async () => {
    setIsLoading(true);
    try {
      const permission = await requestNotificationPermission(true);
      setHasPermission(permission);

      if (permission) {
        // 如果获得权限，启用通知
        updateNotificationSetting('notificationEnabled', true);
      } else {
        // 如果没有获得权限，显示提示
        Alert.alert(
          '通知权限',
          '无法获取通知权限。请在设备设置中手动启用通知权限。',
          [
            {
              text: '稍后再说',
              style: 'cancel',
            },
            {
              text: '去设置',
              onPress: () => {
                // 打开应用设置
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('请求通知权限失败:', error);
      Alert.alert('错误', '请求通知权限失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 更新通知设置
  const updateNotificationSetting = (key, value) => {
    // 如果要启用通知，但没有权限，则请求权限
    if (key === 'notificationEnabled' && value && !hasPermission) {
      requestPermission();
      return;
    }

    const newSettings = { ...settings, [key]: value };
    dispatch(updateSettings(newSettings));
  };

  // 渲染设置项
  const renderSettingItem = ({ icon, title, description, key, disabled = false }) => (
    <View style={[styles.settingItem, { borderBottomColor: colors.border || '#f0f0f0' }]}>
      <View style={styles.settingInfo}>
        <View style={styles.settingHeader}>
          <Icon name={icon} size={SIZE.icon.sm} color={disabled ? colors.textSecondary : colors.text} />
          <Text
            style={[
              styles.settingTitle,
              { color: disabled ? colors.textSecondary : colors.text },
            ]}
          >
            {title}
          </Text>
        </View>

        {description && (
          <Text
            style={[
              styles.settingDescription,
              { color: colors.textSecondary, fontSize: 12 },
            ]}
          >
            {description}
          </Text>
        )}
      </View>

      <Switch
        value={settings[key]}
        onValueChange={(value) => updateNotificationSetting(key, value)}
        trackColor={{ false: colors.border, true: (colors.primary || '#007AFF') + '80' }}
        thumbColor={settings[key] ? (colors.primary || '#007AFF') : (colors.card || '#FFFFFF')}
        disabled={disabled}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content}>
        {/* 通知权限状态 */}
        <View style={[styles.permissionCard, { backgroundColor: colors.card || '#FFFFFF' }]}>
          <View style={styles.permissionHeader}>
            <Icon
              name={hasPermission ? 'notifications-active' : 'notifications-off'}
              size={SIZE.icon.md}
              color={hasPermission ? colors.success : colors.error}
            />
            <Text
              style={[
                styles.permissionTitle,
                { fontWeight: 'bold', color: colors.text },
              ]}
            >
              {hasPermission ? '通知已启用' : '通知已禁用'}
            </Text>
          </View>

          <Text
            style={[
              styles.permissionDescription,
              { color: colors.textSecondary, fontSize: 13 },
            ]}
          >
            {hasPermission
              ? '您已授予应用发送通知的权限'
              : '您需要授予应用发送通知的权限才能接收提醒和更新'}
          </Text>

          {!hasPermission && (
            <TouchableOpacity
              style={[styles.permissionButton, { backgroundColor: colors.primary || '#007AFF' }]}
              onPress={requestPermission}
              disabled={isLoading}
            >
              <Text
                style={[
                  { color: colors.card || '#FFFFFF', fontSize: 13 },
                ]}
              >
                {isLoading ? '请求中...' : '授予权限'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 通知设置 */}
        <View style={[styles.settingsCard, { backgroundColor: colors.card || '#FFFFFF' }]}>
          {renderSettingItem({
            icon: 'notifications',
            title: '启用通知',
            description: '接收应用的通知和提醒',
            key: 'notificationEnabled',
            disabled: !hasPermission,
          })}

          {renderSettingItem({
            icon: 'event-note',
            title: '提醒通知',
            description: '接收笔记提醒和待办事项通知',
            key: 'reminderNotification',
            disabled: !hasPermission || !settings.notificationEnabled,
          })}

          {renderSettingItem({
            icon: 'sync',
            title: '同步通知',
            description: '接收数据同步状态的通知',
            key: 'syncNotification',
            disabled: !hasPermission || !settings.notificationEnabled,
          })}

          {renderSettingItem({
            icon: 'forum',
            title: '社区通知',
            description: '接收评论、回复和点赞通知',
            key: 'communityNotification',
            disabled: !hasPermission || !settings.notificationEnabled,
          })}

          {renderSettingItem({
            icon: 'update',
            title: '更新通知',
            description: '接收应用更新和新功能通知',
            key: 'updateNotification',
            disabled: !hasPermission || !settings.notificationEnabled,
          })}
        </View>

        {/* 通知时间设置 */}
        <View style={[styles.settingsCard, { backgroundColor: colors.card || '#FFFFFF' }]}>
          <TouchableOpacity
            style={styles.timeSettingItem}
            onPress={() => navigation.navigate('NotificationTimeSettings')}
            disabled={!hasPermission || !settings.notificationEnabled}
          >
            <View style={styles.settingInfo}>
              <View style={styles.settingHeader}>
                <Icon
                  name="access-time"
                  size={SIZE.icon.sm}
                  color={!hasPermission || !settings.notificationEnabled ? colors.textSecondary : colors.text}
                />
                <Text
                  style={[
                    styles.settingTitle,
                    { color: !hasPermission || !settings.notificationEnabled ? colors.textSecondary : colors.text },
                  ]}
                >
                  免打扰时间
                </Text>
              </View>

              <Text
                style={[
                  styles.settingDescription,
                  { color: colors.textSecondary, fontSize: 12 },
                ]}
              >
                设置不接收通知的时间段
              </Text>
            </View>

            <Icon
              name="chevron-right"
              size={SIZE.icon.md}
              color={!hasPermission || !settings.notificationEnabled ? colors.textSecondary : colors.text}
            />
          </TouchableOpacity>
        </View>

        {/* 多渠道通知配置 */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>通知渠道</Text>
        <View style={[styles.settingsCard, { backgroundColor: colors.card || '#FFFFFF' }]}>
          {renderSettingItem({
            icon: 'smartphone',
            title: '推送通知',
            description: '通过系统推送接收通知',
            key: 'pushNotificationEnabled',
            disabled: !hasPermission || !settings.notificationEnabled,
          })}

          {renderSettingItem({
            icon: 'email',
            title: '邮件通知',
            description: '通过邮件接收重要通知摘要',
            key: 'emailNotificationEnabled',
            disabled: !hasPermission || !settings.notificationEnabled,
          })}

          {renderSettingItem({
            icon: 'inbox',
            title: '应用内通知',
            description: '在应用内显示通知徽章和弹窗',
            key: 'inAppNotificationEnabled',
            disabled: !hasPermission || !settings.notificationEnabled,
          })}
        </View>

        {/* 通知优先级 */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>通知优先级</Text>
        <View style={[styles.settingsCard, { backgroundColor: colors.card || '#FFFFFF' }]}>
          <TouchableOpacity
            style={[styles.priorityItem, { borderBottomColor: colors.border || '#f0f0f0' }]}
            onPress={() => updateNotificationSetting('notificationPriority', 'high')}
            disabled={!hasPermission || !settings.notificationEnabled}
          >
            <View style={styles.priorityInfo}>
              <Icon name="priority-high" size={SIZE.icon.sm} color={colors.error} />
              <Text style={[styles.priorityText, { color: colors.text }]}>高优先级</Text>
            </View>
            <View style={styles.priorityCheck}>
              {settings.notificationPriority === 'high' && (
                <Icon name="check" size={SIZE.icon.sm} color={colors.primary} />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.priorityItem, { borderBottomColor: colors.border || '#f0f0f0' }]}
            onPress={() => updateNotificationSetting('notificationPriority', 'medium')}
            disabled={!hasPermission || !settings.notificationEnabled}
          >
            <View style={styles.priorityInfo}>
              <Icon name="notifications" size={SIZE.icon.sm} color={colors.warning} />
              <Text style={[styles.priorityText, { color: colors.text }]}>中优先级</Text>
            </View>
            <View style={styles.priorityCheck}>
              {settings.notificationPriority === 'medium' && (
                <Icon name="check" size={SIZE.icon.sm} color={colors.primary} />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.priorityItem, { borderBottomColor: colors.border || '#f0f0f0' }]}
            onPress={() => updateNotificationSetting('notificationPriority', 'low')}
            disabled={!hasPermission || !settings.notificationEnabled}
          >
            <View style={styles.priorityInfo}>
              <Icon name="notifications-none" size={SIZE.icon.sm} color={colors.textSecondary} />
              <Text style={[styles.priorityText, { color: colors.text }]}>低优先级</Text>
            </View>
            <View style={styles.priorityCheck}>
              {settings.notificationPriority === 'low' && (
                <Icon name="check" size={SIZE.icon.sm} color={colors.primary} />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* 声音和振动 */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>声音和振动</Text>
        <View style={[styles.settingsCard, { backgroundColor: colors.card || '#FFFFFF' }]}>
          {renderSettingItem({
            icon: 'volume-up',
            title: '通知声音',
            description: '播放通知提示音',
            key: 'notificationSound',
            disabled: !hasPermission || !settings.notificationEnabled,
          })}

          {renderSettingItem({
            icon: 'vibration',
            title: '振动',
            description: '收到通知时振动',
            key: 'notificationVibration',
            disabled: !hasPermission || !settings.notificationEnabled,
          })}

          {renderSettingItem({
            icon: 'flash-on',
            title: 'LED指示灯',
            description: '有未读通知时闪烁LED灯',
            key: 'notificationLED',
            disabled: !hasPermission || !settings.notificationEnabled,
          })}
        </View>

        <Text
          style={[
            styles.note,
            { color: colors.textSecondary, fontSize: 12 },
          ]}
        >
          注意：即使启用了通知，您也可能需要在设备设置中允许应用发送通知
        </Text>
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
    padding: SPACING.md,
  },
  permissionCard: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...ELEVATION.sm,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  permissionTitle: {
    marginLeft: SPACING.sm,
  },
  permissionDescription: {
    marginBottom: SPACING.md,
  },
  permissionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  settingsCard: {
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...ELEVATION.sm,
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
  },
  settingDescription: {
    marginLeft: 28, // Icon size + margin
  },
  timeSettingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  note: {
    textAlign: 'center',
    marginBottom: SPACING.xl,
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
    paddingHorizontal: 4,
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
});

export default NotificationSettingsScreen;
