import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
  ToastAndroid,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { addReminder } from '../../redux/slices/reminderSlice';
import SafeDateTimePicker from '../../components/common/SafeDateTimePicker';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../services/api';
import { API_ENDPOINTS } from '../../config/api';
import reminderNotificationService from '../../services/reminder/reminderNotificationService';

const AddReminderScreen = ({ route, navigation }) => {
  const { date, category } = route.params || {};
  const themeContext = useTheme();
  const theme = themeContext.theme;
  const dispatch = useDispatch();

     // 检查主题对象
   if (!theme || !theme.colors) {
     return (
       <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
         <Text>主题加载失败，请重启应用</Text>
       </View>
     );
   }
  const [saving, setSaving] = useState(false);
  const [inlineHint, setInlineHint] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('date');
  const [showRepeatEndPicker, setShowRepeatEndPicker] = useState(false);
  const [reminder, setReminder] = useState({
    title: '',
    description: '',
    due_date: date ? new Date(date) : new Date(),
    priority: 'medium',
    frequency: 'once',
    category: category || 'other',
    color: '#3498db',
    tags: '',
    is_enabled: true,
    is_completed: false,
    repeat_end_date: null,
  });

  // 请求通知权限
  useEffect(() => {
    reminderNotificationService.requestPermissions();
  }, []);

  const notifyNonBlocking = (message) => {
    setInlineHint(message);
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };

  // 创建提醒
  const handleCreate = async () => {
    // 验证表单
    if (!reminder.title.trim()) {
      notifyNonBlocking('请输入提醒标题');
      return;
    }

    try {
      setSaving(true);
      setInlineHint('');

      // 创建提醒
      const response = await api.post(API_ENDPOINTS.REMINDER.BASE, reminder);

      // 更新Redux状态
      dispatch(addReminder(response.data));

      // 安排本地通知
      await reminderNotificationService.scheduleReminderNotification(response.data);

      // 非阻断成功提示
      notifyNonBlocking('提醒已创建');
      navigation.goBack();
    } catch (error) {
      console.error('创建提醒失败:', error);
      notifyNonBlocking(error?.message || '创建提醒失败');
    } finally {
      setSaving(false);
    }
  };

  // 处理日期选择
  const handleDateChange = (event, selectedDate) => {
    try {
      // 如果没有选择日期，直接返回
      if (!selectedDate) {return;}

      // 处理选择的日期或时间
      if (datePickerMode === 'date') {
        // 如果是日期模式，保留原时间部分，只更新日期
        const currentDate = new Date(reminder.due_date);
        selectedDate.setHours(currentDate.getHours());
        selectedDate.setMinutes(currentDate.getMinutes());

        setReminder({
          ...reminder,
          due_date: selectedDate,
        });

        // 在选择完日期后，显示时间选择器
        // 使用更长的延迟时间，确保前一个选择器已完全关闭
        setTimeout(() => {
          try {
            setDatePickerMode('time');
            setShowDatePicker(true);
          } catch (err) {
            console.warn('打开时间选择器失败:', err);
          }
        }, 500);
      } else {
        // 如果是时间模式，合并日期和时间
        const currentDate = new Date(reminder.due_date);
        currentDate.setHours(selectedDate.getHours());
        currentDate.setMinutes(selectedDate.getMinutes());

        setReminder({
          ...reminder,
          due_date: currentDate,
        });
      }
    } catch (error) {
      console.error('处理日期选择错误:', error);
      // 确保选择器关闭
      setShowDatePicker(false);
    }
  };

  // 显示日期选择器
  const showDateTimePicker = () => {
    // 确保在显示新的选择器之前，先关闭任何可能已经打开的选择器
    setShowDatePicker(false);

    // 使用setTimeout确保状态更新后再显示选择器
    setTimeout(() => {
      setDatePickerMode('date');
      setShowDatePicker(true);
    }, 100);
  };

  // 处理重复结束日期选择
  const handleRepeatEndChange = (event, selectedDate) => {
    try {
      if (!selectedDate) {return;}
      const endDate = new Date(selectedDate);
      endDate.setHours(0, 0, 0, 0);
      setReminder({
        ...reminder,
        repeat_end_date: endDate,
      });
    } catch (error) {
      console.error('处理重复结束日期选择错误:', error);
    } finally {
      setShowRepeatEndPicker(false);
    }
  };

  // 获取优先级颜色
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return theme.colors.error;
      case 'medium':
        return theme.colors.primary; // 中优先级改为蓝色
      case 'low':
        return theme.colors.success;
      default:
        return theme.colors.primary;
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

  // 获取频率标签
  const getFrequencyLabel = (frequency) => {
    switch (frequency) {
      case 'once':
        return '一次';
      case 'daily':
        return '每天';
      case 'weekly':
        return '每周';
      case 'monthly':
        return '每月';
      case 'yearly':
        return '每年';
      default:
        return '一次';
    }
  };

  // 渲染主界面
    return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* 顶部导航栏（统一返回按钮样式） */}
      <View style={[styles.headerBar, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.colors.primary + '15' }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>添加提醒</Text>
        <View style={styles.headerRight} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {inlineHint ? (
          <View style={[styles.hintBanner, { backgroundColor: theme.colors.warning + '22' }]}>
            <Text style={[styles.hintText, { color: theme.colors.warning }]}>{inlineHint}</Text>
          </View>
        ) : null}
        {/* 标题和描述 */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>标题</Text>
          <TextInput
            style={[styles.titleInput, { color: theme.colors.text, borderBottomColor: theme.colors.border }]}
            value={reminder.title}
            onChangeText={(text) => setReminder({ ...reminder, title: text })}
            placeholder="提醒标题"
            placeholderTextColor={theme.colors.textDisabled}
            autoFocus
          />

          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, marginTop: 16 }]}>描述</Text>
          <TextInput
            style={[styles.descriptionInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
            value={reminder.description}
            onChangeText={(text) => setReminder({ ...reminder, description: text })}
            placeholder="添加描述（可选）"
            placeholderTextColor={theme.colors.textDisabled}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* 日期和时间 */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>日期和时间</Text>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={showDateTimePicker}
          >
            <Icon name="event" size={24} color={theme.colors.primary} style={styles.dateTimeIcon} />
            <Text style={[styles.dateTimeText, { color: theme.colors.text }]}>
              {format(reminder.due_date, 'yyyy年MM月dd日 EEEE HH:mm', { locale: zhCN })}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 优先级 */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>优先级</Text>
          <View style={styles.priorityContainer}>
            {['low', 'medium', 'high'].map((priority) => (
              <TouchableOpacity
                key={priority}
                style={[
                  styles.priorityButton,
                  {
                    backgroundColor: reminder.priority === priority && priority !== 'medium'
                      ? getPriorityColor(priority)
                      : theme.colors.background,
                    borderColor: getPriorityColor(priority),
                  },
                ]}
                onPress={() => setReminder({ ...reminder, priority })}
              >
                                  <Text
                    style={[
                      styles.priorityText,
                      {
                        color: reminder.priority === priority && priority !== 'medium'
                          ? '#fff'
                          : getPriorityColor(priority),
                      },
                    ]}
                  >
                    {getPriorityLabel(priority)}
                  </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 分类 */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>分类</Text>
          <View style={styles.categoryContainer}>
            {['work', 'study', 'personal', 'health', 'finance', 'social', 'other'].map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  {
                    backgroundColor: reminder.category === category
                      ? theme.colors.primary
                      : theme.colors.background,
                    borderColor: theme.colors.primary,
                  },
                ]}
                onPress={() => setReminder({ ...reminder, category })}
              >
                <Text
                  style={[
                    styles.categoryText,
                    {
                      color: reminder.category === category
                        ? '#fff'
                        : theme.colors.primary,
                      },
                    ]
                  }>
                  {getCategoryLabel(category)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 重复 */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>重复</Text>
          <View style={styles.frequencyContainer}>
            {['once', 'daily', 'weekly', 'monthly', 'yearly'].map((frequency) => (
              <TouchableOpacity
                key={frequency}
                style={[
                  styles.frequencyButton,
                  {
                    backgroundColor: reminder.frequency === frequency
                      ? theme.colors.primary
                      : theme.colors.background,
                    borderColor: theme.colors.primary,
                  },
                ]}
                onPress={() => setReminder({ ...reminder, frequency })}
              >
                <Text
                  style={[
                    styles.frequencyText,
                    {
                      color: reminder.frequency === frequency
                        ? '#fff'
                        : theme.colors.primary,
                      },
                  ]}
                >
                  {getFrequencyLabel(frequency)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {reminder.frequency !== 'once' && (
            <View style={styles.repeatEndContainer}>
              <Text style={[styles.repeatEndLabel, { color: theme.colors.textSecondary }]}>
                重复结束日期
              </Text>
              <TouchableOpacity
                style={styles.repeatEndButton}
                onPress={() => setShowRepeatEndPicker(true)}
              >
                <Text style={[styles.repeatEndText, { color: theme.colors.text }]}>
                  {reminder.repeat_end_date
                    ? format(new Date(reminder.repeat_end_date), 'yyyy年MM月dd日', { locale: zhCN })
                    : '无结束日期'}
                </Text>
                <Icon name="event" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 标签 */}
        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>标签</Text>
          <TextInput
            style={[styles.tagsInput, { color: theme.colors.text, borderBottomColor: theme.colors.border }]}
            value={reminder.tags}
            onChangeText={(text) => setReminder({ ...reminder, tags: text })}
            placeholder="添加标签，用逗号分隔"
            placeholderTextColor={theme.colors.textDisabled}
          />
        </View>

        {/* 操作按钮 */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            onPress={() => navigation.goBack()}
            disabled={saving}
          >
            <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>取消</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleCreate}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>创建</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 安全日期选择器 */}
      <SafeDateTimePicker
        value={reminder.due_date}
        mode={datePickerMode}
        is24Hour={true}
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={handleDateChange}
        minimumDate={new Date()}
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onError={(error) => console.log('DateTimePicker error:', error)}
        testID="dateTimePicker"
      />

      {/* 重复结束日期选择器（仅日期） */}
      <SafeDateTimePicker
        value={reminder.repeat_end_date ? new Date(reminder.repeat_end_date) : new Date()}
        mode="date"
        is24Hour={true}
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={handleRepeatEndChange}
        minimumDate={new Date(reminder.due_date)}
        visible={showRepeatEndPicker}
        onClose={() => setShowRepeatEndPicker(false)}
        onError={(error) => console.log('RepeatEndPicker error:', error)}
        testID="repeatEndPicker"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 24,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 18,
  },
  headerRight: {
    width: 40,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  hintBanner: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  hintText: {
    fontSize: 13,
  },
  section: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: 'bold',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  descriptionInput: {
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 100,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  dateTimeIcon: {
    marginRight: 12,
  },
  dateTimeText: {
    fontSize: 16,
  },
  priorityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  priorityText: {
    fontWeight: 'bold',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    margin: 4,
  },
  categoryText: {
    fontSize: 14,
  },
  frequencyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  frequencyButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    margin: 4,
  },
  frequencyText: {
    fontSize: 14,
  },
  repeatEndContainer: {
    marginTop: 16,
  },
  repeatEndLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  repeatEndButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  repeatEndText: {
    fontSize: 16,
  },
  tagsInput: {
    fontSize: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontWeight: 'bold',
  },
  createButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default AddReminderScreen;
