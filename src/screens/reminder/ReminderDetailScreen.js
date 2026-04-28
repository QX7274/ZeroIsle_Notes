import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  TextInput,
  Platform,
  ToastAndroid,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { updateReminder, deleteReminder } from '../../redux/slices/reminderSlice';
import SafeDateTimePicker from '../../components/common/SafeDateTimePicker';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../services/api';
import { API_ENDPOINTS } from '../../config/api';
import CalendarIntegrationView from '../../components/reminder/CalendarIntegrationView';

const ReminderDetailScreen = ({ route, navigation }) => {
  const { id } = route.params;
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const [reminder, setReminder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('date');
  const [showRepeatEndPicker, setShowRepeatEndPicker] = useState(false);
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [inlineHint, setInlineHint] = useState('');

  const notifyNonBlocking = (message) => {
    setInlineHint(message);
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };


  // 加载提醒详情
  useEffect(() => {
    fetchReminderDetail();
  }, [id]);

  // 获取提醒详情
  const fetchReminderDetail = async () => {
    try {
      setLoading(true);
      const response = await api.get(API_ENDPOINTS.REMINDER.DETAIL(id));
      setReminder(response.data);
      setTempDate(new Date(response.data.due_date));
    } catch (error) {
      console.error('获取提醒详情失败:', error);
      notifyNonBlocking(error?.message || '获取提醒详情失败，已返回上一页');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // 保存提醒
  const handleSave = async () => {
    try {
      setSaving(true);

      // 更新提醒
      const response = await api.put(API_ENDPOINTS.REMINDER.DETAIL(id), reminder);

      // 更新Redux状态
      dispatch(updateReminder(response.data));

      // 非阻断成功消息
      notifyNonBlocking('提醒已更新');
      navigation.goBack();
    } catch (error) {
      console.error('更新提醒失败:', error);
      notifyNonBlocking(error?.message || '更新提醒失败');
    } finally {
      setSaving(false);
    }
  };

  // 删除提醒
  const handleDelete = () => {
    if (reminder.frequency !== 'once') {
      Alert.alert(
        '删除重复提醒',
        '您想如何删除这个重复的提醒？',
        [
          {
            text: '仅删除本次',
            onPress: () => cancelOccurrence(reminder.due_date),
          },
          {
            text: '删除整个系列',
            onPress: () => deleteSeries(),
            style: 'destructive',
          },
          { text: '取消', style: 'cancel' },
        ]
      );
    } else {
      deleteSeries(); // 非重复提醒直接删除
    }
  };

  // 取消单个实例 (前端调用)
  const cancelOccurrence = async (occurrenceDate) => {
    try {
      setSaving(true);
      await api.post(API_ENDPOINTS.REMINDER.CANCEL_OCCURRENCE(id), {
        occurrence_date: occurrenceDate,
      });
      notifyNonBlocking('本次提醒已取消');
      navigation.goBack();
    } catch (error) {
      console.error('取消单个提醒实例失败:', error);
      notifyNonBlocking(error?.message || '操作失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 删除整个系列
  const deleteSeries = () => {
    Alert.alert(
      '确认删除',
      '确定要删除此提醒系列吗？此操作无法撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await api.delete(API_ENDPOINTS.REMINDER.DETAIL(id));
              dispatch(deleteReminder(id));
              navigation.goBack();
            } catch (error) {
              console.error('删除提醒系列失败:', error);
              notifyNonBlocking(error?.message || '删除失败，请重试');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  // 切换提醒完成状态
  const handleToggleComplete = async () => {
    // 如果是取消完成，则直接执行
    if (reminder.is_completed) {
      // 注意：取消完成一个重复系列的单个实例在当前模型下是复杂操作，
      // 这里暂时只实现恢复整个系列，或需要后端支持删除exception
      notifyNonBlocking('目前仅支持重新开启整个重复系列');
      // ... 此处可添加恢复整个系列的逻辑
      return;
    }

    // 对于重复提醒，询问用户操作范围
    if (reminder.frequency !== 'once') {
      Alert.alert(
        '完成重复提醒',
        '您想如何处理这个重复的提醒？',
        [
          {
            text: '仅完成本次',
            onPress: () => completeOccurrence(reminder.due_date),
          },
          {
            text: '完成整个系列',
            onPress: () => completeSeries(),
            style: 'destructive',
          },
          { text: '取消', style: 'cancel' },
        ]
      );
    } else {
      // 对于非重复提醒，直接完成
      completeSeries();
    }
  };

  // 完成单个实例
  const completeOccurrence = async (occurrenceDate) => {
    try {
      setSaving(true);
      await api.post(API_ENDPOINTS.REMINDER.COMPLETE(id), {
        occurrence_date: occurrenceDate,
      });
      notifyNonBlocking('本次提醒已完成');
      navigation.goBack(); // 操作后返回列表页
    } catch (error) {
      console.error('完成单个提醒实例失败:', error);
      notifyNonBlocking(error?.message || '操作失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 完成整个系列
  const completeSeries = async () => {
    try {
      setSaving(true);
      const updatedReminder = {
        ...reminder,
        is_completed: true,
        completed_at: new Date().toISOString(),
      };
      setReminder(updatedReminder);
      await api.put(API_ENDPOINTS.REMINDER.DETAIL(id), { is_completed: true });
      dispatch(updateReminder(updatedReminder));
    } catch (error) {
      console.error('完成提醒系列失败:', error);
      notifyNonBlocking(error?.message || '操作失败，请重试');
      setReminder(reminder); // 恢复状态
    } finally {
      setSaving(false);
    }
  };

  // 处理延期
  const handleReschedule = () => {
    if (reminder.frequency !== 'once') {
      // 对于重复提醒，我们需要一个专用的日期选择器来获取新的延期时间
      setShowReschedulePicker(true);
    } else {
      // 对于非重复提醒，直接复用现有的日期时间选择器来修改 due_date
      showDateTimePicker();
    }
  };

  // 延期单个实例
  const rescheduleOccurrence = async (newDate) => {
    try {
      setSaving(true);
      await api.post(API_ENDPOINTS.REMINDER.RESCHEDULE_OCCURRENCE(id), {
        occurrence_date: reminder.due_date, // 当前实例的原始日期
        new_due_date: newDate.toISOString(),
      });
      notifyNonBlocking('本次提醒已延期');
      navigation.goBack();
    } catch (error) {
      console.error('延期单个提醒实例失败:', error);
      notifyNonBlocking(error?.message || '操作失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 处理日期选择
  const handleDateChange = (event, selectedDate) => {
    try {
      // 如果没有选择日期，直接返回
      if (!selectedDate) {return;}

      // 更新临时日期
      setTempDate(selectedDate);

      if (datePickerMode === 'date') {
        // 如果是日期模式，保留原时间部分，只更新日期
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
        const newDate = new Date(selectedDate);
        setReminder({
          ...reminder,
          due_date: newDate.toISOString(),
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
    setDatePickerMode('date');
    setShowDatePicker(true);
  };

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

  // 渲染加载中状态
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // 渲染主界面
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 顶部导航栏（统一返回按钮样式） */}
      <View style={[styles.headerBar, { borderBottomColor: theme.border, backgroundColor: theme.cardBackground }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.primary + '15' }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={22} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>提醒详情</Text>
        <View style={styles.headerRight} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {inlineHint ? (
          <View style={[styles.hintBanner, { backgroundColor: theme.warning + '22' }]}>
            <Text style={[styles.hintText, { color: theme.warning }]}>{inlineHint}</Text>
          </View>
        ) : null}
        {/* 标题和描述 */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>标题</Text>
          <TextInput
            style={[styles.titleInput, { color: theme.text, borderBottomColor: theme.border }]}
            value={reminder.title}
            onChangeText={(text) => setReminder({ ...reminder, title: text })}
            placeholder="提醒标题"
            placeholderTextColor={theme.textDisabled}
          />

          <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 16 }]}>描述</Text>
          <TextInput
            style={[styles.descriptionInput, { color: theme.text, borderColor: theme.border }]}
            value={reminder.description || ''}
            onChangeText={(text) => setReminder({ ...reminder, description: text })}
            placeholder="添加描述（可选）"
            placeholderTextColor={theme.textDisabled}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* 日期和时间 */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>日期和时间</Text>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={showDateTimePicker}
          >
            <Icon name="event" size={24} color={theme.primary} style={styles.dateTimeIcon} />
            <Text style={[styles.dateTimeText, { color: theme.text }]}>
              {format(new Date(reminder.due_date), 'yyyy年MM月dd日 EEEE HH:mm', { locale: zhCN })}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 优先级 */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>优先级</Text>
          <View style={styles.priorityContainer}>
            {['low', 'medium', 'high'].map((priority) => (
              <TouchableOpacity
                key={priority}
                style={[
                  styles.priorityButton,
                  {
                    backgroundColor: reminder.priority === priority
                      ? getPriorityColor(priority)
                      : theme.background,
                    borderColor: getPriorityColor(priority),
                  },
                ]}
                onPress={() => setReminder({ ...reminder, priority })}
              >
                <Text
                  style={[
                    styles.priorityText,
                    {
                      color: reminder.priority === priority
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
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>分类</Text>
          <View style={styles.categoryContainer}>
            {['work', 'study', 'personal', 'health', 'finance', 'social', 'other'].map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  {
                    backgroundColor: reminder.category === category
                      ? theme.primary
                      : theme.background,
                    borderColor: theme.primary,
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
                        : theme.primary,
                    },
                  ]}
                >
                  {getCategoryLabel(category)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 重复 */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>重复</Text>
          <View style={styles.frequencyContainer}>
            {['once', 'daily', 'weekly', 'monthly', 'yearly'].map((frequency) => (
              <TouchableOpacity
                key={frequency}
                style={[
                  styles.frequencyButton,
                  {
                    backgroundColor: reminder.frequency === frequency
                      ? theme.primary
                      : theme.background,
                    borderColor: theme.primary,
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
                        : theme.primary,
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
              <Text style={[styles.repeatEndLabel, { color: theme.textSecondary }]}>
                重复结束日期
              </Text>
              <TouchableOpacity
                style={styles.repeatEndButton}
                onPress={() => setShowRepeatEndPicker(true)}
              >
                <Text style={[styles.repeatEndText, { color: theme.text }]}>
                  {reminder.repeat_end_date
                    ? format(new Date(reminder.repeat_end_date), 'yyyy年MM月dd日', { locale: zhCN })
                    : '无结束日期'}
                </Text>
                <Icon name="event" size={20} color={theme.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 标签 */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>标签</Text>
          <TextInput
            style={[styles.tagsInput, { color: theme.text, borderBottomColor: theme.border }]}
            value={reminder.tags || ''}
            onChangeText={(text) => setReminder({ ...reminder, tags: text })}
            placeholder="添加标签，用逗号分隔"
            placeholderTextColor={theme.textDisabled}
          />
        </View>

        {/* 开关选项 */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>启用提醒</Text>
            <Switch
              value={reminder.is_enabled}
              onValueChange={(value) => setReminder({ ...reminder, is_enabled: value })}
              trackColor={{ false: theme.border, true: theme.primary + '80' }}
              thumbColor={reminder.is_enabled ? theme.primary : '#f4f3f4'}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>已完成</Text>
            <Switch
              value={reminder.is_completed}
              onValueChange={handleToggleComplete}
              trackColor={{ false: theme.border, true: theme.success + '80' }}
              thumbColor={reminder.is_completed ? theme.success : '#f4f3f4'}
              disabled={saving}
            />
          </View>
        </View>

        {/* 日历集成 */}
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
          <CalendarIntegrationView
            reminder={reminder}
            onSyncComplete={(calendarData) => {
              // 更新提醒对象
              setReminder({
                ...reminder,
                calendar_event_id: calendarData.calendar_event_id,
                calendar_id: calendarData.calendar_id,
              });
            }}
          />
        </View>

        {/* 操作按钮 */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: theme.error }]}
            onPress={handleDelete}
            disabled={saving}
          >
            <Icon name="delete" size={20} color="#fff" />
            <Text style={styles.buttonText}>删除</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.snoozeButton, { backgroundColor: theme.warning }]}
            onPress={handleReschedule}
            disabled={saving}
          >
            <Icon name="snooze" size={20} color="#fff" />
            <Text style={styles.buttonText}>延期</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.primary }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="save" size={20} color="#fff" />
                <Text style={styles.buttonText}>保存</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 安全日期选择器 */}
      <SafeDateTimePicker
        value={tempDate}
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
      {reminder && (
        <SafeDateTimePicker
          value={reminder.repeat_end_date ? new Date(reminder.repeat_end_date) : new Date()}
          mode="date"
          is24Hour={true}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            try {
              if (!selectedDate) {return;}
              const endDate = new Date(selectedDate);
              endDate.setHours(0, 0, 0, 0);
              setReminder({ ...reminder, repeat_end_date: endDate.toISOString() });
            } catch (e) {
              console.error('处理重复结束日期选择错误:', e);
            } finally {
              setShowRepeatEndPicker(false);
            }
          }}
          minimumDate={new Date(reminder.due_date)}
          visible={showRepeatEndPicker}
          onClose={() => setShowRepeatEndPicker(false)}
          onError={(error) => console.log('RepeatEndPicker error:', error)}
          testID="repeatEndPicker"
        />
      )}

      {/* 重复结束日期选择器（仅日期） */}
      <SafeDateTimePicker
        value={reminder?.repeat_end_date ? new Date(reminder.repeat_end_date) : new Date()}
        mode="date"
        is24Hour={true}
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={(event, selectedDate) => {
          try {
            if (!selectedDate) {return;}
            const endDate = new Date(selectedDate);
            endDate.setHours(0, 0, 0, 0);
            setReminder({
              ...reminder,
              repeat_end_date: endDate.toISOString(),
            });
          } catch (e) {
            console.error('处理重复结束日期选择错误:', e);
          } finally {
            setShowRepeatEndPicker(false);
          }
        }}
        minimumDate={reminder?.due_date ? new Date(reminder.due_date) : new Date()}
        visible={showRepeatEndPicker}
        onClose={() => setShowRepeatEndPicker(false)}
        onError={(error) => console.log('RepeatEndPicker error:', error)}
        testID="repeatEndPicker"
      />

      {/* 延期单个实例的日期时间选择器 */}
      {reminder && (
        <SafeDateTimePicker
          value={new Date(reminder.due_date)} // 默认从当前实例时间开始
          mode="datetime"
          is24Hour={true}
          display="default"
          onChange={(event, selectedDate) => {
            setShowReschedulePicker(false);
            if (selectedDate) {
              rescheduleOccurrence(selectedDate);
            }
          }}
          minimumDate={new Date()}
          visible={showReschedulePicker}
          onClose={() => setShowReschedulePicker(false)}
          onError={(error) => console.log('ReschedulePicker error:', error)}
          testID="reschedulePicker"
        />
      )}
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchLabel: {
    fontSize: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginRight: 4,
  },
  snoozeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginLeft: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default ReminderDetailScreen;
