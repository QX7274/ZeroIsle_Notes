jest.mock('../../../services/api', () => ({
  aiAssistantApi: {
    sendStreamChatMessage: jest.fn(),
    sendChatMessage: jest.fn(),
    getAvailableModels: jest.fn(),
    resetSession: jest.fn(),
  },
}));

jest.mock('../../../services/database/realmService', () => ({
  __esModule: true,
  default: {
    getRealm: jest.fn(),
  },
}));

import { __testables__ } from '../aiAssistantSlice';

describe('aiAssistantSlice history limit guards', () => {
  it('sanitizeHistoryObject enforces session count, message count, and text length caps', () => {
    const { sanitizeHistoryObject } = __testables__;

    const rawHistory = {};
    for (let s = 1; s <= 45; s += 1) {
      rawHistory[`session-${s}`] = Array.from({ length: 230 }, (_, i) => ({
        id: `m-${s}-${i}`,
        text: `x`.repeat(6000),
        sender: i % 2 === 0 ? 'assistant' : 'user',
      }));
    }

    const sanitized = sanitizeHistoryObject(rawHistory);
    const sessions = Object.keys(sanitized);

    expect(sessions).toHaveLength(40);
    sessions.forEach((sessionId) => {
      const messages = sanitized[sessionId];
      expect(messages.length).toBeLessThanOrEqual(200);
      messages.forEach((msg) => {
        expect(msg.text.length).toBeLessThanOrEqual(4000);
      });
    });
  });
});
