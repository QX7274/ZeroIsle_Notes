const { NativeModules } = require('react-native');

const NotificationChannelModule = NativeModules.NotificationChannelModule || null;

const notificationChannelWrapper = {
    createChannel: (channelId, channelName, importance) => {
        if (NotificationChannelModule) {
            NotificationChannelModule.createChannel(channelId, channelName, importance);
        } else {
            console.warn('NotificationChannelModule not available');
        }
    },
};

module.exports = notificationChannelWrapper;
module.exports.default = notificationChannelWrapper;
