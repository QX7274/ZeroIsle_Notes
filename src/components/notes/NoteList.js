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
    
    return (
      <Card
        style={[
          styles.noteCard,
          layout === 'grid' && styles.gridCard,
        ]}
        elevation="small"
        onPress={() => onNotePress && onNotePress(item)}
      >
        <View style={styles.noteContent}>
          <Text
            variant="body"
            size="large"
            bold
            style={styles.noteTitle}
            numberOfLines={2}
          >
            {item.title}
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
    padding: 16,
    paddingBottom: 80, // 为底部按钮留出空间
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteCard: {
    marginBottom: 12,
  },
  gridCard: {
    flex: 1,
    margin: 6,
  },
  noteContent: {
    flex: 1,
  },
  noteTitle: {
    marginBottom: 8,
  },
  noteExcerpt: {
    marginBottom: 12,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  noteMetadata: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  noteDate: {
    marginTop: 4,
  },
  noteActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    marginTop: 16,
  },
  footerContainer: {
    padding: 16,
    alignItems: 'center',
  },
});

export default NoteList;
