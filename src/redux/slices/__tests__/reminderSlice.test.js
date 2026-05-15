jest.mock('../../../services/api', () => ({
  get: jest.fn(),
}));

jest.mock('../../../utils/messageUtils', () => ({
  showMessage: jest.fn(),
}));

jest.mock('../../../services/reminder/reminderNotificationService', () => ({
  getOfflineOperations: jest.fn(),
}));

import remindersReducer, { loadReminders, refreshUnsyncedCount, syncReminders } from '../reminderSlice';

describe('reminderSlice offline projection', () => {
  it('should project offline update onto incoming reminders', () => {
    const state = remindersReducer(undefined, {
      type: loadReminders.fulfilled.type,
      payload: {
        reminders: [
          { id: 'r-1', title: 'server-title', is_completed: false },
        ],
        offlineOperations: [
          {
            operation: 'update',
            data: { id: 'r-1', title: 'offline-updated', is_completed: true },
          },
        ],
      },
    });

    expect(state.reminders).toHaveLength(1);
    expect(state.reminders[0]).toMatchObject({
      id: 'r-1',
      title: 'offline-updated',
      is_completed: true,
      isLocal: true,
    });
  });

  it('should project offline update when payload uses reminderId field', () => {
    const state = remindersReducer(undefined, {
      type: loadReminders.fulfilled.type,
      payload: {
        reminders: [
          { id: 'r-1', title: 'server-title', is_completed: false },
        ],
        offlineOperations: [
          {
            operation: 'update',
            data: { reminderId: 'r-1', title: 'offline-updated-by-reminderId', is_completed: true },
          },
        ],
      },
    });

    expect(state.reminders).toHaveLength(1);
    expect(state.reminders[0]).toMatchObject({
      id: 'r-1',
      title: 'offline-updated-by-reminderId',
      is_completed: true,
      isLocal: true,
    });
  });

  it('should remove deleted reminder via offline delete projection', () => {
    const state = remindersReducer(undefined, {
      type: loadReminders.fulfilled.type,
      payload: {
        reminders: [
          { id: 'r-1', title: 'keep-me' },
          { id: 'r-2', title: 'delete-me' },
        ],
        offlineOperations: [
          {
            operation: 'delete',
            data: { id: 'r-2' },
          },
        ],
      },
    });

    expect(state.reminders).toHaveLength(1);
    expect(state.reminders[0].id).toBe('r-1');
  });

  it('should remove reminder when delete projection carries string id payload', () => {
    const state = remindersReducer(undefined, {
      type: loadReminders.fulfilled.type,
      payload: {
        reminders: [
          { id: 'r-1', title: 'keep-me' },
          { id: 'r-2', title: 'delete-me' },
        ],
        offlineOperations: [
          {
            operation: 'delete',
            data: 'r-2',
          },
        ],
      },
    });

    expect(state.reminders).toHaveLength(1);
    expect(state.reminders[0].id).toBe('r-1');
  });

  it('should remove reminder when delete projection uses reminderId field', () => {
    const state = remindersReducer(undefined, {
      type: loadReminders.fulfilled.type,
      payload: {
        reminders: [
          { id: 'r-1', title: 'keep-me' },
          { id: 'r-2', title: 'delete-me' },
        ],
        offlineOperations: [
          {
            operation: 'delete',
            data: { reminderId: 'r-2' },
          },
        ],
      },
    });

    expect(state.reminders).toHaveLength(1);
    expect(state.reminders[0].id).toBe('r-1');
  });

  it('should preserve local reminders not present in incoming list', () => {
    const baseState = remindersReducer(undefined, {
      type: 'unknown',
    });
    const stateWithLocal = {
      ...baseState,
      reminders: [
        { id: 'local-1', title: 'local-draft', isLocal: true },
      ],
    };

    const nextState = remindersReducer(stateWithLocal, {
      type: loadReminders.fulfilled.type,
      payload: {
        reminders: [
          { id: 'server-1', title: 'server-item' },
        ],
        offlineOperations: [],
      },
    });

    expect(nextState.reminders).toHaveLength(2);
    expect(nextState.reminders.find(item => item.id === 'local-1')).toBeTruthy();
    expect(nextState.reminders.find(item => item.id === 'server-1')).toBeTruthy();
    expect(nextState.offlineReminders).toEqual([
      { id: 'local-1', title: 'local-draft', isLocal: true },
    ]);
  });

  it('should keep projected local reminders mirrored into offlineReminders', () => {
    const state = remindersReducer(undefined, {
      type: loadReminders.fulfilled.type,
      payload: {
        reminders: [
          { id: 'r-1', title: 'server-title', is_completed: false },
        ],
        offlineOperations: [
          {
            operation: 'update',
            data: { id: 'r-1', title: 'offline-updated', is_completed: true },
          },
        ],
      },
    });

    expect(state.offlineReminders).toEqual([
      {
        id: 'r-1',
        title: 'offline-updated',
        is_completed: true,
        isLocal: true,
      },
    ]);
  });

  it('should update unsyncedCount from sync fulfilled remaining payload', () => {
    const state = remindersReducer(undefined, {
      type: syncReminders.fulfilled.type,
      payload: {
        synced: 2,
        failed: 1,
        remaining: 4,
      },
    });

    expect(state.syncStatus.syncing).toBe(false);
    expect(state.syncStatus.unsyncedCount).toBe(4);
    expect(state.syncStatus.lastSynced).toBeTruthy();
  });

  it('should update unsyncedCount from sync rejected remaining payload', () => {
    const state = remindersReducer(undefined, {
      type: syncReminders.rejected.type,
      payload: {
        message: 'sync failed',
        remaining: 3,
      },
    });

    expect(state.syncStatus.syncing).toBe(false);
    expect(state.syncStatus.unsyncedCount).toBe(3);
    expect(state.syncStatus.error).toMatchObject({
      message: 'sync failed',
      remaining: 3,
    });
  });

  it('should fallback unsyncedCount to 0 when refresh result is null', () => {
    const state = remindersReducer(undefined, {
      type: refreshUnsyncedCount.fulfilled.type,
      payload: null,
    });

    expect(state.syncStatus.unsyncedCount).toBe(0);
  });
});
