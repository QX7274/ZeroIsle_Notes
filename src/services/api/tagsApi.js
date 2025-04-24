/**
 * 标签API服务
 * 导出tagApi中的方法
 */

import { tagApi } from './tagApi';

// 导出所有方法
export const getTags = tagApi.getTags;
export const createTag = tagApi.createTag;
export const updateTag = tagApi.updateTag;
export const deleteTag = tagApi.deleteTag;
export const getTagNotes = tagApi.getTagNotes;
export const addTagToNote = tagApi.addTagToNote;
export const removeTagFromNote = tagApi.removeTagFromNote;
export const getStatistics = tagApi.getStatistics;
export const searchTags = tagApi.searchTags;

// 默认导出
export default tagApi;
