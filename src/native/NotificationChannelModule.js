import { NativeModules } from 'react-native';

const { NotificationChannelModule } = NativeModules;

export default {
    createChannel: (channelId, channelName, importance) => {
        NotificationChannelModule.createChannel(channelId, channelName, importance);
    },
}; 