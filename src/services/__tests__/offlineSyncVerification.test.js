
jest.mock('realm', () => {
    class MockRealmObject {}
    class MockObjectId {
        constructor(id = 'mock-object-id') {
            this.id = id;
        }
        toHexString() {
            return this.id;
        }
    }

    const realmLike = {
        Object: MockRealmObject,
        BSON: { ObjectId: MockObjectId },
    };

    return {
        __esModule: true,
        default: realmLike,
        Object: MockRealmObject,
        BSON: { ObjectId: MockObjectId },
    };
});

import OfflineSyncService, { SyncOperationType, SyncStatus } from '../offlineSync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Mocks
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-community/netinfo', () => ({
    addEventListener: jest.fn(),
    fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
}));

global.fetch = jest.fn();

describe('OfflineSyncService Verification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        OfflineSyncService.queue = [];
        OfflineSyncService.isOnline = false;
        OfflineSyncService.isSyncing = false;
        AsyncStorage.getItem.mockResolvedValue(null); // Default to null
    });

    it('1. Should add item to queue when saving offline', async () => {
        const data = { id: 'note_123', content: 'offline content' };
        await OfflineSyncService.saveOffline('notes', data, SyncOperationType.CREATE);

        expect(OfflineSyncService.queue.length).toBe(1);
        expect(OfflineSyncService.queue[0].data).toEqual(data);
        expect(OfflineSyncService.queue[0].status).toBe(SyncStatus.PENDING);
        expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('2. Should attempt sync immediately if online', async () => {
        OfflineSyncService.isOnline = true;
        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true, data: { id: 'note_online' } }), // Valid return structure
        });

        const data = { id: 'note_online', content: 'online content' };
        await OfflineSyncService.saveOffline('notes', data, SyncOperationType.CREATE);

        // Initial check: item added
        expect(OfflineSyncService.queue.length).toBe(1);

        // Wait for async syncItem to complete (it's not awaited in saveOffline)
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(global.fetch).toHaveBeenCalled();
        // After success, syncItem removes it from queue
        expect(OfflineSyncService.queue.length).toBe(0);
    });

    it('3. Should NOT sync immediately if offline', async () => {
        OfflineSyncService.isOnline = false;

        const data = { id: 'note_offline', content: 'offline content' };
        await OfflineSyncService.saveOffline('notes', data, SyncOperationType.CREATE);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(OfflineSyncService.queue.length).toBe(1);
        expect(OfflineSyncService.queue[0].status).toBe(SyncStatus.PENDING);
    });

    it('4. Should sync pending items when calling syncAll', async () => {
        OfflineSyncService.isOnline = true;
        // Manually setup queue
        OfflineSyncService.queue = [{
            id: 'pending_1',
            entityType: 'notes',
            entityId: 'n1',
            operation: SyncOperationType.CREATE,
            data: { id: 'n1' },
            status: SyncStatus.PENDING,
            retryCount: 0,
            createdAt: new Date().toISOString(),
        }];

        global.fetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true, data: { id: 'n1' } }),
        });

        const result = await OfflineSyncService.syncAll();

        expect(result.synced).toBe(1);
        expect(global.fetch).toHaveBeenCalled();
        expect(OfflineSyncService.queue.length).toBe(0);
    });
});
