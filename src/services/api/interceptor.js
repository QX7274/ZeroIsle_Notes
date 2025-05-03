/**
 * API拦截器
 * 为了保持兼容性，导入并导出apiClient
 * @deprecated 请直接使用apiClient
 */
import apiClient from './apiClient';

/**
 * 为了保持兼容性，导出apiClient
 * 所有使用instance的地方都应该迁移到apiClient
 */
export default apiClient;