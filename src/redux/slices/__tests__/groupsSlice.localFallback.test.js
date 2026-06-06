jest.mock('../../../services/api/groupApi', () => ({
  getUserGroups: jest.fn(),
  getGroupDetail: jest.fn(),
  createGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  generateJoinCode: jest.fn(),
  joinGroupByCode: jest.fn(),
  inviteUserToGroup: jest.fn(),
  searchGroupInviteCandidates: jest.fn(),
  getGroupMembers: jest.fn(),
  leaveGroup: jest.fn(),
  getGroupInvitations: jest.fn(),
  acceptGroupInvitation: jest.fn(),
  rejectGroupInvitation: jest.fn(),
  startScreenShare: jest.fn(),
  endScreenShare: jest.fn(),
  getGroupSharedScreens: jest.fn(),
  pauseScreenShare: jest.fn(),
  resumeScreenShare: jest.fn(),
}));

import reducer, {
  fetchGroups,
  fetchGroupDetail,
  fetchGroupMembers,
  createGroup,
  generateJoinCode,
  leaveGroup,
  selectGroupsError,
  upsertLocalGroup,
} from '../groupsSlice';

describe('groupsSlice local fallback behavior', () => {
  it('upsertLocalGroup adds local group and sets currentGroup', () => {
    const local = {
      id: 'local-1',
      name: 'Local Group',
      local_only: true,
    };

    const state = reducer(undefined, upsertLocalGroup(local));

    expect(state.groups).toHaveLength(1);
    expect(state.groups[0]).toMatchObject(local);
    expect(state.currentGroup).toMatchObject(local);
  });

  it('fetchGroups.fulfilled keeps local_only groups when remote is empty', () => {
    const withLocal = reducer(
      undefined,
      upsertLocalGroup({ id: 'local-2', name: 'Offline Group', local_only: true })
    );

    const next = reducer(withLocal, fetchGroups.fulfilled([], 'req-1'));

    expect(next.groups).toHaveLength(1);
    expect(next.groups[0].id).toBe('local-2');
    expect(next.groups[0].local_only).toBe(true);
  });

  it('fetchGroups.fulfilled merges remote groups and pending local_only groups', () => {
    const base = reducer(
      undefined,
      upsertLocalGroup({ id: 'local-3', name: 'Draft Group', local_only: true })
    );

    const remote = [{ id: 'remote-1', name: 'Server Group' }];
    const next = reducer(base, fetchGroups.fulfilled(remote, 'req-2'));

    expect(next.groups.map((g) => g.id)).toEqual(['remote-1', 'local-3']);
  });

  it('fetchGroupDetail.fulfilled can set local group as currentGroup', () => {
    const local = { id: 'local-9', name: 'Offline Detail', local_only: true };
    const base = reducer(undefined, upsertLocalGroup(local));
    const next = reducer(base, fetchGroupDetail.fulfilled(local, 'req-local-detail', 'local-9'));
    expect(next.currentGroup).toMatchObject(local);
  });

  it('createGroup.fulfilled upserts instead of duplicating same id', () => {
    const local = { id: 'local-dup', name: 'Draft 1', local_only: true };
    const base = reducer(undefined, upsertLocalGroup(local));
    const next = reducer(
      base,
      createGroup.fulfilled({ id: 'local-dup', name: 'Draft 2', local_only: true }, 'req-create')
    );
    expect(next.groups.filter((g) => g.id === 'local-dup')).toHaveLength(1);
    expect(next.currentGroup?.name).toBe('Draft 2');
  });

  it('generateJoinCode.fulfilled supports local group fallback', () => {
    const local = {
      id: 'local-join-1',
      name: 'Offline Joinable',
      local_only: true,
      local_join_code: 'LOCAL-AB12CD',
    };
    const base = reducer(undefined, upsertLocalGroup(local));
    const next = reducer(
      base,
      generateJoinCode.fulfilled(
        { join_code: 'LOCAL-AB12CD', expires_at: '2026-05-15T12:00:00.000Z' },
        'req-joincode-local',
        { groupId: 'local-join-1', expiresIn: 30 }
      )
    );
    expect(next.joinCode).toBe('LOCAL-AB12CD');
    expect(next.joinCodeExpiresAt).toBe('2026-05-15T12:00:00.000Z');
  });

  it('fetchGroupMembers.fulfilled writes local fallback member list', () => {
    const local = { id: 'local-members-1', name: 'Offline Members', local_only: true };
    const base = reducer(undefined, upsertLocalGroup(local));
    const next = reducer(
      base,
      fetchGroupMembers.fulfilled(
        { groupId: 'local-members-1', members: [{ id: 'local-owner', username: 'You', role: 'owner' }] },
        'req-members-local',
        'local-members-1'
      )
    );
    expect(next.members).toHaveLength(1);
    expect(next.members[0]).toMatchObject({ id: 'local-owner', username: 'You', role: 'owner' });
  });

  it('leaveGroup.fulfilled removes local group and clears currentGroup', () => {
    const local = { id: 'local-leave-1', name: 'Offline Leave', local_only: true };
    const seeded = reducer(undefined, upsertLocalGroup(local));
    const next = reducer(
      seeded,
      leaveGroup.fulfilled({ groupId: 'local-leave-1' }, 'req-leave-local', 'local-leave-1')
    );
    expect(next.groups.find((g) => g.id === 'local-leave-1')).toBeUndefined();
    expect(next.currentGroup).toBeNull();
  });

  it('selectGroupsError hides network-shaped object errors', () => {
    const state = {
      groups: reducer(
        undefined,
        createGroup.rejected(
          null,
          'req-create-network',
          { name: 'Offline Draft' },
          { message: '网络连接失败，请检查网络设置后重试', isNetworkError: true }
        )
      ),
    };

    expect(selectGroupsError(state)).toBeNull();
  });
});
