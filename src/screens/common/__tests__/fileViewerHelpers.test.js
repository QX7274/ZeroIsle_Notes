import { buildFileInfo } from '../fileViewerHelpers';

describe('buildFileInfo', () => {
  test('keeps the resolved local cache path for offline viewing', () => {
    const result = buildFileInfo({
      processedUri: '/cache/attachments/remote_hash.pdf',
      name: 'report.pdf',
      stats: { size: 12, mtime: new Date('2026-07-17T00:00:00.000Z') },
      fileType: 'pdf',
    });

    expect(result).toEqual({
      uri: '/cache/attachments/remote_hash.pdf',
      name: 'report.pdf',
      size: 12,
      type: 'pdf',
      lastModified: new Date('2026-07-17T00:00:00.000Z'),
    });
  });
});
