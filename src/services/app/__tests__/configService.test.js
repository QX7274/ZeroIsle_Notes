jest.mock('../../database/realmService', () => ({
  __esModule: true,
  default: {
    getRealm: jest.fn().mockRejectedValue(new Error('storage unavailable')),
  },
}));

jest.mock('../../../config', () => ({
  API_URL: 'http://127.0.0.1:8001',
  API_VERSION: 'v1',
}));

describe('configService security defaults', () => {
  test('does not expose a MongoDB credential in the default configuration', async () => {
    const { configService } = require('../configService');
    const { MONGODB_CONFIG } = require('../../../config/mongodbConfig');
    const config = await configService.getConfig();

    expect(config.mongodb.connectionString).toBe('');
    expect(MONGODB_CONFIG.URI).toBe('');
    expect(config.mongodb.connectionString).not.toMatch(/mongodb\+srv:\/\/[^/]+:[^@]+@/);
  });
});
