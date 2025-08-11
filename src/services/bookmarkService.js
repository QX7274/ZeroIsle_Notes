import { offlineStorageService } from './offline';

// 书签服务：按文档ID（或key）管理书签列表
// 书签结构：{ id, name, page, offsetY, createdAt, updatedAt }
const buildKey = (docId) => `bookmarks_${docId}`;

export function withPosition(data = {}, { page = 1, offsetY = 0 } = {}) {
  return { ...data, page, offsetY };
}

export async function getBookmarks(docId) {
  try {
    const stored = await offlineStorageService.getItem(buildKey(docId));
    if (!stored) return [];
    // 兼容已解析对象与字符串两种形态
    if (typeof stored === 'string') {
      try {
        const list = JSON.parse(stored);
        return Array.isArray(list) ? list : [];
      } catch (parseErr) {
        console.warn('解析书签JSON失败，返回空列表', parseErr);
        return [];
      }
    }
    // 如果已经是数组/对象
    return Array.isArray(stored) ? stored : [];
  } catch (e) {
    console.warn('读取书签失败', e);
    return [];
  }
}

export async function saveBookmarks(docId, list) {
  try {
    await offlineStorageService.setItem(buildKey(docId), JSON.stringify(list || []));
    return true;
  } catch (e) {
    console.warn('保存书签失败', e);
    return false;
  }
}

export async function addBookmark(docId, data) {
  const list = await getBookmarks(docId);
  const now = Date.now();
  const item = { id: `bm_${now}_${Math.random().toString(36).slice(2,8)}`, createdAt: now, updatedAt: now, ...data };
  list.push(item);
  await saveBookmarks(docId, list);
  return item;
}

export async function updateBookmark(docId, id, patch) {
  const list = await getBookmarks(docId);
  const idx = list.findIndex(x => x.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch, updatedAt: Date.now() };
    await saveBookmarks(docId, list);
    return list[idx];
  }
  return null;
}

export async function removeBookmark(docId, id) {
  const list = await getBookmarks(docId);
  const next = list.filter(x => x.id !== id);
  await saveBookmarks(docId, next);
  return true;
}

