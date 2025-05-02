/**
 * 笔记列表组件
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import { Card } from '../common';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { formatDate } from '../../utils/dateUtils';

/**
 * 笔记列表组件
 * @param {Array} notes - 笔记数组
 * @param {Function} onNotePress - 点击笔记回调
 * @param {Function} onEditPress - 点击编辑按钮回调
 * @param {Function} onDeletePress - 点击删除按钮回调
 * @param {Function} onRefresh - 下拉刷新回调
 * @param {boolean} refreshing - 是否正在刷新
 * @param {boolean} loading - 是否正在加载
 * @param {Function} onEndReached - 滚动到底部回调
 * @param {string} emptyText - 空列表提示文本
 * @param {string} layout - 布局方式：list, grid
 */
const NoteList = ({
  notes = [],
  onNotePress,
  onEditPress,
  onDeletePress,
  onRefresh,
  refreshing = false,
  loading = false,
  onEndReached,
  emptyText = '暂无笔记',
  layout = 'list',
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  // 渲染笔记项
  const renderNoteItem = ({ item }) => {
    // 提取标签和分类
    const tags = item.tags || [];
    const category = item.category || {};

    // 获取笔记类型图标
    const getNoteTypeIcon = () => {
      if (item.type === 'canvas') return 'gesture';

      switch (item.template) {
        case 'lined': return 'subject';
        case 'grid': return 'grid-on';
        case 'checklist': return 'check-box';
        case 'diary': return 'event-note';
        default: return 'description';
      }
    };

    // 获取笔记类型颜色
    const getNoteTypeColor = () => {
      if (item.type === 'canvas') return '#9C27B0'; // 紫色

      switch (item.template) {
        case 'lined': return '#2196F3'; // 蓝色
        case 'grid': return '#4CAF50'; // 绿色
        case 'checklist': return '#FF9800'; // 橙色
        case 'diary': return '#E91E63'; // 粉色
        default: return colors.primary;
      }
    };

    // 判断是否为离线笔记
    const isOfflineNote = item.isOffline || item.sync_status === 'pending';

    return (
      <Card
        style={[
          styles.noteCard,
          layout === 'grid' && styles.gridCard,
          item.pinned && styles.pinnedCard,
        ]}
        elevation="small"
        onPress={() => onNotePress && onNotePress(item)}
      >
        {item.pinned && (
          <View style={styles.pinnedBadge}>
            <Icon name="push-pin" size={16} color={colors.card} />
          </View>
        )}

        <View style={styles.noteTypeIndicator}>
          <View style={[styles.noteTypeIcon, { backgroundColor: getNoteTypeColor() }]}>
            <Icon name={getNoteTypeIcon()} size={16} color="#fff" />
          </View>
        </View>

        <View style={styles.noteContent}>
          <Text
            variant="body"
            size="large"
            bold
            style={styles.noteTitle}
            numberOfLines={2}
          >
            {item.title}
            {isOfflineNote && (
              <Text
                variant="body"
                size="small"
                color="hint"
              > (离线)</Text>
            )}
          </Text>

          {item.content && (
            <Text
              variant="body"
              size="medium"
              color="hint"
              style={styles.noteExcerpt}
              numberOfLines={layout === 'grid' ? 2 : 3}
            >
              {item.content}
            </Text>
          )}

          <View style={styles.noteFooter}>
            <View style={styles.noteMetadata}>
              {category.name && (
                <View style={[
                  styles.categoryBadge,
                  { backgroundColor: category.color || colors.primary }
                ]}>
                  <Text
                    variant="body"
                    size="small"
                    color="card"
                    numberOfLines={1}
                  >
                    {category.name}
                  </Text>
                </View>
              )}

              {tags.length > 0 && (
                <View style={styles.tagContainer}>
                  <Icon name="local-offer" size={14} color={colors.textHint} />
                  <Text
                    variant="body"
                    size="small"
                    color="hint"
                    numberOfLines={1}
                    style={styles.tagText}
                  >
                    {tags.length}
                  </Text>
                </View>
              )}

              <Text
                variant="body"
                size="small"
                color="hint"
                style={styles.noteDate}
              >
                {formatDate(item.updated_at || item.created_at)}
              </Text>
            </View>

            <View style={styles.noteActions}>
              {onEditPress && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => onEditPress(item)}
                >
                  <Icon name="edit" size={20} color={colors.primary} />
                </TouchableOpacity>
              )}

              {onDeletePress && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => onDeletePress(item)}
                >
                  <Icon name="delete" size={20} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Card>
    );
  };

  // 渲染空列表
  const renderEmptyList = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Icon
          name="note"
          size={64}
          color={colors.textDisabled}
        />
        <Text
          variant="body"
          size="large"
          color="hint"
          center
          style={styles.emptyText}
        >
          {emptyText}
        </Text>
      </View>
    );
  };

  // 渲染底部加载指示器
  const renderFooter = () => {
    if (!loading) return null;

    return (
      <View style={styles.footerContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  return (
    <FlatList
      data={notes}
      renderItem={renderNoteItem}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={[
        styles.listContainer,
        notes.length === 0 && styles.emptyListContainer,
      ]}
      ListEmptyComponent={renderEmptyList}
      ListFooterComponent={renderFooter}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        ) : undefined
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      numColumns={layout === 'grid' ? 2 : 1}
      key={layout} // 布局变化时重新渲染
    />
  );
};

const styles = StyleSheet.create({
  listContainer: {
    padding: 20,
    paddingBottom: 100, // 为底部按钮留出更多空间
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteCard: {
    marginBottom: 20,
    position: 'relative',
    overflow: 'visible',
    borderRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  gridCard: {
    flex: 1,
    margin: 10,
    minHeight: 220,
  },
  pinnedCard: {
    borderWidth: 2,
    borderColor: '#FFD700',
    elevation: 8,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  pinnedBadge: {
    position: 'absolute',
    top: -12,
    right: 12,
    backgroundColor: '#FFD700',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  noteTypeIndicator: {
    position: 'absolute',
    top: 12,
    left: -12,
    zIndex: 5,
  },
  noteTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  noteContent: {
    flex: 1,
    paddingLeft: 30, // 为类型图标留出更多空间
    paddingRight: 12,
    paddingVertical: 16,
  },
  noteTitle: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  noteExcerpt: {
    marginBottom: 16,
    lineHeight: 22,
    fontSize: 15,
    opacity: 0.8,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  noteMetadata: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  tagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  tagText: {
    marginLeft: 6,
    fontWeight: '500',
    fontSize: 13,
  },
  noteDate: {
    marginTop: 4,
    fontStyle: 'italic',
    fontSize: 13,
    opacity: 0.7,
  },
  noteActions: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 20,
    padding: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionButton: {
    padding: 10,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 50,
    flex: 1,
  },
  emptyText: {
    marginTop: 24,
    fontSize: 18,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 300,
  },
  footerContainer: {
    padding: 20,
    alignItems: 'center',
  },
});

export default NoteList;
