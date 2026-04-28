/**
 * 分片上传服务 - 处理大文件切片上传与断点续传
 * 对应里程碑 4 要求：500MB 大附件、分片、续传、非阻塞
 */

import RNFS from 'react-native-fs';
import realmService from '../database/realmService';
import apiClient from '../api/apiClient';
import { logService } from '../../utils/logService';
import { deviceIdentityService } from '../app/deviceIdentityService';
import { networkService } from '../network/networkService';

class ChunkedUploadService {
  constructor() {
    this.DEFAULT_CHUNK_SIZE = 1024 * 1024; // 默认 1MB
    this.MAX_RETRIES = 3;
    this.RETRY_BASE_DELAY_MS = 600;
    this.INIT_ENDPOINT = '/files/upload/init/';
    this.CHUNK_ENDPOINT = '/files/upload/chunk/';
    this.COMPLETE_ENDPOINT = '/files/upload/complete/';
    this.CANCEL_ENDPOINT = '/files/upload/cancel/';

    this.STATUS = {
      PENDING: 'pending',
      UPLOADING: 'uploading',
      PAUSED: 'paused',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled',
      FAILED: 'failed',
    };
  }

  /**
   * 开始分片上传任务
   * @param {Object} params
   * @param {string} params.uri 本地路径
   * @param {number} params.size 总大小
   * @param {string} params.name 文件名
   * @param {Function} params.onProgress 进度回调
   */
  async startUpload({ uri, size, name, type, onProgress }) {
    const realm = await realmService.getRealm();
    const deviceId = await deviceIdentityService.getDeviceId();
    const clientOpId = `up_${realmService.createObjectId()}`;

    // 1. 获取或创建上传会话
    let session = realm.objects('UploadSession').filtered(`localPath == $0 AND status != "${this.STATUS.COMPLETED}"`, uri)[0];

    if (!session) {
      const initResult = await this._requestUploadInit({ name, size, type, deviceId, clientOpId });
      realm.write(() => {
        session = realm.create('UploadSession', {
          _id: `sess_${Date.now()}`,
          sessionId: initResult.sessionId,
          fileId: initResult.fileId || null,
          localPath: uri,
          fileSize: size,
          chunkSize: this.DEFAULT_CHUNK_SIZE,
          uploadedBytes: 0,
          status: this.STATUS.UPLOADING,
          updatedAt: new Date(),
          deviceId,
          clientOpId,
        });
      });
    } else {
      realm.write(() => {
        session.status = this.STATUS.UPLOADING;
        session.updatedAt = new Date();
      });
    }

    return this._resumeUpload(session, onProgress);
  }

  async pauseUpload({ sessionId, localPath }) {
    const realm = await realmService.getRealm();
    let session = null;

    if (sessionId) {
      session = realm.objects('UploadSession').filtered('sessionId == $0', sessionId)[0];
    } else if (localPath) {
      session = realm.objects('UploadSession').filtered(`localPath == $0 AND status == "${this.STATUS.UPLOADING}"`, localPath)[0];
    }

    if (!session) return false;

    realm.write(() => {
      session.status = this.STATUS.PAUSED;
      session.updatedAt = new Date();
    });

    return true;
  }

  async resumeUpload({ sessionId, localPath, onProgress }) {
    const realm = await realmService.getRealm();
    let session = null;

    if (sessionId) {
      session = realm.objects('UploadSession').filtered('sessionId == $0', sessionId)[0];
    } else if (localPath) {
      session = realm.objects('UploadSession').filtered(`localPath == $0 AND status == "${this.STATUS.PAUSED}"`, localPath)[0];
    }

    if (!session) {
      throw new Error('Upload session not found for resume');
    }

    realm.write(() => {
      session.status = this.STATUS.UPLOADING;
      session.updatedAt = new Date();
    });

    const resumedResult = await this._resumeUpload(session, onProgress);

    if (resumedResult?.paused || resumedResult?.cancelled) {
      return {
        ...resumedResult,
        strategy: 'chunked',
        fileName: this._extractFileName(session.localPath),
      };
    }

    return {
      ...(resumedResult || {}),
      strategy: 'chunked',
      fileName: this._extractFileName(session.localPath),
    };
  }

  async cancelUpload({ sessionId, localPath, reason = 'user_cancelled' }) {
    const realm = await realmService.getRealm();
    let session = null;

    if (sessionId) {
      session = realm.objects('UploadSession').filtered('sessionId == $0', sessionId)[0];
    } else if (localPath) {
      session = realm.objects('UploadSession').filtered(`localPath == $0 AND status != "${this.STATUS.COMPLETED}"`, localPath)[0];
    }

    if (!session) return false;

    realm.write(() => {
      session.status = this.STATUS.CANCELLED;
      session.error = reason;
      session.updatedAt = new Date();
    });

    try {
      await apiClient.post(this.CANCEL_ENDPOINT, {
        sessionId: session.sessionId,
        fileId: session.fileId || null,
        uploadedBytes: session.uploadedBytes,
        totalSize: session.fileSize,
        reason,
        deviceId: session.deviceId || null,
        clientOpId: session.clientOpId || null,
      });
    } catch (error) {
      logService.warn('[ChunkedUpload] 取消通知失败（本地状态已标记为取消）', error?.message || error);
    }

    return true;
  }

  _extractFileName(path) {
    try {
      return String(path || '').split('/').pop() || 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }

  /**
   * 恢复上传逻辑
   * @private
   */
  async _resumeUpload(session, onProgress) {
    const realm = await realmService.getRealm();
    const { localPath, fileSize, chunkSize } = session;

    try {
      while (session.uploadedBytes < fileSize) {
        if (session.status === this.STATUS.PAUSED) {
          return {
            success: false,
            paused: true,
            path: localPath,
            sessionId: session.sessionId,
            fileId: session.fileId || null,
            uploadedBytes: session.uploadedBytes,
          };
        }

        if (session.status === this.STATUS.CANCELLED) {
          return {
            success: false,
            cancelled: true,
            path: localPath,
            sessionId: session.sessionId,
            fileId: session.fileId || null,
            uploadedBytes: session.uploadedBytes,
          };
        }

        // 检查网络
        if (!networkService.isOnline()) {
          throw new Error('Network disconnected during chunked upload');
        }

        const offset = session.uploadedBytes;
        const length = Math.min(chunkSize, fileSize - offset);

        // A. 非阻塞读取分片
        const chunkData = await RNFS.read(localPath, length, offset, 'base64');

        // B. 发送分片到后端
        await this._uploadChunk(session, chunkData, offset);

        // C. 更新进度与持久化状态
        realm.write(() => {
          session.uploadedBytes += length;
          session.updatedAt = new Date();
          session.retryCount = 0; // 成功一次后重置重试计数
        });

        if (onProgress) {
          onProgress(session.uploadedBytes / fileSize);
        }
      }

      const completeResult = await this._completeUpload(session);

      realm.write(() => {
        session.status = this.STATUS.COMPLETED;
        session.error = null;
        session.updatedAt = new Date();
      });

      logService.info(`[ChunkedUpload] 文件上传完成: ${localPath}`);
      return {
        success: true,
        path: localPath,
        sessionId: session.sessionId,
        fileId: session.fileId || null,
        remoteUrl: completeResult?.remoteUrl || null,
      };

    } catch (error) {
      logService.error(`[ChunkedUpload] 上传中断: ${session.sessionId}`, error);

      const normalizedError = this._normalizeUploadError(error, '分片上传中断');
      normalizedError.sessionId = session.sessionId || null;
      normalizedError.fileId = session.fileId || null;

      realm.write(() => {
        session.status = this.STATUS.FAILED;
        session.error = normalizedError.message;
        session.retryCount += 1;
      });

      throw normalizedError;
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _normalizeUploadError(error, defaultMessage) {
    const message = error?.message || defaultMessage || '上传失败';
    const normalizedError = new Error(message);
    normalizedError.name = 'UploadError';
    normalizedError.status = error?.response?.status ?? null;
    normalizedError.code = error?.code || error?.response?.data?.code || null;
    normalizedError.responseData = error?.response?.data ?? null;
    normalizedError.isNetworkError = !error?.response && !!error?.request;
    normalizedError.originalError = error;
    return normalizedError;
  }

  async _requestUploadInit({ name, size, type, deviceId, clientOpId }) {
    try {
      const payload = { name, size, type, deviceId, clientOpId };
      const response = await apiClient.post(this.INIT_ENDPOINT, payload);

      const sessionId = response?.sessionId || response?.data?.sessionId;
      const fileId = response?.fileId || response?.data?.fileId || null;

      if (!sessionId) {
        throw new Error('初始化上传会话失败：服务端未返回sessionId');
      }

      return { sessionId, fileId };
    } catch (error) {
      throw this._normalizeUploadError(error, '初始化上传会话失败');
    }
  }

  /**
   * 实际发送分片的网络请求
   * @private
   */
  async _uploadChunk(session, base64Data, offset) {
    const chunkIndex = Math.floor(offset / session.chunkSize);
    const isLast = offset + session.chunkSize >= session.fileSize;

    const payload = {
      sessionId: session.sessionId,
      fileId: session.fileId || null,
      offset,
      chunkIndex,
      totalSize: session.fileSize,
      chunkSize: session.chunkSize,
      data: base64Data,
      isLast,
      deviceId: session.deviceId || null,
      clientOpId: session.clientOpId || null,
    };

    let attempt = 0;
    while (attempt < this.MAX_RETRIES) {
      try {
        await apiClient.post(this.CHUNK_ENDPOINT, payload, {
          timeout: 60000,
        });
        return true;
      } catch (error) {
        attempt += 1;
        if (attempt >= this.MAX_RETRIES) {
          throw this._normalizeUploadError(error, '分片上传失败');
        }
        await this._sleep(this.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
      }
    }

    return false;
  }

  async _completeUpload(session) {
    try {
      const response = await apiClient.post(this.COMPLETE_ENDPOINT, {
        sessionId: session.sessionId,
        fileId: session.fileId || null,
        uploadedBytes: session.uploadedBytes,
        totalSize: session.fileSize,
        deviceId: session.deviceId || null,
        clientOpId: session.clientOpId || null,
      });

      return {
        remoteUrl: response?.url || response?.data?.url || null,
      };
    } catch (error) {
      throw this._normalizeUploadError(error, '上传完成确认失败');
    }
  }
}

export const chunkedUploadService = new ChunkedUploadService();
export default chunkedUploadService;

