/**
 * 分类管理界面
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from '../../utils/haptics';
import personalActivityApi from '../../services/api/personalActivityApi';

const CategoryManagerScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#4CAF50',
    icon: 'label',
  });

  const colorOptions = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  ];

  const iconOptions = [
    'work', 'school', 'fitness-center', 'sports',
    'people', 'home', 'favorite', 'label',
  ];

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await personalActivityApi.getCategories();
      const data = response?.data;

      if (Array.isArray(data)) {
        setCategories(data);
      } else if (data && typeof data === 'object') {
        const categoriesArray = Array.isArray(data.categories) ? data.categories : [];
        setCategories(categoriesArray);
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      Alert.alert('错误', '加载分类失败，请稍后重试');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!formData.name.trim()) {
      Alert.alert('错误', '分类名称不能为空');
      return;
    }

    try {
      if (editingCategory) {
        await personalActivityApi.updateCategory(editingCategory._id, formData);
        Alert.alert('成功', '分类更新成功');
      } else {
        await personalActivityApi.createCategory(formData);
        Alert.alert('成功', '分类创建成功');
      }

      setModalVisible(false);
      setEditingCategory(null);
      setFormData({ name: '', description: '', color: '#4CAF50', icon: 'label' });
      loadCategories();
    } catch (error) {
      Alert.alert('错误', editingCategory ? '更新分类失败' : '创建分类失败');
    }
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color,
      icon: category.icon,
    });
    setModalVisible(true);
  };

  const handleDeleteCategory = (category) => {
    if (category.is_system) {
      Alert.alert('提示', '系统分类不能删除');
      return;
    }

    Alert.alert(
      '确认删除',
      `确定要删除分类"${category.name}"吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await personalActivityApi.deleteCategory(category._id);
              Alert.alert('成功', '分类删除成功');
              loadCategories();
            } catch (error) {
              Alert.alert('错误', '删除分类失败');
            }
          },
        },
      ]
    );
  };

  const renderCategoryItem = (category) => {
    if (!category || !category._id) {
      return null;
    }

    return (
      <View key={category._id} style={[styles.categoryItem, { backgroundColor: colors.card }]}>
        <View style={styles.categoryInfo}>
          <View style={[styles.categoryIcon, { backgroundColor: (category.color || '#4CAF50') + '20' }]}>
            <Icon name={category.icon || 'label'} size={20} color={category.color || '#4CAF50'} />
          </View>
          <View style={styles.categoryText}>
            <Text variant="body" style={styles.categoryName}>{category.name || '未命名'}</Text>
            <Text variant="caption" style={styles.categoryDesc}>
              {category.description || '无描述'}
            </Text>
            <Text variant="caption" style={styles.categoryStats}>
              {category.activity_count || 0} 个活动
            </Text>
          </View>
        </View>
        <View style={styles.categoryActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditCategory(category)}
          >
            <Icon name="edit" size={20} color={colors.primary} />
          </TouchableOpacity>
          {!category.is_system && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteCategory(category)}
            >
              <Icon name="delete" size={20} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderColorPicker = () => (
    <View style={styles.colorPicker}>
      <Text variant="body" style={styles.formLabel}>颜色</Text>
      <View style={styles.colorOptions}>
        {colorOptions.map(color => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorOption,
              { backgroundColor: color },
              formData.color === color && styles.selectedColor,
            ]}
            onPress={() => setFormData({ ...formData, color })}
          />
        ))}
      </View>
    </View>
  );

  const renderIconPicker = () => (
    <View style={styles.iconPicker}>
      <Text variant="body" style={styles.formLabel}>图标</Text>
      <View style={styles.iconOptions}>
        {iconOptions.map(icon => (
          <TouchableOpacity
            key={icon}
            style={[
              styles.iconOption,
              { backgroundColor: colors.card },
              formData.icon === icon && { backgroundColor: colors.primary + '20' },
            ]}
            onPress={() => setFormData({ ...formData, icon })}
          >
            <Icon name={icon} size={24} color={formData.icon === icon ? colors.primary : colors.text} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text variant="h2" style={styles.headerTitle}>分类管理</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setEditingCategory(null);
            setFormData({ name: '', description: '', color: '#4CAF50', icon: 'label' });
            setModalVisible(true);
          }}
        >
          <Icon name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* 分类列表 */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {Array.isArray(categories) && categories.length > 0 ? (
          categories.map(renderCategoryItem)
        ) : (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
            <Icon name="folder-open" size={48} color={colors.textSecondary} />
            <Text variant="body" style={{ marginTop: 16, color: colors.textSecondary }}>暂无分类</Text>
          </View>
        )}
      </ScrollView>

      {/* 编辑模态框 */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={[styles.modalButton, { color: colors.text }]}>取消</Text>
            </TouchableOpacity>
            <Text variant="h3" style={styles.modalTitle}>
              {editingCategory ? '编辑分类' : '新建分类'}
            </Text>
            <TouchableOpacity onPress={handleSaveCategory}>
              <Text style={[styles.modalButton, { color: colors.primary }]}>保存</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text variant="body" style={styles.formLabel}>名称 *</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.card, color: colors.text }]}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="输入分类名称"
                placeholderTextColor={colors.text + '60'}
              />
            </View>

            <View style={styles.formGroup}>
              <Text variant="body" style={styles.formLabel}>描述</Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { backgroundColor: colors.card, color: colors.text }]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="输入分类描述"
                placeholderTextColor={colors.text + '60'}
                multiline
                numberOfLines={3}
              />
            </View>

            {renderColorPicker()}
            {renderIconPicker()}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  addButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryText: {
    flex: 1,
  },
  categoryName: {
    fontWeight: '600',
    marginBottom: 4,
  },
  categoryDesc: {
    opacity: 0.7,
    marginBottom: 2,
  },
  categoryStats: {
    opacity: 0.5,
    fontSize: 12,
  },
  categoryActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontWeight: '600',
  },
  modalButton: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    marginBottom: 8,
    fontWeight: '500',
  },
  textInput: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  colorPicker: {
    marginBottom: 20,
  },
  colorOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#000',
  },
  iconPicker: {
    marginBottom: 20,
  },
  iconOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  iconOption: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CategoryManagerScreen;
