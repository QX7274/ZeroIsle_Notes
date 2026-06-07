import { NativeModules } from 'react-native';

const { DebugLogModule } = NativeModules;

const safeSerialize = payload => {
  if (typeof payload === 'string') {
    return payload;
  }

  try {
    return JSON.stringify(payload);
  } catch (error) {
    return `[debugLog serialize failed] ${error?.message || 'unknown error'}`;
  }
};

export const debugLog = (level = 'info', tag = 'ZeroIsleDebug', payload = '') => {
  if (!__DEV__) {
    return;
  }

  if (DebugLogModule?.log) {
    DebugLogModule.log(level, tag, safeSerialize(payload));
  }
};

export default debugLog;
