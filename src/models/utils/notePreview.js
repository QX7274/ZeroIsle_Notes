/**
 * 笔记列表预览元数据工具（里程碑 5.1 续：列表预览 + 徽标）
 *
 * 背景（RISK-PERF-002 续）：列表字段裁剪（noteProjection.toNoteSummary）只投影
 * 白名单字段 + metadata，不再读取 content。但列表页仍需要「一行预览文字」与
 * 「是否有正文 / 分页 / 笔迹」的徽标，而这些事实只能来自正文与页面数据。
 *
 * 因此把「读取大字段」这一步前移到写入侧：
 * 1. 保存笔记时调用 buildNotePreview({ content, pages, strokeData })，把结果
 *    （previewText / contentLength / hasContent / hasPages / hasStrokeData）
 *    merge 进 metadata（标量 JSON 字符串）；
 * 2. 列表页只解析 metadata 即可渲染预览与徽标，无需再读 content/pages/strokeData。
 *
 * 约定：
 * - 纯函数、确定性：同一入参永远得到同一结果，不依赖时间/随机数/Realm；
 * - 非法入参（null/undefined/非字符串 content、非对象入参）一律安全返回默认值，不抛错；
 * - hasPages / hasStrokeData 只根据调用方传入的原值做「空/非空」判定，
 *   不 JSON.parse，也不遍历大字段内容（这正是本模块要避免的开销）。
 */

/** 预览文本默认上限（字符） */
const DEFAULT_PREVIEW_LENGTH = 80;

/** 「空」的 JSON 字面量：字符串形态的 pages/strokeData 常见空值 */
const EMPTY_JSON_LITERALS = Object.freeze(['[]', '{}', 'null', 'undefined']);

/**
 * 是否是普通对象（排除 null / 数组）
 * @param {*} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 判断调用方传入的大字段原值是否「非空」。
 *
 * 只读取 length / 键数量这类廉价元信息，不对字符串做 JSON.parse，
 * 也不深入遍历对象，避免触发大字段的完整读取。
 *
 * @param {*} value content/pages/strokeData 的原值
 * @returns {boolean}
 */
function isNonEmptyValue(value) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed !== '' && !EMPTY_JSON_LITERALS.includes(trimmed);
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value.length === 'number') {
    // 数组 / Realm List / 类数组：长度即事实
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return true;
}

/**
 * 剥离 markdown 标记并折叠空白。
 *
 * 只做「行首标记 + 通用强调标记」的确定性替换，不解析 markdown 语法树：
 * 标题 #、引用 >、无序列表标记（-、*、+）与有序列表序号、setext 下划线 =/-、
 * 围栏代码块、行内代码/强调/删除线 ` * _ ~、图片与链接（保留可见文字）、
 * 裸方括号、HTML 标签。
 *
 * @param {string} text 原始正文
 * @returns {string} 单行预览文本（未截断）
 */
function stripMarkdown(text) {
  if (typeof text !== 'string' || text === '') {
    return '';
  }

  let output = text.replace(/\r\n?/g, '\n');

  // 围栏代码块：去掉 ```lang / ``` 分隔行，保留其中的文本
  output = output.replace(/^[ \t]*```[^\n]*$/gm, ' ');
  output = output.replace(/```/g, ' ');

  // 图片 / 链接：保留可见文字，去掉地址
  output = output.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  output = output.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  // 行首标记：标题、引用、列表、序号
  output = output.replace(/^[ \t]*#{1,6}[ \t]*/gm, '');
  output = output.replace(/^[ \t]*>[ \t]?/gm, '');
  output = output.replace(/^[ \t]*(?:[-*+]|\d+\.)[ \t]+/gm, '');

  // setext 标题下划线（整行 = 或 -）
  output = output.replace(/^[ \t]*[=-]{1,}[ \t]*$/gm, ' ');

  // 强调 / 删除线 / 行内代码标记
  output = output.replace(/[*_`~]/g, '');

  // HTML 标签与裸方括号（复选框 "- [ ] 待办" 等）
  output = output.replace(/<[^>]*>/g, ' ');
  output = output.replace(/[[\]]/g, '');

  // 折叠所有空白（含换行）为单个空格
  return output.replace(/\s+/g, ' ').trim();
}

/**
 * 按上限截断，且不切断 UTF-16 代理对（避免末尾出现半个 emoji）。
 * @param {string} text
 * @param {number} limit
 * @returns {string}
 */
function truncateText(text, limit) {
  const numericLimit = Number(limit);
  const max = Number.isFinite(numericLimit) && numericLimit >= 0
    ? Math.floor(numericLimit)
    : DEFAULT_PREVIEW_LENGTH;

  if (text.length <= max) {
    return text;
  }

  let cut = text.slice(0, max);
  const lastCode = cut.charCodeAt(cut.length - 1);
  if (lastCode >= 0xd800 && lastCode <= 0xdbff) {
    cut = cut.slice(0, -1);
  }
  return cut;
}

/**
 * 计算列表预览元数据（写入侧调用）。
 *
 * @param {Object} [input] { content, pages, strokeData }；pages/strokeData 传原值即可
 * @param {string} [input.content] 笔记正文
 * @param {*} [input.pages] 分页数据原值（通常为 JSON 字符串）
 * @param {*} [input.strokeData] 笔迹数据原值（通常为 JSON 字符串）
 * @param {number} [input.limit] 预览文本上限，默认 DEFAULT_PREVIEW_LENGTH
 * @returns {{previewText: string, contentLength: number, hasContent: boolean, hasPages: boolean, hasStrokeData: boolean}}
 */
function buildNotePreview(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const content = typeof source.content === 'string' ? source.content : '';

  return {
    previewText: truncateText(stripMarkdown(content), source.limit),
    contentLength: content.length,
    hasContent: content.length > 0,
    hasPages: isNonEmptyValue(source.pages),
    hasStrokeData: isNonEmptyValue(source.strokeData),
  };
}

/**
 * 解析已有 metadata 为普通对象；坏 JSON / 非对象一律降级为 {}（不抛错）。
 * @param {string|Object|null|undefined} metadata
 * @returns {Object}
 */
function normalizeMetadataObject(metadata) {
  if (typeof metadata === 'string') {
    if (!metadata) {
      return {};
    }
    try {
      const parsed = JSON.parse(metadata);
      return isPlainObject(parsed) ? { ...parsed } : {};
    } catch (error) {
      return {};
    }
  }
  return isPlainObject(metadata) ? { ...metadata } : {};
}

/**
 * 把预览元数据增量合并进 metadata（保留既有键，返回 JSON 字符串）。
 *
 * - metadata 可以是 JSON 字符串或普通对象；坏 JSON 安全降级为 {}；
 * - preview 中值为 undefined 的键会被忽略，避免覆盖既有值；
 * - 不修改任何入参。
 *
 * @param {string|Object|null|undefined} metadata 调用方/历史已有的 metadata
 * @param {Object|null|undefined} preview buildNotePreview 的结果
 * @returns {string} 合并后的 metadata JSON 字符串
 */
function mergePreviewMetadata(metadata, preview) {
  const base = normalizeMetadataObject(metadata);
  const additions = {};

  if (isPlainObject(preview)) {
    Object.keys(preview).forEach((key) => {
      if (preview[key] !== undefined) {
        additions[key] = preview[key];
      }
    });
  }

  return JSON.stringify({ ...base, ...additions });
}

module.exports = {
  DEFAULT_PREVIEW_LENGTH,
  buildNotePreview,
  mergePreviewMetadata,
  stripMarkdown,
  truncateText,
  isNonEmptyValue,
};

module.exports.default = buildNotePreview;
