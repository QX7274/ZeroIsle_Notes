/**
 * 笔记卡片（NoteItem）的投影兼容层（里程碑 5.1：列表字段裁剪 + 正文延迟加载）
 *
 * 列表数据来源有两种形态：
 * 1. 完整 Note 对象 / 展平的普通对象（历史形态，含 content/pages/strokeData）；
 * 2. 轻量 summary（noteProjection.materializeNoteSummaries 产出，不含 content/pages/strokeData，
 *    但带 previewText / hasContent / hasPages / hasStrokeData，这些由写入侧写入 metadata 后派生）。
 *
 * 本模块把两种形态统一成同一组读取函数，让 NoteItem 在两种数据源下渲染一致：
 * - 优先使用 summary 的轻量字段，避免为了渲染预览而读取正文；
 * - 老形态（无 summary 字段）回退到直接读取 content/pages/strokeData，行为与改动前完全一致。
 */

/** 与 HomeScreen 既有实现保持一致的 markdown 标记集合 */
const MARKDOWN_MARKS = /[#*`>~=[\]_]/g;

/** previewText 长度上限（与 notePreview.buildNotePreview 的默认值保持一致） */
export const PREVIEW_TEXT_LIMIT = 80;

/**
 * 剥离 markdown 标记并压缩空白
 * @param {string} raw
 * @returns {string}
 */
export const stripMarkdown = (raw) => {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw.replace(MARKDOWN_MARKS, '').replace(/\s+/g, ' ').trim();
};

/**
 * 卡片摘要文本：summary 优先，回退到实时剥离正文
 * @param {Object} item
 * @returns {string} 空字符串表示无可展示摘要
 */
export const getItemPreviewText = (item) => {
  if (!item) {
    return '';
  }
  if (typeof item.previewText === 'string' && item.previewText.length > 0) {
    return item.previewText;
  }
  return stripMarkdown(item.content);
};

/**
 * 是否存在正文：summary 的布尔标记优先（读取它不会触碰 content）
 * @param {Object} item
 * @returns {boolean}
 */
export const itemHasContent = (item) => {
  if (!item) {
    return false;
  }
  if (typeof item.hasContent === 'boolean') {
    return item.hasContent;
  }
  return Boolean(item.content);
};

/**
 * 是否存在分页数据
 * @param {Object} item
 * @returns {boolean}
 */
export const itemHasPages = (item) => {
  if (!item) {
    return false;
  }
  if (typeof item.hasPages === 'boolean') {
    return item.hasPages;
  }
  return Boolean(item.pages);
};

/**
 * 是否存在笔迹数据
 * @param {Object} item
 * @returns {boolean}
 */
export const itemHasStrokeData = (item) => {
  if (!item) {
    return false;
  }
  if (typeof item.hasStrokeData === 'boolean') {
    return item.hasStrokeData;
  }
  return Boolean(item.strokeData);
};

/**
 * 供导出的「内容文本」：老形态用 content（可能与旧行为逐字一致，包括循环引用保护），
 * summary 形态退化为 previewText。用于 renderCover 里 content.includes(...) 这类判断。
 * @param {Object} item
 * @returns {string}
 */
export const getItemContentLikeText = (item) => {
  if (!item) {
    return '';
  }
  const { content } = item;
  if (typeof content === 'string') {
    return content;
  }
  if (content && typeof content === 'object') {
    // 与既有实现一致：循环引用按空字符串处理，其它对象转字符串
    if (content.reference === 'circular') {
      return '';
    }
    try {
      return String(content);
    } catch (error) {
      return '';
    }
  }
  if (typeof item.previewText === 'string') {
    return item.previewText;
  }
  return '';
};

/**
 * summary 是否「未打标」（缺少写入侧预览元数据）。
 *
 * 打标过的笔记一定带 contentLength（buildNotePreview 产出）→ hasContent 为布尔、
 * previewText 为字符串；因此「previewText 缺失 且 hasContent 为 null」即视为未打标。
 * 存量笔记与 notesApi.importNote 导入的笔记属于这一类，列表侧据此回退到全量数据源，
 * 避免摘要整体消失（见 HomeScreen.loadNotesListPayload 的未打标保护）。
 *
 * @param {Object} item summary 列表项
 * @returns {boolean}
 */
export const isUntaggedSummary = (item) => Boolean(item)
  && (item.previewText === null || item.previewText === undefined)
  && item.hasContent === null;

/**
 * 按 id 取回完整笔记（summary 形态的列表项不含正文）。
 *
 * 只负责「取回 + 解包」，不涉及 Redux；取不到或抛错时返回 null，
 * 由调用方决定回退策略（例如重命名时退回 summary 形态）。
 *
 * @param {Object} item 列表项（summary 或完整 Note）
 * @param {Function} getById 注入的取数函数，契约同 notesApi.getById(id) => { success, data }
 * @returns {Promise<Object|null>} 完整笔记或 null
 */
export const resolveFullNote = async (item, getById) => {
  if (!item || typeof getById !== 'function') {
    return null;
  }
  const noteId = item._id || item.id;
  if (!noteId) {
    return null;
  }
  try {
    const response = await getById(String(noteId));
    // 兼容 { success, data } 与「直接返回笔记对象」两种契约
    const note = response && response.data ? response.data : response;
    return note || null;
  } catch (error) {
    return null;
  }
};

/**
 * 解析列表项正文（所有「需要正文」的路径专用）。
 *
 * - 老形态（item.content 已存在）：直接返回，语义与改动前的 `item.content || ''` 完全一致，
 *   不会为了省事去多发一次请求；
 * - 轻量 summary（content === undefined）：调用注入的 getById 按 id 延迟加载正文；
 *   没有 id、取数失败或约束缺失时回退空串，绝不抛错，保证导航/导出不被正文加载失败阻断。
 *
 * @param {Object} item 列表项
 * @param {Function} getById 注入的取数函数（HomeScreen 传 notesApi.getById，便于单测 mock）
 * @returns {Promise<string>} 正文文本；未知时为空串
 */
export const resolveItemContent = async (item, getById) => {
  if (!item) {
    return '';
  }
  if (item.content !== undefined) {
    return item.content || '';
  }

  const note = await resolveFullNote(item, getById);
  if (!note || note.content === undefined || note.content === null) {
    return '';
  }
  try {
    return typeof note.content === 'string' ? note.content : String(note.content);
  } catch (error) {
    return '';
  }
};

export default {
  PREVIEW_TEXT_LIMIT,
  stripMarkdown,
  getItemPreviewText,
  itemHasContent,
  itemHasPages,
  itemHasStrokeData,
  getItemContentLikeText,
  isUntaggedSummary,
  resolveFullNote,
  resolveItemContent,
};
