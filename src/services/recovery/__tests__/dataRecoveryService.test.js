const notes = [];

const mockRealm = {
  objects: jest.fn(() => ({
    filtered: jest.fn(() => notes),
  })),
};

const mockRealmService = {
  getRealm: jest.fn(async () => mockRealm),
};

const mockFileService = {
  fileExists: jest.fn(async () => false),
};

jest.mock('../../database/realmService', () => ({
  __esModule: true,
  default: mockRealmService,
}));
jest.mock('../../../utils/logService', () => ({
  logService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../files/fileService', () => ({
  fileService: mockFileService,
}));
jest.mock('../../data/dataIntegrityService', () => ({
  __esModule: true,
  default: { initialize: jest.fn(async () => undefined) },
}));
jest.mock('../../backup/autoBackupService', () => ({
  __esModule: true,
  default: { initialize: jest.fn(async () => undefined) },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));

const { DataRecoveryService } = require('../dataRecoveryService');

describe('DataRecoveryService missing file detection', () => {
  beforeEach(() => {
    notes.splice(0, notes.length);
    jest.clearAllMocks();
  });

  test('ignores the virtual URI owned by paged notes', async () => {
    notes.push({
      _id: 'paged-note-1',
      title: '分页笔记',
      type: 'paged_note',
      file_uri: 'paged_note://paged-note-1',
      is_deleted: false,
    });

    const service = new DataRecoveryService();
    await expect(service.detectMissingFiles()).resolves.toEqual([]);
    expect(mockFileService.fileExists).not.toHaveBeenCalled();
  });

  test('still reports missing physical files', async () => {
    notes.push({
      _id: 'pdf-note-1',
      title: 'PDF笔记',
      type: 'pdf',
      pdfPath: '/data/user/0/com.zeroisle_notes/files/missing.pdf',
      is_deleted: false,
    });

    const service = new DataRecoveryService();
    const issues = await service.detectMissingFiles();

    expect(issues).toHaveLength(1);
    expect(issues[0].filePath).toContain('missing.pdf');
    expect(mockFileService.fileExists).toHaveBeenCalledWith(issues[0].filePath);
  });
});
