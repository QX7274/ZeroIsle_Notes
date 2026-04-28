/**
 * 离线同步服务
 *
 * 提供离线数据存储和在线同步功能
 *
 * 使用方法:
 * import { OfflineSyncService } from '@/services/offlineSync';
 *
 * // 保存离线数据
 * OfflineSyncService.saveOffline('notes', note);
 *
 * // 同步到服务器
 * await OfflineSyncService.syncAll();
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import networkService from './network/networkService';
import tokenService from './auth/tokenService';
import realmService from './database/realmService';

import { API_URL, API_VERSION } from '../config';

const OFFLINE_QUEUE_KEY = '@zeroislenotes:offline_queue';
const SYNC_STATUS_KEY = '@zeroislenotes:sync_status';

// 操作类型
export const SyncOperationType = {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
};

// 同步状态
export const SyncStatus = {
    PENDING: 'pending',
    SYNCING: 'syncing',
    SYNCED: 'synced',
    FAILED: 'failed',
    CONFLICT: 'conflict',
};

class OfflineSyncServiceClass {
    constructor() {
        this.queue = [];
        this.isOnline = true;
        this.isSyncing = false;
        this.listeners = new Set();
        this._initialized = false;
    }

    /**
     * 初始化
     */
    async init() {
        if (this._initialized) {return;}

        try {
            // 加载离线队列
            const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
            if (queueJson) {
                this.queue = JSON.parse(queueJson);
            }

            // 监听网络状态
            networkService.addNetworkListener(state => {
                const wasOffline = !this.isOnline;
                this.isOnline = Boolean(state?.isOnline);

                // 如果从离线变为在线，自动同步
                if (wasOffline && this.isOnline) {
                    this.syncAll();
                }

                this._notifyListeners();
            });

            // 获取初始网络状态
            const state = await networkService.checkConnection();
            this.isOnline = Boolean(state);

            this._initialized = true;
        } catch (error) {
            console.error('OfflineSync init failed:', error);
            throw error;
        }
    }

    /**
     * 保存离线操作
     */
    async saveOffline(entityType, data, operation = SyncOperationType.UPDATE) {
        const item = {
            id: realmService.createObjectId(),
            entityType,
            entityId: data.id || data._id,
            operation,
            data,
            status: SyncStatus.PENDING,
            createdAt: new Date().toISOString(),
            retryCount: 0,
        };

        this.queue.push(item);
        await this._saveQueue();
        this._notifyListeners();

        // 如果在线，立即尝试同步
        if (this.isOnline) {
            this.syncItem(item);
        }

        return item;
    }

    /**
     * 同步单个项目
     */
    async syncItem(item, options = {}) {
        const { fromSyncAll = false } = options;

        if (this.isSyncing && !fromSyncAll) {
            throw new Error('同步已在进行中');
        }
        if (!this.isOnline) {
            throw new Error('离线状态无法同步');
        }

        try {
            item.status = SyncStatus.SYNCING;
            this._notifyListeners();

            await this._performSync(item);

            // 同步成功，从队列移除
            this.queue = this.queue.filter(q => q.id !== item.id);
            await this._saveQueue();
            this._notifyListeners();

            return true;

        } catch (error) {
            console.error('Sync item failed:', error);

            if (error?.code === 'SYNC_CONFLICT') {
                // 业务语义：服务端冲突不是传输失败，标记冲突待人工/策略处理
                item.status = SyncStatus.CONFLICT;
                item.conflictData = error.serverData;
                item.lastError = error.message;
            } else {
                item.status = SyncStatus.FAILED;
                item.retryCount++;
                item.lastError = error.message;
            }

            await this._saveQueue();
            this._notifyListeners();
            throw error;
        }
    }

    /**
     * 同步所有待同步项目
     */
    async syncAll() {
        if (this.isSyncing) {
            throw new Error('同步已在进行中');
        }
        if (!this.isOnline) {
            throw new Error('离线状态无法同步');
        }

        this.isSyncing = true;
        this._notifyListeners();

        let synced = 0;
        let failed = 0;

        try {
            const pendingItems = this.queue.filter(
                q => q.status === SyncStatus.PENDING || q.status === SyncStatus.FAILED
            );

            for (const item of pendingItems) {
                // 跳过重试次数过多的项目
                if (item.retryCount >= 5) {
                    failed++;
                    continue;
                }

                try {
                    await this.syncItem(item, { fromSyncAll: true });
                    synced++;
                } catch (error) {
                    failed++;
                }

                // 添加延迟避免请求过快
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            if (failed > 0) {
                throw new Error(`同步未完成，失败 ${failed} 项`);
            }

            return { synced, failed };
        } finally {
            this.isSyncing = false;
            this._notifyListeners();
        }
    }

    /**
     * 执行实际同步操作
     */
    async _performSync(item) {
        const { entityType, entityId, operation, data } = item;

        try {
            let endpoint, method, body;

            switch (entityType) {
                case 'notes':
                    endpoint = `/notes${operation === SyncOperationType.CREATE ? '' : `/${entityId}`}/`;
                    break;
                case 'tags':
                    endpoint = `/tags${operation === SyncOperationType.CREATE ? '' : `/${entityId}`}/`;
                    break;
                case 'categories':
                    endpoint = `/categories${operation === SyncOperationType.CREATE ? '' : `/${entityId}`}/`;
                    break;
                default:
                    endpoint = `/${entityType}${operation === SyncOperationType.CREATE ? '' : `/${entityId}`}/`;
            }

            switch (operation) {
                case SyncOperationType.CREATE:
                    method = 'POST';
                    body = JSON.stringify(data);
                    break;
                case SyncOperationType.UPDATE:
                    method = 'PATCH';
                    body = JSON.stringify(data);
                    break;
                case SyncOperationType.DELETE:
                    method = 'DELETE';
                    body = null;
                    break;
            }

            // 获取认证token
            const tokenData = await tokenService.getAccessToken();
            const token = tokenData ? tokenData.token : null;

            const response = await fetch(`${this._getBaseUrl()}${endpoint}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                },
                body,
            });

            if (response.status === 409) {
                // 业务语义：同步冲突需上层进入冲突处理流程（非静默失败）
                const serverData = await response.json();
                const conflictError = new Error('同步冲突，请选择保留本地或服务器版本后重试');
                conflictError.code = 'SYNC_CONFLICT';
                conflictError.serverData = serverData;
                throw conflictError;
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `同步请求失败: HTTP ${response.status}`);
            }

            await response.json();

        } catch (error) {
            throw error;
        }
    }

    /**
     * 解决冲突
     */
    async resolveConflict(itemId, resolution) {
        const item = this.queue.find(q => q.id === itemId);
        if (!item || item.status !== SyncStatus.CONFLICT) {
            // 业务语义：未找到冲突项或状态不匹配时返回 false（非错误）
            return false;
        }

        switch (resolution) {
            case 'local':
                // 使用本地版本，强制同步
                item.data._forceUpdate = true;
                item.status = SyncStatus.PENDING;
                break;
            case 'server':
                // 使用服务器版本，丢弃本地更改
                this.queue = this.queue.filter(q => q.id !== itemId);
                break;
            case 'merge':
                // 合并（需要外部处理合并逻辑）
                break;
        }

        await this._saveQueue();
        this._notifyListeners();

        if (resolution === 'local') {
            return this.syncItem(item);
        }

        return true;
    }

    /**
     * 获取同步状态
     */
    getStatus() {
        const pending = this.queue.filter(q => q.status === SyncStatus.PENDING).length;
        const failed = this.queue.filter(q => q.status === SyncStatus.FAILED).length;
        const conflicts = this.queue.filter(q => q.status === SyncStatus.CONFLICT).length;

        return {
            isOnline: this.isOnline,
            isSyncing: this.isSyncing,
            pendingCount: pending,
            failedCount: failed,
            conflictCount: conflicts,
            totalPending: pending + failed + conflicts,
            queue: this.queue,
        };
    }

    /**
     * 清除已完成的同步项
     */
    async clearSynced() {
        this.queue = this.queue.filter(q => q.status !== SyncStatus.SYNCED);
        await this._saveQueue();
        this._notifyListeners();
    }

    /**
     * 添加监听器
     */
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    _notifyListeners() {
        const status = this.getStatus();
        this.listeners.forEach(listener => listener(status));
    }

    async _saveQueue() {
        try {
            await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.queue));
        } catch (error) {
            console.error('Failed to save offline queue:', error);
            throw error;
        }
    }

    _getBaseUrl() {
        return `${API_URL}/api/${API_VERSION}`;
    }
}

export const OfflineSyncService = new OfflineSyncServiceClass();

// React Hook
export const useOfflineSync = () => {
    const [status, setStatus] = React.useState(OfflineSyncService.getStatus());

    React.useEffect(() => {
        OfflineSyncService.init();
        const unsubscribe = OfflineSyncService.addListener(setStatus);
        return unsubscribe;
    }, []);

    return {
        ...status,
        saveOffline: (type, data, op) => OfflineSyncService.saveOffline(type, data, op),
        syncAll: () => OfflineSyncService.syncAll(),
        resolveConflict: (id, res) => OfflineSyncService.resolveConflict(id, res),
    };
};

export default OfflineSyncService;
