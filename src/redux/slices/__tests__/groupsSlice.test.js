jest.mock('../../../services/api/groupApi', () => ({}));

import groupsReducer, {
  clearActiveScreenShareSession,
  createScreenShare,
  endScreenShare,
  fetchScreenShares,
  joinScreenShare,
  patchActiveScreenShareSession,
} from '../groupsSlice';

describe('groupsSlice screen share session', () => {
  it('should create host session on createScreenShare.fulfilled', () => {
    const action = {
      type: createScreenShare.fulfilled.type,
      payload: {
        id: 'share-1',
        status: 'active',
        webrtc_room_id: 'room-1',
        user: { id: 'user-1' },
        group: { id: 'group-1' },
      },
      meta: {
        arg: {
          groupId: 'group-1',
          title: 'demo',
        },
      },
    };

    const nextState = groupsReducer(undefined, action);

    expect(nextState.activeScreenShareSession).toMatchObject({
      groupId: 'group-1',
      shareId: 'share-1',
      role: 'host',
      status: 'created',
      webrtcRoomId: 'room-1',
      ownerId: 'user-1',
    });
  });

  it('should create viewer session on joinScreenShare.fulfilled', () => {
    const state = {
      ...groupsReducer(undefined, { type: 'unknown' }),
      sharedScreens: [
        {
          id: 'share-2',
          status: 'active',
          webrtc_room_id: 'room-2',
          user: { id: 'user-2' },
          group: { id: 'group-2' },
        },
      ],
    };

    const action = {
      type: joinScreenShare.fulfilled.type,
      payload: {
        webrtc_room_id: 'room-2',
      },
      meta: {
        arg: 'share-2',
      },
    };

    const nextState = groupsReducer(state, action);

    expect(nextState.activeScreenShareSession).toMatchObject({
      groupId: 'group-2',
      shareId: 'share-2',
      role: 'viewer',
      status: 'joining',
      webrtcRoomId: 'room-2',
      ownerId: 'user-2',
    });
  });

  it('should sync paused status from fetchScreenShares.fulfilled', () => {
    const baseState = groupsReducer(undefined, { type: 'unknown' });
    const state = groupsReducer(baseState, patchActiveScreenShareSession({
      shareId: 'share-3',
      role: 'host',
      status: 'sharing',
      webrtcRoomId: 'room-3',
    }));

    const action = {
      type: fetchScreenShares.fulfilled.type,
      payload: [
        {
          id: 'share-3',
          status: 'paused',
          webrtc_room_id: 'room-3',
          user: { id: 'user-3' },
          group: { id: 'group-3' },
        },
      ],
    };

    const nextState = groupsReducer(state, action);

    expect(nextState.activeScreenShareSession).toMatchObject({
      shareId: 'share-3',
      role: 'host',
      status: 'paused',
      webrtcRoomId: 'room-3',
      ownerId: 'user-3',
    });
    expect(nextState.activeScreenShareSession.shareSnapshot?.status).toBe('paused');
  });

  it('should keep shared screen and active session references stable for equivalent fetch payload', () => {
    const baseState = groupsReducer(undefined, { type: 'unknown' });
    const sharedScreens = [
      {
        id: 'share-3b',
        status: 'active',
        title: '稳定共享',
        webrtc_room_id: 'room-3b',
        user: { id: 'user-3b' },
        group: { id: 'group-3b' },
      },
    ];
    const stateWithList = groupsReducer(baseState, {
      type: fetchScreenShares.fulfilled.type,
      payload: sharedScreens,
    });
    const state = groupsReducer(stateWithList, patchActiveScreenShareSession({
      shareId: 'share-3b',
      role: 'viewer',
      status: 'viewing',
      webrtcRoomId: 'room-3b',
      ownerId: 'user-3b',
      groupId: 'group-3b',
      shareSnapshot: sharedScreens[0],
    }));

    const nextState = groupsReducer(state, {
      type: fetchScreenShares.fulfilled.type,
      payload: [
        {
          id: 'share-3b',
          status: 'active',
          title: '稳定共享',
          webrtc_room_id: 'room-3b',
          user: { id: 'user-3b' },
          group: { id: 'group-3b' },
        },
      ],
    });

    expect(nextState.sharedScreens).toBe(state.sharedScreens);
    expect(nextState.activeScreenShareSession).toBe(state.activeScreenShareSession);
  });

  it('should clear active session explicitly', () => {
    const baseState = groupsReducer(undefined, { type: 'unknown' });
    const state = groupsReducer(baseState, patchActiveScreenShareSession({
      shareId: 'share-4',
      role: 'viewer',
      status: 'viewing',
      webrtcRoomId: 'room-4',
    }));

    const nextState = groupsReducer(state, clearActiveScreenShareSession());

    expect(nextState.activeScreenShareSession).toEqual({
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
  });

  it('should patch remote stream diagnostics on active session', () => {
    const baseState = groupsReducer(undefined, { type: 'unknown' });
    const state = groupsReducer(baseState, patchActiveScreenShareSession({
      shareId: 'share-5',
      role: 'viewer',
      status: 'viewing',
      webrtcRoomId: 'room-5',
      hasRemoteStream: false,
      viewerTimeoutReached: false,
    }));

    const nextState = groupsReducer(state, patchActiveScreenShareSession({
      hasRemoteStream: true,
      hasAttachedRemoteStream: true,
      viewerTimeoutReached: false,
      connectionState: 'connected',
      connectionDetail: 'remote-stream-ready',
    }));

    expect(nextState.activeScreenShareSession).toMatchObject({
      shareId: 'share-5',
      hasRemoteStream: true,
      hasAttachedRemoteStream: true,
      viewerTimeoutReached: false,
      connectionState: 'connected',
      connectionDetail: 'remote-stream-ready',
    });
  });

  it('should patch connected users on active session without replacing equivalent user list', () => {
    const baseState = groupsReducer(undefined, { type: 'unknown' });
    const state = groupsReducer(baseState, patchActiveScreenShareSession({
      shareId: 'share-5b',
      role: 'host',
      status: 'sharing',
      webrtcRoomId: 'room-5b',
      connectedUsers: [
        { id: 'user-a', username: 'Alpha', is_sharing: true },
      ],
    }));

    const equivalentState = groupsReducer(state, patchActiveScreenShareSession({
      connectedUsers: [
        { id: 'user-a', username: 'Alpha', is_sharing: true },
      ],
    }));
    const nextState = groupsReducer(state, patchActiveScreenShareSession({
      connectedUsers: [
        { id: 'user-a', username: 'Alpha', is_sharing: true },
        { id: 'user-b', username: 'Beta', is_sharing: false },
      ],
    }));

    expect(equivalentState.activeScreenShareSession).toBe(state.activeScreenShareSession);
    expect(nextState.activeScreenShareSession.connectedUsers).toEqual([
      { id: 'user-a', username: 'Alpha', is_sharing: true },
      { id: 'user-b', username: 'Beta', is_sharing: false },
    ]);
  });

  it('should patch connection lifecycle state on active session', () => {
    const baseState = groupsReducer(undefined, { type: 'unknown' });
    const state = groupsReducer(baseState, patchActiveScreenShareSession({
      shareId: 'share-6',
      role: 'host',
      status: 'sharing',
      webrtcRoomId: 'room-6',
      connectionState: 'connected',
    }));

    const nextState = groupsReducer(state, patchActiveScreenShareSession({
      status: 'error',
      connectionState: 'error',
      connectionDetail: 'signal-failed',
    }));

    expect(nextState.activeScreenShareSession).toMatchObject({
      shareId: 'share-6',
      status: 'error',
      connectionState: 'error',
      connectionDetail: 'signal-failed',
    });
  });

  it('should clear ended session diagnostics on endScreenShare.fulfilled', () => {
    const baseState = groupsReducer(undefined, { type: 'unknown' });
    const state = groupsReducer(baseState, patchActiveScreenShareSession({
      groupId: 'group-6b',
      shareId: 'share-6b',
      role: 'host',
      status: 'sharing',
      webrtcRoomId: 'room-6b',
      ownerId: 'user-6b',
      connectedUsers: [
        { id: 'user-a', username: 'Alpha', is_sharing: true },
        { id: 'user-b', username: 'Beta', is_sharing: false },
      ],
      hasRemoteStream: true,
      hasAttachedRemoteStream: true,
      viewerTimeoutReached: true,
      shareSnapshot: {
        id: 'share-6b',
        status: 'active',
        title: 'Session 6B',
        webrtc_room_id: 'room-6b',
        user: { id: 'user-6b' },
        group: { id: 'group-6b' },
      },
    }));

    const nextState = groupsReducer(state, {
      type: endScreenShare.fulfilled.type,
      payload: {
        shareId: 'share-6b',
      },
    });

    expect(nextState.activeScreenShareSession).toMatchObject({
      groupId: 'group-6b',
      shareId: 'share-6b',
      role: 'host',
      status: 'ended',
      webrtcRoomId: 'room-6b',
      ownerId: 'user-6b',
      connectedUsers: [],
      hasRemoteStream: false,
      hasAttachedRemoteStream: false,
      viewerTimeoutReached: false,
    });
    expect(nextState.activeScreenShareSession.shareSnapshot).toMatchObject({
      id: 'share-6b',
      status: 'ended',
      title: 'Session 6B',
    });
  });

  it('should keep active session ended when fetchScreenShares returns ended snapshot', () => {
    const baseState = groupsReducer(undefined, { type: 'unknown' });
    const state = groupsReducer(baseState, patchActiveScreenShareSession({
      groupId: 'group-6c',
      shareId: 'share-6c',
      role: 'viewer',
      status: 'ended',
      webrtcRoomId: 'room-6c',
      ownerId: 'user-6c',
      shareSnapshot: {
        id: 'share-6c',
        status: 'ended',
        title: 'Session 6C',
        webrtc_room_id: 'room-6c',
        user: { id: 'user-6c' },
        group: { id: 'group-6c' },
      },
    }));

    const nextState = groupsReducer(state, {
      type: fetchScreenShares.fulfilled.type,
      payload: [
        {
          id: 'share-6c',
          status: 'ended',
          title: 'Session 6C',
          webrtc_room_id: 'room-6c',
          user: { id: 'user-6c' },
          group: { id: 'group-6c' },
        },
      ],
    });

    expect(nextState.activeScreenShareSession).toMatchObject({
      groupId: 'group-6c',
      shareId: 'share-6c',
      role: 'viewer',
      status: 'ended',
      webrtcRoomId: 'room-6c',
      ownerId: 'user-6c',
    });
    expect(nextState.activeScreenShareSession.shareSnapshot).toMatchObject({
      id: 'share-6c',
      status: 'ended',
      title: 'Session 6C',
    });
  });

  it('should keep share snapshot fields patchable without replacing session identity fields', () => {
    const baseState = groupsReducer(undefined, { type: 'unknown' });
    const state = groupsReducer(baseState, patchActiveScreenShareSession({
      groupId: 'group-7',
      shareId: 'share-7',
      role: 'viewer',
      status: 'viewing',
      webrtcRoomId: 'room-7',
      ownerId: 'user-7',
      shareSnapshot: {
        id: 'share-7',
        status: 'active',
        title: '旧标题',
        webrtc_room_id: 'room-7',
        user: { id: 'user-7' },
        group: { id: 'group-7' },
      },
    }));

    const nextState = groupsReducer(state, patchActiveScreenShareSession({
      shareSnapshot: {
        id: 'share-7',
        status: 'paused',
        title: '新标题',
        webrtc_room_id: 'room-7',
        user: { id: 'user-7' },
        group: { id: 'group-7' },
      },
    }));

    expect(nextState.activeScreenShareSession).toMatchObject({
      groupId: 'group-7',
      shareId: 'share-7',
      role: 'viewer',
      status: 'viewing',
      webrtcRoomId: 'room-7',
      ownerId: 'user-7',
    });
    expect(nextState.activeScreenShareSession.shareSnapshot).toMatchObject({
      id: 'share-7',
      status: 'paused',
      title: '新标题',
    });
  });

  it('should ignore equivalent session patch payload without replacing session reference', () => {
    const baseState = groupsReducer(undefined, { type: 'unknown' });
    const state = groupsReducer(baseState, patchActiveScreenShareSession({
      groupId: 'group-8',
      shareId: 'share-8',
      role: 'viewer',
      status: 'viewing',
      webrtcRoomId: 'room-8',
      ownerId: 'user-8',
      connectionState: 'connected',
      connectionDetail: 'remote-stream-ready',
      hasRemoteStream: true,
      viewerTimeoutReached: false,
      shareSnapshot: {
        id: 'share-8',
        status: 'active',
        title: '共享八号',
        webrtc_room_id: 'room-8',
        user: { id: 'user-8' },
        group: { id: 'group-8' },
      },
    }));

    const nextState = groupsReducer(state, patchActiveScreenShareSession({
      status: 'viewing',
      connectionState: 'connected',
      connectionDetail: 'remote-stream-ready',
      hasRemoteStream: true,
      viewerTimeoutReached: false,
      shareSnapshot: {
        id: 'share-8',
        status: 'active',
        title: '共享八号',
        webrtc_room_id: 'room-8',
        user: { id: 'user-8' },
        group: { id: 'group-8' },
      },
    }));

    expect(nextState.activeScreenShareSession).toBe(state.activeScreenShareSession);
  });
});
