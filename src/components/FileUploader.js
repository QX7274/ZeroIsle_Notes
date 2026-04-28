/**
 * 文件上传组件
 * 支持PDF和WORD文档的选择与上传
 */
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import Icon from 'react-native-vector-icons/Ionicons';
import DocumentPicker from 'react-native-document-picker';
import { useTheme } from '../../context/ThemeContext';
import { fileService } from '../../services/files';
import chunkedUploadService from '../../services/files/chunkedUploadService';
import { loadingService } from '../../services/loading';
import { showToast } from '../../redux/slices/uiSlice';
import networkErrorService from '../../services/networkErrorService';

const FileUploader = ({ onUploadComplete, allowedTypes = ['pdf', 'doc', 'docx'] }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const [isUploading, setIsUploading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [currentFileUri, setCurrentFileUri] = useState(null);
  const [isPaused, setIsPaused] = useState(false);

  const buildNormalizedResult = (result, fallbackFileName = 'unknown') => ({
    success: !!result?.success,
    strategy: result?.strategy || 'chunked',
    fileName: result?.fileName || fallbackFileName,
    remoteUrl: result?.remoteUrl || null,
    sessionId: result?.sessionId || null,
    fileId: result?.fileId || null,
    raw: result,
  });

  const resetUploadState = ({ keepSession = false } = {}) => {
    setIsUploading(false);
    setIsPaused(false);
    if (!keepSession) {
      setCurrentSessionId(null);
      setCurrentFileUri(null);
    }
    loadingService.hide();
  };

  const getErrorMessage = (error, fallbackMessage) => {
    if (!error) {
      return fallbackMessage;
    }

    const resolvedStatus = error?.status ?? error?.response?.status ?? null;

    if (error?.name === 'FileNotFoundError') {
      return error?.message || '文件不存在，请重新选择文件';
    }

    if (error?.isNetworkError || networkErrorService.isNetworkError(error)) {
      return '网络连接异常，请检查网络后重试';
    }

    if (error?.request && !error?.response) {
      return '网络请求未收到响应，请稍后重试';
    }

    if (resolvedStatus === 401 || resolvedStatus === 403) {
      return '登录状态已失效，请重新登录后再试';
    }

    if (resolvedStatus >= 500) {
      return '服务器繁忙，请稍后重试';
    }

    return error?.message || fallbackMessage;
  };

  // 处理文件选择
  const handleFilePick = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
      });

      // 验证文件类型
      const fileExtension = result.name.split('.').pop().toLowerCase();
      if (!allowedTypes.includes(fileExtension)) {
        Alert.alert(
          '不支持的文件类型',
          `请上传以下类型的文件: ${allowedTypes.join(', ')}`,
          [{ text: '确定' }]
        );
        return;
      }

      // 上传文件
      await uploadFile(result);
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        return;
      }
      console.error('文件选择错误:', err);
      Alert.alert('错误', '文件选择失败，请重试');
    }
  };

  const handlePauseUpload = async () => {
    try {
      const paused = await chunkedUploadService.pauseUpload({
        sessionId: currentSessionId,
        localPath: currentFileUri,
      });

      if (paused) {
        setIsPaused(true);
        loadingService.show('上传已暂停');
      }
    } catch (error) {
      Alert.alert('暂停失败', getErrorMessage(error, '无法暂停上传任务'));
    }
  };

  const handleResumeUpload = async () => {
    try {
      if (!currentSessionId && !currentFileUri) {
        Alert.alert('提示', '没有可恢复的上传任务');
        return;
      }

      setIsPaused(false);
      setIsUploading(true);

      const resumed = await chunkedUploadService.resumeUpload({
        sessionId: currentSessionId,
        localPath: currentFileUri,
        onProgress: (progress) => {
          const percent = Math.round((Number(progress || 0)) * 100);
          loadingService.show(`继续上传中... ${percent}%`);
        },
      });

      if (resumed?.paused) {
        setIsPaused(true);
        dispatch(showToast({ message: '上传已暂停', type: 'success' }));
        return;
      }

      if (resumed?.cancelled) {
        resetUploadState();
        dispatch(showToast({ message: '上传已取消', type: 'success' }));
        return;
      }

      const normalizedResumed = buildNormalizedResult(
        {
          ...resumed,
          strategy: resumed?.strategy || 'chunked',
          fileName: resumed?.fileName || (currentFileUri ? String(currentFileUri).split('/').pop() : 'unknown'),
        },
        currentFileUri ? String(currentFileUri).split('/').pop() : 'unknown'
      );

      if (onUploadComplete) {
        onUploadComplete(normalizedResumed);
      }

      const successMessage = normalizedResumed.remoteUrl
        ? '文件续传成功'
        : '文件续传完成（等待服务端URL回填）';
      dispatch(showToast({ message: successMessage, type: 'success' }));
    } catch (error) {
      if (error?.isNetworkError || networkErrorService.isNetworkError(error)) {
        networkErrorService.handleFileUploadError(error, {
          context: '文件续传',
          customMessage: '网络连接失败，无法继续上传文件',
        });
      } else {
        Alert.alert('续传失败', getErrorMessage(error, '无法继续上传任务'));
      }
    } finally {
      resetUploadState({ keepSession: true });
    }
  };

  const handleCancelUpload = async () => {
    try {
      const cancelled = await chunkedUploadService.cancelUpload({
        sessionId: currentSessionId,
        localPath: currentFileUri,
        reason: 'user_cancelled',
      });

      if (!cancelled) {
        Alert.alert('提示', '没有可取消的上传任务');
        return;
      }

      resetUploadState();
      dispatch(showToast({ message: '上传已取消', type: 'success' }));
    } catch (error) {
      Alert.alert('取消失败', getErrorMessage(error, '无法取消上传任务'));
    }
  };

  // 上传文件到服务器
  const uploadFile = async (file) => {
    try {
      setIsUploading(true);
      loadingService.show('上传中...');

      // 调用文件服务上传文件
      setCurrentFileUri(file.uri);
      setIsPaused(false);

      const uploadResult = await fileService.uploadFile({
        uri: file.uri,
        name: file.name,
        type: file.type,
        size: file.size,
        onProgress: (progress) => {
          const percent = Math.round((Number(progress || 0)) * 100);
          loadingService.show(`上传中... ${percent}%`);
        },
      });

      if (uploadResult?.sessionId) {
        setCurrentSessionId(uploadResult.sessionId);
      }

      const normalizedResult = buildNormalizedResult(
        {
          ...uploadResult,
          strategy: uploadResult?.strategy || 'single',
          fileName: uploadResult?.fileName || file?.name || 'unknown',
        },
        file?.name || 'unknown'
      );

      // 上传成功回调
      if (onUploadComplete) {
        onUploadComplete(normalizedResult);
      }

      const successMessage = normalizedResult.remoteUrl
        ? '文件上传成功'
        : '文件上传完成（等待服务端URL回填）';
      dispatch(showToast({ message: successMessage, type: 'success' }));
      return uploadResult;
    } catch (error) {
      console.error('文件上传失败:', error);
      if (error?.cancelled || /cancel/i.test(String(error?.message || ''))) {
        dispatch(showToast({ message: '上传已取消', type: 'success' }));
      } else if (networkErrorService.isNetworkError(error)) {
        networkErrorService.handleFileUploadError(error, {
          context: '文件上传',
          customMessage: '网络连接失败，无法上传文件',
        });
      } else {
        Alert.alert('上传失败', getErrorMessage(error, '文件上传过程中出现错误'));
      }
      throw error;
    } finally {
      resetUploadState({ keepSession: true });
    }
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[styles.container, { backgroundColor: colors.primaryLight }]}
        onPress={handleFilePick}
        disabled={isUploading}
      >
        <Icon
          name='cloud-upload-outline'
          size={24}
          color={colors.primary}
        />
        <Text style={[styles.text, { color: colors.text }]}>
          {isUploading ? (isPaused ? '上传已暂停' : '上传中...') : '选择文件上传'}
        </Text>
      </TouchableOpacity>

      {isUploading && currentSessionId ? (
        <View style={styles.controlRow}>
          {!isPaused ? (
            <TouchableOpacity style={styles.controlBtn} onPress={handlePauseUpload}>
              <Text style={styles.controlText}>暂停</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.controlBtn} onPress={handleResumeUpload}>
              <Text style={styles.controlText}>继续</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.controlBtn, styles.cancelBtn]} onPress={handleCancelUpload}>
            <Text style={[styles.controlText, styles.cancelText]}>取消</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  text: {
    marginLeft: 8,
    fontSize: 16,
  },
  controlRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  controlBtn: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    backgroundColor: '#f7f7f7',
    marginHorizontal: 4,
  },
  controlText: {
    fontSize: 14,
    color: '#333',
  },
  cancelBtn: {
    borderColor: '#ef9a9a',
    backgroundColor: '#ffebee',
  },
  cancelText: {
    color: '#c62828',
  },
});

export default FileUploader;
