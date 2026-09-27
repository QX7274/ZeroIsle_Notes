const {
  buildPagedNoteRecord,
  buildPagedNoteStoragePayload,
} = require('../pagedNoteHelpers');
const { generateNoteDataHash } = require('../../../services/data/noteDataHash');

describe('pagedNoteHelpers', () => {
  test('buildPagedNoteRecord uses Date objects for Realm timestamps', () => {
    const record = buildPagedNoteRecord({
      noteId: 'note-1',
      title: '分页笔记',
      noteStyle: 'grid',
      currentPage: 3,
      totalPages: 7,
      scale: 1.5,
    });

    expect(record._id).toBe('note-1');
    expect(record.title).toBe('分页笔记');
    expect(record.noteStyle).toBe('grid');
    expect(record.currentPage).toBe(3);
    expect(record.totalPages).toBe(7);
    expect(record.scale).toBe(1.5);
    expect(record.created_at).toBeInstanceOf(Date);
    expect(record.updated_at).toBeInstanceOf(Date);
    expect(record.pages).toBe(JSON.stringify([{ content: '', pageNumber: 0, strokes: [] }]));
    expect(record.dataHash).toBe(generateNoteDataHash(record));
  });

  test('buildPagedNoteStoragePayload keeps update timestamps as Date objects', () => {
    const updatedAt = new Date('2026-07-10T12:00:00.000Z');
    const payload = buildPagedNoteStoragePayload({
      noteId: 'note-2',
      title: '同步笔记',
      noteStyle: 'cornell',
      pages: [{ content: 'hello' }],
      currentPage: 2,
      totalPages: 5,
      scale: 0.9,
      updatedAt,
    });

    expect(payload._id).toBe('note-2');
    expect(payload.pageStyle).toBe('cornell');
    expect(payload.pages).toBe(JSON.stringify([{ content: 'hello' }]));
    expect(payload.updated_at).toBe(updatedAt);
  });
});
