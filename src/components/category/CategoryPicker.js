/**
 * 分类选择器组件
 * 用于选择分类的对话框
 */

import React, { useState } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Modal } from '../common';
import { Text } from '../common/Typography';
import { useTheme } from '../../context/ThemeContext';

/**
 * 分类选择器组件
 * @param {boolean} visible - 是否显示
 * @param {Array} categories - 分类列表
 * @param {string} selectedId - 选中的分类ID
 * @param {boolean} allowNone - 是否允许选择"无"
 * @param {Function} onSelect - 选择回调
 * @param {Function} onCancel - 取消回调
 */
const CategoryPicker = ({
  visible,
  categories = [],
  selectedId = null,
  allowNone = false,
  onSelect,
  onCancel,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  // 渲染单个分类项
  const renderCategoryItem = ({ item }) => {
    const isSelected = selectedId === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.categoryItem,
          isSelected && styles.categoryItemSelected,
        ]}
        onPress={() => onSelect && onSelect(item.id)}
      >
        {/* 分类图标 */}
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: `${item.color || colors.primary}20` },
          ]}
        >
          <Icon
            name={item.icon || 'folder'}
            size={20}
            color={item.color || colors.primary}
          />
        </View>

        {/* 分类信息 */}
        <View style={styles.infoContainer}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {item.description && (
            <Text style={styles.description} numberOfLines={1}>
              {item.description}
            </Text>
          )}
        </View>

        {/* 选中指示器 */}
        {isSelected && (
          <Icon name="check-circle" size={24} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  // 渲染"无"选项
  const renderNoneOption = () => {
    if (!allowNone) return null;

    const isSelected = selectedId === null;

    return (
      <TouchableOpacity
        style={[
          styles.categoryItem,
          isSelected && styles.categoryItemSelected,
          styles.noneOption,
        ]}
        onPress={() => onSelect && onSelect(null)}
      >
        <View style={[styles.iconContainer, { backgroundColor: colors.border }]}>
          <Icon name="block" size={20} color={colors.textSecondary} />
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.name}>无</Text>
          <Text style={styles.description}>不选择任何分类</Text>
        </View>

        {isSelected && (
          <Icon name="check-circle" size={24} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      onClose={onCancel}
      title="选择分类"
      maxHeight={500}
    >
      <View style={styles.container}>
        <FlatList
          data={categories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id || item._id}
          ListHeaderComponent={renderNoneOption}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </Modal>
  );
};

const getStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      maxHeight: 400,
    },
    listContent: {
      paddingVertical: 8,
    },
    categoryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      marginVertical: 4,
      backgroundColor: colors.background,
    },
    categoryItemSelected: {
      backgroundColor: colors.primaryLight,
    },
    noneOption: {
      marginBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 12,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    infoContainer: {
      flex: 1,
    },
    name: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 2,
    },
    description: {
      fontSize: 13,
      color: colors.textSecondary,
    },
  });

export default CategoryPicker;





