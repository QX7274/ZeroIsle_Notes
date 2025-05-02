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
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { updateReminder, deleteReminder } from '../store/slices/reminderSlice';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../services/api';
import { API_ENDPOINTS } from '../config/api';

const ReminderDetailScreen = ({ route, navigation }) => {
  const { id } = route.params;
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const [reminder, setReminder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState('date');
  const [tempDate, setTempDate] = useState(new Date());

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
      Alert.alert('错误', '获取提醒详情失败');
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
      
      // 显示成功消息
      Alert.alert('成功', '提醒已更新', [
        { text: '确定', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('更新提醒失败:', error);
      Alert.alert('错误', '更新提醒失败');
    } finally {
      setSaving(false);
    }
  };

  // 删除提醒
  const handleDelete = () => {
    Alert.alert(
      '确认删除',
      '确定要删除此提醒吗？此操作无法撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              
              // 删除提醒
              await api.delete(API_ENDPOINTS.REMINDER.DETAIL(id));
              
              // 更新Redux状态
              dispatch(deleteReminder(id));
              
              // 返回上一页
              navigation.goBack();
            } catch (error) {
              console.error('删除提醒失败:', error);
              Alert.alert('错误', '删除提醒失败');
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  // 切换提醒完成状态
  const handleToggleComplete = async () => {
    try {
      setSaving(true);
      
      // 更新提醒对象
      const updatedReminder = {
        ...reminder,
        is_completed: !reminder.is_completed,
        completed_at: !reminder.is_completed ? new Date().toISOString() : null,
      };
      
      // 更新本地状态
      setReminder(updatedReminder);
      
      // 更新服务器
      if (updatedReminder.is_completed) {
        await api.post(API_ENDPOINTS.REMINDER.COMPLETE(id));
      } else {
        await api.post(`${API_ENDPOINTS.REMINDER.DETAIL(id)}reopen/`);
      }
      
      // 更新Redux状态
      dispatch(updateReminder(updatedReminder));
    } catch (error) {
      console.error('更新提醒状态失败:', error);
      Alert.alert('错误', '更新提醒状态失败');
      
      // 恢复原始状态
      setReminder(reminder);
    } finally {
      setSaving(false);
    }
  };

  // 处理日期选择
  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    
    if (selectedDate) {
      setTempDate(selectedDate);
      
      if (datePickerMode === 'date') {
        // 如果是日期模式，保留原时间部分，只更新日期
        if (Platform.OS === 'android') {
          setDatePickerMode('time');
          setShowDatePicker(true);
        }
      } else {
        // 如果是时间模式，合并日期和时间
        const newDate = new Date(selectedDate);
        setReminder({
          ...reminder,
          due_date: newDate.toISOString(),
        });
      }
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
                  }
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
                    }
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
                  }
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
                    }
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
                  }
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
                    }
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
                onPress={() => {
                  // TODO: 添加重复结束日期选择器
                }}
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
      
      {/* 日期选择器 */}
      {showDatePicker && (
        <DateTimePicker
          value={tempDate}
          mode={datePickerMode}
          is24Hour={true}
          display="default"
          onChange={handleDateChange}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
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
    marginRight: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default ReminderDetailScreen;
