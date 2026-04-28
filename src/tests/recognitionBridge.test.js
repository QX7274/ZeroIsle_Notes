import { NativeModules, Platform } from 'react-native';
import {
  normalizeRecognizedText,
  recognizeHandwriting,
  recognizeTextInRegion,
} from '../native/recognitionBridge';

describe('recognitionBridge', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Object.keys(NativeModules).forEach((key) => {
      delete NativeModules[key];
    });
  });

  afterAll(() => {
    Platform.OS = originalPlatform;
  });

  it('normalizes string, object and block-array OCR results', () => {
    expect(normalizeRecognizedText('  hello  ')).toBe('hello');
    expect(normalizeRecognizedText({ text: ' world ' })).toBe('world');
    expect(normalizeRecognizedText([{ text: 'A' }, { text: 'B' }])).toBe('A B');
    expect(normalizeRecognizedText(null)).toBe('');
  });

  it('uses Android canvas module promise API for region OCR', async () => {
    Platform.OS = 'android';
    const recognizeTextInRegionMock = jest.fn().mockResolvedValue('安卓 OCR');
    NativeModules.NativeInfiniteCanvasModule = {
      recognizeTextInRegion: recognizeTextInRegionMock,
    };

    const text = await recognizeTextInRegion('infinite', 11, {
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    });

    expect(recognizeTextInRegionMock).toHaveBeenCalledWith(11, 1, 2, 3, 4);
    expect(text).toBe('安卓 OCR');
  });

  it('falls back to the iOS view module contract for handwriting recognition', async () => {
    Platform.OS = 'ios';
    const recognizeHandwritingMock = jest.fn().mockResolvedValue({ text: 'Hello' });
    NativeModules.NativePagedNoteView = {
      recognizeHandwriting: recognizeHandwritingMock,
    };

    const text = await recognizeHandwriting('paged', 22, {
      count: 3,
      strokeIds: ['s1', 's2'],
    });

    expect(recognizeHandwritingMock).toHaveBeenCalledWith(22, ['s1', 's2']);
    expect(text).toBe('Hello');
  });

  it('throws a useful error when no native recognition module is available', async () => {
    Platform.OS = 'android';

    await expect(
      recognizeHandwriting('infinite', 33, { count: 2 })
    ).rejects.toThrow('NativeInfiniteCanvasModule / NativeInfiniteCanvasViewManager.recognizeHandwriting is not available on android');
  });
});
