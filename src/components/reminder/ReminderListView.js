import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  SectionList,
  RefreshControl,
  Platform,
  ToastAndroid,
  Animated,
  Easing,
  ScrollView,
  Switch,
  Modal,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

import { useDispatch, useSelector } from 'react-redux';
import {
  loadReminders,
  updateLocalReminder,
  deleteLocalReminder,
  syncReminders,
  refreshUnsyncedCount,
} from '../../redux/slices/reminderSlice';
import reminderNotificationService from '../../services/reminder/reminderNotificationService';
import * as reminderApi from '../../services/api/reminderApi';
import { format, isToday, isPast, isFuture, addDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/MaterialIcons';
import networkService from '../../services/network/networkService';

const ReminderListView = ({ navigation, route }) => {
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const reminders = useSelector(state => state.reminders.reminders);
  const hasNavigation = Boolean(navigation);

  // 安全获取主题颜色的辅助函数
  const getThemeColor = (colorKey, defaultValue) => {
    return theme?.[colorKey] || defaultValue;
  };
  const unsyncedCount = useSelector(state => state.reminders.syncStatus?.unsyncedCount || 0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reminderSections, setReminderSections] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'today', 'upcoming', 'completed'
  const [syncing, setSyncing] = useState(false);
  const [showSyncIndicator, setShowSyncIndicator] = useState(false);
  const [syncRotation] = useState(new Animated.Value(0));
  const unsyncedCountRef = useRef(unsyncedCount);
  const syncInFlightRef = useRef(false);
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [selectedReminders, setSelectedReminders] = useState([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [inlineHint, setInlineHint] = useState('');
  const [listState, setListState] = useState('idle');

  const notifyNonBlocking = useCallback((message) => {
    if (!message) {
      return;
    }
    setInlineHint(message);
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  }, []);
  const [advancedFilters, setAdvancedFilters] = useState({
    priority: 'all', // 'all', 'high', 'medium', 'low'
    category: 'all',
    startDate: null,
    endDate: null,
    tags: [],
  });

  const logDegradedReminderAction = useCallback((message, error) => {
    if (__DEV__) {
      console.log(message, error);
    }
  }, []);

  // 加载提醒数据
  const loadRemindersData = useCallback(async () => {
    try {
      setLoading(true);
      await dispatch(refreshUnsyncedCount());

      const localReminders = await reminderNotificationService.getPreferredLocalReminders();

      if (isOnline) {
        try {
          setSyncing(true);
          setListState('loading');
          const response = await reminderApi.getAllReminders({}, {
            suppressGlobalErrorUI: true,
          });

          if (response.success && response.data?.results) {
            dispatch(loadReminders(response.data.results));
            await reminderNotificationService.saveAllReminders(response.data.results);
            setInlineHint('');
            setListState(response.data.results.length > 0 ? 'ready' : 'empty');
            if (Platform.OS === 'android') {
              ToastAndroid.show('提醒数据已更新', ToastAndroid.SHORT);
            }
          }
        } catch (error) {
          const logMethod = error?.isNetworkError && __DEV__ ? console.log : console.error;
          logMethod('从服务器加载提醒数据失败:', error);
          dispatch(loadReminders(localReminders));
          setListState(localReminders.length > 0 ? 'offline' : 'offline-empty');
          notifyNonBlocking(
            error?.isNetworkError
              ? '网络不可用，已切换为本地提醒视图'
              : '服务器暂不可用，已显示本地提醒'
          );
        } finally {
          setSyncing(false);
        }
      } else {
        dispatch(loadReminders(localReminders));
        setListState(localReminders.length > 0 ? 'offline' : 'offline-empty');
        notifyNonBlocking('当前处于离线模式，已显示本地提醒');
      }
    } catch (error) {
      const logMethod = error?.isNetworkError && __DEV__ ? console.log : console.error;
      logMethod('加载提醒数据失败:', error);
      setListState('error');
      notifyNonBlocking('加载提醒失败，已尽量回退到本地数据');
    } finally {
      setLoading(false);
    }
  }, [dispatch, isOnline, notifyNonBlocking]);

  // 同步离线提醒
  const syncOfflineReminders = useCallback(async () => {
    try {
      if (!isOnline || unsyncedCount === 0 || syncInFlightRef.current) {
        return;
      }

      syncInFlightRef.current = true;
      setSyncing(true);
      const syncResult = await dispatch(syncReminders()).unwrap();
      const syncedCount = Number(syncResult?.synced || 0);
      if (syncedCount > 0) {
        notifyNonBlocking(`已同步${syncedCount}个离线提醒`);
      }
    } catch (error) {
      console.error('同步离线提醒失败:', error);
      notifyNonBlocking('无法同步离线提醒，请稍后重试');
    } finally {
      setSyncing(false);
      syncInFlightRef.current = false;
    }
  }, [dispatch, isOnline, notifyNonBlocking, unsyncedCount]);

  useEffect(() => {
    unsyncedCountRef.current = unsyncedCount;
  }, [unsyncedCount]);

  // 将提醒按类别组织
  const organizeReminders = useCallback(() => {
    if (!reminders || reminders.length === 0) {
      setReminderSections([]);
      return;
    }

    // 根据过滤条件筛选提醒
    let filteredReminders = [...reminders];

    // 基本过滤
    if (filter === 'today') {
      filteredReminders = reminders.filter(reminder => {
        const dueDate = new Date(reminder.dueDate || reminder.due_date);
        return isToday(dueDate);
      });
    } else if (filter === 'upcoming') {
      filteredReminders = reminders.filter(reminder => {
        const dueDate = new Date(reminder.dueDate || reminder.due_date);
        return isFuture(dueDate) && !reminder.is_completed;
      });
    } else if (filter === 'completed') {
      filteredReminders = reminders.filter(reminder => reminder.is_completed);
    }

    // 应用高级过滤
    if (advancedFilters.priority !== 'all') {
      filteredReminders = filteredReminders.filter(reminder =>
        reminder.priority === advancedFilters.priority
      );
    }

    if (advancedFilters.category !== 'all') {
      filteredReminders = filteredReminders.filter(reminder =>
        reminder.category === advancedFilters.category
      );
    }

    if (advancedFilters.startDate) {
      const startDate = new Date(advancedFilters.startDate);
      startDate.setHours(0, 0, 0, 0);
      filteredReminders = filteredReminders.filter(reminder => {
        const dueDate = new Date(reminder.dueDate || reminder.due_date);
        return dueDate >= startDate;
      });
    }

    if (advancedFilters.endDate) {
      const endDate = new Date(advancedFilters.endDate);
      endDate.setHours(23, 59, 59, 999);
      filteredReminders = filteredReminders.filter(reminder => {
        const dueDate = new Date(reminder.dueDate || reminder.due_date);
        return dueDate <= endDate;
      });
    }

    if (advancedFilters.tags && advancedFilters.tags.length > 0) {
      filteredReminders = filteredReminders.filter(reminder => {
        if (!reminder.tags) {return false;}

        // 将标签字符串转换为数组
        const reminderTags = reminder.tags.split(',').map(tag => tag.trim());

        // 检查是否包含任何选定的标签
        return advancedFilters.tags.some(tag => reminderTags.includes(tag));
      });
    }

    const now = new Date();

    // 过期提醒
    const overdue = filteredReminders.filter(reminder => {
      const dueDate = new Date(reminder.dueDate || reminder.due_date);
      return isPast(dueDate) && !isToday(dueDate) && !reminder.is_completed;
    });

    // 今日提醒
    const today = filteredReminders.filter(reminder => {
      const dueDate = new Date(reminder.dueDate || reminder.due_date);
      return isToday(dueDate) && !reminder.is_completed;
    });

    // 明日提醒
    const nextDay = filteredReminders.filter(reminder => {
      const dueDate = new Date(reminder.dueDate || reminder.due_date);
      return isToday(addDays(dueDate, -1)) && !reminder.is_completed;
    });

    // 未来提醒
    const future = filteredReminders.filter(reminder => {
      const dueDate = new Date(reminder.dueDate || reminder.due_date);
      return isFuture(dueDate) && !isToday(addDays(dueDate, -1)) && !reminder.is_completed;
    });

    // 已完成提醒
    const completed = filteredReminders.filter(reminder => reminder.is_completed);

    const sections = [];

    if (overdue.length > 0 && filter !== 'completed') {
      sections.push({
        title: '已过期',
        data: overdue.sort((a, b) => {
          const dateA = new Date(a.dueDate || a.due_date);
          const dateB = new Date(b.dueDate || b.due_date);
          return dateA - dateB; // 按日期升序排序
        }),
        key: 'overdue',
      });
    }

    if (today.length > 0 && (filter === 'all' || filter === 'today')) {
      sections.push({
        title: '今日',
        data: today.sort((a, b) => {
          const dateA = new Date(a.dueDate || a.due_date);
          const dateB = new Date(b.dueDate || b.due_date);
          return dateA - dateB; // 按日期升序排序
        }),
        key: 'today',
      });
    }

    if (nextDay.length > 0 && filter !== 'today' && filter !== 'completed') {
      sections.push({
        title: '明日',
        data: nextDay.sort((a, b) => {
          const dateA = new Date(a.dueDate || a.due_date);
          const dateB = new Date(b.dueDate || b.due_date);
          return dateA - dateB; // 按日期升序排序
        }),
        key: 'tomorrow',
      });
    }

    if (future.length > 0 && filter !== 'today' && filter !== 'completed') {
      sections.push({
        title: '未来',
        data: future.sort((a, b) => {
          const dateA = new Date(a.dueDate || a.due_date);
          const dateB = new Date(b.dueDate || b.due_date);
          return dateA - dateB; // 按日期升序排序
        }),
        key: 'future',
      });
    }

    if (completed.length > 0 && (filter === 'all' || filter === 'completed')) {
      sections.push({
        title: '已完成',
        data: completed.sort((a, b) => {
          const dateA = new Date(a.completed_at || a.updated_at || a.created_at);
          const dateB = new Date(b.completed_at || b.updated_at || b.created_at);
          return dateB - dateA; // 按完成时间降序排序
        }),
        key: 'completed',
      });
    }

    setReminderSections(sections);
  }, [advancedFilters, filter, reminders]);

  // 初始化
  useEffect(() => {
    const unsubscribe = networkService.addNetworkListener(state => {
      const online = Boolean(state?.isOnline);
      setIsOnline(online);

      if (online && unsyncedCountRef.current > 0) {
        syncOfflineReminders();
      }
    });

    loadRemindersData();

    return () => {
      unsubscribe();
    };
  }, [loadRemindersData, syncOfflineReminders]);

  useFocusEffect(
    useCallback(() => {
      dispatch(refreshUnsyncedCount());
      loadRemindersData();
    }, [dispatch, loadRemindersData])
  );

  // 当提醒列表变化时，更新分组
  useEffect(() => {
    organizeReminders();
  }, [organizeReminders]);

  // 同步动画
  useEffect(() => {
    if (syncing) {
      setShowSyncIndicator(true);
      Animated.loop(
        Animated.timing(syncRotation, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      setTimeout(() => {
        setShowSyncIndicator(false);
      }, 1000);
      syncRotation.setValue(0);
    }
  }, [syncRotation, syncing]);

  // 切换提醒完成状态
  const handleToggleComplete = async (reminder) => {
    try {
      // 更新提醒对象
      const updatedReminder = {
        ...reminder,
        is_completed: !reminder.is_completed,
        completed_at: !reminder.is_completed ? new Date().toISOString() : null,
      };

      // 调度更新提醒操作
      dispatch(updateLocalReminder({
        id: reminder.id,
        reminderData: updatedReminder,
      }));

      // 更新服务器
      try {
        if (updatedReminder.is_completed) {
          await reminderApi.completeReminder(reminder.id, {
            suppressGlobalErrorUI: true,
          });
        } else {
          await reminderApi.reopenReminder(reminder.id, {
            suppressGlobalErrorUI: true,
          });
        }
      } catch (error) {
        logDegradedReminderAction('更新提醒状态失败:', error);
        // 保存到离线存储
        await reminderNotificationService.saveOfflineReminderUpdate(updatedReminder);
        await dispatch(refreshUnsyncedCount());
      }
    } catch (error) {
      logDegradedReminderAction('切换提醒完成状态失败:', error);
      notifyNonBlocking('更新提醒失败');
    }
  };

  // 切换提醒启用状态
  const handleToggleEnabled = async (reminder) => {
    try {
      // 更新提醒对象
      const updatedReminder = {
        ...reminder,
        is_enabled: !reminder.is_enabled,
      };

      // 调度更新提醒操作
      dispatch(updateLocalReminder({
        id: reminder.id,
        reminderData: updatedReminder,
      }));

      // 更新服务器
      try {
        if (updatedReminder.is_enabled) {
          await reminderApi.toggleEnableReminder(reminder.id, true, {
            suppressGlobalErrorUI: true,
          });
        } else {
          await reminderApi.toggleEnableReminder(reminder.id, false, {
            suppressGlobalErrorUI: true,
          });
        }
      } catch (error) {
        logDegradedReminderAction('更新提醒启用状态失败:', error);
        // 保存到离线存储
        await reminderNotificationService.saveOfflineReminderUpdate(updatedReminder);
        await dispatch(refreshUnsyncedCount());
      }
    } catch (error) {
      logDegradedReminderAction('切换提醒启用状态失败:', error);
      notifyNonBlocking('更新提醒失败');
    }
  };

  // 删除提醒
  const handleDeleteReminder = async (reminder) => {
    try {
      // 确认删除
      Alert.alert(
        '确认删除',
        `确定要删除提醒"${reminder.title}"吗？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '删除',
            style: 'destructive',
            onPress: async () => {
              try {
                // 调度删除提醒操作
                dispatch(deleteLocalReminder(reminder.id));

                // 删除服务器数据
                try {
                  await reminderApi.deleteReminder(reminder.id, {
                    suppressGlobalErrorUI: true,
                  });
                } catch (error) {
                  logDegradedReminderAction('删除提醒失败:', error);
                  await reminderNotificationService.saveOfflineReminderDelete(reminder);
                  await dispatch(refreshUnsyncedCount());
                }
              } catch (error) {
                logDegradedReminderAction('删除提醒失败:', error);
                notifyNonBlocking('删除提醒失败');
              }
            },
          },
        ]
      );
    } catch (error) {
      logDegradedReminderAction('删除提醒操作失败:', error);
    }
  };

  // 刷新提醒列表
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadRemindersData();

      // 如果有网络连接，尝试同步离线提醒
      if (isOnline && unsyncedCount > 0) {
        await syncOfflineReminders();
      }
    } catch (error) {
      logDegradedReminderAction('刷新提醒列表失败:', error);
    } finally {
      setRefreshing(false);
    }
  }, [isOnline, loadRemindersData, logDegradedReminderAction, syncOfflineReminders, unsyncedCount]);

  // 切换提醒选择状态
  const handleToggleSelect = (reminder) => {
    if (selectedReminders.includes(reminder.id)) {
      setSelectedReminders(selectedReminders.filter(id => id !== reminder.id));
    } else {
      setSelectedReminders([...selectedReminders, reminder.id]);
    }
  };

  // 批量完成提醒
  const handleBatchComplete = async () => {
    try {
      setSyncing(true);

      // 获取选中的提醒
      const selectedItems = reminders.filter(reminder =>
        selectedReminders.includes(reminder.id) && !reminder.is_completed
      );

      if (selectedItems.length === 0) {
        notifyNonBlocking('没有选中未完成的提醒');
        return;
      }

      // 确认操作
      Alert.alert(
        '批量完成',
        `确定要将选中的 ${selectedItems.length} 个提醒标记为已完成吗？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '确定',
            onPress: async () => {
              try {
                // 更新每个提醒
                for (const reminder of selectedItems) {
                  const updatedReminder = {
                    ...reminder,
                    is_completed: true,
                    completed_at: new Date().toISOString(),
                  };

                  // 更新Redux状态
                  dispatch(updateLocalReminder({
                    id: reminder.id,
                    reminderData: updatedReminder,
                  }));

                  // 更新服务器
                  if (isOnline) {
                    try {
                      await reminderApi.completeReminder(reminder.id, {
                        suppressGlobalErrorUI: true,
                      });
                    } catch (error) {
                      logDegradedReminderAction(`更新提醒 ${reminder.id} 状态失败:`, error);
                      // 保存到离线存储
                      await reminderNotificationService.saveOfflineReminderUpdate(updatedReminder);
                      await dispatch(refreshUnsyncedCount());
                    }
                  } else {
                    // 离线模式，保存到本地
                    await reminderNotificationService.saveOfflineReminderUpdate(updatedReminder);
                    await dispatch(refreshUnsyncedCount());
                  }
                }

                // 清除选择
                setSelectedReminders([]);
                setShowBatchActions(false);

                // 显示成功消息
                notifyNonBlocking(`已完成 ${selectedItems.length} 个提醒`);
              } catch (error) {
                logDegradedReminderAction('批量完成提醒失败:', error);
                notifyNonBlocking('批量完成提醒失败');
              } finally {
                setSyncing(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      logDegradedReminderAction('批量操作失败:', error);
      notifyNonBlocking('批量操作失败');
      setSyncing(false);
    }
  };

  // 批量删除提醒
  const handleBatchDelete = async () => {
    try {
      if (selectedReminders.length === 0) {
        notifyNonBlocking('没有选中的提醒');
        return;
      }

      // 确认操作
      Alert.alert(
        '批量删除',
        `确定要删除选中的 ${selectedReminders.length} 个提醒吗？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '删除',
            style: 'destructive',
            onPress: async () => {
              try {
                setSyncing(true);

                // 删除每个提醒
                for (const id of selectedReminders) {
                  // 更新Redux状态
                  dispatch(deleteLocalReminder(id));

                  // 更新服务器
                  if (isOnline) {
                    try {
                      await reminderApi.deleteReminder(id, {
                        suppressGlobalErrorUI: true,
                      });
                    } catch (error) {
                      logDegradedReminderAction(`删除提醒 ${id} 失败:`, error);
                      await reminderNotificationService.saveOfflineReminderDelete(id);
                      await dispatch(refreshUnsyncedCount());
                    }
                  } else {
                    await reminderNotificationService.saveOfflineReminderDelete(id);
                    await dispatch(refreshUnsyncedCount());
                  }
                }

                // 清除选择
                setSelectedReminders([]);
                setShowBatchActions(false);

                // 显示成功消息
                notifyNonBlocking(`已删除 ${selectedReminders.length} 个提醒`);
              } catch (error) {
                logDegradedReminderAction('批量删除提醒失败:', error);
                notifyNonBlocking('批量删除提醒失败');
              } finally {
                setSyncing(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      logDegradedReminderAction('批量操作失败:', error);
      notifyNonBlocking('批量操作失败');
    }
  };

  // 应用高级筛选
  const applyAdvancedFilters = () => {
    setShowFilterModal(false);
    // 筛选已在organizeReminders函数中应用
  };

  // 重置高级筛选
  const resetAdvancedFilters = () => {
    setAdvancedFilters({
      priority: 'all',
      category: 'all',
      startDate: null,
      endDate: null,
      tags: [],
    });
  };

  // 渲染提醒项
  const renderReminderItem = ({ item }) => {
    const dueDate = new Date(item.dueDate || item.due_date);
    const isPastDue = isPast(dueDate) && !isToday(dueDate);

    // 确保主题颜色存在，提供默认值
    const defaultColor = '#2196F3'; // 默认蓝色
    const errorColor = theme?.error || '#F44336'; // 错误颜色
    const warningColor = theme?.warning || '#FFEB3B'; // 警告颜色
    const primaryColor = theme?.primary || defaultColor; // 主色调

    const color = item.color || (
      isPastDue
        ? errorColor
        : isToday(dueDate)
          ? warningColor
          : primaryColor
    );

    // 检查是否为离线创建的提醒
    const isOffline = item.id.toString().startsWith('local-');

    // 检查是否被选中
    const isSelected = selectedReminders.includes(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.reminderItem,
          {
            backgroundColor: isSelected ? (theme?.primary || '#2196F3') + '15' : (theme?.cardBackground || '#FFFFFF'),
            borderLeftWidth: 4,
            borderLeftColor: color,
            opacity: !item.is_enabled ? 0.7 : 1,
          },
        ]}
        testID={`item.reminder.${item.id}`}
        onPress={() => showBatchActions ? handleToggleSelect(item) : navigation?.navigate('ReminderDetail', { id: item.id, reminder: item })}
        onLongPress={() => {
          if (!showBatchActions) {
            setShowBatchActions(true);
            handleToggleSelect(item);
          }
        }}
      >
        {showBatchActions ? (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => handleToggleSelect(item)}
          >
            <View             style={[
              styles.checkbox,
              {
                borderColor: theme?.primary || '#2196F3',
                backgroundColor: isSelected ? (theme?.primary || '#2196F3') : 'transparent',
              },
            ]}>
              {isSelected && (
                <Icon name="check" size={16} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => handleToggleComplete(item)}
          >
            <View style={[
              styles.checkbox,
              {
                borderColor: color,
                backgroundColor: item.is_completed ? color : 'transparent',
              },
            ]}>
              {item.is_completed && (
                <Icon name="check" size={16} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.reminderInfo}>
          <View style={styles.titleRow}>
            <Text style={[
              styles.reminderTitle,
              {
                color: theme?.text || '#000000',
                textDecorationLine: item.is_completed ? 'line-through' : 'none',
                fontWeight: item.is_completed ? 'normal' : 'bold',
              },
            ]}>
              {item.title}
            </Text>

            {!item.is_enabled && (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: getThemeColor('primary', '#2196F3') + '14',
                    borderColor: getThemeColor('primary', '#2196F3') + '33',
                  },
                ]}
              >
                <Text style={[styles.statusBadgeText, { color: getThemeColor('primary', '#2196F3') }]}>
                  已暂停
                </Text>
              </View>
            )}

            {isOffline && (
              <View style={[styles.offlineBadge, { backgroundColor: (theme?.warning || '#FFEB3B') + '30', borderColor: theme?.warning || '#FFEB3B' }]}>
                <Text style={[styles.offlineText, { color: theme?.warning || '#FFEB3B' }]}>
                  离线
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.reminderDate, { color: theme?.textSecondary || '#666666' }]}>
            {format(dueDate, 'yyyy-MM-dd HH:mm', { locale: zhCN })}
          </Text>

          <View style={styles.metaContainer}>
            {item.category && (
              <View style={[styles.categoryBadge, { backgroundColor: color + '20', borderColor: color }]}>
                <Text style={[styles.categoryText, { color }]}>
                  {getCategoryName(item.category)}
                </Text>
              </View>
            )}

                         {item.frequency && item.frequency !== 'once' && (
               <View style={[styles.frequencyBadge, { backgroundColor: getThemeColor('background', '#FFFFFF') }]}>
                 <Text style={[styles.frequencyText, { color: getThemeColor('textSecondary', '#666666') }]}>
                   {getFrequencyName(item.frequency)}
                 </Text>
               </View>
             )}

            {item.priority && item.priority !== 'medium' && (
                             <View style={[
                 styles.priorityBadge,
                 {
                   backgroundColor:
                     item.priority === 'high'
                       ? getThemeColor('error', '#F44336') + '20'
                       : item.priority === 'low'
                         ? getThemeColor('success', '#4CAF50') + '20'
                         : getThemeColor('background', '#FFFFFF'),
                   borderColor:
                     item.priority === 'high'
                       ? getThemeColor('error', '#F44336')
                       : item.priority === 'low'
                         ? getThemeColor('success', '#4CAF50')
                         : getThemeColor('border', '#E0E0E0'),
                 },
               ]}>
                 <Text style={[
                   styles.priorityText,
                   {
                     color:
                       item.priority === 'high'
                         ? getThemeColor('error', '#F44336')
                         : item.priority === 'low'
                           ? getThemeColor('success', '#4CAF50')
                           : getThemeColor('textSecondary', '#666666'),
                   },
                 ]}>
                  {item.priority === 'high' ? '高优先级' : item.priority === 'low' ? '低优先级' : '中优先级'}
                </Text>
              </View>
            )}
          </View>

                     {item.tags && (
             <View style={styles.tagsContainer}>
               {item.tags.split(',').map((tag, index) => (
                 <View
                   key={index}
                   style={[styles.tagBadge, { backgroundColor: getThemeColor('background', '#FFFFFF'), borderColor: getThemeColor('border', '#E0E0E0') }]}
                 >
                   <Text style={[styles.tagText, { color: getThemeColor('textSecondary', '#666666') }]}>
                     #{tag.trim()}
                   </Text>
                 </View>
               ))}
             </View>
           )}
        </View>

        {!showBatchActions && (
          <View style={styles.reminderActions}>
             <TouchableOpacity
               onPress={() => handleToggleEnabled(item)}
               style={[
                 styles.iconButton,
                 !item.is_enabled && {
                   backgroundColor: getThemeColor('primary', '#2196F3') + '12',
                   borderColor: getThemeColor('primary', '#2196F3') + '2E',
                 },
               ]}
               testID={`action.reminder.toggle.${item.id}`}
             >
               <Icon
                 name={item.is_enabled ? 'notifications-active' : 'notifications-off'}
                 size={20}
                 color={item.is_enabled ? color : getThemeColor('textSecondary', '#666666')}
               />
             </TouchableOpacity>

             <TouchableOpacity
               onPress={() => handleDeleteReminder(item)}
               style={styles.iconButton}
               testID={`action.reminder.delete.${item.id}`}
             >
               <Icon name="delete-outline" size={20} color={getThemeColor('error', '#F44336')} />
             </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // 获取分类名称
  const getCategoryName = (category) => {
    const categories = {
      'work': '工作',
      'study': '学习',
      'personal': '个人',
      'health': '健康',
      'finance': '财务',
      'social': '社交',
      'other': '其他',
    };
    return categories[category] || '其他';
  };

  // 获取频率名称
  const getFrequencyName = (frequency) => {
    const frequencies = {
      'once': '一次',
      'daily': '每天',
      'weekly': '每周',
      'monthly': '每月',
      'yearly': '每年',
    };
    return frequencies[frequency] || '一次';
  };

  // 渲染分组标题
  const renderSectionHeader = ({ section }) => (
    <View style={[styles.sectionHeader, { backgroundColor: getThemeColor('background', '#FFFFFF') }]}>
      <Text style={[styles.sectionTitle, { color: getThemeColor('text', '#000000') }]}>
        {section.title}
      </Text>
      <Text style={[styles.sectionCount, { color: getThemeColor('textSecondary', '#666666') }]}>
        {section.data.length}项
      </Text>
    </View>
  );

  // 渲染过滤器
  const renderFilterBar = () => (
    <View style={[styles.filterBar, { backgroundColor: getThemeColor('cardBackground', '#FFFFFF') }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'all' && { backgroundColor: getThemeColor('primary', '#2196F3') + '20' },
          ]}
          onPress={() => setFilter('all')}
          testID="filter.reminder.all"
        >
          <Text style={[
            styles.filterText,
            { color: filter === 'all' ? getThemeColor('primary', '#2196F3') : getThemeColor('textSecondary', '#666666') },
          ]}>
            全部
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'today' && { backgroundColor: getThemeColor('primary', '#2196F3') + '20' },
          ]}
          onPress={() => setFilter('today')}
          testID="filter.reminder.today"
        >
          <Text style={[
            styles.filterText,
            { color: filter === 'today' ? getThemeColor('primary', '#2196F3') : getThemeColor('textSecondary', '#666666') },
          ]}>
            今日
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'upcoming' && { backgroundColor: getThemeColor('primary', '#2196F3') + '20' },
          ]}
          onPress={() => setFilter('upcoming')}
          testID="filter.reminder.upcoming"
        >
          <Text style={[
            styles.filterText,
            { color: filter === 'upcoming' ? getThemeColor('primary', '#2196F3') : getThemeColor('textSecondary', '#666666') },
          ]}>
            即将到期
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'completed' && { backgroundColor: getThemeColor('primary', '#2196F3') + '20' },
          ]}
          onPress={() => setFilter('completed')}
          testID="filter.reminder.completed"
        >
          <Text style={[
            styles.filterText,
            { color: filter === 'completed' ? getThemeColor('primary', '#2196F3') : getThemeColor('textSecondary', '#666666') },
          ]}>
            已完成
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity
         style={[
           styles.advancedFilterButton,
           (advancedFilters.priority !== 'all' ||
            advancedFilters.category !== 'all' ||
            advancedFilters.startDate ||
            advancedFilters.endDate ||
            advancedFilters.tags.length > 0) &&
           { backgroundColor: getThemeColor('primary', '#2196F3') + '20' },
         ]}
         onPress={() => setShowFilterModal(true)}
         testID="filter.reminder.advanced"
       >
         <Icon
           name="filter-list"
           size={16}
           color={
             (advancedFilters.priority !== 'all' ||
              advancedFilters.category !== 'all' ||
              advancedFilters.startDate ||
              advancedFilters.endDate ||
              advancedFilters.tags.length > 0)
               ? getThemeColor('primary', '#2196F3')
               : getThemeColor('textSecondary', '#666666')
           }
         />
         <Text style={[
           styles.advancedFilterText,
           {
             color: (advancedFilters.priority !== 'all' ||
               advancedFilters.category !== 'all' ||
               advancedFilters.startDate ||
               advancedFilters.endDate ||
               advancedFilters.tags.length > 0)
                 ? getThemeColor('primary', '#2196F3')
                 : getThemeColor('textSecondary', '#666666'),
           },
         ]}>
           筛选
         </Text>
       </TouchableOpacity>
    </View>
  );

    // 渲染加载中状态
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: getThemeColor('background', '#FFFFFF') }]}>
        <ActivityIndicator size="large" color={getThemeColor('primary', '#2196F3')} />
      </SafeAreaView>
    );
  }

  // 渲染空状态
  const renderEmptyList = () => (
    <View style={styles.emptyContainer} testID="state.reminder.empty">
      <Icon name="event-note" size={64} color={getThemeColor('primary', '#2196F3')} />
      <Text style={[styles.emptyText, { color: getThemeColor('textSecondary', '#666666') }]}>
        {listState === 'offline-empty' ? '离线模式下暂无本地提醒' : '暂无提醒'}
      </Text>
      <Text style={[styles.emptySubText, { color: getThemeColor('textSecondary', '#666666') }]}>
        {listState === 'offline' || listState === 'offline-empty'
          ? '网络恢复后会自动刷新，你也可以先在本地继续添加和管理提醒'
          : '点击右下角的加号按钮添加新提醒'}
      </Text>
    </View>
  );

  // 渲染高级筛选模态框
  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowFilterModal(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: getThemeColor('cardBackground', '#FFFFFF') }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: getThemeColor('text', '#000000') }]}>高级筛选</Text>
            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
              <Icon name="close" size={24} color={getThemeColor('text', '#000000')} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* 优先级筛选 */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: getThemeColor('text', '#000000') }]}>优先级</Text>
              <View style={styles.filterOptions}>
                {['all', 'high', 'medium', 'low'].map(priority => (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.filterOption,
                      advancedFilters.priority === priority && {
                        backgroundColor: getThemeColor('primary', '#2196F3') + '20',
                        borderColor: getThemeColor('primary', '#2196F3'),
                      },
                    ]}
                    onPress={() => setAdvancedFilters({...advancedFilters, priority})}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      { color: advancedFilters.priority === priority ? getThemeColor('primary', '#2196F3') : getThemeColor('text', '#000000') },
                    ]}>
                      {priority === 'all' ? '全部' :
                       priority === 'high' ? '高' :
                       priority === 'medium' ? '中' : '低'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 分类筛选 */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: getThemeColor('text', '#000000') }]}>分类</Text>
              <View style={styles.filterOptions}>
                {['all', 'work', 'study', 'personal', 'health', 'finance', 'social', 'other'].map(category => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.filterOption,
                      advancedFilters.category === category && {
                        backgroundColor: getThemeColor('primary', '#2196F3') + '20',
                        borderColor: getThemeColor('primary', '#2196F3'),
                      },
                    ]}
                    onPress={() => setAdvancedFilters({...advancedFilters, category})}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      { color: advancedFilters.category === category ? getThemeColor('primary', '#2196F3') : getThemeColor('text', '#000000') },
                    ]}>
                      {category === 'all' ? '全部' : getCategoryName(category)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

                         {/* 日期范围筛选 */}
             <View style={styles.filterSection}>
               <Text style={[styles.filterSectionTitle, { color: getThemeColor('text', '#000000') }]}>日期范围</Text>
               <View style={styles.dateRangeContainer}>
                 <TouchableOpacity
                   style={[styles.dateInput, { borderColor: getThemeColor('border', '#E0E0E0') }]}
                   onPress={() => {
                     // 显示日期选择器
                     // 这里需要实现日期选择逻辑
                   }}
                 >
                   <Text style={[styles.dateText, { color: advancedFilters.startDate ? getThemeColor('text', '#000000') : getThemeColor('textSecondary', '#666666') }]}>
                     {advancedFilters.startDate ? format(new Date(advancedFilters.startDate), 'yyyy-MM-dd') : '开始日期'}
                   </Text>
                 </TouchableOpacity>

                 <Text style={[styles.dateRangeSeparator, { color: getThemeColor('textSecondary', '#666666') }]}>至</Text>

                 <TouchableOpacity
                   style={[styles.dateInput, { borderColor: getThemeColor('border', '#E0E0E0') }]}
                   onPress={() => {
                     // 显示日期选择器
                     // 这里需要实现日期选择逻辑
                   }}
                 >
                   <Text style={[styles.dateText, { color: advancedFilters.endDate ? getThemeColor('text', '#000000') : getThemeColor('textSecondary', '#666666') }]}>
                     {advancedFilters.endDate ? format(new Date(advancedFilters.endDate), 'yyyy-MM-dd') : '结束日期'}
                   </Text>
                 </TouchableOpacity>
               </View>
             </View>
           </ScrollView>

           <View style={styles.modalFooter}>
             <TouchableOpacity
               style={[styles.modalButton, { borderColor: getThemeColor('border', '#E0E0E0') }]}
               onPress={resetAdvancedFilters}
             >
               <Text style={[styles.modalButtonText, { color: getThemeColor('text', '#000000') }]}>重置</Text>
             </TouchableOpacity>

             <TouchableOpacity
               style={[styles.modalButton, { backgroundColor: getThemeColor('primary', '#2196F3') }]}
               onPress={applyAdvancedFilters}
             >
               <Text style={[styles.modalButtonText, { color: '#fff' }]}>应用</Text>
             </TouchableOpacity>
           </View>
        </View>
      </View>
    </Modal>
  );

  // 渲染批量操作工具栏
  const renderBatchToolbar = () => (
    <View style={[styles.batchToolbar, { backgroundColor: getThemeColor('cardBackground', '#FFFFFF') }]}>
      <View style={styles.batchInfo}>
        <Text style={[styles.batchCount, { color: getThemeColor('text', '#000000') }]}>
          已选择 {selectedReminders.length} 项
        </Text>
      </View>

      <View style={styles.batchActions}>
        <TouchableOpacity
          style={styles.batchAction}
          onPress={handleBatchComplete}
        >
          <Icon name="done-all" size={20} color={getThemeColor('primary', '#2196F3')} />
          <Text style={[styles.batchActionText, { color: getThemeColor('primary', '#2196F3') }]}>完成</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.batchAction}
          onPress={handleBatchDelete}
        >
          <Icon name="delete-sweep" size={20} color={getThemeColor('error', '#F44336')} />
          <Text style={[styles.batchActionText, { color: getThemeColor('error', '#F44336') }]}>删除</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.batchAction}
          onPress={() => {
            setSelectedReminders([]);
            setShowBatchActions(false);
          }}
        >
          <Icon name="close" size={20} color={getThemeColor('textSecondary', '#666666')} />
          <Text style={[styles.batchActionText, { color: getThemeColor('textSecondary', '#666666') }]}>取消</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // 渲染同步指示器
  const renderSyncIndicator = () => {
    if (!showSyncIndicator) {return null;}

    const spin = syncRotation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <View style={[styles.syncIndicator, { backgroundColor: getThemeColor('cardBackground', '#FFFFFF') }]}>
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Icon name="sync" size={20} color={getThemeColor('primary', '#2196F3')} />
        </Animated.View>
        <Text style={[styles.syncText, { color: getThemeColor('textSecondary', '#666666') }]}>
          {syncing ? '同步中...' : '同步完成'}
        </Text>
      </View>
    );
  };

  const renderSyncStatusCard = () => {
    const isOfflineView = listState === 'offline' || listState === 'offline-empty';
    const hasUnsyncedChanges = unsyncedCount > 0;
    const shouldRender = isOfflineView || hasUnsyncedChanges || syncing || Boolean(inlineHint);

    if (!shouldRender) {
      return null;
    }

    const statusTone = syncing
      ? getThemeColor('primary', '#2196F3')
      : hasUnsyncedChanges
        ? getThemeColor('warning', '#FFB300')
        : isOfflineView
          ? getThemeColor('primary', '#2196F3')
          : getThemeColor('success', '#2E7D32');

    const statusTitle = syncing
      ? '同步处理中'
      : hasUnsyncedChanges
        ? `待同步操作 ${unsyncedCount} 条`
        : isOfflineView
          ? '离线本地视图'
          : '同步状态正常';

    const statusDescription = inlineHint || (
      syncing
        ? '正在对齐本地提醒与离线队列，请稍候。'
        : hasUnsyncedChanges
          ? '当前页面已显示本地提醒，联网后会继续自动同步离线操作。'
          : isOfflineView
            ? '当前已优先展示本地提醒，恢复联网后可继续校验同步结果。'
            : '当前提醒列表与同步状态没有新的阻塞提示。'
    );

    return (
      <View
        style={[
          styles.syncStatusCard,
          {
            backgroundColor: getThemeColor('cardBackground', '#FFFFFF') + 'E8',
            borderColor: statusTone + '3D',
            shadowColor: statusTone,
          },
        ]}
        testID="state.reminder.syncStatus"
      >
        <View style={[styles.syncStatusAccent, { backgroundColor: statusTone }]} />
        <View style={styles.syncStatusContent}>
          <View style={styles.syncStatusHeader}>
            <Text style={[styles.syncStatusTitle, { color: getThemeColor('text', '#0F172A') }]}>
              <Icon
                name={syncing ? 'sync' : hasUnsyncedChanges ? 'pending-actions' : isOfflineView ? 'cloud-off' : 'check-circle'}
                size={14}
                color={statusTone}
              />
              {' '}
              {statusTitle}
            </Text>
            <View
              style={[
                styles.syncStatusPill,
                { backgroundColor: statusTone + '14', borderColor: statusTone + '24' },
              ]}
            >
              <Text style={[styles.syncStatusPillText, { color: statusTone }]}>
                {syncing ? '同步中' : hasUnsyncedChanges ? '待处理' : isOfflineView ? '离线' : '正常'}
              </Text>
            </View>
          </View>
          <Text style={[styles.syncStatusDescription, { color: getThemeColor('textSecondary', '#64748B') }]}>
            {statusDescription}
          </Text>
        </View>
      </View>
    );
  };

  if (!hasNavigation) {
    logDegradedReminderAction('ReminderListView: navigation对象未定义');
    return (
      <SafeAreaView style={styles.navigationErrorContainer}>
        <Text style={styles.navigationErrorText}>导航错误，请重新进入页面</Text>
      </SafeAreaView>
    );
  }

  // 主渲染
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: getThemeColor('background', '#FFFFFF') }]}>
      {renderFilterBar()}
      {renderSyncStatusCard()}

      <SectionList
        sections={reminderSections}
        renderItem={renderReminderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[getThemeColor('primary', '#2196F3')]}
            tintColor={getThemeColor('primary', '#2196F3')}
          />
        }
      />

      {showBatchActions && renderBatchToolbar()}
      {renderSyncIndicator()}
      {renderFilterModal()}

      {/* 添加提醒按钮 */}
      {!showBatchActions && (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: getThemeColor('primary', '#2196F3') }]}
          onPress={() => navigation?.navigate('ReminderAdd')}
          testID="action.reminder.add"
        >
          <Icon name="add" size={24} color="#ffffff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // 移除调试边框，确保内容在状态栏下方正确显示
    // borderWidth: 1,
    // borderColor: 'red',
  },
  filterBar: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 0, // 确保没有顶部边距
    // 为Android添加状态栏高度补偿，确保过滤器栏在状态栏下方
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 8,
  },
  filterScroll: {
    flex: 1,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 16,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
     advancedFilterButton: {
     flexDirection: 'row',
     alignItems: 'center',
     paddingHorizontal: 12,
     paddingVertical: 8,
     borderRadius: 20,
     marginLeft: 8,
     minWidth: 60,
   },
   advancedFilterText: {
     fontSize: 14,
     fontWeight: '500',
     marginLeft: 4,
   },
  listContainer: {
    paddingBottom: 88,
    flexGrow: 1,
  },
  syncStatusCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    borderRadius: 26,
    borderWidth: 1,
    borderStyle: 'solid',
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'stretch',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13,
    shadowRadius: 22,
    elevation: 5,
  },
  syncStatusAccent: {
    width: 4,
    borderRadius: 999,
    marginRight: 12,
    opacity: 0.9,
  },
  syncStatusContent: {
    flex: 1,
  },
  syncStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  syncStatusTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
    lineHeight: 21,
  },
  syncStatusDescription: {
    fontSize: 13,
    lineHeight: 21,
    letterSpacing: 0.1,
  },
  syncStatusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 4,
    minWidth: 62,
    alignItems: 'center',
  },
  syncStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  completeButton: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  reminderTitle: {
    fontSize: 16,
    flex: 1,
  },
  offlineBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    marginLeft: 8,
  },
  offlineText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  reminderDate: {
    fontSize: 12,
    marginBottom: 4,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 12,
  },
  frequencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  frequencyText: {
    fontSize: 12,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
    borderWidth: 1,
  },
  priorityText: {
    fontSize: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 6,
    marginBottom: 4,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 10,
  },
  reminderActions: {
    flexDirection: 'row',
  },
  iconButton: {
    minWidth: 36,
    minHeight: 36,
    padding: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 0, // 减少顶部边距，避免超出屏幕
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionCount: {
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 0, // 移除顶部边距，避免超出屏幕
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  // 批量操作工具栏样式
  batchToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  batchInfo: {
    flex: 1,
  },
  batchCount: {
    fontWeight: 'bold',
  },
  batchActions: {
    flexDirection: 'row',
  },
  batchAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  batchActionText: {
    marginLeft: 4,
    fontSize: 14,
  },
  // 同步指示器样式
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 50 : 70, // 根据平台和状态栏高度动态调整，确保在过滤器栏下方
    right: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    zIndex: 1000, // 确保在其他元素之上
  },
  syncText: {
    marginLeft: 6,
    fontSize: 12,
  },
  // 添加按钮样式
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  // 高级筛选模态框样式
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterOptionText: {
    fontSize: 14,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInput: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
  dateText: {
    fontSize: 14,
  },
  dateRangeSeparator: {
    marginHorizontal: 10,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ReminderListView;
