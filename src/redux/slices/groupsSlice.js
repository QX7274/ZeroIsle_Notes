/**
 * 群组模块Redux Slice
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as groupApi from '../../services/api/groupApi';

const isLikelyNetworkError = (error) => {
  const message = error?.message || '';
  return (
    error?.isNetworkError ||
    message.includes('Network Error') ||
    message.includes('网络') ||
    message.includes('服务器请求失败')
  );
};

// 初始状态
const initialState = {
  groups: [],
  currentGroup: null,
  members: [],
  invitations: [],
  sharedScreens: [],
  inviteCandidates: [],
  inviteCandidatesLoading: false,
  inviteCandidatesError: null,
  inviteActionLoading: false,
  lastInvitation: null,
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
    setCurrentGroup: (state, action) => {
      state.currentGroup = action.payload;
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
        state.groups = action.payload || [];
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
        state.groups.push(action.payload);
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
        state.error = action.payload;
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
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createScreenShare.fulfilled, (state, action) => {
        state.isLoading = false;
        state.sharedScreens.push(action.payload);
      })
      .addCase(createScreenShare.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 获取屏幕共享列表
      .addCase(fetchScreenShares.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchScreenShares.fulfilled, (state, action) => {
        state.isLoading = false;
        state.sharedScreens = action.payload;
      })
      .addCase(fetchScreenShares.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 结束屏幕共享
      .addCase(endScreenShare.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(endScreenShare.fulfilled, (state, action) => {
        state.isLoading = false;

        // 更新屏幕共享状态
        const index = state.sharedScreens.findIndex(share => share.id === action.payload.shareId);
        if (index !== -1) {
          state.sharedScreens[index].status = 'ended';
          state.sharedScreens[index].ended_at = new Date().toISOString();
        }
      })
      .addCase(endScreenShare.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 加入屏幕共享
      .addCase(joinScreenShare.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(joinScreenShare.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(joinScreenShare.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

// 导出Actions
export const {
  clearGroupError,
  clearJoinCode,
  clearInviteCandidates,
  clearLastInvitation,
  setCurrentGroup,
} = groupsSlice.actions;

// 导出Selectors
export const selectGroups = (state) => state.groups.groups;
export const selectCurrentGroup = (state) => state.groups.currentGroup;
export const selectGroupMembers = (state) => state.groups.members;
export const selectGroupInvitations = (state) => state.groups.invitations;
export const selectSharedScreens = (state) => state.groups.sharedScreens;
export const selectInviteCandidates = (state) => state.groups.inviteCandidates;
export const selectInviteCandidatesLoading = (state) => state.groups.inviteCandidatesLoading;
export const selectInviteCandidatesError = (state) => state.groups.inviteCandidatesError;
export const selectInviteActionLoading = (state) => state.groups.inviteActionLoading;
export const selectLastInvitation = (state) => state.groups.lastInvitation;
export const selectGroupsLoading = (state) => state.groups.isLoading;
export const selectGroupsError = (state) => state.groups.error;
export const selectJoinCode = (state) => state.groups.joinCode;
export const selectJoinCodeExpiresAt = (state) => state.groups.joinCodeExpiresAt;

// 导出Reducer
export default groupsSlice.reducer;
