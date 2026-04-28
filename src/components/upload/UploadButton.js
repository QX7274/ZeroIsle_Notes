/**
 * 上传按钮组件
 * 提供数据上传功能的UI组件
 * Refactored with Design Tokens
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../context/ThemeContext'; // Use consistent ThemeContext
import uploadService from '../../services/upload';
import { networkService } from '../../services/network';
import { SPACING, RADIUS, ELEVATION, SIZE, BORDER } from '../../theme/tokens';

const UploadButton = ({
  collection,
  id,
  data,
  onSuccess,
  onError,
  style,
  buttonText = '上传',
  showQueue = true,
}) => {
  const { theme } = useTheme();
  // Ensure correct color references
  const colors = theme.colors || theme;

  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isOnline, setIsOnline] = useState(networkService.isOnline());

  // 监听网络状态变化
  useEffect(() => {
    const unsubscribe = networkService.addListener('network:change', (state) => {
      setIsOnline(state.isOnline);
    });

    // 加载上传队列
    loadUploadQueue();

    return () => {
      unsubscribe();
    };
  }, []);

  // 加载上传队列
  const loadUploadQueue = async () => {
    try {
      const queue = await uploadService.getUploadQueue();
      setUploadQueue(queue);
    } catch (error) {
      console.error('加载上传队列失败', error);
    }
  };

  const getErrorMessage = (error, fallbackMessage = '操作失败') => {
    const resolvedStatus = error?.status ?? error?.response?.status ?? null;

    if (error?.name === 'FileNotFoundError') {
      return error?.message || '文件不存在，请确认文件后重试';
    }

    if (error?.isNetworkError || (error?.request && !error?.response)) {
      return '网络连接异常，请检查网络后重试';
    }

    if (resolvedStatus === 401 || resolvedStatus === 403) {
      return '登录状态已失效，请重新登录后重试';
    }

    if (typeof resolvedStatus === 'number' && resolvedStatus >= 500) {
      return '服务器暂时不可用，请稍后重试';
    }

    return error?.message || fallbackMessage;
  };

  // 处理上传
  const handleUpload = async () => {
    if (!isOnline) {
      Alert.alert(
        '离线状态',
        '当前处于离线状态，数据将添加到上传队列，在网络恢复后自动上传。',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '添加到队列',
            onPress: async () => {
              try {
                const result = await uploadService.uploadData(collection, id, data, false);
                if (result.success) {
                  Alert.alert('成功', '数据已添加到上传队列');
                  await loadUploadQueue();
                  if (onSuccess) {onSuccess(result);}
                } else {
                  Alert.alert('错误', getErrorMessage(result, '添加到上传队列失败'));
                  if (onError) {onError(result);}
                }
              } catch (error) {
                Alert.alert('错误', getErrorMessage(error, '添加到上传队列失败'));
                if (onError) {onError({ success: false, error });}
              }
            },
          },
        ]
      );
      return;
    }

    setUploading(true);
    try {
      const result = await uploadService.uploadData(collection, id, data, true);
      if (result.success) {
        Alert.alert('成功', '数据上传成功');
        await loadUploadQueue();
        if (onSuccess) {onSuccess(result);}
      } else {
        Alert.alert('错误', getErrorMessage(result, '上传失败'));
        if (onError) {onError(result);}
      }
    } catch (error) {
      Alert.alert('错误', getErrorMessage(error, '上传失败'));
      if (onError) {onError({ success: false, error });}
    } finally {
      setUploading(false);
    }
  };

  // 处理上传队列
  const handleProcessQueue = async () => {
    if (!isOnline) {
      Alert.alert('离线状态', '当前处于离线状态，无法处理上传队列');
      return;
    }

    setUploading(true);
    try {
      const result = await uploadService.processUploadQueue();
      if (result.success) {
        Alert.alert('成功', `成功处理 ${result.succeeded} 项，失败 ${result.failed} 项`);
        await loadUploadQueue();
      } else {
        Alert.alert('错误', getErrorMessage(result, '处理上传队列失败'));
      }
    } catch (error) {
      Alert.alert('错误', getErrorMessage(error, '处理上传队列失败'));
    } finally {
      setUploading(false);
    }
  };

  // 移除队列项
  const handleRemoveQueueItem = async (id) => {
    try {
      await uploadService.removeFromUploadQueue(id);
      await loadUploadQueue();
    } catch (error) {
      Alert.alert('错误', getErrorMessage(error, '移除队列项失败'));
    }
  };

  // 渲染队列项
  const renderQueueItem = ({ item }) => (
    <View style={[styles.queueItem, { borderBottomColor: colors.border || '#eee' }]}>
      <View style={styles.queueItemInfo}>
        <Text style={[styles.queueItemTitle, { color: colors.text }]}>
          {item.type === 'file' ? '文件上传' : `${item.collection}/${item.recordId}`}
        </Text>
        <Text style={[styles.queueItemSubtitle, { color: colors.textSecondary }]}>
          {new Date(item.timestamp).toLocaleString()}
        </Text>
        <Text style={[
          styles.queueItemStatus,
          { color: item.status === 'failed' ? colors.error : colors.text },
        ]}>
          {item.status === 'failed' ? '失败' : '待处理'}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.queueItemRemove}
        onPress={() => handleRemoveQueueItem(item.id)}
      >
        <Icon name="close" size={SIZE.icon.sm} color={colors.text} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: colors.primary },
          uploading && styles.buttonDisabled,
        ]}
        onPress={handleUpload}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Icon name="cloud-upload" size={SIZE.icon.sm} color="#fff" style={styles.icon} />
            <Text style={styles.buttonText}>{buttonText}</Text>
          </>
        )}
      </TouchableOpacity>

      {showQueue && uploadQueue.length > 0 && (
        <TouchableOpacity
          style={styles.queueButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={[styles.queueButtonText, { color: colors.textSecondary || '#666' }]}>
            上传队列 ({uploadQueue.length})
          </Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.card || colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                上传队列
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={SIZE.icon.md} color={colors.text} />
              </TouchableOpacity>
            </View>

            {uploadQueue.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.text }]}>
                上传队列为空
              </Text>
            ) : (
              <FlatList
                data={uploadQueue}
                renderItem={renderQueueItem}
                keyExtractor={(item) => item.id}
                style={styles.queueList}
              />
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.primary },
                  (!isOnline || uploading) && styles.buttonDisabled,
                ]}
                onPress={handleProcessQueue}
                disabled={!isOnline || uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalButtonText}>处理队列</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    ...ELEVATION.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  icon: {
    marginRight: SPACING.sm,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  queueButton: {
    marginTop: SPACING.sm,
  },
  queueButtonText: {
    fontSize: 12,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '85%',
    maxHeight: '80%',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...ELEVATION.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginVertical: SPACING.xl,
  },
  queueList: {
    maxHeight: 300,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: BORDER.width.thin,
  },
  queueItemInfo: {
    flex: 1,
  },
  queueItemTitle: {
    fontWeight: 'bold',
  },
  queueItemSubtitle: {
    fontSize: 12,
  },
  queueItemStatus: {
    fontSize: 12,
  },
  queueItemRemove: {
    padding: SPACING.sm,
  },
  modalFooter: {
    marginTop: SPACING.md,
    alignItems: 'center',
  },
  modalButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    ...ELEVATION.sm,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default UploadButton;
