import { NativeModules } from 'react-native';

const { DebugLogModule } = NativeModules;
let hasReportedBridgeState = false;

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

  if (!hasReportedBridgeState) {
    hasReportedBridgeState = true;

    if (DebugLogModule?.log) {
      DebugLogModule.log('info', 'DebugLogModule', safeSerialize({
        event: 'js-bridge-detected',
        nativeModuleKeys: Object.keys(NativeModules || {}).filter(name =>
          name.toLowerCase().includes('debug')),
      }));
    } else {
      console.warn('[debugLog] DebugLogModule unavailable', {
        nativeModuleKeys: Object.keys(NativeModules || {}).filter(name =>
          name.toLowerCase().includes('debug')),
      });
    }
  }

  if (DebugLogModule?.log) {
    DebugLogModule.log(level, tag, safeSerialize(payload));
  }
};

export default debugLog;
