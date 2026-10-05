import api from './authService';

// 说明（本轮修复）：本文件此前有两类问题，都会让"标签管理"页不可信或不可用：
//
// 1) 路径错误：全部函数指向 `/tags` 系列，但后端的管理标签接口在
//    `/content/tags/`（见 content/urls.py 的 router 注册）。
//    因此新建/编辑/删除标签全部 404。
// 2) 假数据：getTags 与 getTagStats **直接 return mockTags()/mockTagStats()**，
//    真实调用被注释掉 —— 页面上那 10 个标签（重要/会议/项目/学习/生活/…）
//    全部是硬编码的虚构数据，与数据库无关。
//
// 另外原实现的 batchDeleteTags / mergeTags 指向后端**不存在**的端点，
// 本轮按后端真实能力处理（详见各自注释）。

const BASE = "/content/tags/";

// 获取标签列表
export const getTags = async (params) => {
  try {
    const response = await api.get(BASE, { params });
    // 后端分页响应 {count, results} -> 解包为数组，供列表组件直接使用。
    return response.data.results ?? response.data;
  } catch (error) {
    console.error('获取标签列表错误:', error);
    throw error;
  }
};

// 获取标签详情
export const getTagDetail = async (id) => {
  try {
    const response = await api.get(`${BASE}${id}/`);
    return response.data;
  } catch (error) {
    console.error('获取标签详情错误:', error);
    throw error;
  }
};

// 创建标签
export const createTag = async (tagData) => {
  try {
    const response = await api.post(BASE, tagData);
    return response.data;
  } catch (error) {
    console.error('创建标签错误:', error);
    throw error;
  }
};

// 更新标签
export const updateTag = async (id, tagData) => {
  try {
    const response = await api.put(`${BASE}${id}/`, tagData);
    return response.data;
  } catch (error) {
    console.error('更新标签错误:', error);
    throw error;
  }
};

// 删除标签
export const deleteTag = async (id) => {
  try {
    const response = await api.delete(`${BASE}${id}/`);
    return response.data;
  } catch (error) {
    console.error('删除标签错误:', error);
    throw error;
  }
};

// 批量删除标签
//
// 后端 TagViewSet **没有** batch_delete 动作（只有标准 CRUD + sync），
// 原实现的 `/tags/batch-delete` 必然 404。
// 这里改为在前端逐个调用已有的删除接口：不新增后端接口即可让功能可用，
// 且调用方无需改变（仍传 ids 数组）。
// 若后续标签量很大，应改为后端批量端点。
export const batchDeleteTags = async (ids) => {
  try {
    const list = Array.isArray(ids) ? ids : [];
    const results = await Promise.all(list.map((id) => deleteTag(id)));
    return {
      status: "success",
      deleted: results.length,
    };
  } catch (error) {
    console.error('批量删除标签错误:', error);
    throw error;
  }
};

// 合并标签
//
// 后端同样**没有** merge 动作，原 `/tags/merge` 必然 404。
// 合并语义（把 source 的引用改挂到 target 再删 source）涉及跨集合写入，
// 属于后端职责，前端无法安全模拟。因此这里明确抛出可读错误，
// 让调用方知道该能力尚未实现，而不是静默失败或假装成功。
// （TagManagement 页面据此会提示用户，而不是显示"合并成功"。）
export const mergeTags = async () => {
  throw new Error(
    "标签合并功能暂未实现：后端缺少 merge 接口。" +
      "该操作需要改写笔记对标签的引用，属于服务端职责。"
  );
};

// 获取标签统计数据
//
// 后端没有 `/content/tags/stats/`。原实现直接返回 mockTagStats() 假数据。
// 现改为基于真实标签列表自行聚合，保证数字与列表一致（不再出现"统计 10 个、"
// 列表却只有 3 个"这类自相矛盾）。
export const getTagStats = async () => {
  try {
    const tags = await getTags();
    const list = Array.isArray(tags) ? tags : [];
    return {
      total: list.length,
      list,
    };
  } catch (error) {
    console.error('获取标签统计数据错误:', error);
    throw error;
  }
};
