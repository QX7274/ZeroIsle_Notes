/**
 * 日历集成视图组件
 * 提供将提醒同步到设备日历的功能
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Switch,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import calendarIntegrationService from '../../services/calendarIntegrationService';

/**
 * 日历集成视图组件
 * @param {Object} reminder 提醒对象
 * @param {Function} onSyncComplete 同步完成回调
 */
const CalendarIntegrationView = ({ reminder, onSyncComplete }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState(null);
  const [syncStatus, setSyncStatus] = useState({
    synced: false,
    eventId: null,
    calendarName: null,
  });
  const [autoSync, setAutoSync] = useState(false);

  // 初始化
  useEffect(() => {
    loadCalendars();
    checkSyncStatus();
  }, [reminder]);

  // 加载日历列表
  const loadCalendars = async () => {
    try {
      setLoading(true);
      const availableCalendars = await calendarIntegrationService.getCalendars();
      
      // 过滤出可写的日历
      const writableCalendars = availableCalendars.filter(cal => cal.allowsModifications);
      
      setCalendars(writableCalendars);
      
      // 如果有默认日历，选中它
      const defaultCalendarId = await calendarIntegrationService._getDefaultCalendarId();
      if (defaultCalendarId) {
        setSelectedCalendarId(defaultCalendarId);
      } else if (writableCalendars.length > 0) {
        setSelectedCalendarId(writableCalendars[0].id);
      }
    } catch (error) {
      console.error('加载日历失败:', error);
      Alert.alert('错误', '加载日历失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 检查同步状态
  const checkSyncStatus = () => {
    if (reminder.calendar_event_id) {
      // 查找日历名称
      const calendarName = calendars.find(cal => cal.id === reminder.calendar_id)?.title || '未知日历';
      
      setSyncStatus({
        synced: true,
        eventId: reminder.calendar_event_id,
        calendarName,
      });
    } else {
      setSyncStatus({
        synced: false,
        eventId: null,
        calendarName: null,
      });
    }
  };

  // 同步到日历
  const handleSyncToCalendar = async () => {
    if (!selectedCalendarId) {
      Alert.alert('提示', '请先选择一个日历');
      return;
    }

    try {
      setLoading(true);
      
      // 创建日历事件
      const eventId = await calendarIntegrationService.createCalendarEvent(
        reminder,
        selectedCalendarId
      );
      
      if (eventId) {
        // 查找日历名称
        const calendarName = calendars.find(cal => cal.id === selectedCalendarId)?.title || '未知日历';
        
        // 更新同步状态
        setSyncStatus({
          synced: true,
          eventId,
          calendarName,
        });
        
        // 回调
        if (onSyncComplete) {
          onSyncComplete({
            calendar_event_id: eventId,
            calendar_id: selectedCalendarId,
          });
        }
        
        Alert.alert('成功', `提醒已同步到日历: ${calendarName}`);
      } else {
        Alert.alert('错误', '同步到日历失败');
      }
    } catch (error) {
      console.error('同步到日历失败:', error);
      Alert.alert('错误', '同步到日历失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 更新日历事件
  const handleUpdateCalendarEvent = async () => {
    if (!syncStatus.synced || !syncStatus.eventId) {
      Alert.alert('提示', '提醒尚未同步到日历');
      return;
    }

    try {
      setLoading(true);
      
      // 更新日历事件
      const success = await calendarIntegrationService.updateCalendarEvent(
        syncStatus.eventId,
        reminder
      );
      
      if (success) {
        Alert.alert('成功', '日历事件已更新');
      } else {
        Alert.alert('错误', '更新日历事件失败');
      }
    } catch (error) {
      console.error('更新日历事件失败:', error);
      Alert.alert('错误', '更新日历事件失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 删除日历事件
  const handleDeleteCalendarEvent = async () => {
    if (!syncStatus.synced || !syncStatus.eventId) {
      Alert.alert('提示', '提醒尚未同步到日历');
      return;
    }

    // 确认删除
    Alert.alert(
      '确认删除',
      `确定要从日历 ${syncStatus.calendarName} 中删除此事件吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // 删除日历事件
              const success = await calendarIntegrationService.deleteCalendarEvent(
                syncStatus.eventId
              );
              
              if (success) {
                // 更新同步状态
                setSyncStatus({
                  synced: false,
                  eventId: null,
                  calendarName: null,
                });
                
                // 回调
                if (onSyncComplete) {
                  onSyncComplete({
                    calendar_event_id: null,
                    calendar_id: null,
                  });
                }
                
                Alert.alert('成功', '日历事件已删除');
              } else {
                Alert.alert('错误', '删除日历事件失败');
              }
            } catch (error) {
              console.error('删除日历事件失败:', error);
              Alert.alert('错误', '删除日历事件失败: ' + error.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // 渲染日历项
  const renderCalendarItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.calendarItem,
        {
          backgroundColor: theme.cardBackground,
          borderColor: selectedCalendarId === item.id ? theme.primary : theme.border,
        },
      ]}
      onPress={() => setSelectedCalendarId(item.id)}
    >
      <View style={[styles.calendarColor, { backgroundColor: item.color || '#cccccc' }]} />
      <Text style={[styles.calendarTitle, { color: theme.text }]}>{item.title}</Text>
      {selectedCalendarId === item.id && (
        <Icon name="check-circle" size={20} color={theme.primary} style={styles.checkIcon} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>日历集成</Text>
      
      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
      ) : (
        <>
          {syncStatus.synced ? (
            <View style={[styles.syncStatusContainer, { backgroundColor: theme.cardBackground }]}>
              <Icon name="event-available" size={24} color={theme.success} style={styles.syncIcon} />
              <View style={styles.syncInfo}>
                <Text style={[styles.syncText, { color: theme.text }]}>
                  已同步到日历: {syncStatus.calendarName}
                </Text>
                <Text style={[styles.syncSubText, { color: theme.textSecondary }]}>
                  事件ID: {syncStatus.eventId.substring(0, 12)}...
                </Text>
              </View>
              <View style={styles.syncActions}>
                <TouchableOpacity
                  style={[styles.syncButton, { backgroundColor: theme.primary }]}
                  onPress={handleUpdateCalendarEvent}
                >
                  <Icon name="sync" size={16} color="#ffffff" />
                  <Text style={styles.syncButtonText}>更新</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.syncButton, { backgroundColor: theme.error }]}
                  onPress={handleDeleteCalendarEvent}
                >
                  <Icon name="delete" size={16} color="#ffffff" />
                  <Text style={styles.syncButtonText}>删除</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                选择要同步到的日历:
              </Text>
              
              {calendars.length > 0 ? (
                <FlatList
                  data={calendars}
                  renderItem={renderCalendarItem}
                  keyExtractor={item => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.calendarList}
                />
              ) : (
                <Text style={[styles.emptyText, { color: theme.textDisabled }]}>
                  没有可用的日历
                </Text>
              )}
              
              <View style={styles.optionRow}>
                <Text style={[styles.optionLabel, { color: theme.text }]}>自动同步更改</Text>
                <Switch
                  value={autoSync}
                  onValueChange={setAutoSync}
                  trackColor={{ false: theme.border, true: theme.primary + '80' }}
                  thumbColor={autoSync ? theme.primary : '#f4f3f4'}
                />
              </View>
              
              <TouchableOpacity
                style={[styles.syncButton, styles.mainSyncButton, { backgroundColor: theme.primary }]}
                onPress={handleSyncToCalendar}
                disabled={!selectedCalendarId}
              >
                <Icon name="event" size={20} color="#ffffff" />
                <Text style={styles.mainSyncButtonText}>同步到日历</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  loader: {
    marginVertical: 20,
  },
  calendarList: {
    paddingVertical: 8,
  },
  calendarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 12,
    minWidth: 120,
  },
  calendarColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  calendarTitle: {
    fontSize: 14,
    flex: 1,
  },
  checkIcon: {
    marginLeft: 4,
  },
  emptyText: {
    textAlign: 'center',
    marginVertical: 20,
    fontStyle: 'italic',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 16,
  },
  optionLabel: {
    fontSize: 16,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 12,
    marginLeft: 4,
  },
  mainSyncButton: {
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  mainSyncButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  syncStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginVertical: 8,
  },
  syncIcon: {
    marginRight: 12,
  },
  syncInfo: {
    flex: 1,
  },
  syncText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  syncSubText: {
    fontSize: 12,
    marginTop: 4,
  },
  syncActions: {
    flexDirection: 'row',
  },
});

export default CalendarIntegrationView;
