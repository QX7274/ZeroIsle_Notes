import React, { useState, useEffect, useCallback } from 'react';
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
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import SafeDateTimePicker from '../../components/common/SafeDateTimePicker';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/MaterialIcons';
import reminderApi from '../../services/api/reminderApi';
import { isNetworkConnected } from '../../services/network/networkService';
import reminderNotificationService from '../../services/reminder/reminderNotificationService';
import { addLocalReminder } from '../../redux/slices/reminderSlice';

const AddReminderScreen = ({ route, navigation }) => {
  const { date, category } = route.params || {};
  const themeContext = useTheme();
  const theme = themeContext.theme;
  const dispatch = useDispatch();
  const statusBarInset = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
  const actionBarHeight = 96;

  const [saving, setSaving] = useState(false);
  const [inlineHint, setInlineHint] = useState('');
  const [hintTone, setHintTone] = useState('warning');
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

  const notifyNonBlocking = (message, tone = 'warning') => {
    setHintTone(tone);
    setInlineHint(message);
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };

  const createOptimisticLocalReminder = useCallback(() => ({
    ...reminderNotificationService.buildOfflineReminderPayload(reminder),
    createdAt: new Date().toISOString(),
  }), [reminder]);

  // 创建提醒
  const saveReminderLocally = useCallback(async () => {
    setSaving(true);
    setInlineHint('');

    const offlineReminder = await reminderNotificationService.saveOfflineReminder(reminder);
    let localReminder = offlineReminder;

    try {
      const notificationId = await reminderNotificationService.scheduleReminderNotification(offlineReminder);
      if (notificationId) {
        localReminder = { ...offlineReminder, notificationId };
      }
    } catch (notificationError) {
      console.warn('本地提醒已保存，但本地通知调度失败:', notificationError);
      notifyNonBlocking('已保存本地提醒，但通知调度失败', 'warning');
    }

    dispatch(addLocalReminder(localReminder));
    if (localReminder === offlineReminder) {
      notifyNonBlocking('已保存为本地提醒，联网后会自动同步', 'success');
    }
    navigation.goBack();
  }, [dispatch, navigation, reminder]);

  const fallbackToOptimisticLocalReminder = useCallback((message) => {
    const optimisticReminder = createOptimisticLocalReminder();
    dispatch(addLocalReminder(optimisticReminder));
    notifyNonBlocking(message, 'warning');
    navigation.goBack();
  }, [createOptimisticLocalReminder, dispatch, navigation]);

  if (!theme || !theme.colors) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>主题加载失败，请重启应用</Text>
      </View>
    );
  }
  const handleCreate = async () => {
    if (!reminder.title.trim()) {
      notifyNonBlocking('请输入提醒标题');
      return;
    }

    const isConnected = await isNetworkConnected();
    if (!isConnected) {
      try {
        await saveReminderLocally();
      } catch (offlineError) {
        console.error('保存本地提醒失败:', offlineError);
        notifyNonBlocking('保存本地提醒失败，请稍后重试');
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      setSaving(true);
      setInlineHint('');

      const response = await reminderApi.createReminder(reminder, {
        suppressGlobalErrorUI: true,
      });

      try {
        await reminderNotificationService.scheduleReminderNotification(response.data);
      } catch (notificationError) {
        console.warn('提醒已创建，但本地通知调度失败:', notificationError);
        notifyNonBlocking('提醒已创建，但本地通知未成功安排', 'warning');
        navigation.goBack();
        return;
      }

      notifyNonBlocking('提醒已创建', 'success');
      navigation.goBack();
    } catch (error) {
      console.error('创建提醒失败:', error);
      const shouldFallbackToLocal = error?.isOfflineError
        || error?.isNetworkError
        || error?.message?.includes('网络')
        || error?.message?.includes('offline')
        || error?.message?.includes('Network');

      if (shouldFallbackToLocal) {
        try {
          await saveReminderLocally();
          return;
        } catch (offlineError) {
          console.error('远程创建失败后，本地兜底保存失败:', offlineError);
          notifyNonBlocking('网络不可用且本地保存失败，请稍后重试', 'warning');
          return;
        }
      }

      notifyNonBlocking(error?.message || '创建提醒失败，请稍后重试', 'warning');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateWithFallback = async () => {
    if (!reminder.title.trim()) {
      notifyNonBlocking('请输入提醒标题');
      return;
    }

    try {
      const isConnected = await isNetworkConnected();
      if (!isConnected) {
        try {
          await saveReminderLocally();
        } catch (offlineError) {
          console.error('离线创建提醒的最终兜底失败:', offlineError);
          fallbackToOptimisticLocalReminder('已先在当前设备显示本地提醒，但本地存储未完全成功');
        } finally {
          setSaving(false);
        }
        return;
      }

      await handleCreate();
    } catch (error) {
      console.error('创建提醒最终兜底失败:', error);
      fallbackToOptimisticLocalReminder('已先在当前设备显示本地提醒，但本地存储未完全成功');
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
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={statusBarInset + 12}
      testID="screen.reminder"
    >
      {/* 顶部导航栏（统一返回按钮样式） */}
      <View style={[styles.headerBar, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.colors.primary + '15' }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          testID="action.reminder.back"
        >
          <Icon name="arrow-back" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>添加提醒</Text>
        <View style={styles.headerRight} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: actionBarHeight + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {inlineHint ? (
          <View
            style={[
              styles.hintBanner,
              {
                backgroundColor: hintTone === 'success'
                  ? theme.colors.success + '18'
                  : theme.colors.primary + '12',
                borderColor: hintTone === 'success'
                  ? theme.colors.success + '44'
                  : theme.colors.primary + '2E',
              },
            ]}
            testID="state.reminder.createHint"
          >
            <Icon
              name={hintTone === 'success' ? 'check-circle-outline' : 'wifi-off'}
              size={18}
              color={hintTone === 'success' ? theme.colors.success : theme.colors.primary}
              style={styles.hintIcon}
            />
            <Text
              style={[
                styles.hintText,
                {
                  color: hintTone === 'success' ? theme.colors.success : theme.colors.primary,
                },
              ]}
            >
              {inlineHint}
            </Text>
          </View>
        ) : null}
        <View
          style={[
            styles.contextCard,
            {
              backgroundColor: theme.colors.card + 'F2',
              borderColor: theme.colors.primary + '18',
            },
          ]}
        >
          <View style={[styles.contextIconWrap, { backgroundColor: theme.colors.primary + '14' }]}>
            <Icon name="notifications-active" size={18} color={theme.colors.primary} />
          </View>
          <View style={styles.contextContent}>
            <Text style={[styles.contextTitle, { color: theme.colors.text }]}>创建提醒</Text>
            <Text style={[styles.contextDescription, { color: theme.colors.textSecondary }]}>
              当前阶段优先保证真机可点、页内可读和离线提示诚实清晰。联网后即可正常创建并同步提醒。
            </Text>
          </View>
        </View>
        {/* 标题和描述 */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.colors.card + 'F2',
              borderColor: theme.colors.primary + '14',
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>标题</Text>
          <TextInput
            style={[styles.titleInput, { color: theme.colors.text, borderBottomColor: theme.colors.border }]}
            testID="input.reminder.title"
            value={reminder.title}
            onChangeText={(text) => setReminder({ ...reminder, title: text })}
            placeholder="提醒标题"
            placeholderTextColor={theme.colors.textDisabled}
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
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.colors.card + 'F2',
              borderColor: theme.colors.primary + '14',
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>日期和时间</Text>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={showDateTimePicker}
            testID="action.reminder.pickDateTime"
          >
            <Icon name="event" size={24} color={theme.colors.primary} style={styles.dateTimeIcon} />
            <Text style={[styles.dateTimeText, { color: theme.colors.text }]}>
              {format(reminder.due_date, 'yyyy年MM月dd日 EEEE HH:mm', { locale: zhCN })}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 优先级 */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.colors.card + 'F2',
              borderColor: theme.colors.primary + '14',
            },
          ]}
        >
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
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                testID={`option.reminder.priority.${priority}`}
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
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.colors.card + 'F2',
              borderColor: theme.colors.primary + '14',
            },
          ]}
        >
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
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                testID={`option.reminder.category.${category}`}
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
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.colors.card + 'F2',
              borderColor: theme.colors.primary + '14',
            },
          ]}
        >
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
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                testID={`option.reminder.frequency.${frequency}`}
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
                testID="action.reminder.pickRepeatEnd"
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
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.colors.card + 'F2',
              borderColor: theme.colors.primary + '14',
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>标签</Text>
          <TextInput
            style={[styles.tagsInput, { color: theme.colors.text, borderBottomColor: theme.colors.border }]}
            value={reminder.tags}
            onChangeText={(text) => setReminder({ ...reminder, tags: text })}
            placeholder="添加标签，用逗号分隔"
            placeholderTextColor={theme.colors.textDisabled}
          />
        </View>

      </ScrollView>

      <View
        style={[
          styles.actionBar,
          {
            backgroundColor: theme.colors.card + 'F5',
            borderTopColor: theme.colors.primary + '16',
          },
        ]}
      >
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            onPress={() => navigation.goBack()}
            disabled={saving}
            testID="action.reminder.cancel"
          >
            <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>取消</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleCreateWithFallback}
            disabled={saving}
            testID="action.reminder.create"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>创建</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

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
        testID="repeatEndPicker"
      />
    </KeyboardAvoidingView>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 24,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
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
    paddingBottom: 24,
  },
  hintBanner: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hintIcon: {
    marginRight: 10,
  },
  hintText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
  },
  contextCard: {
    borderRadius: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  contextIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contextContent: {
    flex: 1,
  },
  contextTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  contextDescription: {
    fontSize: 13,
    lineHeight: 20,
  },
  section: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
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
  actionBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
