/**
 * 现代化提醒屏幕
 * 支持渐变背景和动画效果
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Animated,
  StatusBar,
  Platform,
  TextInput,
  Modal,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { loadReminders, addReminder, updateReminder, deleteReminder } from '../store/slices/reminderSlice';
import { websocketService } from '../services/websocket';
import { notificationService } from '../services/notification';
import { offlineStorageService } from '../services/offlineStorage';
import { analyticsService } from '../services/analytics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, isToday, isTomorrow, isYesterday, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
// 尝试默认导入方式
import LinearGradient from 'react-native-linear-gradient';
// 直接导入所有常量
import * as Dimensions from '../utils/constants/dimensions';
import { Button, Card } from '../components/common';

const ReminderScreen = () => {
  const { colors, isDarkMode } = useTheme();
  const dispatch = useDispatch();
  const reminders = useSelector(state => state.reminder.reminders);

  // 状态管理
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [newReminder, setNewReminder] = useState({
    title: '',
    dueDate: new Date(),
    isEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [reminderToDelete, setReminderToDelete] = useState(null);

  // 动画值
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerFadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const listFadeAnim = useRef(new Animated.Value(0)).current;

  // 渐变色
  const headerGradient = isDarkMode
    ? colors.gradients.header
    : ['#4361EE', '#4CC9F0'];
  const backgroundGradient = isDarkMode
    ? ['#121212', '#1E1E1E']
    : ['#F8F9FA', '#FFFFFF'];

  useEffect(() => {
    init();

    // 设置状态栏
    StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('transparent');
      StatusBar.setTranslucent(true);
    }

    // 启动动画
    Animated.parallel([
      Animated.timing(headerFadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(headerSlideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(listFadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      websocketService.removeListener('notification', handleNotification);
      websocketService.disconnect();
    };
  }, []);

  const init = async () => {
    try {
      setLoading(true);
      await offlineStorageService.init();
      websocketService.connect();
      websocketService.addListener('notification', handleNotification);
      await loadLocalReminders();
    } catch (error) {
      console.error('初始化失败:', error);
      analyticsService.trackError(error, { operation: 'init' });
    } finally {
      setLoading(false);
    }
  };

  const loadLocalReminders = async () => {
    try {
      const localReminders = await offlineStorageService.getReminders();
      dispatch(loadReminders(localReminders));
    } catch (error) {
      console.error('加载本地提醒失败:', error);
      analyticsService.trackError(error, { operation: 'load_local_reminders' });
    }
  };

  const handleNotification = (data) => {
    const reminder = reminders.find(r => r.id === data.reminder_id);
    if (reminder) {
      notificationService.scheduleLocalNotification(
        '提醒',
        reminder.title,
        new Date(reminder.dueDate)
      );
    }
  };

  const handleAddReminder = async () => {
    // 验证输入
    if (!newReminder.title.trim()) {
      Alert.alert('提示', '请输入提醒标题');
      return;
    }

    try {
      setSyncing(true);

      // 添加提醒前的动画效果
      Animated.timing(fadeAnim, {
        toValue: 0.7,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const reminder = await dispatch(addReminder(newReminder)).unwrap();
      await offlineStorageService.saveReminder(reminder);

      // 设置本地通知
      notificationService.scheduleLocalNotification(
        '提醒',
        reminder.title,
        new Date(reminder.dueDate)
      );

      // 重置表单
      setNewReminder({
        title: '',
        dueDate: new Date(),
        isEnabled: true,
      });

      // 关闭添加模态框
      setShowAddModal(false);

      // 添加成功的动画效果
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(300)
      ]).start();

      // 记录分析数据
      analyticsService.trackReminderAction('create', reminder.id);
    } catch (error) {
      Alert.alert('错误', '添加提醒失败');
      analyticsService.trackError(error, { operation: 'add_reminder' });

      // 添加失败的动画效果
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleReminder = async (reminder) => {
    try {
      setSyncing(true);
      const updatedReminder = await dispatch(updateReminder({
        ...reminder,
        isEnabled: !reminder.isEnabled,
      })).unwrap();
      await offlineStorageService.saveReminder(updatedReminder);

      if (!reminder.isEnabled) {
        notificationService.scheduleLocalNotification(
          '提醒',
          reminder.title,
          new Date(reminder.dueDate)
        );
      } else {
        notificationService.cancelAllNotifications();
        const notifications = await notificationService.getScheduledNotifications();
        notifications.forEach(notification => {
          notificationService.scheduleLocalNotification(
            notification.title,
            notification.message,
            new Date(notification.date)
          );
        });
      }
      analyticsService.trackReminderAction('toggle', reminder.id);
    } catch (error) {
      Alert.alert('错误', '更新提醒失败');
      analyticsService.trackError(error, { operation: 'toggle_reminder' });
    } finally {
      setSyncing(false);
    }
  };

  // 显示删除确认对话框
  const confirmDeleteReminder = (reminder) => {
    setReminderToDelete(reminder);
    setShowConfirmDelete(true);
  };

  // 执行删除操作
  const handleDeleteReminder = async (reminder) => {
    try {
      setSyncing(true);

      // 删除前的动画效果
      Animated.timing(fadeAnim, {
        toValue: 0.7,
        duration: 300,
        useNativeDriver: true,
      }).start();

      await dispatch(deleteReminder(reminder.id)).unwrap();
      await offlineStorageService.deleteReminder(reminder.id);

      // 重新设置通知
      notificationService.cancelAllNotifications();
      const notifications = await notificationService.getScheduledNotifications();
      notifications.forEach(notification => {
        notificationService.scheduleLocalNotification(
          notification.title,
          notification.message,
          new Date(notification.date)
        );
      });

      // 删除成功的动画效果
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(300)
      ]).start();

      // 记录分析数据
      analyticsService.trackReminderAction('delete', reminder.id);

      // 关闭确认对话框
      setShowConfirmDelete(false);
      setReminderToDelete(null);
    } catch (error) {
      Alert.alert('错误', '删除提醒失败');
      analyticsService.trackError(error, { operation: 'delete_reminder' });

      // 删除失败的动画效果
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } finally {
      setSyncing(false);
    }
  };

  // 格式化日期显示
  const formatReminderDate = (dateString) => {
    const date = new Date(dateString);

    if (isToday(date)) {
      return `今天 ${format(date, 'HH:mm', { locale: zhCN })}`;
    } else if (isTomorrow(date)) {
      return `明天 ${format(date, 'HH:mm', { locale: zhCN })}`;
    } else if (isYesterday(date)) {
      return `昨天 ${format(date, 'HH:mm', { locale: zhCN })}`;
    } else {
      return format(date, 'yyyy-MM-dd HH:mm', { locale: zhCN });
    }
  };

  // 渲染单个提醒项
  const renderReminder = ({ item, index }) => {
    // 计算动画延迟，实现列表项的交错动画
    const animDelay = index * 100;

    return (
      <Animated.View
        style={[
          styles.reminderItemContainer,
          {
            opacity: listFadeAnim,
            transform: [{
              translateY: listFadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              })
            }]
          }
        ]}
      >
        <Card style={styles.reminderItem}>
          <View style={styles.reminderHeader}>
            <View style={styles.reminderTitleContainer}>
              <MaterialIcon
                name="notifications"
                size={20}
                color={item.isEnabled ? colors.primary : colors.textSecondary}
                style={styles.reminderIcon}
              />
              <Text
                style={[
                  styles.reminderTitle,
                  {
                    color: colors.text,
                    textDecorationLine: item.isEnabled ? 'none' : 'line-through'
                  }
                ]}
              >
                {item.title}
              </Text>
            </View>
            <View
              style={[
                styles.reminderStatus,
                {
                  backgroundColor: item.isEnabled
                    ? 'rgba(52, 199, 89, 0.2)'
                    : 'rgba(255, 59, 48, 0.2)'
                }
              ]}
            >
              <Text
                style={[
                  styles.reminderStatusText,
                  {
                    color: item.isEnabled
                      ? '#34C759'
                      : '#FF3B30'
                  }
                ]}
              >
                {item.isEnabled ? '已启用' : '已禁用'}
              </Text>
            </View>
          </View>

          <View style={styles.reminderDateContainer}>
            <MaterialIcon
              name="event"
              size={16}
              color={colors.textSecondary}
              style={styles.dateIcon}
            />
            <Text style={[styles.reminderDate, { color: colors.textSecondary }]}>
              {formatReminderDate(item.dueDate)}
            </Text>
          </View>

          <View style={styles.reminderActions}>
            <Button
              title={item.isEnabled ? "禁用" : "启用"}
              type={item.isEnabled ? "outline" : "gradient"}
              gradientType={item.isEnabled ? null : "success"}
              rounded
              onPress={() => handleToggleReminder(item)}
              style={styles.actionButton}
              size="small"
              icon={item.isEnabled ? "notifications-off" : "notifications-active"}
            />
            <Button
              title="删除"
              type="gradient"
              gradientType="error"
              rounded
              onPress={() => confirmDeleteReminder(item)}
              style={styles.actionButton}
              size="small"
              icon="delete"
            />
          </View>
        </Card>
      </Animated.View>
    );
  };

  // 加载状态
  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={backgroundGradient}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>加载提醒中...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 渐变背景 */}
      <LinearGradient
        colors={backgroundGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* 渐变头部 */}
      <Animated.View
        style={[
          styles.headerContainer,
          {
            opacity: headerFadeAnim,
            transform: [{ translateY: headerSlideAnim }]
          }
        ]}
      >
        <LinearGradient
          colors={headerGradient}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>提醒事项</Text>
            <Text style={styles.headerSubtitle}>管理您的日程和提醒</Text>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* 同步指示器 */}
      {syncing && (
        <Animated.View
          style={[
            styles.syncIndicator,
            {
              backgroundColor: isDarkMode
                ? 'rgba(0, 0, 0, 0.7)'
                : 'rgba(255, 255, 255, 0.9)',
              ...Dimensions.SHADOW.MEDIUM
            }
          ]}
        >
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.syncText, { color: colors.text }]}>同步中...</Text>
        </Animated.View>
      )}

      {/* 提醒列表 */}
      {reminders.length > 0 ? (
        <FlatList
          data={reminders}
          renderItem={renderReminder}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <MaterialIcon name="notifications-none" size={80} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>暂无提醒</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            点击下方按钮添加新的提醒事项
          </Text>
        </View>
      )}

      {/* 添加按钮 */}
      <View style={styles.addButtonContainer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={colors.gradients.primary}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            borderRadius={28}
          />
          <Icon name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* 日期选择器 */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="datetime"
          display="default"
          onChange={(event, date) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (date) {
              setSelectedDate(date);
              setNewReminder({ ...newReminder, dueDate: date });
            }
          }}
        />
      )}

      {/* 添加提醒模态框 */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setShowAddModal(false)}
          />
          <View style={[
            styles.modalContainer,
            { backgroundColor: colors.cardBackground }
          ]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>添加提醒</Text>

            <TextInput
              style={[
                styles.titleInput,
                {
                  color: colors.text,
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                }
              ]}
              placeholder="提醒标题"
              placeholderTextColor={colors.textSecondary}
              value={newReminder.title}
              onChangeText={(text) => setNewReminder({ ...newReminder, title: text })}
            />

            <TouchableOpacity
              style={[
                styles.dateSelector,
                {
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                }
              ]}
              onPress={() => setShowDatePicker(true)}
            >
              <MaterialIcon name="event" size={20} color={colors.primary} />
              <Text style={[styles.dateText, { color: colors.text }]}>
                {format(selectedDate, 'yyyy-MM-dd HH:mm', { locale: zhCN })}
              </Text>
              <MaterialIcon name="arrow-drop-down" size={24} color={colors.primary} />
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <Button
                title="取消"
                type="outline"
                rounded
                onPress={() => setShowAddModal(false)}
                style={styles.modalButton}
              />
              <Button
                title="添加"
                type="gradient"
                gradientType="primary"
                rounded
                onPress={handleAddReminder}
                style={styles.modalButton}
                loading={syncing}
                disabled={syncing || !newReminder.title.trim()}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* 删除确认对话框 */}
      <Modal
        visible={showConfirmDelete}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfirmDelete(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setShowConfirmDelete(false)}
          />
          <View style={[
            styles.confirmDialog,
            { backgroundColor: colors.cardBackground }
          ]}>
            <MaterialIcon name="warning" size={32} color="#FF9500" style={styles.warningIcon} />
            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              确认删除
            </Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              您确定要删除此提醒吗？此操作无法撤销。
            </Text>
            <View style={styles.confirmButtons}>
              <Button
                title="取消"
                type="outline"
                rounded
                onPress={() => setShowConfirmDelete(false)}
                style={styles.confirmButton}
              />
              <Button
                title="删除"
                type="gradient"
                gradientType="error"
                rounded
                onPress={() => reminderToDelete && handleDeleteReminder(reminderToDelete)}
                loading={syncing}
                disabled={syncing}
                style={styles.confirmButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  // 基础容器样式
  container: {
    flex: 1,
  },

  // 加载状态样式
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Dimensions.spacing.medium,
    fontSize: 16,
  },

  // 头部样式
  headerContainer: {
    width: '100%',
    overflow: 'hidden',
    ...Dimensions.SHADOW.MEDIUM,
  },
  header: {
    width: '100%',
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
    paddingBottom: Dimensions.spacing.medium,
  },
  headerContent: {
    paddingHorizontal: Dimensions.spacing.large,
    paddingVertical: Dimensions.spacing.medium,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: Dimensions.spacing.tiny,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },

  // 同步指示器样式
  syncIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: '50%',
    transform: [{ translateX: -75 }],
    width: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Dimensions.spacing.medium,
    borderRadius: Dimensions.borderRadius.round,
    zIndex: 1000,
  },
  syncText: {
    marginLeft: Dimensions.spacing.small,
    fontSize: 14,
  },

  // 列表样式
  listContainer: {
    padding: Dimensions.spacing.large,
    paddingBottom: Dimensions.spacing.extraLarge * 3, // 使用 extraLarge 替代 xxlarge
  },
  reminderItemContainer: {
    marginBottom: Dimensions.spacing.medium,
  },
  reminderItem: {
    padding: Dimensions.spacing.medium,
  },

  // 提醒项头部样式
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Dimensions.spacing.small,
  },
  reminderTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reminderIcon: {
    marginRight: Dimensions.spacing.small,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  reminderStatus: {
    paddingHorizontal: Dimensions.spacing.small,
    paddingVertical: Dimensions.spacing.tiny,
    borderRadius: Dimensions.borderRadius.round,
  },
  reminderStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // 提醒日期样式
  reminderDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Dimensions.spacing.medium,
  },
  dateIcon: {
    marginRight: Dimensions.spacing.tiny,
  },
  reminderDate: {
    fontSize: 14,
  },

  // 提醒操作按钮样式
  reminderActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    marginLeft: Dimensions.spacing.small,
    minWidth: 80,
  },

  // 添加按钮样式
  addButtonContainer: {
    position: 'absolute',
    bottom: Dimensions.spacing.large,
    right: Dimensions.spacing.large,
    ...Dimensions.SHADOW.LARGE,
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  // 空状态样式
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Dimensions.spacing.large,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: Dimensions.spacing.large,
    marginBottom: Dimensions.spacing.small,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },

  // 模态框样式
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '85%',
    maxWidth: 400,
    borderRadius: Dimensions.borderRadius.large,
    padding: Dimensions.spacing.large,
    ...Dimensions.SHADOW.LARGE,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: Dimensions.spacing.large,
    textAlign: 'center',
  },
  titleInput: {
    height: 50,
    borderRadius: Dimensions.borderRadius.medium,
    paddingHorizontal: Dimensions.spacing.medium,
    marginBottom: Dimensions.spacing.medium,
    fontSize: 16,
  },
  dateSelector: {
    height: 50,
    borderRadius: Dimensions.borderRadius.medium,
    paddingHorizontal: Dimensions.spacing.medium,
    marginBottom: Dimensions.spacing.large,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    marginLeft: Dimensions.spacing.small,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: Dimensions.spacing.small,
  },

  // 确认对话框样式
  confirmDialog: {
    width: '85%',
    maxWidth: 400,
    borderRadius: Dimensions.borderRadius.large,
    padding: Dimensions.spacing.large,
    ...Dimensions.SHADOW.LARGE,
    alignItems: 'center',
  },
  warningIcon: {
    marginBottom: Dimensions.spacing.medium,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: Dimensions.spacing.medium,
  },
  confirmMessage: {
    fontSize: 16,
    marginBottom: Dimensions.spacing.LARGE,
    textAlign: 'center',
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  confirmButton: {
    flex: 1,
    marginHorizontal: Dimensions.spacing.SMALL,
  },
});

export default ReminderScreen;