import { NativeModules } from 'react-native';

// Mock the NativeModules
const mockRecognizeHandwriting = jest.fn();

NativeModules.NativeInfiniteCanvasView = {
  recognizeHandwriting: mockRecognizeHandwriting,
};

NativeModules.NativePagedNoteView = {
  recognizeHandwriting: mockRecognizeHandwriting,
};

describe('Handwriting Recognition Native Module', () => {
  beforeEach(() => {
    // Clear mock history before each test
    mockRecognizeHandwriting.mockClear();
  });

  it('should call NativeInfiniteCanvasView.recognizeHandwriting with correct parameters', async () => {
    const reactTag = 1;
    const strokeIds = ['s1', 's2', 's3'];
    const expectedResult = { text: 'Hello World', confidence: 0.9 };

    // Set up the mock to return a resolved promise with the expected result
    mockRecognizeHandwriting.mockResolvedValue(expectedResult);

    const result = await NativeModules.NativeInfiniteCanvasView.recognizeHandwriting(reactTag, strokeIds);

    // Verify the mock was called
    expect(mockRecognizeHandwriting).toHaveBeenCalledWith(reactTag, strokeIds);

    // Verify the result
    expect(result).toBe(expectedResult);
  });

  it('should call NativePagedNoteView.recognizeHandwriting with correct parameters', async () => {
    const reactTag = 2;
    const strokeIds = ['a', 'b'];
    const expectedResult = { text: '你好世界', confidence: 0.85 };

    mockRecognizeHandwriting.mockResolvedValue(expectedResult);

    const result = await NativeModules.NativePagedNoteView.recognizeHandwriting(reactTag, strokeIds);

    expect(mockRecognizeHandwriting).toHaveBeenCalledWith(reactTag, strokeIds);
    expect(result).toBe(expectedResult);
  });

  it('should handle errors from the native module', async () => {
    const reactTag = 3;
    const strokeIds = ['x'];
    const errorMessage = 'E_HANDWRITING_FAILED: Recognition failed';

    // Set up the mock to return a rejected promise
    mockRecognizeHandwriting.mockRejectedValue(new Error(errorMessage));

    await expect(NativeModules.NativeInfiniteCanvasView.recognizeHandwriting(reactTag, strokeIds)).rejects.toThrow(errorMessage);
  });

  it('should handle empty or null results from the native module', async () => {
    const reactTag = 4;
    const strokeIds = ['z'];

    // Test with null
    mockRecognizeHandwriting.mockResolvedValue(null);
    let result = await NativeModules.NativeInfiniteCanvasView.recognizeHandwriting(reactTag, strokeIds);
    expect(result).toBeNull();

    // Test with empty object
    mockRecognizeHandwriting.mockResolvedValue({});
    result = await NativeModules.NativeInfiniteCanvasView.recognizeHandwriting(reactTag, strokeIds);
    expect(result).toEqual({});
  });
});

