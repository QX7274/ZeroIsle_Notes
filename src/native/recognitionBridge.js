import { NativeModules, Platform } from 'react-native';

const MODULE_CANDIDATES = {
  infinite: {
    ios: ['NativeInfiniteCanvasView', 'NativeInfiniteCanvasViewManager'],
    android: ['NativeInfiniteCanvasModule', 'NativeInfiniteCanvasViewManager'],
  },
  paged: {
    ios: ['NativePagedNoteView', 'NativePagedNoteViewManager'],
    android: ['NativePagedNoteModule', 'NativePagedNoteViewManager'],
  },
};

const getModuleCandidates = (viewType) => {
  const config = MODULE_CANDIDATES[viewType];
  if (!config) {
    throw new Error(`Unsupported recognition view type: ${viewType}`);
  }

  return config[Platform.OS] || [];
};

const invokeNativeMethod = async (viewType, methodName, args) => {
  const candidateNames = getModuleCandidates(viewType);

  for (const moduleName of candidateNames) {
    const nativeModule = NativeModules[moduleName];
    const nativeMethod = nativeModule?.[methodName];

    if (typeof nativeMethod === 'function') {
      return nativeMethod(...args);
    }
  }

  throw new Error(`${candidateNames.join(' / ')}.${methodName} is not available on ${Platform.OS}`);
};

export const normalizeRecognizedText = (result) => {
  if (!result) {
    return '';
  }

  if (typeof result === 'string') {
    return result.trim();
  }

  if (Array.isArray(result)) {
    return result
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (item && typeof item.text === 'string') {
          return item.text;
        }

        return '';
      })
      .join(' ')
      .trim();
  }

  if (typeof result === 'object' && typeof result.text === 'string') {
    return result.text.trim();
  }

  return '';
};

export const recognizeTextInRegion = async (viewType, reactTag, rect) => {
  const result = await invokeNativeMethod(viewType, 'recognizeTextInRegion', [
    reactTag,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
  ]);

  return normalizeRecognizedText(result);
};

export const recognizeHandwriting = async (viewType, reactTag, options = {}) => {
  const { count = 5, strokeIds = [] } = options;
  const args = Platform.OS === 'ios' && strokeIds.length > 0
    ? [reactTag, strokeIds]
    : [reactTag, count];

  const result = await invokeNativeMethod(viewType, 'recognizeHandwriting', args);
  return normalizeRecognizedText(result);
};
