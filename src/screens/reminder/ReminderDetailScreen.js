import React, { useCallback, useEffect, useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  updateReminder as updateReminderAction,
  deleteReminder as deleteReminderAction,
  selectReminders,
} from '../../redux/slices/reminderSlice';
import SafeDateTimePicker from '../../components/common/SafeDateTimePicker';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/MaterialIcons';
import reminderApi from '../../services/api/reminderApi';
import CalendarIntegrationView from '../../components/reminder/CalendarIntegrationView';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';

const PRIORITIES = ['low', 'medium', 'high'];
const CATEGORIES = ['work', 'study', 'personal', 'health', 'finance', 'social', 'other'];
const FREQUENCIES = ['once', 'daily', 'weekly', 'monthly', 'yearly'];

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

const getFrequencyLabel = (frequency) => {
  switch (frequency) {
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

const ReminderDetailScreen = ({ route, navigation }) => {
  const {
    id,
    reminder: routeReminderParam = null,
  } = route.params;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const localReminders = useSelector(selectReminders);
  const localReminder = localReminders.find((item) => item.id === id);
  const routeReminder = routeReminderParam || localReminder || null;

  const [reminder, setReminder] = useState(routeReminder);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inlineHint, setInlineHint] = useState('');
  const [hintTone, setHintTone] = useState('warning');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('date');
  const [showRepeatEndPicker, setShowRepeatEndPicker] = useState(false);
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date(routeReminder?.due_date || Date.now()));
  const detailState = loading ? 'loading' : !reminder ? 'empty' : saving ? 'busy' : 'ready';

  const notifyNonBlocking = useCallback((message, tone = 'warning') => {
    if (!message) {
      return;
    }
    setHintTone(tone);
    setInlineHint(message);
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  }, []);

  const getErrorMessage = useCallback((error, fallbackMessage) => {
    if (error?.isOfflineError || error?.isNetworkError || error?.message?.includes('Network')) {
      return '当前网络不可用，详情页已保持本地可读状态，请联网后再试';
    }
    return error?.message || fallbackMessage;
  }, []);

  const getPriorityColor = useCallback((priority) => {
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
  }, [theme.error, theme.primary, theme.success, theme.warning]);

  const fetchReminderDetail = useCallback(async () => {
    try {
      setLoading(true);
      setInlineHint('');
      const response = await reminderApi.getReminderById(id, {
        suppressGlobalErrorUI: true,
      });
      setReminder(response.data);
      setTempDate(new Date(response.data.due_date || response.data.dueDate || Date.now()));
    } catch (error) {
      console.log('获取提醒详情失败:', error);
      if (routeReminder) {
        setReminder(routeReminder);
        setTempDate(new Date(routeReminder.due_date || routeReminder.dueDate || Date.now()));
        notifyNonBlocking('当前使用列表快照展示详情，联网后可获取最新数据');
        return;
      }
      notifyNonBlocking(getErrorMessage(error, '获取提醒详情失败，已返回上一页'));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [getErrorMessage, id, navigation, notifyNonBlocking, routeReminder]);

  useEffect(() => {
    fetchReminderDetail();
  }, [fetchReminderDetail]);

  const handleSave = async () => {
    if (saving) {
      return;
    }
    if (!reminder?.title?.trim()) {
      notifyNonBlocking('请输入提醒标题');
      return;
    }

    try {
      setSaving(true);
      const response = await reminderApi.updateReminder(id, reminder, {
        suppressGlobalErrorUI: true,
      });
      dispatch(updateReminderAction(response.data));
      notifyNonBlocking('提醒已更新', 'success');
      navigation.goBack();
    } catch (error) {
      console.log('更新提醒失败:', error);
      notifyNonBlocking(getErrorMessage(error, '更新提醒失败，请稍后重试'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (saving) {
      return;
    }
    Alert.alert(
      '确认删除',
      '确定要删除这条提醒吗？此操作无法撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await reminderApi.deleteReminder(id, {
                suppressGlobalErrorUI: true,
              });
              dispatch(deleteReminderAction(id));
              notifyNonBlocking('提醒已删除', 'success');
              navigation.goBack();
            } catch (error) {
              console.log('删除提醒失败:', error);
              notifyNonBlocking(getErrorMessage(error, '删除提醒失败，请稍后重试'));
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (saving) {
      return;
    }
    if (!reminder) {
      return;
    }

    if (reminder.frequency !== 'once') {
      Alert.alert(
        '删除重复提醒',
        '当前阶段先收口整条提醒删除，单次实例删除待后续联网联调后继续完善。',
        [
          { text: '取消', style: 'cancel' },
          { text: '删除整条', style: 'destructive', onPress: confirmDelete },
        ]
      );
      return;
    }

    confirmDelete();
  };

  const handleToggleComplete = async () => {
    if (saving) {
      return;
    }
    if (!reminder) {
      return;
    }

    if (reminder.is_completed) {
      notifyNonBlocking('当前阶段暂不支持在详情页撤销完成状态');
      return;
    }

    const previousReminder = reminder;
    const updatedReminder = {
      ...reminder,
      is_completed: true,
      completed_at: new Date().toISOString(),
    };

    try {
      setSaving(true);
      setReminder(updatedReminder);
      const response = await reminderApi.updateReminder(
        id,
        { is_completed: true },
        { suppressGlobalErrorUI: true }
      );
      dispatch(updateReminderAction({
        ...updatedReminder,
        ...response.data,
      }));
      notifyNonBlocking('提醒已标记完成', 'success');
    } catch (error) {
      console.log('标记提醒完成失败:', error);
      setReminder(previousReminder);
      notifyNonBlocking(getErrorMessage(error, '标记完成失败，请稍后重试'));
    } finally {
      setSaving(false);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    if (saving) {
      setShowDatePicker(false);
      return;
    }
    if (!selectedDate || !reminder) {
      setShowDatePicker(false);
      return;
    }

    setTempDate(selectedDate);

    if (datePickerMode === 'date') {
      setTimeout(() => {
        setDatePickerMode('time');
        setShowDatePicker(true);
      }, 350);
      return;
    }

    setReminder({
      ...reminder,
      due_date: selectedDate.toISOString(),
    });
    setShowDatePicker(false);
  };

  const openRepeatEndPicker = useCallback(() => {
    if (saving) {
      return;
    }
    setShowRepeatEndPicker(true);
  }, [saving]);

  const handleRepeatEndChange = useCallback((event, selectedDate) => {
    if (saving) {
      setShowRepeatEndPicker(false);
      return;
    }
    if (!selectedDate) {
      setShowRepeatEndPicker(false);
      return;
    }
    if (!reminder) {
      setShowRepeatEndPicker(false);
      return;
    }
    const endDate = new Date(selectedDate);
    endDate.setHours(0, 0, 0, 0);
    setReminder({
      ...reminder,
      repeat_end_date: endDate.toISOString(),
    });
    setShowRepeatEndPicker(false);
  }, [reminder, saving]);

  const openReschedulePicker = useCallback(() => {
    if (saving) {
      return;
    }
    setShowReschedulePicker(true);
  }, [saving]);

  const handleBackPress = useCallback(() => {
    if (saving) {
      return;
    }
    navigation.goBack();
  }, [navigation, saving]);

  const openDateTimePicker = useCallback(() => {
    if (saving) {
      return;
    }
    setDatePickerMode('date');
    setShowDatePicker(true);
  }, [saving]);

  const handleRescheduleConfirm = useCallback(async (selectedDate) => {
    if (saving) {
      return;
    }
    if (!selectedDate || !reminder) {
      return;
    }

    const nextDate = selectedDate.toISOString();

    try {
      setSaving(true);
      const response = await reminderApi.updateReminder(
        id,
        { due_date: nextDate },
        { suppressGlobalErrorUI: true }
      );
      const mergedReminder = {
        ...reminder,
        due_date: nextDate,
        ...response.data,
      };
      setReminder(mergedReminder);
      setTempDate(new Date(nextDate));
      dispatch(updateReminderAction(mergedReminder));
      notifyNonBlocking('提醒时间已更新', 'success');
    } catch (error) {
      console.log('改期提醒失败:', error);
      notifyNonBlocking(getErrorMessage(error, '改期失败，请稍后重试'));
    } finally {
      setSaving(false);
    }
  }, [dispatch, getErrorMessage, id, notifyNonBlocking, reminder, saving]);

  const handleRescheduleChange = useCallback((event, selectedDate) => {
    if (saving) {
      setShowReschedulePicker(false);
      return;
    }
    setShowReschedulePicker(false);
    if (selectedDate) {
      handleRescheduleConfirm(selectedDate);
    }
  }, [handleRescheduleConfirm, saving]);

  const closeDatePicker = useCallback(() => {
    if (saving) {return;}
    setShowDatePicker(false);
  }, [saving]);

  const closeRepeatEndPicker = useCallback(() => {
    if (saving) {return;}
    setShowRepeatEndPicker(false);
  }, [saving]);

  const closeReschedulePicker = useCallback(() => {
    if (saving) {return;}
    setShowReschedulePicker(false);
  }, [saving]);

  if (loading) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: theme.background }]}
        testID="screen.reminder.detail.loading"
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!reminder) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: theme.background }]}
        testID="screen.reminder.detail.empty"
      >
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>提醒详情暂不可用</Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      testID="screen.reminder.detail"
    >
      <View testID={`state.reminder.detail.state.${detailState}`} />
      <View testID={`state.reminder.detail.saving.visibility.${saving ? 'visible' : 'hidden'}`} />
      <View testID={`state.reminder.detail.datePicker.visibility.${showDatePicker ? 'visible' : 'hidden'}`} />
      <View testID={`state.reminder.detail.repeatEndPicker.visibility.${showRepeatEndPicker ? 'visible' : 'hidden'}`} />
      <View testID={`state.reminder.detail.reschedulePicker.visibility.${showReschedulePicker ? 'visible' : 'hidden'}`} />
      <View
        style={[
          styles.headerBar,
          {
            borderBottomColor: theme.primary + '16',
            backgroundColor: theme.cardBackground,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
      >
        <ScreenHeaderBackButton
          onPress={handleBackPress}
          testID="action.reminder.detail.back"
          style={styles.backButton}
        />
        <Text style={[styles.headerTitle, { color: theme.text }]}>提醒详情</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {inlineHint ? (
          <View
            style={[
              styles.hintBanner,
              {
                backgroundColor: hintTone === 'success' ? theme.success + '18' : theme.primary + '12',
                borderColor: hintTone === 'success' ? theme.success + '40' : theme.primary + '2E',
              },
            ]}
            testID="state.reminder.detailHint"
          >
            <Icon
              name={hintTone === 'success' ? 'check-circle-outline' : 'info-outline'}
              size={18}
              color={hintTone === 'success' ? theme.success : theme.primary}
              style={styles.hintIcon}
            />
            <Text
              style={[
                styles.hintText,
                { color: hintTone === 'success' ? theme.success : theme.primary },
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
              backgroundColor: theme.cardBackground + 'F2',
              borderColor: theme.primary + '18',
            },
          ]}
        >
          <View style={[styles.contextIconWrap, { backgroundColor: theme.primary + '14' }]}>
            <Icon name="edit-calendar" size={18} color={theme.primary} />
          </View>
          <View style={styles.contextContent}>
            <Text style={[styles.contextTitle, { color: theme.text }]}>编辑提醒</Text>
            <Text style={[styles.contextDescription, { color: theme.textSecondary }]}>
              当前阶段优先保证详情页真机可读、可改、可返回。联网后可继续验证完整保存与同步链路。
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground + 'F2',
              borderColor: theme.primary + '14',
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>标题</Text>
          <TextInput
            style={[styles.titleInput, { color: theme.text, borderBottomColor: theme.border }]}
            value={reminder.title || ''}
            onChangeText={(text) => setReminder({ ...reminder, title: text })}
            placeholder="请输入提醒标题"
            placeholderTextColor={theme.textDisabled}
            testID="input.reminder.detail.title"
          />

          <Text style={[styles.sectionTitle, styles.spacedTitle, { color: theme.textSecondary }]}>描述</Text>
          <TextInput
            style={[styles.descriptionInput, { color: theme.text, borderColor: theme.border }]}
            value={reminder.description || ''}
            onChangeText={(text) => setReminder({ ...reminder, description: text })}
            placeholder="补充描述信息"
            placeholderTextColor={theme.textDisabled}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            testID="input.reminder.detail.description"
          />
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground + 'F2',
              borderColor: theme.primary + '14',
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>日期和时间</Text>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={openDateTimePicker}
            disabled={saving}
            testID="action.reminder.detail.pickDateTime"
          >
            <Icon name="event" size={24} color={theme.primary} style={styles.dateTimeIcon} />
            <Text style={[styles.dateTimeText, { color: theme.text }]}>
              {format(new Date(reminder.due_date), 'yyyy年MM月dd日 EEEE HH:mm', { locale: zhCN })}
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground + 'F2',
              borderColor: theme.primary + '14',
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>优先级</Text>
          <View style={styles.priorityContainer}>
            {PRIORITIES.map((priority) => {
              const isActive = reminder.priority === priority;
              const accent = getPriorityColor(priority);
              return (
                <TouchableOpacity
                  key={priority}
                  style={[
                    styles.priorityButton,
                    {
                      backgroundColor: isActive ? accent : theme.background,
                      borderColor: accent,
                    },
                  ]}
                  onPress={() => setReminder({ ...reminder, priority })}
                  disabled={saving}
                  testID={`chip.reminder.detail.priority.${priority}`}
                >
                  <Text style={[styles.priorityText, { color: isActive ? '#fff' : accent }]}>
                    {getPriorityLabel(priority)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground + 'F2',
              borderColor: theme.primary + '14',
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>分类</Text>
          <View style={styles.categoryContainer}>
            {CATEGORIES.map((category) => {
              const isActive = reminder.category === category;
              return (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryButton,
                    {
                      backgroundColor: isActive ? theme.primary : theme.background,
                      borderColor: theme.primary,
                    },
                  ]}
                  onPress={() => setReminder({ ...reminder, category })}
                  disabled={saving}
                  testID={`chip.reminder.detail.category.${category}`}
                >
                  <Text style={[styles.categoryText, { color: isActive ? '#fff' : theme.primary }]}>
                    {getCategoryLabel(category)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground + 'F2',
              borderColor: theme.primary + '14',
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>重复</Text>
          <View style={styles.frequencyContainer}>
            {FREQUENCIES.map((frequency) => {
              const isActive = reminder.frequency === frequency;
              return (
                <TouchableOpacity
                  key={frequency}
                  style={[
                    styles.frequencyButton,
                    {
                      backgroundColor: isActive ? theme.primary : theme.background,
                      borderColor: theme.primary,
                    },
                  ]}
                  onPress={() => setReminder({ ...reminder, frequency })}
                  disabled={saving}
                  testID={`chip.reminder.detail.frequency.${frequency}`}
                >
                  <Text style={[styles.frequencyText, { color: isActive ? '#fff' : theme.primary }]}>
                    {getFrequencyLabel(frequency)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {reminder.frequency !== 'once' ? (
            <View style={styles.repeatEndContainer}>
              <Text style={[styles.repeatEndLabel, { color: theme.textSecondary }]}>重复结束日期</Text>
              <TouchableOpacity
                style={styles.repeatEndButton}
                onPress={openRepeatEndPicker}
                disabled={saving}
                testID="action.reminder.detail.pickRepeatEnd"
              >
                <Text style={[styles.repeatEndText, { color: theme.text }]}>
                  {reminder.repeat_end_date
                    ? format(new Date(reminder.repeat_end_date), 'yyyy年MM月dd日', { locale: zhCN })
                    : '无结束日期'}
                </Text>
                <Icon name="event" size={20} color={theme.primary} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground + 'F2',
              borderColor: theme.primary + '14',
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>标签</Text>
          <TextInput
            style={[styles.tagsInput, { color: theme.text, borderBottomColor: theme.border }]}
            value={reminder.tags || ''}
            onChangeText={(text) => setReminder({ ...reminder, tags: text })}
            placeholder="多个标签请用逗号分隔"
            placeholderTextColor={theme.textDisabled}
            testID="input.reminder.detail.tags"
          />
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground + 'F2',
              borderColor: theme.primary + '14',
            },
          ]}
        >
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>启用提醒</Text>
            <Switch
              value={Boolean(reminder.is_enabled)}
              onValueChange={(value) => setReminder({ ...reminder, is_enabled: value })}
              trackColor={{ false: theme.border, true: theme.primary + '80' }}
              thumbColor={reminder.is_enabled ? theme.primary : '#f4f3f4'}
              disabled={saving}
              testID="switch.reminder.detail.enabled"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>已完成</Text>
            <Switch
              value={Boolean(reminder.is_completed)}
              onValueChange={handleToggleComplete}
              trackColor={{ false: theme.border, true: theme.success + '80' }}
              thumbColor={reminder.is_completed ? theme.success : '#f4f3f4'}
              disabled={saving}
              testID="switch.reminder.detail.completed"
            />
          </View>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground + 'F2',
              borderColor: theme.primary + '14',
            },
          ]}
        >
          <CalendarIntegrationView
            reminder={reminder}
            onSyncComplete={(calendarData) => {
              setReminder({
                ...reminder,
                calendar_event_id: calendarData.calendar_event_id,
                calendar_id: calendarData.calendar_id,
              });
            }}
          />
        </View>
      </ScrollView>

      <View
        style={[
          styles.actionBar,
          {
            backgroundColor: theme.cardBackground + 'F5',
            borderTopColor: theme.primary + '16',
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: theme.error }]}
          onPress={handleDelete}
          disabled={saving}
          activeOpacity={saving ? 1 : 0.7}
          testID="action.reminder.detail.delete"
        >
          <Icon name="delete" size={20} color="#fff" />
          <Text style={styles.buttonText}>删除</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.snoozeButton, { backgroundColor: theme.warning }]}
          onPress={openReschedulePicker}
          disabled={saving}
          activeOpacity={saving ? 1 : 0.7}
          testID="action.reminder.detail.reschedule"
        >
          <Icon name="schedule" size={20} color="#fff" />
          <Text style={styles.buttonText}>改期</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.primary }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={saving ? 1 : 0.7}
          testID="action.reminder.detail.save"
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

      <SafeDateTimePicker
        value={tempDate}
        mode={datePickerMode}
        is24Hour
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={handleDateChange}
        minimumDate={new Date()}
        visible={showDatePicker}
        onClose={closeDatePicker}
        onError={(error) => console.log('DateTimePicker error:', error)}
        testID="picker.reminder.detail.dateTime"
      />

      <SafeDateTimePicker
        value={reminder.repeat_end_date ? new Date(reminder.repeat_end_date) : new Date(reminder.due_date)}
        mode="date"
        is24Hour
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={handleRepeatEndChange}
        minimumDate={new Date(reminder.due_date)}
        visible={showRepeatEndPicker}
        onClose={closeRepeatEndPicker}
        onError={(error) => console.log('RepeatEndPicker error:', error)}
        testID="picker.reminder.detail.repeatEnd"
      />

      <SafeDateTimePicker
        value={new Date(reminder.due_date)}
        mode="datetime"
        is24Hour
        display="default"
        onChange={handleRescheduleChange}
        minimumDate={new Date()}
        visible={showReschedulePicker}
        onClose={closeReschedulePicker}
        onError={(error) => console.log('ReschedulePicker error:', error)}
        testID="picker.reminder.detail.reschedule"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 16,
    borderBottomWidth: 1,
  },
  backButton: {
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
    paddingBottom: 128,
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
    lineHeight: 20,
    flex: 1,
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
    justifyContent: 'center',
    alignItems: 'center',
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
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  spacedTitle: {
    marginTop: 16,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: '700',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  descriptionInput: {
    fontSize: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 14,
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
    flex: 1,
    lineHeight: 24,
  },
  priorityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  priorityText: {
    fontWeight: '700',
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
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    flex: 1,
    marginRight: 4,
  },
  snoozeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    flex: 1,
    marginHorizontal: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    flex: 1,
    marginLeft: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default ReminderDetailScreen;
