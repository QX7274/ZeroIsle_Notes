import { NativeModules, Platform } from 'react-native';

// Mock the NativeModules for both platforms
const mockRecognizeTextInRegion = jest.fn();

NativeModules.NativePDFView = {
  recognizeTextInRegion: mockRecognizeTextInRegion,
};

// 方案A：Android 通过 NativePDFModule 暴露 Promise API
NativeModules.NativePDFModule = {
  recognizeTextInRegion: mockRecognizeTextInRegion,
};

describe('PDF OCR Native Module Bridging', () => {
  beforeEach(() => {
    // Clear mock history before each test
    mockRecognizeTextInRegion.mockClear();
  });

  describe('iOS Platform', () => {
    beforeAll(() => {
      Platform.OS = 'ios';
    });

    it('should call NativePDFView.recognizeTextInRegion on iOS', async () => {
      const reactTag = 1;
      const rect = { x: 10, y: 20, width: 100, height: 50 };
      const expectedText = 'iOS PDF OCR Result';

      mockRecognizeTextInRegion.mockResolvedValue(expectedText);

      const text = await NativeModules.NativePDFView.recognizeTextInRegion(reactTag, rect.x, rect.y, rect.width, rect.height);

      expect(mockRecognizeTextInRegion).toHaveBeenCalledWith(reactTag, rect.x, rect.y, rect.width, rect.height);
      expect(text).toBe(expectedText);
    });

    it('should handle errors on iOS', async () => {
      const reactTag = 2;
      const rect = { x: 10, y: 20, width: 100, height: 50 };
      const errorMessage = 'iOS OCR Failed';

      mockRecognizeTextInRegion.mockRejectedValue(new Error(errorMessage));

      await expect(NativeModules.NativePDFView.recognizeTextInRegion(reactTag, rect.x, rect.y, rect.width, rect.height)).rejects.toThrow(errorMessage);
    });
  });

  describe('Android Platform', () => {
    beforeAll(() => {
      Platform.OS = 'android';
    });

    it('should call NativePDFModule.recognizeTextInRegion on Android', async () => {
      const reactTag = 3;
      const rect = { x: 15, y: 25, width: 110, height: 55 };
      const expectedText = 'Android PDF OCR Result';

      mockRecognizeTextInRegion.mockResolvedValue(expectedText);

      const text = await NativeModules.NativePDFModule.recognizeTextInRegion(reactTag, rect.x, rect.y, rect.width, rect.height);

      expect(mockRecognizeTextInRegion).toHaveBeenCalledWith(reactTag, rect.x, rect.y, rect.width, rect.height);
      expect(text).toBe(expectedText);
    });

    it('should handle errors on Android', async () => {
      const reactTag = 4;
      const rect = { x: 15, y: 25, width: 110, height: 55 };
      const errorMessage = 'Android OCR Failed';

      mockRecognizeTextInRegion.mockRejectedValue(new Error(errorMessage));

      await expect(NativeModules.NativePDFModule.recognizeTextInRegion(reactTag, rect.x, rect.y, rect.width, rect.height)).rejects.toThrow(errorMessage);
    });
  });
});

