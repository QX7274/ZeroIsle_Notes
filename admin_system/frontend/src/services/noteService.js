import api from './authService';

// 说明（本轮修复）：
// 本文件此前是**整份 mock**（313 行假数据），且路径全部指向不存在的 `/notes` 系列：
//   - getNotes / getNoteDetail -> 直接 return mockNotes()/mockNoteDetail()；
//   - getNoteStats -> 直接 return mockNoteStats()；
//   - createNote/updateNote/deleteNote/updateNoteStatus -> `/notes...`，后端在 /content/notes/ 下；
//   - getNoteVersions -> `/notes/{id}/versions`，后端此前根本没有该端点。
// 而 NoteDetail 是**已挂载页面**，因此"笔记详情 + 版本历史"一直在展示虚构数据。
//
// 现全部改为真实接口。后端本轮同时补上了 versions 动作（见 content/views.py）。

const BASE = "/content/notes/";

// 获取笔记列表
export const getNotes = async (params) => {
  try {
    const response = await api.get(BASE, { params });
    // 后端分页响应 {count, results}，这里保持原样返回，
    // 因为调用方（NoteList 等）需要同时拿到 total。
    return response.data;
  } catch (error) {
    console.error('获取笔记列表错误:', error);
    throw error;
  }
};

// 获取笔记详情
export const getNoteDetail = async (id) => {
  try {
    const response = await api.get(`${BASE}${id}/`);
    return response.data;
  } catch (error) {
    console.error('获取笔记详情错误:', error);
    throw error;
  }
};

// 创建笔记
export const createNote = async (noteData) => {
  try {
    const response = await api.post(BASE, noteData);
    return response.data;
  } catch (error) {
    console.error('创建笔记错误:', error);
    throw error;
  }
};

// 更新笔记
export const updateNote = async (id, noteData) => {
  try {
    const response = await api.put(`${BASE}${id}/`, noteData);
    return response.data;
  } catch (error) {
    console.error('更新笔记错误:', error);
    throw error;
  }
};

// 删除笔记
export const deleteNote = async (id) => {
  try {
    const response = await api.delete(`${BASE}${id}/`);
    return response.data;
  } catch (error) {
    console.error('删除笔记错误:', error);
    throw error;
  }
};

// 更新笔记状态
//
// 后端 NoteViewSet 没有单独的单条状态端点，只有批量动
// batch_update_status；单条更新即"只传一个 id"的批量调用，
// 与 contentService.updateNoteStatus 保持同一口径。
export const updateNoteStatus = async (id, status) => {
  try {
    const response = await api.post(`${BASE}batch_update_status/`, {
      note_ids: [id],
      status,
    });
    return response.data;
  } catch (error) {
    console.error('更新笔记状态错误:', error);
    throw error;
  }
};

// 获取笔记版本历史
//
// 后端此前没有该端点，本轮新增（NoteViewSet.versions）。
export const getNoteVersions = async (id) => {
  try {
    const response = await api.get(`${BASE}${id}/versions/`);
    // 后端返回 {count, results}；页面按数组渲染，这里解包。
    return response.data.results ?? response.data;
  } catch (error) {
    console.error('获取笔记版本历史错误:', error);
    throw error;
  }
};

// 恢复笔记到指定版本
//
// 后端**没有**恢复端点（主后端有 NoteVersionViewSet，但管理后台未接入写操作）。
// 版本恢复会改写笔记正文，属高风险写操作，不应由前端拼接口模拟。
// 因此明确抛错，让调用方提示"暂不支持"，而不是假装成功。
export const restoreNoteVersion = async () => {
  throw new Error(
    "版本恢复暂未实现：后端缺少 restore 接口。" +
      "该操作会改写笔记正文，需要服务端实现并做权限校验。"
  );
};

// 获取笔记统计数据
export const getNoteStats = async () => {
  try {
    const response = await api.get(`${BASE}stats/`);
    return response.data;
  } catch (error) {
    console.error('获取笔记统计数据错误:', error);
    throw error;
  }
};
