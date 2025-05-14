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
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { updateSettings } from '../../redux/slices/settingsSlice';
import { requestNotificationPermission } from '../../services/notifications';

const NotificationSettingsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
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
    <View style={styles.settingItem}>
      <View style={styles.settingInfo}>
        <View style={styles.settingHeader}>
          <Icon name={icon} size={20} color={disabled ? colors.textSecondary : colors.text} />
          <Text
            style={[
              styles.settingTitle,
              { color: disabled ? colors.textSecondary : colors.text }
            ]}
          >
            {title}
          </Text>
        </View>

        {description && (
          <Text
            style={[
              styles.settingDescription,
              { color: colors.textSecondary, fontSize: 12 }
            ]}
          >
            {description}
          </Text>
        )}
      </View>

      <Switch
        value={settings[key]}
        onValueChange={(value) => updateNotificationSetting(key, value)}
        trackColor={{ false: colors.border, true: colors.primary + '80' }}
        thumbColor={settings[key] ? colors.primary : colors.card}
        disabled={disabled}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content}>
        {/* 通知权限状态 */}
        <View style={[styles.permissionCard, { backgroundColor: colors.card }]}>
          <View style={styles.permissionHeader}>
            <Icon
              name={hasPermission ? 'notifications-active' : 'notifications-off'}
              size={24}
              color={hasPermission ? colors.success : colors.error}
            />
            <Text
              style={[
                styles.permissionTitle,
                { fontWeight: 'bold' }
              ]}
            >
              {hasPermission ? '通知已启用' : '通知已禁用'}
            </Text>
          </View>

          <Text
            style={[
              styles.permissionDescription,
              { color: colors.textSecondary, fontSize: 13 }
            ]}
          >
            {hasPermission
              ? '您已授予应用发送通知的权限'
              : '您需要授予应用发送通知的权限才能接收提醒和更新'}
          </Text>

          {!hasPermission && (
            <TouchableOpacity
              style={[styles.permissionButton, { backgroundColor: colors.primary }]}
              onPress={requestPermission}
              disabled={isLoading}
            >
              <Text
                style={[
                  { color: colors.card, fontSize: 13 }
                ]}
              >
                {isLoading ? '请求中...' : '授予权限'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 通知设置 */}
        <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
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
        <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.timeSettingItem}
            onPress={() => navigation.navigate('NotificationTimeSettings')}
            disabled={!hasPermission || !settings.notificationEnabled}
          >
            <View style={styles.settingInfo}>
              <View style={styles.settingHeader}>
                <Icon
                  name="access-time"
                  size={20}
                  color={!hasPermission || !settings.notificationEnabled ? colors.textSecondary : colors.text}
                />
                <Text
                  style={[
                    styles.settingTitle,
                    { color: !hasPermission || !settings.notificationEnabled ? colors.textSecondary : colors.text }
                  ]}
                >
                  免打扰时间
                </Text>
              </View>

              <Text
                style={[
                  styles.settingDescription,
                  { color: colors.textSecondary, fontSize: 12 }
                ]}
              >
                设置不接收通知的时间段
              </Text>
            </View>

            <Icon
              name="chevron-right"
              size={24}
              color={!hasPermission || !settings.notificationEnabled ? colors.textSecondary : colors.text}
            />
          </TouchableOpacity>
        </View>

        <Text
          style={[
            styles.note,
            { color: colors.textSecondary, fontSize: 12 }
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
    padding: 16,
  },
  permissionCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  permissionTitle: {
    marginLeft: 8,
  },
  permissionDescription: {
    marginBottom: 16,
  },
  permissionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  settingsCard: {
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  settingTitle: {
    marginLeft: 8,
  },
  settingDescription: {
    marginLeft: 28,
  },
  timeSettingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  note: {
    textAlign: 'center',
    marginBottom: 32,
  },
});

export default NotificationSettingsScreen;
