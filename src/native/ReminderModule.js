import { NativeModules } from 'react-native';

const { ReminderModule } = NativeModules;

export default {
    scheduleReminder: (reminder) => {
        return ReminderModule.scheduleReminder({
            id: reminder.id,
            title: reminder.title,
            description: reminder.description,
            timestamp: reminder.timestamp,
        });
    },

    cancelReminder: (id) => {
        return ReminderModule.cancelReminder(id);
    },
}; 