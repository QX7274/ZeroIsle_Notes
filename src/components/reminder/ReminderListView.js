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
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { loadReminders, updateReminder, deleteReminder } from '../../store/slices/reminderSlice';
import reminderNotificationService from '../../services/reminderNotificationService';
import api from '../../services/api';
import { API_ENDPOINTS } from '../../config/api';
import { format, isToday, isPast, isFuture, addDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/MaterialIcons';

const ReminderListView = ({ navigation }) => {
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const reminders = useSelector(state => state.reminders.reminders);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reminderSections, setReminderSections] = useState([]);
  const [isConnected, setIsConnected] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'today', 'upcoming', 'completed'

  // 初始化
  useEffect(() => {
    loadRemindersData();
  }, []);

  // 当提醒列表变化时，更新分组
  useEffect(() => {
    organizeReminders();
  }, [reminders, filter]);

  // 加载提醒数据
  const loadRemindersData = async () => {
    try {
      setLoading(true);
      
      // 从API获取提醒
      const response = await api.get(API_ENDPOINTS.REMINDER.BASE);
      
      if (response.data && response.data.results) {
        dispatch(loadReminders(response.data.results));
      }
    } catch (error) {
      console.error('加载提醒数据失败:', error);
      
      // 出错时使用本地存储的提醒
      const offlineReminders = await reminderNotificationService.getOfflineReminders();
      dispatch(loadReminders(offlineReminders));
    } finally {
      setLoading(false);
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
        data: overdue,
        key: 'overdue'
      });
    }

    if (today.length > 0 && (filter === 'all' || filter === 'today')) {
      sections.push({
        title: '今日',
        data: today,
        key: 'today'
      });
    }

    if (nextDay.length > 0 && filter !== 'today' && filter !== 'completed') {
      sections.push({
        title: '明日',
        data: nextDay,
        key: 'tomorrow'
      });
    }

    if (future.length > 0 && filter !== 'today' && filter !== 'completed') {
      sections.push({
        title: '未来',
        data: future,
        key: 'future'
      });
    }
    
    if (completed.length > 0 && (filter === 'all' || filter === 'completed')) {
      sections.push({
        title: '已完成',
        data: completed,
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
    } catch (error) {
      console.error('刷新提醒列表失败:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

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

    return (
      <TouchableOpacity
        style={[
          styles.reminderItem,
          {
            backgroundColor: theme.cardBackground,
            borderLeftWidth: 4,
            borderLeftColor: color,
            opacity: !item.is_enabled ? 0.7 : 1,
          }
        ]}
        onPress={() => navigation.navigate('ReminderDetail', { id: item.id })}
      >
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
        
        <View style={styles.reminderInfo}>
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
          
          <Text style={[styles.reminderDate, { color: theme.textSecondary }]}>
            {format(dueDate, 'yyyy-MM-dd HH:mm', { locale: zhCN })}
          </Text>
          
          {item.category && (
            <View style={styles.metaContainer}>
              <View style={[styles.categoryBadge, { backgroundColor: color + '20', borderColor: color }]}>
                <Text style={[styles.categoryText, { color }]}>
                  {getCategoryName(item.category)}
                </Text>
              </View>
              
              {item.frequency !== 'once' && (
                <View style={[styles.frequencyBadge, { backgroundColor: theme.background }]}>
                  <Text style={[styles.frequencyText, { color: theme.textSecondary }]}>
                    {getFrequencyName(item.frequency)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
        
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
  reminderTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  reminderDate: {
    fontSize: 12,
    marginBottom: 4,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 12,
  },
  frequencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  frequencyText: {
    fontSize: 12,
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
});

export default ReminderListView;
