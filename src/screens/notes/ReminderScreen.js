import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Text,
  Switch
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { remindersApi } from '../../services/api';
import { addReminder, updateReminder, deleteReminder } from '../../redux/actions/remindersActions';
import Icon from 'react-native-vector-icons/Ionicons';
import { dateUtils } from '../../utils';
import DateTimePicker from '@react-native-community/datetimepicker';

const ReminderScreen = () => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const reminders = useSelector(state => state.reminders.reminders);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    try {
      const response = await remindersApi.getAll();
      dispatch(updateReminder(response));
    } catch (error) {
      console.error('加载提醒失败:', error);
    }
  };

  const handleAddReminder = () => {
    setShowDatePicker(true);
  };

  const handleDateChange = async (event, date) => {
    setShowDatePicker(false);
    if (date) {
      try {
        const reminderData = {
          title: '新提醒',
          date: date.toISOString(),
          isEnabled: true
        };
        const newReminder = await remindersApi.create(reminderData);
        dispatch(addReminder(newReminder));
      } catch (error) {
        console.error('创建提醒失败:', error);
      }
    }
  };

  const handleToggleReminder = async (reminder) => {
    try {
      const updatedReminder = await remindersApi.update(reminder.id, {
        ...reminder,
        isEnabled: !reminder.isEnabled
      });
      dispatch(updateReminder(updatedReminder));
    } catch (error) {
      console.error('更新提醒失败:', error);
    }
  };

  const handleDeleteReminder = async (id) => {
    try {
      await remindersApi.delete(id);
      dispatch(deleteReminder(id));
    } catch (error) {
      console.error('删除提醒失败:', error);
    }
  };

  const renderReminderItem = ({ item }) => (
    <View style={[styles.reminderItem, { backgroundColor: colors.card }]}>
      <View style={styles.reminderContent}>
        <Text style={[styles.reminderTitle, { color: colors.text }]}>
          {item.title}
        </Text>
        <Text style={[styles.reminderDate, { color: colors.text }]}>
          {dateUtils.format(new Date(item.date))}
        </Text>
      </View>
      <View style={styles.reminderActions}>
        <Switch
          value={item.isEnabled}
          onValueChange={() => handleToggleReminder(item)}
          trackColor={{ false: colors.border, true: colors.primary }}
        />
        <TouchableOpacity
          onPress={() => handleDeleteReminder(item.id)}
          style={styles.deleteButton}
        >
          <Icon name="trash-outline" size={20} color={colors.notification} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={reminders}
        renderItem={renderReminderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContainer}
      />
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: colors.primary }]}
        onPress={handleAddReminder}
      >
        <Icon name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="datetime"
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
    flex: 1
  },
  listContainer: {
    padding: 16
  },
  reminderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2
  },
  reminderContent: {
    flex: 1
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4
  },
  reminderDate: {
    fontSize: 14
  },
  reminderActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  deleteButton: {
    marginLeft: 16,
    padding: 4
  },
  addButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4
  }
});

export default ReminderScreen;