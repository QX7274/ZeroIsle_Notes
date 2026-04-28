// Note Version API (JS)
// Provides list, compare, restore, auto-save endpoints wrappers

import apiClient from './apiClient';

const normalizePage = (resp) => {
  // DRF pagination shape: { count, next, previous, results }
  if (resp && resp.results && typeof resp.count === 'number') {
    return {
      items: resp.results,
      total: resp.count,
      page: resp.current || 1,
      pageSize: resp.page_size || resp.results.length,
    };
  }
  // Non-paginated fallback
  return {
    items: Array.isArray(resp) ? resp : [],
    total: Array.isArray(resp) ? resp.length : 0,
    page: 1,
    pageSize: Array.isArray(resp) ? resp.length : 0,
  };
};

const wrapError = (e) => {
  const code = e?.code || e?.response?.status || 'API_ERROR';
  const message = e?.message || '请求失败';
  return Object.assign(new Error(message), { code });
};

export async function getVersions(noteId, { page = 1, pageSize = 20, signal } = {}) {
  try {
    const res = await apiClient.get('/notes/versions/', {
      params: { note_id: noteId, page, page_size: pageSize },
      signal,
    });
    return normalizePage(res);
  } catch (e) {
    throw wrapError(e);
  }
}

export async function compareVersions(fromId, toId, { signal } = {}) {
  try {
    const res = await apiClient.get('/notes/versions/compare', {
      params: { from_id: fromId, to_id: toId },
      signal,
    });
    return res; // { note_id, from_version, to_version, title_diff, content_diff }
  } catch (e) {
    throw wrapError(e);
  }
}

export async function restoreVersion(versionId, { signal } = {}) {
  try {
    const res = await apiClient.post(`/notes/versions/${versionId}/restore/`, null, { signal });
    return res; // restored_to_version
  } catch (e) {
    throw wrapError(e);
  }
}

export async function getLatestAutoSave(noteId, { signal } = {}) {
  try {
    const res = await apiClient.get('/notes/versions/auto_save', {
      params: { note_id: noteId },
      signal,
    });
    return res;
  } catch (e) {
    if (e?.response?.status === 404) {
      throw Object.assign(new Error('未找到自动保存版本（首次使用或尚未创建）'), { code: 404 });
    }
    throw wrapError(e);
  }
}

export async function createAutoSave({ note, title, content }, { signal } = {}) {
  try {
    const res = await apiClient.post('/notes/versions/create_auto_save', { note, title, content }, { signal });
    return res;
  } catch (e) {
    throw wrapError(e);
  }
}
