jest.mock('../../files/fileService', () => ({ fileService: {} }));
jest.mock('../../database/realmService', () => ({ __esModule: true, default: {} }));
jest.mock('../../database/mongoDBAdapter', () => ({ mongoDBService: {} }));
jest.mock('../../network/networkService', () => ({ networkService: {} }));
jest.mock('../../storage/offlineDataService', () => ({ __esModule: true, default: {} }));
jest.mock('../../app/deviceIdentityService', () => ({ deviceIdentityService: {} }));
jest.mock('../../../models', () => ({ OfflineQueue: {}, SearchIndex: {} }));
jest.mock('../../../utils/logService', () => ({
  logService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { DataIntegrityService } = require('../dataIntegrityService');
const { EnhancedNoteService } = require('../../notes/enhancedNoteService');

describe('note data hash consistency', () => {
  test('uses the same hash for a plain note and its Realm-shaped representation', () => {
    const note = {
      title: 'Hash contract',
      content: '',
      type: 'paged',
      strokeData: null,
      viewport: null,
      pdfAnnotations: null,
      audioTranscription: null,
      wordContent: null,
      pages: '[]',
    };

    const integrityHash = new DataIntegrityService().generateDataHash(note);
    const enhancedHash = new EnhancedNoteService().generateDataHash(note);

    expect(enhancedHash).toBe(integrityHash);
  });
});
