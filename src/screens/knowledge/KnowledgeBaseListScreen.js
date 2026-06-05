/**
 * 鐭ヨ瘑搴撳垪琛ㄥ睆骞? * @description 鏄剧ず鐢ㄦ埛鎷ユ湁鍜屽弬涓庣殑鐭ヨ瘑搴撳垪琛紝骞舵彁渚涘垱寤烘柊鐭ヨ瘑搴撶殑鍏ュ彛銆? */
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { EmptyState, Card } from '../../components/common';
import { SkeletonListCards } from '../../components/common/Skeleton';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import { UnifiedSearchBar } from '../../components/search';
import { SPACING, FONT_SIZES, BORDER_RADIUS, spacing } from '../../utils/constants/dimensions';
import { fetchKnowledgeBases, deleteKnowledgeBase } from '../../redux/slices/knowledgeBaseSlice';



const KnowledgeBaseListScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();

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

  const openActionMenu = (item) => {
    setActiveItem(item);
    setShowActionMenu(true);
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const closeActionMenu = () => {
    setShowActionMenu(false);
  };

  const openDeleteConfirm = () => {
    closeActionMenu();
    setShowDeleteConfirm(true);
  };

  const closeDeleteConfirm = () => {
    setShowDeleteConfirm(false);
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

  const openKnowledgeBaseDetail = (id) => {
    if (!id) {return;}
    navigation.navigate('KnowledgeBaseDetail', { id });
  };

  const openKnowledgeBaseEdit = (kbId) => {
    if (!kbId) {return;}
    navigation.navigate('KnowledgeBaseEdit', { kbId });
  };

  const handleOpenActiveItem = () => {
    closeActionMenu();
    openKnowledgeBaseDetail(activeItem?.id);
  };

  const handleEditActiveItem = () => {
    closeActionMenu();
    openKnowledgeBaseEdit(activeItem?.id);
  };

  const handleShareActiveItem = () => {
    closeActionMenu();
    if (activeItem) {
      handleShare(activeItem);
    }
  };

  const handleConfirmDeleteActiveItem = async () => {
    const item = activeItem;
    closeDeleteConfirm();
    if (item) {
      await handleDelete(item);
    }
  };

  const renderKnowledgeBaseCard = ({ item }) => (
    <Card style={[styles.kbCard, { borderColor: theme.colors.border }]} onLongPress={() => openActionMenu(item)}>
      <TouchableOpacity activeOpacity={0.8} onPress={() => openKnowledgeBaseDetail(item.id)}>
        <View style={styles.cardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: (item.color || theme.colors.primary) + '22' }]}>
            <Icon name={item.icon || 'menu-book'} size={20} color={item.color || theme.colors.primary} />
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
      {/* 椤堕儴瀵艰埅鏍忥紙缁熶竴杩斿洖鎸夐挳鏍峰紡锛?*/}
      <View style={[styles.headerBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.headerTopRow}>
          <ScreenHeaderBackButton
            onPress={handleGoBack}
            testID="action.knowledgeBaseList.back"
            style={styles.backButton}
          />
          <Text style={styles.headerTitle}>知识库</Text>
          <View style={styles.headerRight} />
        </View>
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
          ListEmptyComponent={<EmptyState message="还没有知识库，快创建一个吧" icon="menu-book" />}
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
        onRequestClose={closeActionMenu}
      >
        <TouchableOpacity
          style={styles.modalMask}
          activeOpacity={1}
          onPress={closeActionMenu}
        >
          <View style={styles.actionSheet}>
            <Text style={styles.actionSheetTitle}>{activeItem?.name || '请选择操作'}</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleOpenActiveItem}
            >
              <Text style={styles.actionButtonText}>打开</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleEditActiveItem}
            >
              <Text style={styles.actionButtonText}>编辑</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleShareActiveItem}
            >
              <Text style={styles.actionButtonText}>分享</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                openDeleteConfirm();
              }}
            >
              <Text style={styles.actionDangerText}>删除</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionCancel]}
              onPress={closeActionMenu}
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
        onRequestClose={closeDeleteConfirm}
      >
        <TouchableOpacity
          style={styles.modalMask}
          activeOpacity={1}
          onPress={closeDeleteConfirm}
        >
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmTitle}>删除知识库</Text>
            <Text style={styles.confirmMessage}>
              {`确定删除“${activeItem?.name || ''}”吗？此操作不可撤销。`}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmCancelButton]}
                onPress={closeDeleteConfirm}
              >
                <Text style={styles.actionButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmDeleteButton]}
                onPress={handleConfirmDeleteActiveItem}
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
    paddingHorizontal: SPACING.MEDIUM,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.primary + '1C',
    backgroundColor: theme.colors.card + 'E8',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
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
    paddingBottom: SPACING.XXLARGE,
  },
  kbCard: {
    marginBottom: spacing.medium,
    padding: spacing.medium,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.MEDIUM,
    backgroundColor: theme.colors.card + 'EE',
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    borderColor: theme.colors.primary + '20',
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
    borderTopColor: theme.colors.primary + '1A',
    paddingTop: spacing.medium,
    marginTop: spacing.medium,
    backgroundColor: theme.colors.background + '7A',
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
    backgroundColor: theme.colors.card + 'E5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary + '18',
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
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.onPrimary + '26',
  },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.32)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: theme.colors.card + 'F2',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.medium,
    borderTopWidth: 1,
    borderColor: theme.colors.primary + '26',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  actionSheetTitle: {
    fontSize: FONT_SIZES.medium,
    color: theme.colors.textSecondary,
    marginBottom: spacing.small,
  },
  actionButton: {
    paddingVertical: 13,
    borderRadius: 10,
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
    borderTopColor: theme.colors.primary + '1A',
    marginTop: 4,
  },
  confirmDialog: {
    margin: 24,
    padding: spacing.medium,
    borderRadius: 18,
    backgroundColor: theme.colors.card + 'F2',
    borderWidth: 1,
    borderColor: theme.colors.primary + '24',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 9,
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

