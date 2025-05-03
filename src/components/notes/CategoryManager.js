import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, Alert } from 'react-native';
import { categoryApi } from '../../services/api/categoryApi';
import Icon from 'react-native-vector-icons/MaterialIcons';

const CategoryManager = ({ onSelectCategory }) => {
  const [categories, setCategories] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);
  const [statistics, setStatistics] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [parentCategory, setParentCategory] = useState(null);

  useEffect(() => {
    loadCategories();
    loadCategoryTree();
    loadStatistics();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await categoryApi.getCategories();
      setCategories(response.data);
    } catch (error) {
      Alert.alert('错误', '加载分类失败');
    }
  };

  const loadCategoryTree = async () => {
    try {
      const response = await categoryApi.getCategoryTree();
      setCategoryTree(response.data);
    } catch (error) {
      Alert.alert('错误', '加载分类树失败');
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await categoryApi.getStatistics();
      setStatistics(response.data);
    } catch (error) {
      Alert.alert('错误', '加载统计信息失败');
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      Alert.alert('错误', '分类名称不能为空');
      return;
    }

    try {
      await categoryApi.createCategory({
        name: newCategoryName,
        parent: parentCategory
      });
      setNewCategoryName('');
      setParentCategory(null);
      setModalVisible(false);
      loadCategories();
      loadCategoryTree();
      Alert.alert('成功', '分类创建成功');
    } catch (error) {
      Alert.alert('错误', '创建分类失败');
    }
  };

  const handleDeleteCategory = async (category) => {
    Alert.alert(
      '确认删除',
      `确定要删除分类 "${category.name}" 吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          onPress: async () => {
            try {
              await categoryApi.deleteCategory(category.id);
              loadCategories();
              loadCategoryTree();
              Alert.alert('成功', '分类删除成功');
            } catch (error) {
              Alert.alert('错误', '删除分类失败');
            }
          }
        }
      ]
    );
  };

  const handleMoveNotes = async (category, noteIds) => {
    try {
      await categoryApi.moveNotes(category.id, noteIds);
      Alert.alert('成功', '笔记移动成功');
    } catch (error) {
      Alert.alert('错误', '移动笔记失败');
    }
  };

  const handleMergeCategories = async (sourceId, targetId) => {
    try {
      await categoryApi.mergeCategories(sourceId, targetId);
      loadCategories();
      loadCategoryTree();
      Alert.alert('成功', '分类合并成功');
    } catch (error) {
      Alert.alert('错误', '合并分类失败');
    }
  };

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      style={styles.categoryItem}
      onPress={() => onSelectCategory(item)}
    >
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryName}>{item.name}</Text>
        <Text style={styles.noteCount}>
          {statistics.find(s => s.category_id === item.id)?.note_count || 0} 条笔记
        </Text>
      </View>
      <View style={styles.categoryActions}>
        <TouchableOpacity
          onPress={() => {
            setSelectedCategory(item);
            setModalVisible(true);
          }}
        >
          <Icon name="edit" size={24} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteCategory(item)}>
          <Icon name="delete" size={24} color="#666" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>分类管理</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Icon name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
        renderItem={renderCategoryItem}
        keyExtractor={item => item.id.toString()}
        style={styles.list}
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedCategory ? '编辑分类' : '新建分类'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="输入分类名称"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleCreateCategory}
              >
                <Text style={styles.buttonText}>确认</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    marginBottom: 4,
  },
  noteCount: {
    fontSize: 12,
    color: '#666',
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelButton: {
    padding: 10,
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
  },
});

export default CategoryManager;
