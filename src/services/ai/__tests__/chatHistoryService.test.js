jest.mock('../../database/mongoDBAdapter', () => ({
  mongoDBService: {
    initialize: jest.fn(),
    insertOne: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

jest.mock('../../database/realmService', () => ({
  getRealm: jest.fn(),
  createObjectId: jest.fn(() => 'object-id-1'),
}));

jest.mock('../../network/networkService', () => ({
  networkService: {
    isOnline: jest.fn(() => false),
  },
}));

jest.mock('../../../utils/logService', () => ({
  logService: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../utils/aiChatMigration', () => ({
  migrateAIChatData: jest.fn(),
}));

const chatHistoryService = require('../chatHistoryService');
const { logService } = require('../../../utils/logService');

describe('chatHistoryService.getHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chatHistoryService.initialized = false;
    chatHistoryService.initializationPromise = null;
  });

  test('returns an empty array when the conversation lookup fails', async () => {
    const error = new Error('boom');
    const spy = jest.spyOn(chatHistoryService, 'getConversations').mockRejectedValue(error);

    await expect(chatHistoryService.getHistory()).resolves.toEqual([]);
    expect(logService.error).toHaveBeenCalledWith('获取AI历史记录失败', error);

    spy.mockRestore();
  });

  test('maps conversations into toolbar history items', async () => {
    const createdAt = new Date('2026-07-01T08:00:00.000Z');
    const updatedAt = new Date('2026-07-01T09:30:00.000Z');
    const spy = jest.spyOn(chatHistoryService, 'getConversations').mockResolvedValue([
      {
        _id: 'conv-1',
        title: '翻译',
        messages: [
          { content: 'input text' },
          { content: 'output text' },
        ],
        created_at: createdAt,
        updated_at: updatedAt,
      },
    ]);

    await expect(chatHistoryService.getHistory({ limit: 10 })).resolves.toEqual([
      {
        id: 'conv-1',
        tool: '翻译',
        input: 'input text',
        output: 'output text',
        timestamp: updatedAt,
      },
    ]);

    spy.mockRestore();
  });
});
