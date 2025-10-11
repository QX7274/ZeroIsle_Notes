/**
 * 分类编辑器组件
 * 用于创建和编辑分类的对话框
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Modal, Button, ColorPicker } from '../common';
import { Text } from '../common/Typography';
import { useTheme } from '../../context/ThemeContext';
import CategoryPicker from './CategoryPicker';

// 预设图标列表
const PRESET_ICONS = [
  'folder',
  'work',
  'school',
  'book',
  'code',
  'brush',
  'music-note',
  'sports',
  'favorite',
  'star',
  'lightbulb',
  'palette',
  'games',
  'restaurant',
  'flight',
  'home',
];

/**
 * 分类编辑器组件
 * @param {boolean} visible - 是否显示
 * @param {object} category - 要编辑的分类（创建时为null）
 * @param {Array} allCategories - 所有分类列表（用于选择父分类）
 * @param {Function} onSave - 保存回调
 * @param {Function} onCancel - 取消回调
 */
const CategoryEditor = ({
  visible,
  category = null,
  allCategories = [],
  onSave,
  onCancel,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const isEditing = !!category;
  
  // 确保 allCategories 是数组
  const validCategories = Array.isArray(allCategories) ? allCategories : [];

  // 表单状态
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(colors.primary);
  const [icon, setIcon] = useState('folder');
  const [parentId, setParentId] = useState(null);

  // UI状态
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showParentPicker, setShowParentPicker] = useState(false);

  // 当分类数据变化时更新表单
  useEffect(() => {
    if (category) {
      setName(category.name || '');
      setDescription(category.description || '');
      setColor(category.color || colors.primary);
      setIcon(category.icon || 'folder');
      setParentId(category.parent || null);
    } else {
      resetForm();
    }
  }, [category]);

  // 重置表单
  const resetForm = () => {
    setName('');
    setDescription('');
    setColor(colors.primary);
    setIcon('folder');
    setParentId(null);
  };

  // 验证表单
  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('提示', '请输入分类名称');
      return false;
    }
    // 检查是否与其他分类重名
    const duplicate = validCategories.find(
      (cat) =>
        cat.name === name.trim() &&
        (!isEditing || cat.id !== category.id)
    );
    if (duplicate) {
      Alert.alert('提示', '该分类名称已存在');
      return false;
    }
    return true;
  };

  // 处理保存
  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    const categoryData = {
      name: name.trim(),
      description: description.trim(),
      color,
      icon,
      parent: parentId,
    };

    if (isEditing) {
      categoryData.id = category.id;
    }

    onSave && onSave(categoryData);
    resetForm();
  };

  // 处理取消
  const handleCancel = () => {
    resetForm();
    onCancel && onCancel();
  };

  // 获取父分类名称
  const getParentName = () => {
    if (!parentId) return '无';
    const parent = validCategories.find((c) => c.id === parentId);
    return parent ? parent.name : '未知';
  };

  // 过滤掉当前分类及其子分类（编辑时不能选择自己作为父分类）
  const getAvailableParents = () => {
    if (!isEditing) return validCategories;
    
    const excludeIds = new Set([category.id]);
    const findChildren = (id) => {
      validCategories.forEach((cat) => {
        if (cat.parent === id) {
          excludeIds.add(cat.id);
          findChildren(cat.id);
        }
      });
    };
    findChildren(category.id);
    
    return validCategories.filter((cat) => !excludeIds.has(cat.id));
  };

  return (
    <Modal
      visible={visible}
      onClose={handleCancel}
      title={isEditing ? '编辑分类' : '新建分类'}
    >
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* 分类名称 */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>分类名称 *</Text>
          <TextInput
            style={styles.input}
            placeholder="请输入分类名称"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
            maxLength={100}
          />
        </View>

        {/* 分类描述 */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>分类描述</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="请输入分类描述（可选）"
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={500}
          />
        </View>

        {/* 图标选择 */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>分类图标</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowIconPicker(!showIconPicker)}
          >
            <Icon name={icon} size={24} color={color} />
            <Text style={styles.pickerButtonText}>选择图标</Text>
            <Icon name="chevron-right" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* 图标选择器 */}
          {showIconPicker && (
            <View style={styles.iconPicker}>
              {PRESET_ICONS.map((iconName) => (
                <TouchableOpacity
                  key={iconName}
                  style={[
                    styles.iconOption,
                    icon === iconName && styles.iconOptionSelected,
                  ]}
                  onPress={() => {
                    setIcon(iconName);
                    setShowIconPicker(false);
                  }}
                >
                  <Icon name={iconName} size={24} color={color} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* 颜色选择 */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>分类颜色</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowColorPicker(!showColorPicker)}
          >
            <View style={[styles.colorPreview, { backgroundColor: color }]} />
            <Text style={styles.pickerButtonText}>选择颜色</Text>
            <Icon name="chevron-right" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* 颜色选择器 */}
          {showColorPicker && (
            <ColorPicker
              selectedColor={color}
              onColorSelect={(selectedColor) => {
                setColor(selectedColor);
                setShowColorPicker(false);
              }}
            />
          )}
        </View>

        {/* 父分类选择 */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>父分类</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowParentPicker(true)}
          >
            <Text style={styles.pickerButtonText}>{getParentName()}</Text>
            <Icon name="chevron-right" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* 操作按钮 */}
        <View style={styles.actions}>
          <Button
            title="取消"
            onPress={handleCancel}
            variant="outline"
            style={styles.actionButton}
          />
          <Button
            title={isEditing ? '保存' : '创建'}
            onPress={handleSave}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>

      {/* 父分类选择器 */}
      <CategoryPicker
        visible={showParentPicker}
        categories={getAvailableParents()}
        selectedId={parentId}
        allowNone
        onSelect={(id) => {
          setParentId(id);
          setShowParentPicker(false);
        }}
        onCancel={() => setShowParentPicker(false)}
      />
    </Modal>
  );
};

const getStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    formGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.background,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    pickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.background,
    },
    pickerButtonText: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      marginLeft: 8,
    },
    colorPreview: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconPicker: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 12,
      padding: 8,
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconOption: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      margin: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    iconOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}20`,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 24,
      marginBottom: 16,
    },
    actionButton: {
      flex: 1,
      marginHorizontal: 4,
    },
  });

export default CategoryEditor;





