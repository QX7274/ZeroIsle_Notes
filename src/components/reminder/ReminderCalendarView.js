import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Dimensions,
  Platform
} from 'react-native';
import { Calendar, CalendarList, Agenda } from 'react-native-calendars';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isSameDay, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../services/api';
import { API_ENDPOINTS } from '../../config/api';
import NetInfo from '@react-native-community/netinfo';

const ReminderCalendarView = ({ navigation }) => {
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const allReminders = useSelector(state => state.reminders.reminders);

  // 基本状态
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [markedDates, setMarkedDates] = useState({});
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 视图状态
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'agenda'
  const [weekDates, setWeekDates] = useState([]);
  const [isConnected, setIsConnected] = useState(true);
  const [calendarHeight, setCalendarHeight] = useState(350); // 默认高度

  // 获取日历数据
  const fetchCalendarData = async (year, month) => {
    try {
      setLoading(true);
      setError(null);

      // 检查网络连接
      const networkState = await NetInfo.fetch();
      setIsConnected(networkState.isConnected);

      if (networkState.isConnected) {
        // 在线模式：从服务器获取数据
        try {
          const response = await api.get(API_ENDPOINTS.REMINDER.CALENDAR, {
            params: { year, month }
          });

          // 处理标记日期
          const marked = {};
          Object.entries(response.data).forEach(([day, dayReminders]) => {
            // 计算日期字符串
            const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

            // 获取当天提醒的颜色
            const colors = dayReminders.map(reminder => reminder.color || getPriorityColor(reminder.priority));
            const dots = colors.slice(0, 3).map(color => ({ color }));

            // 标记日期
            marked[dateStr] = {
              dots,
              marked: true
            };
          });

          setMarkedDates(marked);

          // 如果有选中日期，获取该日期的提醒
          const selectedDay = selectedDate.getDate();
          const selectedMonth = selectedDate.getMonth() + 1;
          const selectedYear = selectedDate.getFullYear();

          if (selectedYear === year && selectedMonth === month && response.data[selectedDay]) {
            setReminders(response.data[selectedDay]);
          }
        } catch (error) {
          console.error('从服务器获取日历数据失败:', error);
          // 服务器请求失败，使用本地数据
          processLocalReminders(year, month);
        }
      } else {
        // 离线模式：使用Redux中的提醒数据
        processLocalReminders(year, month);
      }
    } catch (error) {
      console.error('获取日历数据失败:', error);
      setError('获取日历数据失败，请稍后重试');
      // 尝试使用本地数据
      processLocalReminders(year, month);
    } finally {
      setLoading(false);
    }
  };

  // 处理本地提醒数据
  const processLocalReminders = (year, month) => {
    try {
      // 从Redux获取所有提醒
      if (!allReminders || allReminders.length === 0) {
        setMarkedDates({});
        setReminders([]);
        return;
      }

      // 按日期组织提醒
      const remindersByDate = {};
      const marked = {};

      allReminders.forEach(reminder => {
        if (!reminder.dueDate && !reminder.due_date) return;

        const dueDate = new Date(reminder.dueDate || reminder.due_date);
        const reminderYear = dueDate.getFullYear();
        const reminderMonth = dueDate.getMonth() + 1;
        const reminderDay = dueDate.getDate();

        // 只处理指定月份的提醒
        if (reminderYear !== year || reminderMonth !== month) return;

        // 添加到按日期组织的对象中
        if (!remindersByDate[reminderDay]) {
          remindersByDate[reminderDay] = [];
        }
        remindersByDate[reminderDay].push(reminder);

        // 计算日期字符串
        const dateStr = `${year}-${month.toString().padStart(2, '0')}-${reminderDay.toString().padStart(2, '0')}`;

        // 获取提醒颜色
        const color = reminder.color || getPriorityColor(reminder.priority);

        // 标记日期
        if (!marked[dateStr]) {
          marked[dateStr] = {
            dots: [{ color }],
            marked: true
          };
        } else if (marked[dateStr].dots.length < 3) {
          marked[dateStr].dots.push({ color });
        }
      });

      setMarkedDates(marked);

      // 如果有选中日期，获取该日期的提醒
      const selectedDay = selectedDate.getDate();
      const selectedMonth = selectedDate.getMonth() + 1;
      const selectedYear = selectedDate.getFullYear();

      if (selectedYear === year && selectedMonth === month && remindersByDate[selectedDay]) {
        setReminders(remindersByDate[selectedDay]);
      } else {
        setReminders([]);
      }
    } catch (error) {
      console.error('处理本地提醒数据失败:', error);
      setError('处理本地提醒数据失败');
      setMarkedDates({});
      setReminders([]);
    }
  };

  // 初始化
  useEffect(() => {
    // 监听网络状态变化
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });

    // 初始化周视图日期
    updateWeekDates(selectedDate);

    // 加载日历数据
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    fetchCalendarData(year, month);

    // 计算日历高度
    const screenHeight = Dimensions.get('window').height;
    setCalendarHeight(screenHeight * 0.45); // 屏幕高度的45%

    return () => {
      unsubscribe();
    };
  }, []);

  // 当提醒数据变化时更新日历
  useEffect(() => {
    if (allReminders && allReminders.length > 0) {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;

      // 如果是离线模式，使用本地数据
      if (!isConnected) {
        processLocalReminders(year, month);
      }
    }
  }, [allReminders, isConnected]);

  // 更新周视图日期
  const updateWeekDates = useCallback((date) => {
    const start = startOfWeek(date, { locale: zhCN });
    const end = endOfWeek(date, { locale: zhCN });
    const days = eachDayOfInterval({ start, end });
    setWeekDates(days);
  }, []);

  // 处理日期选择
  const handleDayPress = (day) => {
    const selected = new Date(day.dateString);
    setSelectedDate(selected);

    // 更新周视图日期
    if (viewMode === 'week') {
      updateWeekDates(selected);
    }

    // 获取选中日期的提醒
    const dayStr = day.day.toString();
    const currentYear = selected.getFullYear();
    const currentMonth = selected.getMonth() + 1;

    // 如果月份变化，重新获取数据
    if (currentYear !== selectedDate.getFullYear() || currentMonth !== selectedDate.getMonth() + 1) {
      fetchCalendarData(currentYear, currentMonth);
    } else {
      // 使用已有数据
      if (isConnected) {
        // 在线模式：从服务器获取该日期的提醒
        fetchDayReminders(selected);
      } else {
        // 离线模式：从本地数据中筛选
        const localReminders = allReminders.filter(reminder => {
          const dueDate = new Date(reminder.dueDate || reminder.due_date);
          return isSameDay(dueDate, selected);
        });
        setReminders(localReminders);
      }
    }
  };

  // 处理月份变化
  const handleMonthChange = (month) => {
    const { year, month: monthNum } = month;
    fetchCalendarData(year, monthNum);
  };

  // 获取某一天的提醒
  const fetchDayReminders = async (date) => {
    try {
      setLoading(true);

      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();

      const response = await api.get(API_ENDPOINTS.REMINDER.DAY, {
        params: { year, month, day }
      });

      if (response.data) {
        setReminders(response.data);
      } else {
        setReminders([]);
      }
    } catch (error) {
      console.error('获取日期提醒失败:', error);

      // 使用本地数据
      const localReminders = allReminders.filter(reminder => {
        const dueDate = new Date(reminder.dueDate || reminder.due_date);
        return isSameDay(dueDate, date);
      });
      setReminders(localReminders);
    } finally {
      setLoading(false);
    }
  };

  // 切换视图模式
  const toggleViewMode = () => {
    if (viewMode === 'month') {
      setViewMode('week');
      updateWeekDates(selectedDate);
    } else if (viewMode === 'week') {
      setViewMode('agenda');
    } else {
      setViewMode('month');
    }
  };

  // 渲染提醒项
  const renderReminderItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.reminderItem,
        {
          backgroundColor: theme.cardBackground,
          borderLeftColor: item.color || theme.primary,
        }
      ]}
      onPress={() => navigation.navigate('ReminderDetail', { id: item.id })}
    >
      <View style={styles.reminderContent}>
        <Text
          style={[
            styles.reminderTitle,
            {
              color: theme.text,
              textDecorationLine: item.is_completed ? 'line-through' : 'none',
            }
          ]}
        >
          {item.title}
        </Text>
        <View style={styles.reminderMeta}>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
            <Text style={styles.priorityText}>
              {getPriorityLabel(item.priority)}
            </Text>
          </View>
          {item.category && (
            <View style={[styles.categoryBadge, { backgroundColor: theme.cardBackground }]}>
              <Text style={[styles.categoryText, { color: theme.textSecondary }]}>
                {getCategoryLabel(item.category)}
              </Text>
            </View>
          )}
        </View>
      </View>
      <Icon
        name={item.is_completed ? 'check-circle' : 'arrow-forward'}
        size={24}
        color={item.is_completed ? theme.success : theme.primary}
      />
    </TouchableOpacity>
  );

  // 获取优先级颜色
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return theme.error;
      case 'medium':
        return theme.warning;
      case 'low':
        return theme.success;
      default:
        return theme.primary;
    }
  };

  // 获取优先级标签
  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'high':
        return '高';
      case 'medium':
        return '中';
      case 'low':
        return '低';
      default:
        return '中';
    }
  };

  // 获取分类标签
  const getCategoryLabel = (category) => {
    switch (category) {
      case 'work':
        return '工作';
      case 'study':
        return '学习';
      case 'personal':
        return '个人';
      case 'health':
        return '健康';
      case 'finance':
        return '财务';
      case 'social':
        return '社交';
      default:
        return '其他';
    }
  };

  // 渲染周视图
  const renderWeekView = () => {
    return (
      <View style={styles.weekContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {weekDates.map((date, index) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, new Date());

            // 检查该日期是否有提醒
            const hasReminders = markedDates[dateStr] && markedDates[dateStr].marked;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.weekDay,
                  isSelected && { backgroundColor: theme.primary + '20' },
                  isToday && { borderColor: theme.primary, borderWidth: 1 }
                ]}
                onPress={() => handleDayPress({ dateString: dateStr })}
              >
                <Text style={[styles.weekDayName, { color: theme.textSecondary }]}>
                  {format(date, 'E', { locale: zhCN })}
                </Text>
                <View
                  style={[
                    styles.weekDayNumber,
                    isSelected && { backgroundColor: theme.primary }
                  ]}
                >
                  <Text
                    style={[
                      styles.weekDayNumberText,
                      { color: isSelected ? '#fff' : theme.text }
                    ]}
                  >
                    {format(date, 'd')}
                  </Text>
                </View>
                {hasReminders && (
                  <View style={styles.weekDayDots}>
                    {markedDates[dateStr]?.dots?.map((dot, i) => (
                      <View
                        key={i}
                        style={[styles.weekDayDot, { backgroundColor: dot.color }]}
                      />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // 渲染日历视图
  const renderCalendarView = () => {
    if (viewMode === 'month') {
      return (
        <Calendar
          current={format(selectedDate, 'yyyy-MM-dd')}
          onDayPress={handleDayPress}
          onMonthChange={handleMonthChange}
          markedDates={{
            ...markedDates,
            [format(selectedDate, 'yyyy-MM-dd')]: {
              ...markedDates[format(selectedDate, 'yyyy-MM-dd')],
              selected: true,
              selectedColor: theme.primary,
            },
          }}
          theme={{
            backgroundColor: theme.background,
            calendarBackground: theme.cardBackground,
            textSectionTitleColor: theme.textSecondary,
            selectedDayBackgroundColor: theme.primary,
            selectedDayTextColor: '#ffffff',
            todayTextColor: theme.primary,
            dayTextColor: theme.text,
            textDisabledColor: theme.textDisabled,
            dotColor: theme.primary,
            selectedDotColor: '#ffffff',
            arrowColor: theme.primary,
            monthTextColor: theme.text,
            indicatorColor: theme.primary,
            textDayFontWeight: '300',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '300',
          }}
          markingType="multi-dot"
          style={{ height: calendarHeight }}
        />
      );
    } else if (viewMode === 'week') {
      return renderWeekView();
    } else {
      // Agenda视图
      return (
        <Agenda
          items={{
            [format(selectedDate, 'yyyy-MM-dd')]: reminders,
          }}
          renderItem={(item) => renderReminderItem({ item })}
          renderEmptyData={() => (
            <View style={styles.emptyContainer}>
              <Icon name="event-busy" size={48} color={theme.textDisabled} />
              <Text style={[styles.emptyText, { color: theme.textDisabled }]}>
                当天没有提醒
              </Text>
            </View>
          )}
          theme={{
            backgroundColor: theme.background,
            calendarBackground: theme.cardBackground,
            textSectionTitleColor: theme.textSecondary,
            selectedDayBackgroundColor: theme.primary,
            selectedDayTextColor: '#ffffff',
            todayTextColor: theme.primary,
            dayTextColor: theme.text,
            textDisabledColor: theme.textDisabled,
            dotColor: theme.primary,
            selectedDotColor: '#ffffff',
            arrowColor: theme.primary,
            monthTextColor: theme.text,
            indicatorColor: theme.primary,
            textDayFontWeight: '300',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '300',
          }}
          selected={format(selectedDate, 'yyyy-MM-dd')}
          onDayPress={handleDayPress}
        />
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.calendarHeader}>
        <Text style={[styles.calendarTitle, { color: theme.text }]}>
          {viewMode === 'month' ? '月视图' : viewMode === 'week' ? '周视图' : '日程视图'}
        </Text>
        <View style={styles.calendarActions}>
          {!isConnected && (
            <View style={[styles.offlineIndicator, { backgroundColor: theme.warning + '20' }]}>
              <Icon name="cloud-off" size={16} color={theme.warning} />
              <Text style={[styles.offlineText, { color: theme.warning }]}>离线模式</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.viewModeButton, { backgroundColor: theme.cardBackground }]}
            onPress={toggleViewMode}
          >
            <Icon
              name={
                viewMode === 'month'
                  ? 'view-week'
                  : viewMode === 'week'
                    ? 'view-agenda'
                    : 'calendar-month'
              }
              size={20}
              color={theme.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {renderCalendarView()}

      <View style={styles.reminderSection}>
        <View style={[styles.reminderHeader, { borderBottomColor: theme.border }]}>
          <Text style={[styles.reminderDate, { color: theme.text }]}>
            {format(selectedDate, 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
          </Text>
          <View style={styles.reminderHeaderActions}>
            <TouchableOpacity
              style={[styles.syncButton, { backgroundColor: theme.cardBackground }]}
              onPress={() => {
                const year = selectedDate.getFullYear();
                const month = selectedDate.getMonth() + 1;
                fetchCalendarData(year, month);
              }}
            >
              <Icon name="sync" size={20} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.primary }]}
              onPress={() => navigation.navigate('AddReminder', { date: selectedDate })}
            >
              <Icon name="add" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
        ) : error ? (
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
        ) : reminders.length > 0 ? (
          <FlatList
            data={reminders}
            renderItem={renderReminderItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.reminderList}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Icon name="event-busy" size={48} color={theme.textDisabled} />
            <Text style={[styles.emptyText, { color: theme.textDisabled }]}>
              当天没有提醒
            </Text>
            <TouchableOpacity
              style={[styles.emptyAddButton, { backgroundColor: theme.primary }]}
              onPress={() => navigation.navigate('AddReminder', { date: selectedDate })}
            >
              <Icon name="add" size={16} color="#ffffff" style={styles.emptyAddIcon} />
              <Text style={styles.emptyAddText}>添加提醒</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  calendarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 8,
  },
  offlineText: {
    fontSize: 12,
    marginLeft: 4,
  },
  viewModeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  weekContainer: {
    height: 100,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  weekDay: {
    width: 60,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    borderRadius: 8,
  },
  weekDayName: {
    fontSize: 12,
    marginBottom: 4,
  },
  weekDayNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  weekDayNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  weekDayDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
  },
  weekDayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 2,
  },
  reminderSection: {
    flex: 1,
    marginTop: 10,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  reminderDate: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  reminderHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  reminderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginVertical: 6,
    borderRadius: 8,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  reminderContent: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  reminderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  priorityText: {
    color: '#ffffff',
    fontSize: 12,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categoryText: {
    fontSize: 12,
  },
  loader: {
    marginTop: 20,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 20,
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    marginBottom: 20,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  emptyAddIcon: {
    marginRight: 4,
  },
  emptyAddText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ReminderCalendarView;
