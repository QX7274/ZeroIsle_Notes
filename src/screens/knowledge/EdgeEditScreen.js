/**
 * 知识图谱边编辑屏幕
 * 用于创建和编辑知识图谱中的边（关系）
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { colors } from '../../utils/constants/colors';
import { Text } from 'react-native';
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
import { offlineStorageService } from '../../services/offline';

const EdgeEditScreen = ({ route, navigation }) => {
  const { edgeId, sourceNodeId, targetNodeId } = route.params || {};
  // 使用静态颜色
  const dispatch = useDispatch();

  // 从Redux获取状态
  const { currentEdge, nodes, loading, error } = useSelector(state => state.knowledgeGraph);

  // 本地状态
  const [edge, setEdge] = useState(null);
  const [isCreating, setIsCreating] = useState(!edgeId);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info');
  const [isOffline, setIsOffline] = useState(!offlineStorageService.getStatus().isOnline);

  // 监听离线状态变化
  useEffect(() => {
    const unsubscribe = offlineStorageService.addListener(event => {
      if (event.type === 'connectionChange') {
        setIsOffline(!event.isOnline);
      }
    });

    return () => unsubscribe();
  }, []);

  // 加载边数据
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
  }, [edgeId, sourceNodeId, targetNodeId]);

  // 当边数据加载完成后，初始化编辑状态
  useEffect(() => {
    if (currentEdge && !isCreating) {
      setEdge({ ...currentEdge });
    }
  }, [currentEdge, isCreating]);

  // 加载边数据
  const loadEdgeData = async () => {
    try {
      await dispatch(fetchEdgeById(edgeId)).unwrap();
    } catch (err) {
      showToast('加载边数据失败: ' + (err.message || '请稍后重试'), 'error');
    }
  };

  // 显示Toast消息
  const showToast = (message, type = 'info') => {
    setToastMessage(message);
    setToastType(type);

    // 自动关闭
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  // 处理保存
  const handleSave = async () => {
    if (!edge) return;

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
      setTimeout(() => {
        navigation.goBack();
      }, 1000);
    } catch (err) {
      showToast('保存失败: ' + (err.message || '请稍后重试'), 'error');
    }
  };

  // 处理删除
  const handleDelete = () => {
    if (isCreating) {
      navigation.goBack();
      return;
    }

    Alert.alert(
      '删除关系',
      '确定要删除此关系吗？此操作不可撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(deleteEdge(edgeId)).unwrap();
              navigation.goBack();
              showToast('关系已删除', 'success');
            } catch (err) {
              showToast('删除失败: ' + (err.message || '请稍后重试'), 'error');
            }
          },
        },
      ]
    );
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
          <Text
            variant="heading"
            level="h5"
            style={styles.cardTitle}
          >
            {isCreating ? '创建关系' : '编辑关系'}
          </Text>

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
              onPress={() => navigation.goBack()}
              style={styles.actionButton}
            />

            {!isCreating && (
              <Button
                title="删除"
                type="outline"
                icon="delete"
                onPress={handleDelete}
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

      {/* Toast消息 */}
      {toastMessage ? (
        <Toast
          message={toastMessage}
          onDismiss={() => setToastMessage('')}
          type={toastType}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});

export default EdgeEditScreen;
