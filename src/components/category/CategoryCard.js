/**
 * 分类卡片组件
 * 显示单个分类的卡片视图
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Text } from '../common/Typography';
import { useTheme } from '../../context/ThemeContext';

/**
 * 分类卡片组件
 * @param {object} category - 分类数据
 * @param {Function} onPress - 点击回调
 * @param {Function} onLongPress - 长按回调
 * @param {Function} onEdit - 编辑回调
 * @param {Function} onDelete - 删除回调
 * @param {boolean} isSelected - 是否选中
 */
const CategoryCard = ({
  category,
  onPress,
  onLongPress,
  onEdit,
  onDelete,
  isSelected = false,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors, category.color, isSelected);

  // 获取分类的统计信息
  const noteCount = category.note_count || category.noteCount || 0;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress && onPress(category)}
      onLongPress={() => onLongPress && onLongPress(category)}
      activeOpacity={0.7}
    >
      {/* 分类图标和颜色条 */}
      <View style={styles.leftSection}>
        <View style={styles.iconContainer}>
          <Icon
            name={category.icon || 'folder'}
            size={24}
            color={category.color || colors.primary}
          />
        </View>
      </View>

      {/* 分类信息 */}
      <View style={styles.infoSection}>
        <Text style={styles.name} numberOfLines={1}>
          {category.name}
        </Text>
        {category.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {category.description}
          </Text>
        ) : null}
        <View style={styles.metaContainer}>
          <Icon name="note" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>{noteCount} 篇笔记</Text>
        </View>
      </View>

      {/* 操作按钮 */}
      <View style={styles.actionsSection}>
        {onEdit && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              onEdit(category);
            }}
          >
            <Icon name="edit" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              onDelete(category);
            }}
          >
            <Icon name="delete" size={20} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>

      {/* 选中指示器 */}
      {isSelected && <View style={styles.selectedIndicator} />}
    </TouchableOpacity>
  );
};

const getStyles = (colors, categoryColor, isSelected) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: isSelected ? colors.primaryLight : colors.card,
      borderRadius: 8,
      marginHorizontal: 16,
      marginVertical: 6,
      borderWidth: isSelected ? 2 : 1,
      borderColor: isSelected ? colors.primary : colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    leftSection: {
      marginRight: 12,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: categoryColor ? `${categoryColor}20` : `${colors.primary}20`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoSection: {
      flex: 1,
      marginRight: 8,
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 4,
      lineHeight: 18,
    },
    metaContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    metaText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginLeft: 4,
    },
    actionsSection: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionButton: {
      padding: 8,
      marginLeft: 4,
    },
    selectedIndicator: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: colors.primary,
      borderTopLeftRadius: 8,
      borderBottomLeftRadius: 8,
    },
  });

export default CategoryCard;





