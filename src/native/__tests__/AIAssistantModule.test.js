jest.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: '17' },
  NativeModules: {
    AIAssistant: null,
    BaiduAIAssistant: null,
  },
  NativeEventEmitter: jest.fn(),
}));

jest.mock('../../services/api/apiClient', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

jest.mock('../../services/auth/tokenService', () => ({
  __esModule: true,
  default: {},
}));

describe('AIAssistantModule native fallbacks', () => {
  test('reports an unavailable Baidu native module without throwing ReferenceError', async () => {
    const aiAssistantModule = require('../AIAssistantModule').default;

    await expect(aiAssistantModule.configureBaiduAI({})).rejects.toThrow('百度AI模块不可用');
  });

  test('reports an unavailable shared native module for other engines', async () => {
    const aiAssistantModule = require('../AIAssistantModule').default;

    await expect(aiAssistantModule.configureXunfeiAI({})).rejects.toThrow('AI助手模块不可用');
  });
});
