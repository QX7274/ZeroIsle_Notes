import { generateNoteDataHash } from '../../services/data/noteDataHash';

export const buildPagedNoteRecord = ({
  noteId,
  title,
  noteStyle,
  pages = [{ content: '', pageNumber: 0, strokes: [] }],
  currentPage = 1,
  totalPages = 1,
  scale = 1.0,
}) => {
  const now = new Date();

  const record = {
    _id: noteId,
    id: noteId?.toString?.() || String(noteId),
    title: title || '新建笔记',
    content: '',
    type: 'paged_note',
    noteType: 'paged_note',
    file_type: 'paged_note',
    noteStyle: noteStyle || 'blank',
    pages: JSON.stringify(pages),
    totalPages,
    currentPage,
    scale,
    scrollPosition: JSON.stringify({ x: 0, y: 0 }),
    created_at: now,
    updated_at: now,
    user_id: 'current_user',
    is_deleted: false,
    is_synced: false,
    file_uri: `paged_note://${noteId}`,
    uri: `paged_note://${noteId}`,
  };

  record.dataHash = generateNoteDataHash(record);
  return record;
};

export const buildPagedNoteStoragePayload = ({
  noteId,
  title,
  noteStyle,
  pages = [{ content: '', pageNumber: 0, strokes: [] }],
  currentPage = 1,
  totalPages = 1,
  scale = 1.0,
  updatedAt = new Date(),
}) => ({
  _id: noteId,
  type: 'paged_note',
  title: title || '新建笔记',
  pageStyle: noteStyle || 'blank',
  pages: JSON.stringify(pages),
  currentPage,
  totalPages,
  scale,
  updated_at: updatedAt,
});

export default {
  buildPagedNoteRecord,
  buildPagedNoteStoragePayload,
};
