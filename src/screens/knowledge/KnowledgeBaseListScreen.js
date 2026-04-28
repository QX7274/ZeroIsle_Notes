/**
 * 知识库列表屏幕
 * @description 显示用户拥有和参与的知识库列表，并提供创建新知识库的入口。
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Share,
  ToastAndroid,
  Platform,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { EmptyState, Card } from '../../components/common';
import { SkeletonListCards } from '../../components/common/Skeleton';
import { UnifiedSearchBar } from '../../components/search';
import { SPACING, FONT_SIZES, BORDER_RADIUS, spacing } from '../../utils/constants/dimensions';
import { fetchKnowledgeBases, deleteKnowledgeBase } from '../../redux/slices/knowledgeBaseSlice';



const KnowledgeBaseListScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const dispatch = useDispatch();
  const { knowledgeBases, status } = useSelector((state) => state.knowledgeBase);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inlineHint, setInlineHint] = useState('');
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeItem, setActiveItem] = useState(null);

  const notifyNonBlocking = (message) => {
    if (!message) {
      return;
    }
    setInlineHint(message);
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };

  useEffect(() => {
    dispatch(fetchKnowledgeBases());
  }, [dispatch]);

  const handleShare = (item) => {
    try {
      Share.share({
        title: `分享知识库：${item.name}`,
        message: `${item.name}\n\n${item.description || ''}`.trim(),
      });
    } catch (e) {}
  };

  const handleDelete = async (item) => {
    if (!item?.id) {
      notifyNonBlocking('删除目标无效');
      return;
    }
    try {
      await dispatch(deleteKnowledgeBase(item.id)).unwrap();
      notifyNonBlocking('知识库已删除');
    } catch (err) {
      notifyNonBlocking(err?.message || '删除失败');
    }
  };

  const handleLongPress = (item) => {
    setActiveItem(item);
    setShowActionMenu(true);
  };

  const filteredKnowledgeBases = useMemo(() => {
    if (!searchQuery) {return knowledgeBases;}
    return knowledgeBases.filter(kb =>
      kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (kb.description && kb.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [knowledgeBases, searchQuery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    dispatch(fetchKnowledgeBases()).finally(() => setRefreshing(false));
  }, [dispatch]);

  const handleCreateNew = () => {
    navigation.navigate('KnowledgeBaseEdit');
  };

  const renderKnowledgeBaseCard = ({ item }) => (
    <Card style={[styles.kbCard, { borderColor: theme.colors.border }]} onLongPress={() => handleLongPress(item)}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('KnowledgeBaseDetail', { id: item.id })}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBadge, { backgroundColor: (item.color || theme.colors.primary) + '22' }]}>
            <Icon name={item.icon || 'auto-stories'} size={20} color={item.color || theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.kbTitle}>{item.name}</Text>
            {!!item.updatedAt && (
              <Text style={styles.kbSubTitle}>更新于 {new Date(item.updatedAt).toLocaleDateString()}</Text>
            )}
          </View>
          <Icon name="chevron-right" size={22} color={theme.colors.textSecondary} />
        </View>
        {!!item.description && <Text style={styles.kbDescription} numberOfLines={2}>{item.description}</Text>}
        <View style={styles.kbStatsContainer}>
          <View style={styles.statItem}>
            <Icon name="bubble-chart" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.statText}>{item.nodeCount ?? 0} 节点</Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="device-hub" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.statText}>{item.edgeCount ?? 0} 关系</Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="person" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.statText}>{item.memberCount ?? 1} 成员</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      {inlineHint ? <Text style={styles.hintText}>{inlineHint}</Text> : null}
      {/* 顶部导航栏（统一返回按钮样式） */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.colors.primary + '15' }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>知识库</Text>
        <View style={styles.headerRight} />
      </View>

      <UnifiedSearchBar
        placeholder="搜索知识库..."
        onSearch={setSearchQuery}
      />
      {status === 'loading' && !refreshing ? (
        <SkeletonListCards count={6} cardHeight={92} />
      ) : (
        <FlatList
          data={filteredKnowledgeBases}
          renderItem={renderKnowledgeBaseCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={<EmptyState message="还没有知识库，快创建一个吧！" icon="auto-stories" />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} tintColor={theme.colors.primary} />}
        />
      )}
      <TouchableOpacity style={styles.fab} onPress={handleCreateNew}>
        <Icon name="add" size={30} color={theme.colors.onPrimary} />
      </TouchableOpacity>

      <Modal
        transparent
        animationType="fade"
        visible={showActionMenu}
        onRequestClose={() => setShowActionMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalMask}
          activeOpacity={1}
          onPress={() => setShowActionMenu(false)}
        >
          <View style={styles.actionSheet}>
            <Text style={styles.actionSheetTitle}>{activeItem?.name || '请选择操作'}</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setShowActionMenu(false);
                if (activeItem?.id) {
                  navigation.navigate('KnowledgeBaseDetail', { id: activeItem.id });
                }
              }}
            >
              <Text style={styles.actionButtonText}>打开</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setShowActionMenu(false);
                if (activeItem?.id) {
                  navigation.navigate('KnowledgeBaseEdit', { kbId: activeItem.id });
                }
              }}
            >
              <Text style={styles.actionButtonText}>编辑</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setShowActionMenu(false);
                if (activeItem) {
                  handleShare(activeItem);
                }
              }}
            >
              <Text style={styles.actionButtonText}>分享</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setShowActionMenu(false);
                setShowDeleteConfirm(true);
              }}
            >
              <Text style={styles.actionDangerText}>删除</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionCancel]}
              onPress={() => setShowActionMenu(false)}
            >
              <Text style={styles.actionButtonText}>取消</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={showDeleteConfirm}
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <TouchableOpacity
          style={styles.modalMask}
          activeOpacity={1}
          onPress={() => setShowDeleteConfirm(false)}
        >
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmTitle}>删除知识库</Text>
            <Text style={styles.confirmMessage}>
              {`确定删除“${activeItem?.name || ''}”吗？此操作不可撤销。`}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmCancelButton]}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.actionButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmDeleteButton]}
                onPress={async () => {
                  const item = activeItem;
                  setShowDeleteConfirm(false);
                  if (item) {
                    await handleDelete(item);
                  }
                }}
              >
                <Text style={styles.confirmDeleteText}>删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  hintText: {
    marginHorizontal: SPACING.medium,
    marginTop: SPACING.small,
    color: theme.colors.warning || '#ff9800',
    fontSize: FONT_SIZES.small,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: 12,
    paddingTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: FONT_SIZES.large,
    color: theme.colors.text,
  },
  headerRight: {
    width: 40,
  },
  loader: {
    marginTop: spacing.large,
  },
  listContainer: {
    padding: spacing.medium,
  },
  kbCard: {
    marginBottom: spacing.medium,
    padding: spacing.medium,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.MEDIUM,
    backgroundColor: theme.colors.card,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderColor: theme.colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.medium,
    justifyContent: 'space-between',
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.small,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  kbTitle: {
    fontSize: FONT_SIZES.large,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: 0.3,
  },
  kbSubTitle: {
    marginTop: 4,
    fontSize: FONT_SIZES.small,
    color: theme.colors.textSecondary,
    fontWeight: '400',
  },
  kbDescription: {
    fontSize: FONT_SIZES.medium,
    color: theme.colors.textSecondary,
    marginBottom: spacing.medium,
    lineHeight: 22,
    fontWeight: '400',
  },
  kbStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: spacing.medium,
    marginTop: spacing.medium,
    backgroundColor: theme.colors.background + '30',
    marginHorizontal: -spacing.medium,
    marginBottom: -spacing.medium,
    paddingHorizontal: spacing.medium,
    paddingBottom: spacing.medium,
    borderBottomLeftRadius: BORDER_RADIUS.MEDIUM,
    borderBottomRightRadius: BORDER_RADIUS.MEDIUM,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.extraSmall,
    backgroundColor: theme.colors.card,
    borderRadius: 6,
    paddingHorizontal: spacing.small,
  },
  statText: {
    marginLeft: spacing.extraSmall,
    fontSize: FONT_SIZES.small,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    right: SPACING.LARGE,
    bottom: SPACING.LARGE,
    backgroundColor: theme.colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.medium,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  actionSheetTitle: {
    fontSize: FONT_SIZES.medium,
    color: theme.colors.textSecondary,
    marginBottom: spacing.small,
  },
  actionButton: {
    paddingVertical: 12,
  },
  actionButtonText: {
    fontSize: FONT_SIZES.medium,
    color: theme.colors.text,
    textAlign: 'center',
  },
  actionDangerText: {
    fontSize: FONT_SIZES.medium,
    color: theme.colors.error || '#f44336',
    textAlign: 'center',
  },
  actionCancel: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 4,
  },
  confirmDialog: {
    margin: 24,
    padding: spacing.medium,
    borderRadius: 14,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  confirmTitle: {
    fontSize: FONT_SIZES.large,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: FONT_SIZES.medium,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  confirmButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  confirmCancelButton: {
    marginRight: 6,
  },
  confirmDeleteButton: {
    backgroundColor: (theme.colors.error || '#f44336') + '22',
    borderRadius: 8,
  },
  confirmDeleteText: {
    fontSize: FONT_SIZES.medium,
    color: theme.colors.error || '#f44336',
    fontWeight: '600',
  },
});

export default KnowledgeBaseListScreen;

