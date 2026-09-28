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

  test('buildPagedNoteRecord 不再写入 current_user 哨兵；传入 userId 时写入该值', () => {
    const withoutOwner = buildPagedNoteRecord({
      noteId: 'note-3',
      title: '无 owner',
    });

    expect(withoutOwner.user_id).not.toBe('current_user');
    expect(withoutOwner.user_id === undefined || withoutOwner.user_id === null).toBe(true);

    const emptyOwner = buildPagedNoteRecord({
      noteId: 'note-4',
      title: '空 owner',
      userId: '',
    });

    expect(emptyOwner.user_id === undefined || emptyOwner.user_id === null).toBe(true);

    const withOwner = buildPagedNoteRecord({
      noteId: 'note-5',
      title: '有 owner',
      userId: 'dev-account-001',
    });

    expect(withOwner.user_id).toBe('dev-account-001');
    expect(withOwner.dataHash).toBe(generateNoteDataHash(withOwner));
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
