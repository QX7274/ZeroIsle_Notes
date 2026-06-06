/**
 * 群组模块Redux Slice
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as groupApi from '../../services/api/groupApi';

const createEmptyScreenShareSession = () => ({
  groupId: null,
  shareId: null,
  role: null,
  status: 'idle',
  webrtcRoomId: null,
  ownerId: null,
  connectedUsers: [],
  shareSnapshot: null,
  connectionState: 'idle',
  connectionDetail: null,
  hasAttachedRemoteStream: false,
  hasRemoteStream: false,
  viewerTimeoutReached: false,
  error: null,
});

const hasActiveScreenShareSession = (session) => Boolean(session?.shareId);

const findSharedScreenById = (sharedScreens, shareId) => (
  (sharedScreens || []).find(
    (share) => String(share?.id || '') === String(shareId || '')
  ) || null
);

const getScreenShareSnapshotSignature = (share) => JSON.stringify({
  id: share?.id || null,
  status: share?.status || null,
  title: share?.title || null,
  webrtcRoomId: share?.webrtc_room_id || null,
  ownerId: share?.user?.id || null,
  groupId: share?.group?.id || null,
  endedAt: share?.ended_at || null,
});

const areSharedScreensEquivalent = (currentSharedScreens, nextSharedScreens) => {
  if (currentSharedScreens === nextSharedScreens) {
    return true;
  }

  if (!Array.isArray(currentSharedScreens) || !Array.isArray(nextSharedScreens)) {
    return false;
  }

  if (currentSharedScreens.length !== nextSharedScreens.length) {
    return false;
  }

  return currentSharedScreens.every((share, index) => (
    getScreenShareSnapshotSignature(share) === getScreenShareSnapshotSignature(nextSharedScreens[index])
  ));
};

const patchScreenShareSession = (session, patch) => {
  const nextPatch = patch || {};
  const patchKeys = Object.keys(nextPatch);

  if (patchKeys.length === 0) {
    return session;
  }

  const hasChanges = patchKeys.some((key) => {
    if (key === 'shareSnapshot') {
      return getScreenShareSnapshotSignature(session?.shareSnapshot)
        !== getScreenShareSnapshotSignature(nextPatch.shareSnapshot);
    }

    if (key === 'connectedUsers') {
      const currentUsers = Array.isArray(session?.connectedUsers) ? session.connectedUsers : [];
      const nextUsers = Array.isArray(nextPatch.connectedUsers) ? nextPatch.connectedUsers : [];

      if (currentUsers.length !== nextUsers.length) {
        return true;
      }

      return currentUsers.some((user, index) => {
        const nextUser = nextUsers[index];
        return (
          String(user?.id || '') !== String(nextUser?.id || '')
          || (user?.username || null) !== (nextUser?.username || null)
          || Boolean(user?.is_sharing) !== Boolean(nextUser?.is_sharing)
        );
      });
    }

    return session?.[key] !== nextPatch[key];
  });

  if (!hasChanges) {
    return session;
  }

  return {
    ...session,
    ...nextPatch,
  };
};

const syncActiveScreenShareSession = (session, sharedScreens) => {
  if (!hasActiveScreenShareSession(session)) {
    return session;
  }

  const matchedShare = findSharedScreenById(sharedScreens, session.shareId);

  if (!matchedShare) {
    return session;
  }

  return patchScreenShareSession(session, {
    groupId: matchedShare?.group?.id ?? session.groupId,
    shareId: matchedShare?.id ?? session.shareId,
    webrtcRoomId: matchedShare?.webrtc_room_id ?? session.webrtcRoomId,
    ownerId: matchedShare?.user?.id ?? session.ownerId,
    shareSnapshot: matchedShare,
    status: matchedShare?.status === 'ended'
      ? 'ended'
      : (matchedShare?.status === 'paused'
          ? 'paused'
          : (session.role === 'viewer' ? 'viewing' : 'sharing')),
  });
};

const isLikelyNetworkError = (error) => {
  const message = error?.message || '';
  return (
    error?.isNetworkError ||
    message.includes('Network Error') ||
    message.includes('网络') ||
    message.includes('服务器请求失败')
  );
};

const isNetworkLikeMessage = (value) => {
  const message = String(value || '');
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes('network error')
    || normalized.includes('network connection failed')
    || normalized.includes('request timed out')
    || normalized.includes('no internet')
    || normalized.includes('offline')
    || normalized.includes('网络错误')
    || normalized.includes('网络连接失败')
    || normalized.includes('请求超时')
    || normalized.includes('无网络连接')
    || normalized.includes('网络错误且无缓存')
    || normalized.includes('无法完成请求')
    || normalized.includes('离线状态下无法完成请求')
  );
};

const normalizeGroupError = (value) => (
  isNetworkLikeMessage(value) ? null : value
);

const normalizeInvitationFetchError = (value) => {
  if (isNetworkLikeMessage(value)) {
    return null;
  }

  const message = String(value || '');
  if (!message) {
    return null;
  }

  if (
    message.includes('获取群组邀请失败')
    || message.includes('群组邀请失败')
    || message.includes('邀请失败')
  ) {
    return null;
  }

  return value;
};

const isLocalOnlyGroup = (group) => Boolean(group?.local_only);

const upsertGroupRecord = (groups, group) => {
  if (!group?.id) {
    return groups;
  }

  const list = Array.isArray(groups) ? groups : [];
  const index = list.findIndex((item) => String(item?.id) === String(group.id));

  if (index === -1) {
    list.push(group);
    return list;
  }

  list[index] = {
    ...list[index],
    ...group,
  };
  return list;
};

const mergeRemoteAndLocalGroups = (remoteGroups, existingGroups) => {
  const nextRemoteGroups = Array.isArray(remoteGroups) ? remoteGroups : [];
  const localGroups = (Array.isArray(existingGroups) ? existingGroups : []).filter(isLocalOnlyGroup);
  const merged = [...nextRemoteGroups];

  localGroups.forEach((group) => {
    if (!merged.some((item) => String(item?.id) === String(group.id))) {
      merged.push(group);
    }
  });

  return merged;
};

// 初始状态
const initialState = {
  groups: [],
  currentGroup: null,
  members: [],
  invitations: [],
  sharedScreens: [],
  activeScreenShareSession: createEmptyScreenShareSession(),
  inviteCandidates: [],
  inviteCandidatesLoading: false,
  inviteCandidatesError: null,
  inviteActionLoading: false,
  lastInvitation: null,
  screenShareLoading: false,
  screenShareError: null,
  isLoading: false,
  error: null,
  joinCode: null,
  joinCodeExpiresAt: null,
};

// 异步Action: 获取用户的群组列表
export const fetchGroups = createAsyncThunk(
  'groups/fetchGroups',
  async (_, { rejectWithValue }) => {
    try {
      const response = await groupApi.getUserGroups();
      if (!response.success) {
        return rejectWithValue(response.message || '获取群组列表失败');
      }
      return response.data;
    } catch (error) {
      if (isLikelyNetworkError(error)) {
        return [];
      }
      return rejectWithValue(error.message || '获取群组列表失败');
    }
  }
);

// 异步Action: 获取群组详情
export const fetchGroupDetail = createAsyncThunk(
  'groups/fetchGroupDetail',
  async (groupId, { rejectWithValue }) => {
    try {
      const response = await groupApi.getGroupDetail(groupId);
      if (!response.success) {
        return rejectWithValue(response.message || '获取群组详情失败');
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '获取群组详情失败');
    }
  }
);

// 异步Action: 创建群组
export const createGroup = createAsyncThunk(
  'groups/createGroup',
  async (groupData, { rejectWithValue }) => {
    try {
      const response = await groupApi.createGroup(groupData);
      if (!response.success) {
        return rejectWithValue(response.message || '创建群组失败');
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '创建群组失败');
    }
  }
);

// 异步Action: 更新群组
export const updateGroup = createAsyncThunk(
  'groups/updateGroup',
  async ({ groupId, groupData }, { rejectWithValue }) => {
    try {
      const response = await groupApi.updateGroup(groupId, groupData);
      if (!response.success) {
        return rejectWithValue(response.message || '更新群组失败');
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '更新群组失败');
    }
  }
);

// 异步Action: 删除群组
export const deleteGroup = createAsyncThunk(
  'groups/deleteGroup',
  async (groupId, { rejectWithValue }) => {
    try {
      const response = await groupApi.deleteGroup(groupId);
      if (!response.success) {
        return rejectWithValue(response.message || '删除群组失败');
      }
      return { groupId };
    } catch (error) {
      return rejectWithValue(error.message || '删除群组失败');
    }
  }
);

// 异步Action: 生成加入码
export const generateJoinCode = createAsyncThunk(
  'groups/generateJoinCode',
  async ({ groupId, expiresIn }, { rejectWithValue }) => {
    try {
      const response = await groupApi.generateJoinCode(groupId, expiresIn);
      if (!response.success) {
        return rejectWithValue(response.message || '生成加入码失败');
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '生成加入码失败');
    }
  }
);

// 异步Action: 通过加入码加入群组
export const joinGroupByCode = createAsyncThunk(
  'groups/joinGroupByCode',
  async (joinCode, { rejectWithValue }) => {
    try {
      const response = await groupApi.joinGroupByCode(joinCode);
      if (!response.success) {
        return rejectWithValue(response.message || '加入群组失败');
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '加入群组失败');
    }
  }
);

// 异步Action: 邀请用户加入群组
export const inviteUserToGroup = createAsyncThunk(
  'groups/inviteUserToGroup',
  async ({ groupId, userId }, { rejectWithValue }) => {
    try {
      const response = await groupApi.inviteUserToGroup(groupId, userId);
      if (!response.success) {
        return rejectWithValue(response.message || '邀请用户失败');
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '邀请用户失败');
    }
  }
);

// 异步Action: 获取群组成员
export const searchGroupInviteCandidates = createAsyncThunk(
  'groups/searchGroupInviteCandidates',
  async ({ groupId, keyword }, { rejectWithValue }) => {
    try {
      const response = await groupApi.searchGroupInviteCandidates(groupId, keyword);
      if (!response.success) {
        return rejectWithValue(response.message || '搜索邀请候选失败');
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '搜索邀请候选失败');
    }
  }
);

export const fetchGroupMembers = createAsyncThunk(
  'groups/fetchGroupMembers',
  async (groupId, { rejectWithValue }) => {
    try {
      const response = await groupApi.getGroupMembers(groupId);
      if (!response.success) {
        return rejectWithValue(response.message || '获取群组成员失败');
      }
      return { groupId, members: response.data };
    } catch (error) {
      return rejectWithValue(error.message || '获取群组成员失败');
    }
  }
);

// 异步Action: 离开群组
export const leaveGroup = createAsyncThunk(
  'groups/leaveGroup',
  async (groupId, { rejectWithValue }) => {
    try {
      const response = await groupApi.leaveGroup(groupId);
      if (!response.success) {
        return rejectWithValue(response.message || '离开群组失败');
      }
      return { groupId };
    } catch (error) {
      return rejectWithValue(error.message || '离开群组失败');
    }
  }
);

// 异步Action: 获取群组邀请
export const fetchGroupInvitations = createAsyncThunk(
  'groups/fetchGroupInvitations',
  async (_, { rejectWithValue }) => {
    try {
      const response = await groupApi.getGroupInvitations();
      if (!response.success) {
        return rejectWithValue(response.message || '获取群组邀请失败');
      }
      return response.data;
    } catch (error) {
      if (isLikelyNetworkError(error)) {
        return [];
      }
      return rejectWithValue(error.message || '获取群组邀请失败');
    }
  }
);

// 异步Action: 接受群组邀请
export const acceptGroupInvitation = createAsyncThunk(
  'groups/acceptGroupInvitation',
  async (invitationId, { rejectWithValue }) => {
    try {
      const response = await groupApi.acceptGroupInvitation(invitationId);
      if (!response.success) {
        return rejectWithValue(response.message || '接受邀请失败');
      }
      return { invitationId, group: response.data.group };
    } catch (error) {
      return rejectWithValue(error.message || '接受邀请失败');
    }
  }
);

// 异步Action: 拒绝群组邀请
export const rejectGroupInvitation = createAsyncThunk(
  'groups/rejectGroupInvitation',
  async (invitationId, { rejectWithValue }) => {
    try {
      const response = await groupApi.rejectGroupInvitation(invitationId);
      if (!response.success) {
        return rejectWithValue(response.message || '拒绝邀请失败');
      }
      return { invitationId };
    } catch (error) {
      return rejectWithValue(error.message || '拒绝邀请失败');
    }
  }
);

// 异步Action: 创建屏幕共享
export const createScreenShare = createAsyncThunk(
  'groups/createScreenShare',
  async ({ groupId, title }, { rejectWithValue }) => {
    try {
      const response = await groupApi.createScreenShare(groupId, title);
      if (!response.success) {
        return rejectWithValue(response.message || '创建屏幕共享失败');
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '创建屏幕共享失败');
    }
  }
);

// 异步Action: 获取屏幕共享列表
export const fetchScreenShares = createAsyncThunk(
  'groups/fetchScreenShares',
  async (_, { rejectWithValue }) => {
    try {
      const response = await groupApi.getScreenShares();
      if (!response.success) {
        return rejectWithValue(response.message || '获取屏幕共享列表失败');
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '获取屏幕共享列表失败');
    }
  }
);

// 异步Action: 结束屏幕共享
export const endScreenShare = createAsyncThunk(
  'groups/endScreenShare',
  async (shareId, { rejectWithValue }) => {
    try {
      const response = await groupApi.endScreenShare(shareId);
      if (!response.success) {
        return rejectWithValue(response.message || '结束屏幕共享失败');
      }
      return { shareId };
    } catch (error) {
      return rejectWithValue(error.message || '结束屏幕共享失败');
    }
  }
);

// 异步Action: 加入屏幕共享
export const joinScreenShare = createAsyncThunk(
  'groups/joinScreenShare',
  async (shareId, { rejectWithValue }) => {
    try {
      const response = await groupApi.joinScreenShare(shareId);
      if (!response.success) {
        return rejectWithValue(response.message || '加入屏幕共享失败');
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '加入屏幕共享失败');
    }
  }
);

export const pauseScreenShare = createAsyncThunk(
  'groups/pauseScreenShare',
  async (shareId, { rejectWithValue }) => {
    try {
      const response = await groupApi.pauseScreenShare(shareId);
      if (!response.success) {
        return rejectWithValue(response.message || '暂停屏幕共享失败');
      }
      return { shareId };
    } catch (error) {
      return rejectWithValue(error.message || '暂停屏幕共享失败');
    }
  }
);

export const resumeScreenShare = createAsyncThunk(
  'groups/resumeScreenShare',
  async (shareId, { rejectWithValue }) => {
    try {
      const response = await groupApi.resumeScreenShare(shareId);
      if (!response.success) {
        return rejectWithValue(response.message || '恢复屏幕共享失败');
      }
      return { shareId };
    } catch (error) {
      return rejectWithValue(error.message || '恢复屏幕共享失败');
    }
  }
);

// 创建Slice
const groupsSlice = createSlice({
  name: 'groups',
  initialState,
  reducers: {
    clearGroupError: (state) => {
      state.error = null;
    },
    clearJoinCode: (state) => {
      state.joinCode = null;
      state.joinCodeExpiresAt = null;
    },
    clearInviteCandidates: (state) => {
      state.inviteCandidates = [];
      state.inviteCandidatesError = null;
    },
    clearLastInvitation: (state) => {
      state.lastInvitation = null;
    },
    clearScreenShareError: (state) => {
      state.screenShareError = null;
    },
    setActiveScreenShareSession: (state, action) => {
      state.activeScreenShareSession = {
        ...createEmptyScreenShareSession(),
        ...action.payload,
      };
    },
    patchActiveScreenShareSession: (state, action) => {
      if (
        !hasActiveScreenShareSession(state.activeScreenShareSession)
        && action.payload?.shareId == null
      ) {
        return;
      }

      state.activeScreenShareSession = patchScreenShareSession(
        state.activeScreenShareSession,
        action.payload
      );
    },
    clearActiveScreenShareSession: (state) => {
      state.activeScreenShareSession = createEmptyScreenShareSession();
    },
    setCurrentGroup: (state, action) => {
      state.currentGroup = action.payload;
    },
    upsertLocalGroup: (state, action) => {
      const localGroup = {
        member_count: 1,
        can_invite: true,
        can_generate_join_code: true,
        ...action.payload,
        local_only: true,
      };
      upsertGroupRecord(state.groups, localGroup);
      state.currentGroup = localGroup;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // 获取群组列表
      .addCase(fetchGroups.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchGroups.fulfilled, (state, action) => {
        state.isLoading = false;
        state.groups = mergeRemoteAndLocalGroups(action.payload, state.groups);
      })
      .addCase(fetchGroups.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 获取群组详情
      .addCase(fetchGroupDetail.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchGroupDetail.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentGroup = action.payload;
        upsertGroupRecord(state.groups, action.payload);

        // 如果有加入码，更新加入码信息
        if (action.payload.join_code) {
          state.joinCode = action.payload.join_code;
          state.joinCodeExpiresAt = action.payload.join_code_expires_at;
        }
      })
      .addCase(fetchGroupDetail.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 创建群组
      .addCase(createGroup.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createGroup.fulfilled, (state, action) => {
        state.isLoading = false;
        upsertGroupRecord(state.groups, action.payload);
        state.currentGroup = action.payload;
      })
      .addCase(createGroup.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 更新群组
      .addCase(updateGroup.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateGroup.fulfilled, (state, action) => {
        state.isLoading = false;

        // 更新群组列表中的群组
        const index = state.groups.findIndex(group => group.id === action.payload.id);
        if (index !== -1) {
          state.groups[index] = action.payload;
        }

        // 如果当前群组是被更新的群组，也更新当前群组
        if (state.currentGroup && state.currentGroup.id === action.payload.id) {
          state.currentGroup = action.payload;
        }
      })
      .addCase(updateGroup.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 删除群组
      .addCase(deleteGroup.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteGroup.fulfilled, (state, action) => {
        state.isLoading = false;

        // 从群组列表中移除群组
        state.groups = state.groups.filter(group => group.id !== action.payload.groupId);

        // 如果当前群组是被删除的群组，清空当前群组
        if (state.currentGroup && state.currentGroup.id === action.payload.groupId) {
          state.currentGroup = null;
        }
      })
      .addCase(deleteGroup.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 生成加入码
      .addCase(generateJoinCode.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(generateJoinCode.fulfilled, (state, action) => {
        state.isLoading = false;
        state.joinCode = action.payload.join_code;
        state.joinCodeExpiresAt = action.payload.expires_at;
      })
      .addCase(generateJoinCode.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 通过加入码加入群组
      .addCase(joinGroupByCode.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(joinGroupByCode.fulfilled, (state, action) => {
        state.isLoading = false;

        // 如果群组不在列表中，添加到列表
        const group = action.payload.group;
        if (!state.groups.some(g => g.id === group.id)) {
          state.groups.push(group);
        }
      })
      .addCase(joinGroupByCode.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 获取群组成员
      .addCase(searchGroupInviteCandidates.pending, (state) => {
        state.inviteCandidatesLoading = true;
        state.inviteCandidatesError = null;
      })
      .addCase(searchGroupInviteCandidates.fulfilled, (state, action) => {
        state.inviteCandidatesLoading = false;
        state.inviteCandidates = action.payload || [];
      })
      .addCase(searchGroupInviteCandidates.rejected, (state, action) => {
        state.inviteCandidatesLoading = false;
        state.inviteCandidates = [];
        state.inviteCandidatesError = action.payload;
      })
      .addCase(inviteUserToGroup.pending, (state) => {
        state.inviteActionLoading = true;
        state.error = null;
      })
      .addCase(inviteUserToGroup.fulfilled, (state, action) => {
        state.inviteActionLoading = false;
        state.lastInvitation = action.payload;
        const inviteeId = action.payload?.invitee?.id;
        if (inviteeId) {
          state.inviteCandidates = state.inviteCandidates.map((candidate) =>
            candidate.id === inviteeId
              ? {
                  ...candidate,
                  can_invite: false,
                  invite_block_reason: '该用户已经有待处理邀请',
                }
              : candidate
          );
        }
      })
      .addCase(inviteUserToGroup.rejected, (state, action) => {
        state.inviteActionLoading = false;
        state.error = action.payload;
      })
      .addCase(fetchGroupMembers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchGroupMembers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.members = action.payload.members;
      })
      .addCase(fetchGroupMembers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 离开群组
      .addCase(leaveGroup.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(leaveGroup.fulfilled, (state, action) => {
        state.isLoading = false;

        // 从群组列表中移除群组
        state.groups = state.groups.filter(group => group.id !== action.payload.groupId);

        // 如果当前群组是被离开的群组，清空当前群组
        if (state.currentGroup && state.currentGroup.id === action.payload.groupId) {
          state.currentGroup = null;
        }
      })
      .addCase(leaveGroup.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 获取群组邀请
      .addCase(fetchGroupInvitations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchGroupInvitations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.invitations = action.payload;
      })
      .addCase(fetchGroupInvitations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = normalizeInvitationFetchError(action.payload);
      })

      // 接受群组邀请
      .addCase(acceptGroupInvitation.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(acceptGroupInvitation.fulfilled, (state, action) => {
        state.isLoading = false;

        // 从邀请列表中移除邀请
        state.invitations = state.invitations.filter(invitation => invitation.id !== action.payload.invitationId);

        // 如果群组不在列表中，添加到列表
        const group = action.payload.group;
        if (!state.groups.some(g => g.id === group.id)) {
          state.groups.push(group);
        }
      })
      .addCase(acceptGroupInvitation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 拒绝群组邀请
      .addCase(rejectGroupInvitation.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(rejectGroupInvitation.fulfilled, (state, action) => {
        state.isLoading = false;

        // 从邀请列表中移除邀请
        state.invitations = state.invitations.filter(invitation => invitation.id !== action.payload.invitationId);
      })
      .addCase(rejectGroupInvitation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 创建屏幕共享
      .addCase(createScreenShare.pending, (state) => {
        state.screenShareLoading = true;
        state.screenShareError = null;
      })
      .addCase(createScreenShare.fulfilled, (state, action) => {
        state.screenShareLoading = false;
        state.sharedScreens.push(action.payload);
        state.activeScreenShareSession = {
          ...createEmptyScreenShareSession(),
          groupId: action.meta.arg?.groupId ?? action.payload?.group?.id ?? null,
          shareId: action.payload?.id ?? null,
          role: 'host',
          status: action.payload?.status === 'paused' ? 'paused' : 'created',
          webrtcRoomId: action.payload?.webrtc_room_id ?? null,
          ownerId: action.payload?.user?.id ?? null,
          shareSnapshot: action.payload,
        };
      })
      .addCase(createScreenShare.rejected, (state, action) => {
        state.screenShareLoading = false;
        state.screenShareError = action.payload;
        state.activeScreenShareSession = {
          ...createEmptyScreenShareSession(),
          groupId: action.meta.arg?.groupId ?? null,
          role: 'host',
          status: 'error',
          error: action.payload || '创建屏幕共享失败',
        };
      })

      // 获取屏幕共享列表
      .addCase(fetchScreenShares.pending, (state) => {
        state.screenShareLoading = true;
        state.screenShareError = null;
      })
      .addCase(fetchScreenShares.fulfilled, (state, action) => {
        state.screenShareLoading = false;
        const nextSharedScreens = areSharedScreensEquivalent(
          state.sharedScreens,
          action.payload
        )
          ? state.sharedScreens
          : action.payload;

        state.sharedScreens = nextSharedScreens;
        state.activeScreenShareSession = syncActiveScreenShareSession(
          state.activeScreenShareSession,
          nextSharedScreens
        );
      })
      .addCase(fetchScreenShares.rejected, (state, action) => {
        state.screenShareLoading = false;
        state.screenShareError = action.payload;
      })

      // 结束屏幕共享
      .addCase(endScreenShare.pending, (state) => {
        state.screenShareLoading = true;
        state.screenShareError = null;
      })
      .addCase(endScreenShare.fulfilled, (state, action) => {
        state.screenShareLoading = false;

        // 更新屏幕共享状态
        const index = state.sharedScreens.findIndex(share => share.id === action.payload.shareId);
        if (index !== -1) {
          state.sharedScreens[index].status = 'ended';
          state.sharedScreens[index].ended_at = new Date().toISOString();
        }

        if (String(state.activeScreenShareSession?.shareId || '') === String(action.payload.shareId || '')) {
          state.activeScreenShareSession = {
            ...state.activeScreenShareSession,
            status: 'ended',
            connectedUsers: [],
            hasRemoteStream: false,
            hasAttachedRemoteStream: false,
            viewerTimeoutReached: false,
            shareSnapshot: state.activeScreenShareSession?.shareSnapshot
              ? {
                  ...state.activeScreenShareSession.shareSnapshot,
                  status: 'ended',
                }
              : state.activeScreenShareSession.shareSnapshot,
          };
        }
      })
      .addCase(endScreenShare.rejected, (state, action) => {
        state.screenShareLoading = false;
        state.screenShareError = action.payload;
      })

      // 加入屏幕共享
      .addCase(joinScreenShare.pending, (state) => {
        state.screenShareLoading = true;
        state.screenShareError = null;
      })
      .addCase(joinScreenShare.fulfilled, (state, action) => {
        state.screenShareLoading = false;
        const matchedShare = findSharedScreenById(state.sharedScreens, action.meta.arg);
        state.activeScreenShareSession = {
          ...createEmptyScreenShareSession(),
          groupId: matchedShare?.group?.id ?? state.activeScreenShareSession?.groupId ?? null,
          shareId: action.meta.arg ?? null,
          role: 'viewer',
          status: 'joining',
          webrtcRoomId: action.payload?.webrtc_room_id ?? matchedShare?.webrtc_room_id ?? null,
          ownerId: matchedShare?.user?.id ?? null,
          shareSnapshot: matchedShare,
        };
      })
      .addCase(joinScreenShare.rejected, (state, action) => {
        state.screenShareLoading = false;
        state.screenShareError = action.payload;
        state.activeScreenShareSession = {
          ...createEmptyScreenShareSession(),
          shareId: action.meta.arg ?? null,
          role: 'viewer',
          status: 'error',
          error: action.payload || '加入屏幕共享失败',
        };
      })

      // 暂停屏幕共享
      .addCase(pauseScreenShare.pending, (state) => {
        state.screenShareLoading = true;
        state.screenShareError = null;
      })
      .addCase(pauseScreenShare.fulfilled, (state, action) => {
        state.screenShareLoading = false;
        const index = state.sharedScreens.findIndex(share => share.id === action.payload.shareId);
        if (index !== -1) {
          state.sharedScreens[index].status = 'paused';
        }
        if (String(state.activeScreenShareSession?.shareId || '') === String(action.payload.shareId || '')) {
          state.activeScreenShareSession = syncActiveScreenShareSession(
            {
              ...state.activeScreenShareSession,
              status: 'paused',
            },
            state.sharedScreens
          );
        }
      })
      .addCase(pauseScreenShare.rejected, (state, action) => {
        state.screenShareLoading = false;
        state.screenShareError = action.payload;
      })

      // 恢复屏幕共享
      .addCase(resumeScreenShare.pending, (state) => {
        state.screenShareLoading = true;
        state.screenShareError = null;
      })
      .addCase(resumeScreenShare.fulfilled, (state, action) => {
        state.screenShareLoading = false;
        const index = state.sharedScreens.findIndex(share => share.id === action.payload.shareId);
        if (index !== -1) {
          state.sharedScreens[index].status = 'active';
        }
        if (String(state.activeScreenShareSession?.shareId || '') === String(action.payload.shareId || '')) {
          state.activeScreenShareSession = syncActiveScreenShareSession(
            {
              ...state.activeScreenShareSession,
              status: state.activeScreenShareSession?.role === 'viewer' ? 'viewing' : 'sharing',
            },
            state.sharedScreens
          );
        }
      })
      .addCase(resumeScreenShare.rejected, (state, action) => {
        state.screenShareLoading = false;
        state.screenShareError = action.payload;
      });
  },
});

// 导出Actions
export const {
  clearGroupError,
  clearJoinCode,
  clearInviteCandidates,
  clearLastInvitation,
  clearActiveScreenShareSession,
  clearScreenShareError,
  patchActiveScreenShareSession,
  setActiveScreenShareSession,
  setCurrentGroup,
  upsertLocalGroup,
} = groupsSlice.actions;

// 导出Selectors
export const selectGroups = (state) => state.groups.groups;
export const selectCurrentGroup = (state) => state.groups.currentGroup;
export const selectGroupMembers = (state) => state.groups.members;
export const selectGroupInvitations = (state) => state.groups.invitations;
export const selectSharedScreens = (state) => state.groups.sharedScreens;
export const selectActiveScreenShareSession = (state) => state.groups.activeScreenShareSession;
export const selectInviteCandidates = (state) => state.groups.inviteCandidates;
export const selectInviteCandidatesLoading = (state) => state.groups.inviteCandidatesLoading;
export const selectInviteCandidatesError = (state) => state.groups.inviteCandidatesError;
export const selectInviteActionLoading = (state) => state.groups.inviteActionLoading;
export const selectLastInvitation = (state) => state.groups.lastInvitation;
export const selectScreenShareLoading = (state) => state.groups.screenShareLoading;
export const selectScreenShareError = (state) => state.groups.screenShareError;
export const selectGroupsLoading = (state) => state.groups.isLoading;
export const selectGroupsError = (state) => normalizeGroupError(state.groups.error);
export const selectJoinCode = (state) => state.groups.joinCode;
export const selectJoinCodeExpiresAt = (state) => state.groups.joinCodeExpiresAt;

// 导出Reducer
export default groupsSlice.reducer;
