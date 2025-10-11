/**
 * 分类树组件
 * 显示分类的树形结构视图
 */

import React, { useState } from 'react';
import { View, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Text } from '../common/Typography';
import { useTheme } from '../../context/ThemeContext';

/**
 * 树形节点组件
 */
const TreeNode = ({
  node,
  level = 0,
  onPress,
  onLongPress,
  onEdit,
  onDelete,
  selectedId,
}) => {
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  const styles = getNodeStyles(colors, level, isSelected);

  return (
    <View>
      {/* 节点本身 */}
      <TouchableOpacity
        style={styles.nodeContainer}
        onPress={() => onPress && onPress(node)}
        onLongPress={() => onLongPress && onLongPress(node)}
        activeOpacity={0.7}
      >
        {/* 缩进 */}
        <View style={styles.indent}>
          {level > 0 && <View style={styles.indentLine} />}
        </View>

        {/* 展开/折叠图标 */}
        {hasChildren ? (
          <TouchableOpacity
            style={styles.expandButton}
            onPress={() => setIsExpanded(!isExpanded)}
          >
            <Icon
              name={isExpanded ? 'expand-more' : 'chevron-right'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.expandPlaceholder} />
        )}

        {/* 分类图标 */}
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: `${node.color || colors.primary}20` },
          ]}
        >
          <Icon
            name={node.icon || 'folder'}
            size={20}
            color={node.color || colors.primary}
          />
        </View>

        {/* 分类名称和信息 */}
        <View style={styles.infoContainer}>
          <Text style={styles.name} numberOfLines={1}>
            {node.name}
          </Text>
          <Text style={styles.count}>
            {node.note_count || node.noteCount || 0} 篇
          </Text>
        </View>

        {/* 操作按钮 */}
        <View style={styles.actionsContainer}>
          {onEdit && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                onEdit(node);
              }}
            >
              <Icon name="edit" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                onDelete(node);
              }}
            >
              <Icon name="delete" size={18} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {/* 子节点 */}
      {hasChildren && isExpanded && (
        <View>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onPress={onPress}
              onLongPress={onLongPress}
              onEdit={onEdit}
              onDelete={onDelete}
              selectedId={selectedId}
            />
          ))}
        </View>
      )}
    </View>
  );
};

/**
 * 分类树组件
 * @param {Array} tree - 分类树数据
 * @param {Function} onCategoryPress - 分类点击回调
 * @param {Function} onCategoryLongPress - 分类长按回调
 * @param {Function} onEditCategory - 编辑分类回调
 * @param {Function} onDeleteCategory - 删除分类回调
 * @param {string} selectedCategoryId - 选中的分类ID
 */
const CategoryTree = ({
  tree = [],
  onCategoryPress,
  onCategoryLongPress,
  onEditCategory,
  onDeleteCategory,
  selectedCategoryId = null,
}) => {
  // 确保 tree 是数组
  const validTree = Array.isArray(tree) ? tree : [];
  
  return (
    <View style={styles.container}>
      <FlatList
        data={validTree}
        renderItem={({ item }) => (
          <TreeNode
            node={item}
            level={0}
            onPress={onCategoryPress}
            onLongPress={onCategoryLongPress}
            onEdit={onEditCategory}
            onDelete={onDeleteCategory}
            selectedId={selectedCategoryId}
          />
        )}
        keyExtractor={(item) => item.id || item._id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
});

const getNodeStyles = (colors, level, isSelected) =>
  StyleSheet.create({
    nodeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingRight: 16,
      backgroundColor: isSelected ? colors.primaryLight : 'transparent',
      borderLeftWidth: isSelected ? 3 : 0,
      borderLeftColor: colors.primary,
    },
    indent: {
      width: level * 20,
      flexDirection: 'row',
    },
    indentLine: {
      width: 1,
      backgroundColor: colors.border,
      marginLeft: 10,
    },
    expandButton: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 4,
    },
    expandPlaceholder: {
      width: 24,
      marginRight: 4,
    },
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    infoContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    name: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    count: {
      fontSize: 13,
      color: colors.textSecondary,
      marginLeft: 8,
    },
    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 8,
    },
    actionButton: {
      padding: 6,
      marginLeft: 4,
    },
  });

export default CategoryTree;





