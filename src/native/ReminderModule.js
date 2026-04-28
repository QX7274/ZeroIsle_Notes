const { NativeModules } = require('react-native');

const ReminderModule = NativeModules.ReminderModule || null;

const reminderWrapper = {
    scheduleReminder: (reminder) => {
        if (!ReminderModule) {
            return Promise.reject(new Error('ReminderModule not available'));
        }
        return ReminderModule.scheduleReminder({
            id: reminder.id,
            title: reminder.title,
            description: reminder.description,
            timestamp: reminder.timestamp,
        });
    },

    cancelReminder: (id) => {
        if (!ReminderModule) {
            return Promise.reject(new Error('ReminderModule not available'));
        }
        return ReminderModule.cancelReminder(id);
    },
};

module.exports = reminderWrapper;
module.exports.default = reminderWrapper;
