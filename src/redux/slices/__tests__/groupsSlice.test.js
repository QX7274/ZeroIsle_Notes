jest.mock('../../../services/api/groupApi', () => ({}));

import groupsReducer, {
  clearActiveScreenShareSession,
  createScreenShare,
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
      shareSnapshot: null,
      connectionState: 'idle',
      connectionDetail: null,
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
      viewerTimeoutReached: false,
      connectionState: 'connected',
      connectionDetail: 'remote-stream-ready',
    }));

    expect(nextState.activeScreenShareSession).toMatchObject({
      shareId: 'share-5',
      hasRemoteStream: true,
      viewerTimeoutReached: false,
      connectionState: 'connected',
      connectionDetail: 'remote-stream-ready',
    });
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
});
