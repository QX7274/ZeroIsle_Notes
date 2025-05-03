import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { loadReminders, updateReminder, deleteReminder, syncReminders } from '../../store/slices/reminderSlice';
import reminderNotificationService from '../../services/reminderNotificationService';
import api from '../../services/api';
import { API_ENDPOINTS } from '../../config/api';
import { format, isToday, isPast, isFuture, addDays, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/MaterialIcons';
import NetInfo from '@react-native-community/netinfo';

const ReminderListView = ({ navigation }) => {
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const reminders = useSelector(state => state.reminders.reminders);
  const syncStatus = useSelector(state => state.reminders.syncStatus);
  const offlineReminders = useSelector(state => state.reminders.offlineReminders || []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reminderSections, setReminderSections] = useState([]);
  const [isConnected, setIsConnected] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'today', 'upcoming', 'completed'
  const [syncing, setSyncing] = useState(false);
  const [showSyncIndicator, setShowSyncIndicator] = useState(false);
  const [syncRotation] = useState(new Animated.Value(0));
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [selectedReminders, setSelectedReminders] = useState([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    priority: 'all', // 'all', 'high', 'medium', 'low'
    category: 'all',
    startDate: null,
    endDate: null,
    tags: [],
  });

  // 初始化
  useEffect(() => {
    // 检查网络状态
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);

      // 如果网络连接恢复，尝试同步离线数据
      if (state.isConnected && offlineReminders.length > 0) {
        syncOfflineReminders();
      }
    });

    // 加载提醒数据
    loadRemindersData();

    return () => {
      unsubscribe();
    };
  }, []);

  // 当提醒列表变化时，更新分组
  useEffect(() => {
    organizeReminders();
  }, [reminders, filter, advancedFilters]);

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
      // 延迟隐藏同步指示器，以便用户可以看到同步完成
      setTimeout(() => {
        setShowSyncIndicator(false);
      }, 1000);
      syncRotation.setValue(0);
    }
  }, [syncing]);

  // 加载提醒数据
  const loadRemindersData = async () => {
    try {
      setLoading(true);

      // 首先加载本地存储的提醒，确保离线时也能显示数据
      const localReminders = await reminderNotificationService.getOfflineReminders();

      // 如果有网络连接，从服务器获取最新数据
      if (isConnected) {
        try {
          setSyncing(true);

          // 从API获取提醒
          const response = await api.get(API_ENDPOINTS.REMINDER.BASE);

          if (response.data && response.data.results) {
            // 更新Redux状态
            dispatch(loadReminders(response.data.results));

            // 更新本地存储
            await reminderNotificationService.saveAllReminders(response.data.results);

            // 显示成功消息
            if (Platform.OS === 'android') {
              ToastAndroid.show('提醒数据已更新', ToastAndroid.SHORT);
            }
          }
        } catch (error) {
          console.error('从服务器加载提醒数据失败:', error);

          // 服务器请求失败，使用本地数据
          dispatch(loadReminders(localReminders));

          // 显示错误消息
          if (Platform.OS === 'android') {
            ToastAndroid.show('无法连接到服务器，使用本地数据', ToastAndroid.SHORT);
          }
        } finally {
          setSyncing(false);
        }
      } else {
        // 离线模式，使用本地数据
        dispatch(loadReminders(localReminders));

        // 显示离线消息
        if (Platform.OS === 'android') {
          ToastAndroid.show('当前处于离线模式', ToastAndroid.SHORT);
        }
      }
    } catch (error) {
      console.error('加载提醒数据失败:', error);

      // 显示错误消息
      Alert.alert('错误', '加载提醒数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 同步离线提醒
  const syncOfflineReminders = async () => {
    try {
      // 如果没有网络连接或没有离线提醒，直接返回
      if (!isConnected || offlineReminders.length === 0) {
        return;
      }

      setSyncing(true);

      // 调用Redux action同步离线提醒
      await dispatch(syncReminders());

      // 显示成功消息
      if (Platform.OS === 'android') {
        ToastAndroid.show(`已同步${offlineReminders.length}个离线提醒`, ToastAndroid.SHORT);
      } else {
        Alert.alert('同步成功', `已同步${offlineReminders.length}个离线提醒`);
      }
    } catch (error) {
      console.error('同步离线提醒失败:', error);

      // 显示错误消息
      Alert.alert('同步失败', '无法同步离线提醒，请稍后重试');
    } finally {
      setSyncing(false);
    }
  };

  // 将提醒按类别组织
  const organizeReminders = () => {
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
        if (!reminder.tags) return false;

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
        key: 'overdue'
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
        key: 'today'
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
        key: 'tomorrow'
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
        key: 'future'
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
        key: 'completed'
      });
    }

    setReminderSections(sections);
  };

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
      dispatch(updateReminder(updatedReminder));

      // 更新服务器
      try {
        if (updatedReminder.is_completed) {
          await api.post(API_ENDPOINTS.REMINDER.COMPLETE(reminder.id));
        } else {
          await api.post(`${API_ENDPOINTS.REMINDER.DETAIL(reminder.id)}reopen/`);
        }
      } catch (error) {
        console.error('更新提醒状态失败:', error);
        // 保存到离线存储
        await reminderNotificationService.saveOfflineReminder(updatedReminder);
      }
    } catch (error) {
      console.error('切换提醒完成状态失败:', error);
      Alert.alert('错误', '更新提醒失败');
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
      dispatch(updateReminder(updatedReminder));

      // 更新服务器
      try {
        if (updatedReminder.is_enabled) {
          await api.post(API_ENDPOINTS.REMINDER.ENABLE(reminder.id));
        } else {
          await api.post(API_ENDPOINTS.REMINDER.DISABLE(reminder.id));
        }
      } catch (error) {
        console.error('更新提醒启用状态失败:', error);
        // 保存到离线存储
        await reminderNotificationService.saveOfflineReminder(updatedReminder);
      }
    } catch (error) {
      console.error('切换提醒启用状态失败:', error);
      Alert.alert('错误', '更新提醒失败');
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
                dispatch(deleteReminder(reminder.id));

                // 删除服务器数据
                try {
                  await api.delete(API_ENDPOINTS.REMINDER.DETAIL(reminder.id));
                } catch (error) {
                  console.error('删除提醒失败:', error);
                }
              } catch (error) {
                console.error('删除提醒失败:', error);
                Alert.alert('错误', '删除提醒失败');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('删除提醒操作失败:', error);
    }
  };

  // 刷新提醒列表
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadRemindersData();

      // 如果有网络连接，尝试同步离线提醒
      if (isConnected && offlineReminders.length > 0) {
        await syncOfflineReminders();
      }
    } catch (error) {
      console.error('刷新提醒列表失败:', error);
    } finally {
      setRefreshing(false);
    }
  }, [isConnected, offlineReminders]);

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
        Alert.alert('提示', '没有选中未完成的提醒');
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
                  dispatch(updateReminder(updatedReminder));

                  // 更新服务器
                  if (isConnected) {
                    try {
                      await api.post(API_ENDPOINTS.REMINDER.COMPLETE(reminder.id));
                    } catch (error) {
                      console.error(`更新提醒 ${reminder.id} 状态失败:`, error);
                      // 保存到离线存储
                      await reminderNotificationService.saveOfflineReminder(updatedReminder);
                    }
                  } else {
                    // 离线模式，保存到本地
                    await reminderNotificationService.saveOfflineReminder(updatedReminder);
                  }
                }

                // 清除选择
                setSelectedReminders([]);
                setShowBatchActions(false);

                // 显示成功消息
                if (Platform.OS === 'android') {
                  ToastAndroid.show(`已完成 ${selectedItems.length} 个提醒`, ToastAndroid.SHORT);
                } else {
                  Alert.alert('成功', `已完成 ${selectedItems.length} 个提醒`);
                }
              } catch (error) {
                console.error('批量完成提醒失败:', error);
                Alert.alert('错误', '批量完成提醒失败');
              } finally {
                setSyncing(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('批量操作失败:', error);
      Alert.alert('错误', '批量操作失败');
      setSyncing(false);
    }
  };

  // 批量删除提醒
  const handleBatchDelete = async () => {
    try {
      if (selectedReminders.length === 0) {
        Alert.alert('提示', '没有选中的提醒');
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
                  dispatch(deleteReminder(id));

                  // 更新服务器
                  if (isConnected) {
                    try {
                      await api.delete(API_ENDPOINTS.REMINDER.DETAIL(id));
                    } catch (error) {
                      console.error(`删除提醒 ${id} 失败:`, error);
                    }
                  }
                }

                // 清除选择
                setSelectedReminders([]);
                setShowBatchActions(false);

                // 显示成功消息
                if (Platform.OS === 'android') {
                  ToastAndroid.show(`已删除 ${selectedReminders.length} 个提醒`, ToastAndroid.SHORT);
                } else {
                  Alert.alert('成功', `已删除 ${selectedReminders.length} 个提醒`);
                }
              } catch (error) {
                console.error('批量删除提醒失败:', error);
                Alert.alert('错误', '批量删除提醒失败');
              } finally {
                setSyncing(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('批量操作失败:', error);
      Alert.alert('错误', '批量操作失败');
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
    const color = item.color || (
      isPastDue
        ? theme.error
        : isToday(dueDate)
          ? theme.warning
          : theme.primary
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
            backgroundColor: isSelected ? theme.primary + '15' : theme.cardBackground,
            borderLeftWidth: 4,
            borderLeftColor: color,
            opacity: !item.is_enabled ? 0.7 : 1,
          }
        ]}
        onPress={() => showBatchActions ? handleToggleSelect(item) : navigation.navigate('ReminderDetail', { id: item.id })}
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
            <View style={[
              styles.checkbox,
              {
                borderColor: theme.primary,
                backgroundColor: isSelected ? theme.primary : 'transparent',
              }
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
              }
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
                color: theme.text,
                textDecorationLine: item.is_completed ? 'line-through' : 'none',
                fontWeight: item.is_completed ? 'normal' : 'bold',
              }
            ]}>
              {item.title}
            </Text>

            {isOffline && (
              <View style={[styles.offlineBadge, { backgroundColor: theme.warning + '30', borderColor: theme.warning }]}>
                <Text style={[styles.offlineText, { color: theme.warning }]}>
                  离线
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.reminderDate, { color: theme.textSecondary }]}>
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
              <View style={[styles.frequencyBadge, { backgroundColor: theme.background }]}>
                <Text style={[styles.frequencyText, { color: theme.textSecondary }]}>
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
                      ? theme.error + '20'
                      : item.priority === 'low'
                        ? theme.success + '20'
                        : theme.background,
                  borderColor:
                    item.priority === 'high'
                      ? theme.error
                      : item.priority === 'low'
                        ? theme.success
                        : theme.border,
                }
              ]}>
                <Text style={[
                  styles.priorityText,
                  {
                    color:
                      item.priority === 'high'
                        ? theme.error
                        : item.priority === 'low'
                          ? theme.success
                          : theme.textSecondary
                  }
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
                  style={[styles.tagBadge, { backgroundColor: theme.background, borderColor: theme.border }]}
                >
                  <Text style={[styles.tagText, { color: theme.textSecondary }]}>
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
              style={styles.iconButton}
            >
              <Icon
                name={item.is_enabled ? "notifications-active" : "notifications-off"}
                size={20}
                color={item.is_enabled ? color : theme.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleDeleteReminder(item)}
              style={styles.iconButton}
            >
              <Icon name="delete-outline" size={20} color={theme.error} />
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
    <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {section.title}
      </Text>
      <Text style={[styles.sectionCount, { color: theme.textSecondary }]}>
        {section.data.length}项
      </Text>
    </View>
  );

  // 渲染过滤器
  const renderFilterBar = () => (
    <View style={[styles.filterBar, { backgroundColor: theme.cardBackground }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'all' && { backgroundColor: theme.primary + '20' }
          ]}
          onPress={() => setFilter('all')}
        >
          <Text style={[
            styles.filterText,
            { color: filter === 'all' ? theme.primary : theme.textSecondary }
          ]}>
            全部
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'today' && { backgroundColor: theme.primary + '20' }
          ]}
          onPress={() => setFilter('today')}
        >
          <Text style={[
            styles.filterText,
            { color: filter === 'today' ? theme.primary : theme.textSecondary }
          ]}>
            今日
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'upcoming' && { backgroundColor: theme.primary + '20' }
          ]}
          onPress={() => setFilter('upcoming')}
        >
          <Text style={[
            styles.filterText,
            { color: filter === 'upcoming' ? theme.primary : theme.textSecondary }
          ]}>
            即将到期
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'completed' && { backgroundColor: theme.primary + '20' }
          ]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[
            styles.filterText,
            { color: filter === 'completed' ? theme.primary : theme.textSecondary }
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
          { backgroundColor: theme.primary + '20' }
        ]}
        onPress={() => setShowFilterModal(true)}
      >
        <Icon
          name="filter-list"
          size={20}
          color={
            (advancedFilters.priority !== 'all' ||
             advancedFilters.category !== 'all' ||
             advancedFilters.startDate ||
             advancedFilters.endDate ||
             advancedFilters.tags.length > 0)
              ? theme.primary
              : theme.textSecondary
          }
        />
      </TouchableOpacity>
    </View>
  );

  // 渲染加载中状态
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // 渲染空状态
  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Icon name="event-note" size={64} color={theme.textSecondary} />
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
        暂无提醒
      </Text>
      <Text style={[styles.emptySubText, { color: theme.textSecondary }]}>
        点击右上角的加号按钮添加新提醒
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
        <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>高级筛选</Text>
            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
              <Icon name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* 优先级筛选 */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: theme.text }]}>优先级</Text>
              <View style={styles.filterOptions}>
                {['all', 'high', 'medium', 'low'].map(priority => (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.filterOption,
                      advancedFilters.priority === priority && {
                        backgroundColor: theme.primary + '20',
                        borderColor: theme.primary,
                      }
                    ]}
                    onPress={() => setAdvancedFilters({...advancedFilters, priority})}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      { color: advancedFilters.priority === priority ? theme.primary : theme.text }
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
              <Text style={[styles.filterSectionTitle, { color: theme.text }]}>分类</Text>
              <View style={styles.filterOptions}>
                {['all', 'work', 'study', 'personal', 'health', 'finance', 'social', 'other'].map(category => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.filterOption,
                      advancedFilters.category === category && {
                        backgroundColor: theme.primary + '20',
                        borderColor: theme.primary,
                      }
                    ]}
                    onPress={() => setAdvancedFilters({...advancedFilters, category})}
                  >
                    <Text style={[
                      styles.filterOptionText,
                      { color: advancedFilters.category === category ? theme.primary : theme.text }
                    ]}>
                      {category === 'all' ? '全部' : getCategoryName(category)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 日期范围筛选 */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: theme.text }]}>日期范围</Text>
              <View style={styles.dateRangeContainer}>
                <TouchableOpacity
                  style={[styles.dateInput, { borderColor: theme.border }]}
                  onPress={() => {
                    // 显示日期选择器
                    // 这里需要实现日期选择逻辑
                  }}
                >
                  <Text style={[styles.dateText, { color: advancedFilters.startDate ? theme.text : theme.textSecondary }]}>
                    {advancedFilters.startDate ? format(new Date(advancedFilters.startDate), 'yyyy-MM-dd') : '开始日期'}
                  </Text>
                </TouchableOpacity>

                <Text style={[styles.dateRangeSeparator, { color: theme.textSecondary }]}>至</Text>

                <TouchableOpacity
                  style={[styles.dateInput, { borderColor: theme.border }]}
                  onPress={() => {
                    // 显示日期选择器
                    // 这里需要实现日期选择逻辑
                  }}
                >
                  <Text style={[styles.dateText, { color: advancedFilters.endDate ? theme.text : theme.textSecondary }]}>
                    {advancedFilters.endDate ? format(new Date(advancedFilters.endDate), 'yyyy-MM-dd') : '结束日期'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, { borderColor: theme.border }]}
              onPress={resetAdvancedFilters}
            >
              <Text style={[styles.modalButtonText, { color: theme.text }]}>重置</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.primary }]}
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
    <View style={[styles.batchToolbar, { backgroundColor: theme.cardBackground }]}>
      <View style={styles.batchInfo}>
        <Text style={[styles.batchCount, { color: theme.text }]}>
          已选择 {selectedReminders.length} 项
        </Text>
      </View>

      <View style={styles.batchActions}>
        <TouchableOpacity
          style={styles.batchAction}
          onPress={handleBatchComplete}
        >
          <Icon name="done-all" size={20} color={theme.primary} />
          <Text style={[styles.batchActionText, { color: theme.primary }]}>完成</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.batchAction}
          onPress={handleBatchDelete}
        >
          <Icon name="delete-sweep" size={20} color={theme.error} />
          <Text style={[styles.batchActionText, { color: theme.error }]}>删除</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.batchAction}
          onPress={() => {
            setSelectedReminders([]);
            setShowBatchActions(false);
          }}
        >
          <Icon name="close" size={20} color={theme.textSecondary} />
          <Text style={[styles.batchActionText, { color: theme.textSecondary }]}>取消</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // 渲染同步指示器
  const renderSyncIndicator = () => {
    if (!showSyncIndicator) return null;

    const spin = syncRotation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <View style={[styles.syncIndicator, { backgroundColor: theme.cardBackground }]}>
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Icon name="sync" size={20} color={theme.primary} />
        </Animated.View>
        <Text style={[styles.syncText, { color: theme.textSecondary }]}>
          {syncing ? '同步中...' : '同步完成'}
        </Text>
      </View>
    );
  };

  // 主渲染
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {renderFilterBar()}

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
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      />

      {showBatchActions && renderBatchToolbar()}
      {renderSyncIndicator()}
      {renderFilterModal()}

      {/* 添加提醒按钮 */}
      {!showBatchActions && (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate('AddReminder')}
        >
          <Icon name="add" size={24} color="#ffffff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterBar: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  listContainer: {
    paddingBottom: 16,
    flexGrow: 1,
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
    padding: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 8,
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
    marginTop: 40,
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
    top: 60,
    right: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
