/**
 * 知识图谱边编辑屏幕
 * 用于创建和编辑知识图谱中的边（关系）
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { COLORS } from '../../utils/constants/colors';
import { Text } from 'react-native';

// 统一颜色键，避免直接使用常量大写键导致的 undefined
const colors = {
  background: COLORS.BACKGROUND,
  primary: COLORS.PRIMARY,
  error: COLORS.DANGER,
  warning: COLORS.WARNING,
  surface: COLORS.SURFACE,
  border: COLORS.BORDER,
  text: COLORS.TEXT_PRIMARY,
  textSecondary: COLORS.TEXT_SECONDARY,
};
import { Button, Card, Toast } from '../../components/common';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { EdgeEditor } from '../../components/knowledge';
import {
  fetchEdgeById,
  createEdge,
  updateEdge,
  deleteEdge,
  getAllNodes,
} from '../../redux/slices/knowledgeGraphSlice';
// 已移除 offlineStorageService 导入，现在直接使用 realmService
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';

const EdgeEditScreen = ({ route, navigation }) => {
  const { edgeId, sourceNodeId, targetNodeId } = route.params || {};
  // 使用静态颜色
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();

  // 从Redux获取状态
  const { currentEdge, nodes, loading, error } = useSelector(state => state.knowledgeGraph);

  // 本地状态
  const [edge, setEdge] = useState(null);
  const [isCreating] = useState(!edgeId);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isOffline] = useState(false); // 简化离线状态检查

  const handleGoBack = () => navigation.goBack();
  const goBackAfterDelay = () => setTimeout(handleGoBack, 1000);
  const openDeleteConfirm = () => setShowDeleteConfirm(true);
  const closeDeleteConfirm = () => setShowDeleteConfirm(false);
  const clearToastMessage = React.useCallback(() => setToastMessage(''), []);

  // 监听离线状态变化
  useEffect(() => {
    // 已移除 offlineStorageService 监听器，现在直接使用简化状态
    const unsubscribe = () => {}; // 空函数，保持接口兼容

    return () => unsubscribe();
  }, []);

  // 加载边数据
  // 显示Toast消息
  const showToast = React.useCallback((message, type = 'info') => {
    setToastMessage(message);
    setToastType(type);

    // 自动关闭
    setTimeout(() => {
      clearToastMessage();
    }, 3000);
  }, [clearToastMessage]);

  const loadEdgeData = React.useCallback(async () => {
    try {
      await dispatch(fetchEdgeById(edgeId)).unwrap();
    } catch (err) {
      showToast('加载边数据失败: ' + (err.message || '请稍后重试'), 'error');
    }
  }, [dispatch, edgeId, showToast]);

  useEffect(() => {
    if (edgeId) {
      loadEdgeData();
    } else {
      // 创建新边
      setEdge({
        source: sourceNodeId || '',
        target: targetNodeId || '',
        type: 'related',
        label: '',
        properties: {},
      });
    }

    // 加载所有节点
    if (nodes.length === 0) {
      dispatch(getAllNodes());
    }
  }, [dispatch, edgeId, loadEdgeData, nodes.length, sourceNodeId, targetNodeId]);

  // 当边数据加载完成后，初始化编辑状态
  useEffect(() => {
    if (currentEdge && !isCreating) {
      setEdge({ ...currentEdge });
    }
  }, [currentEdge, isCreating]);

  // 处理保存
  const handleSave = async () => {
    if (!edge) {return;}

    // 验证数据
    if (!edge.source) {
      showToast('请选择源节点', 'error');
      return;
    }

    if (!edge.target) {
      showToast('请选择目标节点', 'error');
      return;
    }

    if (!edge.type) {
      showToast('请选择关系类型', 'error');
      return;
    }

    try {
      if (isCreating) {
        await dispatch(createEdge(edge)).unwrap();
        showToast('创建成功', 'success');
      } else {
        await dispatch(updateEdge({ id: edgeId, edgeData: edge })).unwrap();
        showToast('保存成功', 'success');
      }

      // 返回上一页
      goBackAfterDelay();
    } catch (err) {
      showToast('保存失败: ' + (err.message || '请稍后重试'), 'error');
    }
  };

  // 处理删除
  const handleDelete = async () => {
    if (isCreating) {
      handleGoBack();
      return;
    }

    try {
      await dispatch(deleteEdge(edgeId)).unwrap();
      handleGoBack();
      showToast('关系已删除', 'success');
    } catch (err) {
      showToast('删除失败: ' + (err.message || '请稍后重试'), 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    closeDeleteConfirm();
    await handleDelete();
  };

  // 渲染加载状态
  if (loading && !edge && !isCreating) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            variant="body"
            size="medium"
            color="hint"
            style={styles.loadingText}
          >
            加载关系数据中...
          </Text>
        </View>
      </View>
    );
  }

  // 渲染错误状态
  if (error && !edge && !isCreating) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color={colors.error} />
          <Text
            variant="body"
            size="medium"
            color="error"
            style={styles.errorText}
          >
            {error}
          </Text>
          <Button
            title="重试"
            onPress={loadEdgeData}
            style={styles.retryButton}
          />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.pageHeader, { paddingTop: Math.max(insets.top, 8), borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.pageHeaderTopRow}>
          <ScreenHeaderBackButton
            onPress={handleGoBack}
            testID="action.edgeEdit.back"
            style={styles.backButton}
          />
          <Text variant="heading" level="h5" style={[styles.pageTitle, { color: colors.text }]}>
            {isCreating ? '创建关系' : '编辑关系'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      {/* 离线指示器 */}
      {isOffline && (
        <View style={[styles.offlineBar, { backgroundColor: colors.warning + '20' }]}>
          <Icon name="cloud-off" size={16} color={colors.warning} />
          <Text
            variant="caption"
            color="warning"
            style={styles.offlineText}
          >
            离线模式：部分功能可能不可用
          </Text>
        </View>
      )}

      <ScrollView style={styles.scrollView}>
        <Card style={styles.card}>
          {edge && (
            <EdgeEditor
              edge={edge}
              onChange={setEdge}
              nodes={nodes}
              isCreating={isCreating}
            />
          )}

          <View style={styles.cardActions}>
            <Button
              title="取消"
              type="outline"
              onPress={handleGoBack}
              style={styles.actionButton}
            />

            {!isCreating && (
              <Button
                title="删除"
                type="outline"
                icon="delete"
                onPress={openDeleteConfirm}
                style={[styles.actionButton, styles.deleteButton]}
                textColor="error"
                disabled={isOffline}
              />
            )}

            <Button
              title={isCreating ? '创建' : '保存'}
              onPress={handleSave}
              style={styles.actionButton}
              disabled={isOffline}
            />
          </View>
        </Card>
      </ScrollView>

      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={closeDeleteConfirm}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>删除关系</Text>
            <Text style={styles.modalMessage}>确定要删除此关系吗？此操作不可撤销。</Text>
            <View style={styles.modalActions}>
              <Button
                title="取消"
                type="outline"
                onPress={closeDeleteConfirm}
                style={styles.modalButton}
              />
              <Button
                title="删除"
                onPress={handleDeleteConfirm}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast消息 */}
      {toastMessage ? (
        <Toast
          message={toastMessage}
          onDismiss={clearToastMessage}
          type={toastType}
        />
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  pageHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
  },
  pageTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    justifyContent: 'center',
  },
  offlineText: {
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    padding: 16,
  },
  cardTitle: {
    marginBottom: 16,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  actionButton: {
    marginLeft: 8,
  },
  deleteButton: {
    borderColor: '#F44336',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    minWidth: 120,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  modalButton: {
    flex: 1,
  },
});

export default EdgeEditScreen;
