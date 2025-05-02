import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../services/api';
import { API_ENDPOINTS } from '../../config/api';

const ReminderCalendarView = ({ navigation }) => {
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [markedDates, setMarkedDates] = useState({});
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 获取日历数据
  const fetchCalendarData = async (year, month) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(API_ENDPOINTS.REMINDER.CALENDAR, {
        params: { year, month }
      });
      
      // 处理标记日期
      const marked = {};
      Object.entries(response.data).forEach(([day, dayReminders]) => {
        // 计算日期字符串
        const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        
        // 获取当天提醒的颜色
        const colors = dayReminders.map(reminder => reminder.color);
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
      console.error('获取日历数据失败:', error);
      setError('获取日历数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载和月份变化时获取数据
  useEffect(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    fetchCalendarData(year, month);
  }, []);

  // 处理日期选择
  const handleDayPress = (day) => {
    const selected = new Date(day.dateString);
    setSelectedDate(selected);
    
    // 获取选中日期的提醒
    const dayStr = day.day.toString();
    const currentYear = selected.getFullYear();
    const currentMonth = selected.getMonth() + 1;
    
    // 如果月份变化，重新获取数据
    if (currentYear !== selectedDate.getFullYear() || currentMonth !== selectedDate.getMonth() + 1) {
      fetchCalendarData(currentYear, currentMonth);
    } else {
      // 使用已有数据
      const dayReminders = markedDates[day.dateString]?.reminders || [];
      setReminders(dayReminders);
    }
  };

  // 处理月份变化
  const handleMonthChange = (month) => {
    const { year, month: monthNum } = month;
    fetchCalendarData(year, monthNum);
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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
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
      />

      <View style={styles.reminderSection}>
        <View style={[styles.reminderHeader, { borderBottomColor: theme.border }]}>
          <Text style={[styles.reminderDate, { color: theme.text }]}>
            {format(selectedDate, 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
          </Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate('AddReminder', { date: selectedDate })}
          >
            <Icon name="add" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
        ) : error ? (
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
        ) : reminders.length > 0 ? (
          <FlatList
            data={reminders}
            renderItem={renderReminderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.reminderList}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Icon name="event-busy" size={48} color={theme.textDisabled} />
            <Text style={[styles.emptyText, { color: theme.textDisabled }]}>
              当天没有提醒
            </Text>
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
  },
});

export default ReminderCalendarView;
