import { generateNoteDataHash } from '../../services/data/noteDataHash';

/**
 * 构建分页笔记的 Realm 记录。
 *
 * owner 由调用方注入：传入 userId 时写入该值；未传入（或为 null/空串）时不写 user_id，
 * 交由 schema 默认值决定（runtime 为 string? → null）。
 * 不再硬编码 'current_user' 哨兵 —— 它既不等于任何真实账号，也不被读取侧的
 * 「当前用户 / 无主」谓词识别。
 *
 * @param {Object} params
 * @param {string} params.noteId 笔记 id
 * @param {string} [params.title] 标题
 * @param {string} [params.noteStyle] 纸张样式
 * @param {Array} [params.pages] 页面数据
 * @param {number} [params.currentPage] 当前页
 * @param {number} [params.totalPages] 总页数
 * @param {number} [params.scale] 缩放
 * @param {string|null} [params.userId] 当前用户 id（调用方用 resolveLocalOwnerId 注入）
 * @returns {Object} Realm Note 记录
 */
export const buildPagedNoteRecord = ({
  noteId,
  title,
  noteStyle,
  pages = [{ content: '', pageNumber: 0, strokes: [] }],
  currentPage = 1,
  totalPages = 1,
  scale = 1.0,
  userId = null,
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
    is_deleted: false,
    is_synced: false,
    file_uri: `paged_note://${noteId}`,
    uri: `paged_note://${noteId}`,
  };

  // owner 由调用方注入；缺失时保持无主（不写哨兵）
  if (userId !== undefined && userId !== null && String(userId) !== '') {
    record.user_id = String(userId);
  }

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
