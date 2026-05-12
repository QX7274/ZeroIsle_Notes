/**
 * 群组API服务
 */
import instance from './apiClient';
import { API_ENDPOINTS } from '../../config/api';

/**
 * 获取用户的群组列表
 * @returns {Promise} 群组列表
 */
export const getUserGroups = async () => {
  try {
    const response = await instance.get(API_ENDPOINTS.GROUPS.BASE);
    return {
      success: true,
      data: response.data || [],
    };
  } catch (error) {
    console.error('获取群组列表失败:', error);

    // 如果是401错误且被标记为可忽略的认证错误，不要触发登出
    if (error.response?.status === 401 && error.isIgnorableAuthError) {
      console.log('群组API: 忽略401认证错误');
      throw new Error('暂时无法访问群组功能，请稍后重试');
    }

    throw error;
  }
};

/**
 * 获取群组详情
 * @param {string} groupId 群组ID
 * @returns {Promise} 群组详情
 */
export const getGroupDetail = async (groupId) => {
  try {
    const response = await instance.get(`${API_ENDPOINTS.GROUPS.DETAIL(groupId)}`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('获取群组详情失败:', error);

    // 如果是401错误且被标记为可忽略的认证错误，不要触发登出
    if (error.response?.status === 401 && error.isIgnorableAuthError) {
      console.log('群组API: 忽略401认证错误');
      throw new Error('暂时无法访问群组功能，请稍后重试');
    }

    throw error;
  }
};

/**
 * 创建群组
 * @param {object} groupData 群组数据
 * @returns {Promise} 创建结果
 */
export const createGroup = async (groupData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.GROUPS.BASE, groupData);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('创建群组失败:', error);
    throw error;
  }
};

/**
 * 更新群组信息
 * @param {string} groupId 群组ID
 * @param {object} groupData 群组数据
 * @returns {Promise} 更新结果
 */
export const updateGroup = async (groupId, groupData) => {
  try {
    const response = await instance.patch(
      API_ENDPOINTS.GROUPS.DETAIL(groupId),
      groupData
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('更新群组失败:', error);
    throw error;
  }
};

/**
 * 删除群组
 * @param {string} groupId 群组ID
 * @returns {Promise} 删除结果
 */
export const deleteGroup = async (groupId) => {
  try {
    await instance.delete(API_ENDPOINTS.GROUPS.DETAIL(groupId));
    return {
      success: true,
    };
  } catch (error) {
    console.error('删除群组失败:', error);
    throw error;
  }
};

/**
 * 生成群组加入码
 * @param {string} groupId 群组ID
 * @param {number} expiresIn 过期时间（分钟）
 * @returns {Promise} 加入码
 */
export const generateJoinCode = async (groupId, expiresIn = 30) => {
  try {
    const response = await instance.post(
      API_ENDPOINTS.GROUPS.GENERATE_JOIN_CODE(groupId),
      { expires_in: expiresIn }
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('生成加入码失败:', error);
    throw error;
  }
};

/**
 * 通过加入码加入群组
 * @param {string} joinCode 加入码
 * @returns {Promise} 加入结果
 */
export const joinGroupByCode = async (joinCode) => {
  try {
    const response = await instance.post(
      API_ENDPOINTS.GROUPS.JOIN_BY_CODE,
      { join_code: joinCode }
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('加入群组失败:', error);
    throw error;
  }
};

/**
 * 邀请用户加入群组
 * @param {string} groupId 群组ID
 * @param {string} userId 用户ID
 * @returns {Promise} 邀请结果
 */
export const inviteUserToGroup = async (groupId, userId) => {
  try {
    const response = await instance.post(
      API_ENDPOINTS.GROUPS.INVITE(groupId),
      { user_id: userId }
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('邀请用户失败:', error);
    throw error;
  }
};

/**
 * 获取群组成员列表
 * @param {string} groupId 群组ID
 * @returns {Promise} 成员列表
 */
export const searchGroupInviteCandidates = async (groupId, keyword) => {
  try {
    const response = await instance.get(
      API_ENDPOINTS.GROUPS.INVITE_CANDIDATES(groupId),
      { params: { keyword } }
    );
    return {
      success: true,
      data: response.data || [],
    };
  } catch (error) {
    console.error('搜索群组邀请候选失败:', error);
    throw error;
  }
};

export const getGroupMembers = async (groupId) => {
  try {
    const response = await instance.get(API_ENDPOINTS.GROUPS.MEMBERS(groupId));
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('获取群组成员失败:', error);
    throw error;
  }
};

/**
 * 离开群组
 * @param {string} groupId 群组ID
 * @returns {Promise} 离开结果
 */
export const leaveGroup = async (groupId) => {
  try {
    const response = await instance.post(API_ENDPOINTS.GROUPS.LEAVE(groupId));
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('离开群组失败:', error);
    throw error;
  }
};

/**
 * 获取用户收到的群组邀请
 * @returns {Promise} 邀请列表
 */
export const getGroupInvitations = async () => {
  try {
    const response = await instance.get(API_ENDPOINTS.GROUPS.INVITATIONS);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('获取群组邀请失败:', error);
    throw error;
  }
};

/**
 * 接受群组邀请
 * @param {string} invitationId 邀请ID
 * @returns {Promise} 接受结果
 */
export const acceptGroupInvitation = async (invitationId) => {
  try {
    const response = await instance.post(
      API_ENDPOINTS.GROUPS.ACCEPT_INVITATION(invitationId)
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('接受邀请失败:', error);
    throw error;
  }
};

/**
 * 拒绝群组邀请
 * @param {string} invitationId 邀请ID
 * @returns {Promise} 拒绝结果
 */
export const rejectGroupInvitation = async (invitationId) => {
  try {
    const response = await instance.post(
      API_ENDPOINTS.GROUPS.REJECT_INVITATION(invitationId)
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('拒绝邀请失败:', error);
    throw error;
  }
};

/**
 * 创建屏幕共享
 * @param {string} groupId 群组ID
 * @param {string} title 共享标题
 * @returns {Promise} 创建结果
 */
export const createScreenShare = async (groupId, title) => {
  try {
    const response = await instance.post(
      API_ENDPOINTS.GROUPS.SHARED_SCREENS,
      { group_id: groupId, title }
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('创建屏幕共享失败:', error);
    throw error;
  }
};

/**
 * 获取屏幕共享列表
 * @returns {Promise} 共享列表
 */
export const getScreenShares = async () => {
  try {
    const response = await instance.get(API_ENDPOINTS.GROUPS.SHARED_SCREENS);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('获取屏幕共享列表失败:', error);
    throw error;
  }
};

/**
 * 加入屏幕共享
 * @param {string} shareId 共享ID
 * @returns {Promise} 加入结果
 */
export const joinScreenShare = async (shareId) => {
  try {
    const response = await instance.get(
      API_ENDPOINTS.GROUPS.JOIN_SCREEN_SHARE(shareId)
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('加入屏幕共享失败:', error);
    throw error;
  }
};

/**
 * 暂停屏幕共享
 * @param {string} shareId 共享ID
 * @returns {Promise} 暂停结果
 */
export const pauseScreenShare = async (shareId) => {
  try {
    const response = await instance.post(
      API_ENDPOINTS.GROUPS.PAUSE_SCREEN_SHARE(shareId)
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('暂停屏幕共享失败:', error);
    throw error;
  }
};

/**
 * 恢复屏幕共享
 * @param {string} shareId 共享ID
 * @returns {Promise} 恢复结果
 */
export const resumeScreenShare = async (shareId) => {
  try {
    const response = await instance.post(
      API_ENDPOINTS.GROUPS.RESUME_SCREEN_SHARE(shareId)
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('恢复屏幕共享失败:', error);
    throw error;
  }
};

/**
 * 结束屏幕共享
 * @param {string} shareId 共享ID
 * @returns {Promise} 结束结果
 */
export const endScreenShare = async (shareId) => {
  try {
    const response = await instance.post(
      API_ENDPOINTS.GROUPS.END_SCREEN_SHARE(shareId)
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('结束屏幕共享失败:', error);
    throw error;
  }
};
