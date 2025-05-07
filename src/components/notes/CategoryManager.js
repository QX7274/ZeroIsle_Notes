import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, Alert, ActivityIndicator, Switch } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { categoryApi } from '../../services/api/categoryApi';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';

const CategoryManager = ({ onSelectCategory }) => {
  const [categories, setCategories] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);
  const [statistics, setStatistics] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [parentCategory, setParentCategory] = useState(null);
  const [isAutoCategorizing, setIsAutoCategorizing] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [suggestionModalVisible, setSuggestionModalVisible] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState([]);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [statisticsModalVisible, setStatisticsModalVisible] = useState(false);
  const [statisticsData, setStatisticsData] = useState({
    totalNotes: 0,
    uncategorizedNotes: 0,
    categoryDistribution: [],
    recentActivity: [],
  });
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOptions, setFilterOptions] = useState({
    sortBy: 'name',
    sortOrder: 'asc',
    showEmpty: true,
  });
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [importData, setImportData] = useState('');
  const [importStatus, setImportStatus] = useState({
    loading: false,
    error: null,
    success: false,
  });
  const [exportStatus, setExportStatus] = useState({
    loading: false,
    error: null,
    success: false,
  });
  const [tags, setTags] = useState([]);
  const [selectedCategoryTags, setSelectedCategoryTags] = useState([]);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [permissions, setPermissions] = useState({
    canView: true,
    canEdit: true,
    canDelete: true,
    canManageMembers: true,
  });
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [memberModalVisible, setMemberModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');

  useEffect(() => {
    loadCategories();
    loadCategoryTree();
    loadStatistics();
    loadTags();
    loadRoles();
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
      setStatisticsData(response.data);
    } catch (error) {
      Alert.alert('错误', '加载统计信息失败');
    }
  };

  const loadTags = async () => {
    try {
      const response = await categoryApi.getAllTags();
      setTags(response.data);
    } catch (error) {
      Alert.alert('错误', '加载标签失败');
    }
  };

  const loadRoles = async () => {
    try {
      const response = await categoryApi.getAvailableRoles();
      setRoles(response.data);
    } catch (error) {
      Alert.alert('错误', '加载角色列表失败');
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

  const handleAutoCategorize = async () => {
    setIsAutoCategorizing(true);
    try {
      const response = await categoryApi.autoCategorize();
      if (response.data.success) {
        Alert.alert('成功', '自动分类完成');
        loadCategories();
        loadCategoryTree();
        loadStatistics();
      } else {
        Alert.alert('提示', response.data.message || '自动分类未完成');
      }
    } catch (error) {
      Alert.alert('错误', '自动分类失败');
    } finally {
      setIsAutoCategorizing(false);
    }
  };

  const handleGetSuggestions = async (noteId) => {
    try {
      const response = await categoryApi.getSmartSuggestions(noteId);
      setSuggestions(response.data.suggestions);
      setSelectedNote(noteId);
      setSuggestionModalVisible(true);
    } catch (error) {
      Alert.alert('错误', '获取分类建议失败');
    }
  };

  const handleApplySuggestion = async (categoryId) => {
    try {
      await categoryApi.moveNotes(categoryId, [selectedNote]);
      setSuggestionModalVisible(false);
      loadCategories();
      loadCategoryTree();
      loadStatistics();
      Alert.alert('成功', '应用分类建议成功');
    } catch (error) {
      Alert.alert('错误', '应用分类建议失败');
    }
  };

  const handleToggleBatchMode = () => {
    setIsBatchMode(!isBatchMode);
    if (!isBatchMode) {
      setSelectedNotes([]);
    }
  };

  const handleSelectNote = (noteId) => {
    if (isBatchMode) {
      setSelectedNotes(prev => {
        if (prev.includes(noteId)) {
          return prev.filter(id => id !== noteId);
        } else {
          return [...prev, noteId];
        }
      });
    }
  };

  const handleBatchCategorize = async (categoryId) => {
    if (selectedNotes.length === 0) {
      Alert.alert('提示', '请选择要分类的笔记');
      return;
    }

    try {
      await categoryApi.batchCategorize(selectedNotes, categoryId);
      setBatchModalVisible(false);
      setIsBatchMode(false);
      setSelectedNotes([]);
      loadCategories();
      loadCategoryTree();
      loadStatistics();
      Alert.alert('成功', '批量分类成功');
    } catch (error) {
      Alert.alert('错误', '批量分类失败');
    }
  };

  const handleExportCategories = async () => {
    setExportStatus({ loading: true, error: null, success: false });
    try {
      const response = await categoryApi.exportCategories();
      // 处理导出文件
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'categories_export.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportStatus({ loading: false, error: null, success: true });
      Alert.alert('成功', '分类导出成功');
    } catch (error) {
      setExportStatus({ loading: false, error: error.message, success: false });
      Alert.alert('错误', '分类导出失败');
    }
  };

  const handleImportCategories = async () => {
    if (!importData.trim()) {
      Alert.alert('错误', '请输入要导入的分类数据');
      return;
    }

    setImportStatus({ loading: true, error: null, success: false });
    try {
      // 验证导入数据
      const validationResponse = await categoryApi.validateImportData(JSON.parse(importData));
      if (!validationResponse.data.valid) {
        throw new Error(validationResponse.data.message || '导入数据验证失败');
      }

      // 执行导入
      await categoryApi.importCategories(JSON.parse(importData));
      setImportStatus({ loading: false, error: null, success: true });
      setImportData('');
      setImportModalVisible(false);
      loadCategories();
      loadCategoryTree();
      loadStatistics();
      Alert.alert('成功', '分类导入成功');
    } catch (error) {
      setImportStatus({ loading: false, error: error.message, success: false });
      Alert.alert('错误', '分类导入失败');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await categoryApi.getImportTemplate();
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'categories_template.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      Alert.alert('错误', '下载模板失败');
    }
  };

  const handleShowTags = async (category) => {
    setSelectedCategory(category);
    try {
      const response = await categoryApi.getCategoryTags(category.id);
      setSelectedCategoryTags(response.data);
      setTagModalVisible(true);
    } catch (error) {
      Alert.alert('错误', '加载分类标签失败');
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) {
      Alert.alert('错误', '标签不能为空');
      return;
    }

    try {
      await categoryApi.addCategoryTag(selectedCategory.id, newTag.trim());
      const response = await categoryApi.getCategoryTags(selectedCategory.id);
      setSelectedCategoryTags(response.data);
      setNewTag('');
      loadTags();
    } catch (error) {
      Alert.alert('错误', '添加标签失败');
    }
  };

  const handleDeleteTag = async (tagId) => {
    try {
      await categoryApi.deleteCategoryTag(selectedCategory.id, tagId);
      const response = await categoryApi.getCategoryTags(selectedCategory.id);
      setSelectedCategoryTags(response.data);
      loadTags();
    } catch (error) {
      Alert.alert('错误', '删除标签失败');
    }
  };

  const handleUpdateTag = async (tagId, newTagName) => {
    try {
      await categoryApi.updateCategoryTag(selectedCategory.id, tagId, newTagName);
      const response = await categoryApi.getCategoryTags(selectedCategory.id);
      setSelectedCategoryTags(response.data);
      loadTags();
    } catch (error) {
      Alert.alert('错误', '更新标签失败');
    }
  };

  const handleShowPermissions = async (category) => {
    setSelectedCategory(category);
    try {
      const response = await categoryApi.getCategoryPermissions(category.id);
      setPermissions(response.data);
      setPermissionModalVisible(true);
    } catch (error) {
      Alert.alert('错误', '加载权限设置失败');
    }
  };

  const handleUpdatePermissions = async () => {
    try {
      await categoryApi.updateCategoryPermissions(selectedCategory.id, permissions);
      setPermissionModalVisible(false);
      Alert.alert('成功', '权限更新成功');
    } catch (error) {
      Alert.alert('错误', '更新权限失败');
    }
  };

  const handleShowMembers = async (category) => {
    setSelectedCategory(category);
    try {
      const response = await categoryApi.getCategoryMembers(category.id);
      setMembers(response.data);
      setMemberModalVisible(true);
    } catch (error) {
      Alert.alert('错误', '加载成员列表失败');
    }
  };

  const handleAddMember = async () => {
    if (!selectedUser || !selectedRole) {
      Alert.alert('错误', '请选择用户和角色');
      return;
    }

    try {
      await categoryApi.addCategoryMember(selectedCategory.id, selectedUser.id, selectedRole);
      const response = await categoryApi.getCategoryMembers(selectedCategory.id);
      setMembers(response.data);
      setSelectedUser(null);
      setSelectedRole('');
    } catch (error) {
      Alert.alert('错误', '添加成员失败');
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await categoryApi.removeCategoryMember(selectedCategory.id, userId);
      const response = await categoryApi.getCategoryMembers(selectedCategory.id);
      setMembers(response.data);
    } catch (error) {
      Alert.alert('错误', '移除成员失败');
    }
  };

  const handleUpdateMemberRole = async (userId, newRole) => {
    try {
      await categoryApi.updateCategoryMemberRole(selectedCategory.id, userId, newRole);
      const response = await categoryApi.getCategoryMembers(selectedCategory.id);
      setMembers(response.data);
    } catch (error) {
      Alert.alert('错误', '更新成员角色失败');
    }
  };

  const filteredCategories = categories
    .filter(category => {
      const matchesSearch = category.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesEmptyFilter = filterOptions.showEmpty ||
        (statistics.find(s => s.category_id === category.id)?.note_count || 0) > 0;
      return matchesSearch && matchesEmptyFilter;
    })
    .sort((a, b) => {
      const aCount = statistics.find(s => s.category_id === a.id)?.note_count || 0;
      const bCount = statistics.find(s => s.category_id === b.id)?.note_count || 0;

      if (filterOptions.sortBy === 'name') {
        return filterOptions.sortOrder === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else {
        return filterOptions.sortOrder === 'asc'
          ? aCount - bCount
          : bCount - aCount;
      }
    });

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.categoryItem, { backgroundColor: theme.colors.background }]}
      onPress={() => onSelectCategory(item)}
    >
      <View style={styles.categoryInfo}>
        <Text style={[styles.categoryName, { color: theme.colors.text }]}>
          {item.name}
        </Text>
        <Text style={[styles.noteCount, { color: theme.colors.secondary }]}>
          {statistics.find(s => s.category_id === item.id)?.note_count || 0} 条笔记
        </Text>
      </View>
      <View style={styles.categoryActions}>
        <TouchableOpacity onPress={() => handleShowPermissions(item)}>
          <Icon name="security" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleShowMembers(item)}>
          <Icon name="people" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleShowTags(item)}>
          <Icon name="local-offer" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setSelectedCategory(item);
            setModalVisible(true);
          }}
        >
          <Icon name="edit" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteCategory(item)}>
          <Icon name="delete" size={24} color={theme.colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderSuggestionModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={suggestionModalVisible}
      onRequestClose={() => setSuggestionModalVisible(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            智能分类建议
          </Text>
          <FlatList
            data={suggestions}
            keyExtractor={item => item.category_id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.suggestionItem, {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border
                }]}
                onPress={() => handleApplySuggestion(item.category_id)}
              >
                <Text style={[styles.suggestionName, { color: theme.colors.text }]}>
                  {item.category_name}
                </Text>
                <Text style={[styles.suggestionConfidence, { color: theme.colors.secondary }]}>
                  匹配度: {(item.confidence * 100).toFixed(1)}%
                </Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: theme.colors.error }]}
            onPress={() => setSuggestionModalVisible(false)}
          >
            <Text style={styles.buttonText}>关闭</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderBatchActions = () => (
    <View style={styles.batchActions}>
      <Text style={[styles.batchCount, { color: theme.colors.text }]}>
        已选择 {selectedNotes.length} 条笔记
      </Text>
      <TouchableOpacity
        style={[styles.batchButton, { backgroundColor: theme.colors.primary }]}
        onPress={() => setBatchModalVisible(true)}
        disabled={selectedNotes.length === 0}
      >
        <Text style={styles.buttonText}>批量分类</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBatchModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={batchModalVisible}
      onRequestClose={() => setBatchModalVisible(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            选择目标分类
          </Text>
          <FlatList
            data={categories}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.categoryItem, {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border
                }]}
                onPress={() => handleBatchCategorize(item.id)}
              >
                <Text style={[styles.categoryName, { color: theme.colors.text }]}>
                  {item.name}
                </Text>
                <Text style={[styles.noteCount, { color: theme.colors.secondary }]}>
                  {statistics.find(s => s.category_id === item.id)?.note_count || 0} 条笔记
                </Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: theme.colors.error }]}
            onPress={() => setBatchModalVisible(false)}
          >
            <Text style={styles.buttonText}>取消</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderStatisticsModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={statisticsModalVisible}
      onRequestClose={() => setStatisticsModalVisible(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            分类统计
          </Text>

          <View style={styles.statisticsSection}>
            <Text style={[styles.statisticsTitle, { color: theme.colors.text }]}>
              总体统计
            </Text>
            <View style={styles.statisticsRow}>
              <Text style={[styles.statisticsLabel, { color: theme.colors.text }]}>
                总笔记数:
              </Text>
              <Text style={[styles.statisticsValue, { color: theme.colors.primary }]}>
                {statisticsData.totalNotes}
              </Text>
            </View>
            <View style={styles.statisticsRow}>
              <Text style={[styles.statisticsLabel, { color: theme.colors.text }]}>
                未分类笔记:
              </Text>
              <Text style={[styles.statisticsValue, { color: theme.colors.error }]}>
                {statisticsData.uncategorizedNotes}
              </Text>
            </View>
          </View>

          <View style={styles.statisticsSection}>
            <Text style={[styles.statisticsTitle, { color: theme.colors.text }]}>
              分类分布
            </Text>
            <FlatList
              data={statisticsData.categoryDistribution}
              keyExtractor={item => item.category_id.toString()}
              renderItem={({ item }) => (
                <View style={styles.distributionItem}>
                  <View style={styles.distributionInfo}>
                    <Text style={[styles.distributionName, { color: theme.colors.text }]}>
                      {item.category_name}
                    </Text>
                    <Text style={[styles.distributionCount, { color: theme.colors.secondary }]}>
                      {item.note_count} 条笔记
                    </Text>
                  </View>
                  <View style={styles.distributionBar}>
                    <View
                      style={[
                        styles.distributionProgress,
                        {
                          width: `${(item.note_count / statisticsData.totalNotes) * 100}%`,
                          backgroundColor: theme.colors.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
              )}
            />
          </View>

          <View style={styles.statisticsSection}>
            <Text style={[styles.statisticsTitle, { color: theme.colors.text }]}>
              最近活动
            </Text>
            <FlatList
              data={statisticsData.recentActivity}
              keyExtractor={item => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.activityItem}>
                  <Text style={[styles.activityText, { color: theme.colors.text }]}>
                    {item.description}
                  </Text>
                  <Text style={[styles.activityTime, { color: theme.colors.secondary }]}>
                    {item.timestamp}
                  </Text>
                </View>
              )}
            />
          </View>

          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: theme.colors.error }]}
            onPress={() => setStatisticsModalVisible(false)}
          >
            <Text style={styles.buttonText}>关闭</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderFilterModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={filterModalVisible}
      onRequestClose={() => setFilterModalVisible(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            筛选选项
          </Text>

          <View style={styles.filterSection}>
            <Text style={[styles.filterTitle, { color: theme.colors.text }]}>
              排序方式
            </Text>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  {
                    backgroundColor: filterOptions.sortBy === 'name'
                      ? theme.colors.primary
                      : theme.colors.surface
                  }
                ]}
                onPress={() => setFilterOptions({ ...filterOptions, sortBy: 'name' })}
              >
                <Text style={[
                  styles.filterOptionText,
                  {
                    color: filterOptions.sortBy === 'name'
                      ? '#fff'
                      : theme.colors.text
                  }
                ]}>
                  按名称
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  {
                    backgroundColor: filterOptions.sortBy === 'count'
                      ? theme.colors.primary
                      : theme.colors.surface
                  }
                ]}
                onPress={() => setFilterOptions({ ...filterOptions, sortBy: 'count' })}
              >
                <Text style={[
                  styles.filterOptionText,
                  {
                    color: filterOptions.sortBy === 'count'
                      ? '#fff'
                      : theme.colors.text
                  }
                ]}>
                  按笔记数
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={[styles.filterTitle, { color: theme.colors.text }]}>
              排序顺序
            </Text>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  {
                    backgroundColor: filterOptions.sortOrder === 'asc'
                      ? theme.colors.primary
                      : theme.colors.surface
                  }
                ]}
                onPress={() => setFilterOptions({ ...filterOptions, sortOrder: 'asc' })}
              >
                <Text style={[
                  styles.filterOptionText,
                  {
                    color: filterOptions.sortOrder === 'asc'
                      ? '#fff'
                      : theme.colors.text
                  }
                ]}>
                  升序
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  {
                    backgroundColor: filterOptions.sortOrder === 'desc'
                      ? theme.colors.primary
                      : theme.colors.surface
                  }
                ]}
                onPress={() => setFilterOptions({ ...filterOptions, sortOrder: 'desc' })}
              >
                <Text style={[
                  styles.filterOptionText,
                  {
                    color: filterOptions.sortOrder === 'desc'
                      ? '#fff'
                      : theme.colors.text
                  }
                ]}>
                  降序
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.filterSection}>
            <View style={styles.filterToggle}>
              <Text style={[styles.filterTitle, { color: theme.colors.text }]}>
                显示空分类
              </Text>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  {
                    backgroundColor: filterOptions.showEmpty
                      ? theme.colors.primary
                      : theme.colors.surface
                  }
                ]}
                onPress={() => setFilterOptions({ ...filterOptions, showEmpty: !filterOptions.showEmpty })}
              >
                <Text style={[
                  styles.toggleText,
                  {
                    color: filterOptions.showEmpty
                      ? '#fff'
                      : theme.colors.text
                  }
                ]}>
                  {filterOptions.showEmpty ? '是' : '否'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: theme.colors.error }]}
            onPress={() => setFilterModalVisible(false)}
          >
            <Text style={styles.buttonText}>关闭</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderImportModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={importModalVisible}
      onRequestClose={() => setImportModalVisible(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            导入分类
          </Text>

          <Text style={[styles.importHelp, { color: theme.colors.text }]}>
            请粘贴分类数据（JSON格式）或下载模板
          </Text>

          <TouchableOpacity
            style={[styles.templateButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleDownloadTemplate}
          >
            <Text style={styles.buttonText}>下载模板</Text>
          </TouchableOpacity>

          <TextInput
            style={[styles.importInput, {
              color: theme.colors.text,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface
            }]}
            placeholder="粘贴分类数据..."
            placeholderTextColor={theme.colors.secondary}
            value={importData}
            onChangeText={setImportData}
            multiline
            numberOfLines={10}
          />

          {importStatus.error && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {importStatus.error}
            </Text>
          )}

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.colors.error }]}
              onPress={() => setImportModalVisible(false)}
            >
              <Text style={styles.buttonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleImportCategories}
              disabled={importStatus.loading}
            >
              {importStatus.loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>导入</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderExportModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={exportModalVisible}
      onRequestClose={() => setExportModalVisible(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            导出分类
          </Text>

          <Text style={[styles.exportHelp, { color: theme.colors.text }]}>
            点击导出按钮将分类数据导出为JSON文件
          </Text>

          {exportStatus.error && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {exportStatus.error}
            </Text>
          )}

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.colors.error }]}
              onPress={() => setExportModalVisible(false)}
            >
              <Text style={styles.buttonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleExportCategories}
              disabled={exportStatus.loading}
            >
              {exportStatus.loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>导出</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderPermissionModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={permissionModalVisible}
      onRequestClose={() => setPermissionModalVisible(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            {selectedCategory?.name} 的权限设置
          </Text>

          <View style={styles.permissionSection}>
            <View style={styles.permissionItem}>
              <Text style={[styles.permissionLabel, { color: theme.colors.text }]}>
                查看权限
              </Text>
              <Switch
                value={permissions.canView}
                onValueChange={value => setPermissions({ ...permissions, canView: value })}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              />
            </View>

            <View style={styles.permissionItem}>
              <Text style={[styles.permissionLabel, { color: theme.colors.text }]}>
                编辑权限
              </Text>
              <Switch
                value={permissions.canEdit}
                onValueChange={value => setPermissions({ ...permissions, canEdit: value })}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              />
            </View>

            <View style={styles.permissionItem}>
              <Text style={[styles.permissionLabel, { color: theme.colors.text }]}>
                删除权限
              </Text>
              <Switch
                value={permissions.canDelete}
                onValueChange={value => setPermissions({ ...permissions, canDelete: value })}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              />
            </View>

            <View style={styles.permissionItem}>
              <Text style={[styles.permissionLabel, { color: theme.colors.text }]}>
                成员管理权限
              </Text>
              <Switch
                value={permissions.canManageMembers}
                onValueChange={value => setPermissions({ ...permissions, canManageMembers: value })}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              />
            </View>
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.colors.error }]}
              onPress={() => setPermissionModalVisible(false)}
            >
              <Text style={styles.buttonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleUpdatePermissions}
            >
              <Text style={styles.buttonText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderMemberModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={memberModalVisible}
      onRequestClose={() => setMemberModalVisible(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
            {selectedCategory?.name} 的成员管理
          </Text>

          <View style={styles.memberInputContainer}>
            <Picker
              selectedValue={selectedUser}
              onValueChange={setSelectedUser}
              style={[styles.memberPicker, { color: theme.colors.text }]}
            >
              <Picker.Item label="选择用户" value={null} />
              {/* 这里需要添加用户列表 */}
            </Picker>
            <Picker
              selectedValue={selectedRole}
              onValueChange={setSelectedRole}
              style={[styles.memberPicker, { color: theme.colors.text }]}
            >
              <Picker.Item label="选择角色" value="" />
              {roles.map(role => (
                <Picker.Item key={role.id} label={role.name} value={role.id} />
              ))}
            </Picker>
            <TouchableOpacity
              style={[styles.addMemberButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleAddMember}
            >
              <Text style={styles.buttonText}>添加</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={members}
            keyExtractor={item => item.user_id.toString()}
            renderItem={({ item }) => (
              <View style={[styles.memberItem, {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border
              }]}>
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: theme.colors.text }]}>
                    {item.user_name}
                  </Text>
                  <Text style={[styles.memberRole, { color: theme.colors.secondary }]}>
                    {item.role_name}
                  </Text>
                </View>
                <View style={styles.memberActions}>
                  <Picker
                    selectedValue={item.role_id}
                    onValueChange={value => handleUpdateMemberRole(item.user_id, value)}
                    style={[styles.rolePicker, { color: theme.colors.text }]}
                  >
                    {roles.map(role => (
                      <Picker.Item key={role.id} label={role.name} value={role.id} />
                    ))}
                  </Picker>
                  <TouchableOpacity onPress={() => handleRemoveMember(item.user_id)}>
                    <Icon name="delete" size={20} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />

          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: theme.colors.error }]}
            onPress={() => setMemberModalVisible(false)}
          >
            <Text style={styles.buttonText}>关闭</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>分类管理</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setImportModalVisible(true)}
          >
            <Icon name="file-upload" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setExportModalVisible(true)}
          >
            <Icon name="file-download" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setFilterModalVisible(true)}
          >
            <Icon name="filter-list" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setStatisticsModalVisible(true)}
          >
            <Icon name="analytics" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleToggleBatchMode}
          >
            <Icon name={isBatchMode ? "check-box" : "check-box-outline-blank"} size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleAutoCategorize}
            disabled={isAutoCategorizing}
          >
            {isAutoCategorizing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Icon name="auto-fix-high" size={24} color="#fff" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setModalVisible(true)}
          >
            <Icon name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={[styles.searchInput, {
            color: theme.colors.text,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface
          }]}
          placeholder="搜索分类..."
          placeholderTextColor={theme.colors.secondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {isBatchMode && renderBatchActions()}

      <FlatList
        data={filteredCategories}
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
        <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {selectedCategory ? '编辑分类' : '新建分类'}
            </Text>
            <TextInput
              style={[styles.input, {
                color: theme.colors.text,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface
              }]}
              placeholder="输入分类名称"
              placeholderTextColor={theme.colors.secondary}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: theme.colors.error }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleCreateCategory}
              >
                <Text style={styles.buttonText}>确认</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {renderSuggestionModal()}
      {renderBatchModal()}
      {renderStatisticsModal()}
      {renderFilterModal()}
      {renderImportModal()}
      {renderExportModal()}
      {renderPermissionModal()}
      {renderMemberModal()}
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
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
  suggestionItem: {
    padding: 16,
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  suggestionConfidence: {
    fontSize: 14,
  },
  closeButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  batchActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  batchCount: {
    fontSize: 16,
  },
  batchButton: {
    padding: 8,
    borderRadius: 4,
  },
  statisticsSection: {
    marginBottom: 16,
  },
  statisticsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statisticsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statisticsLabel: {
    fontSize: 16,
  },
  statisticsValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  distributionItem: {
    marginBottom: 12,
  },
  distributionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  distributionName: {
    fontSize: 14,
  },
  distributionCount: {
    fontSize: 14,
  },
  distributionBar: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
  },
  distributionProgress: {
    height: '100%',
    borderRadius: 4,
  },
  activityItem: {
    marginBottom: 8,
  },
  activityText: {
    fontSize: 14,
  },
  activityTime: {
    fontSize: 12,
    marginTop: 2,
  },
  searchContainer: {
    padding: 16,
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  filterOption: {
    flex: 1,
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  filterOptionText: {
    fontSize: 14,
  },
  filterToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleButton: {
    padding: 8,
    borderRadius: 4,
    minWidth: 60,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
  },
  importHelp: {
    fontSize: 14,
    marginBottom: 8,
  },
  exportHelp: {
    fontSize: 14,
    marginBottom: 16,
  },
  templateButton: {
    padding: 8,
    borderRadius: 4,
    marginBottom: 16,
  },
  importInput: {
    height: 200,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 14,
    marginBottom: 16,
  },
  permissionSection: {
    marginBottom: 16,
  },
  permissionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  permissionLabel: {
    fontSize: 16,
  },
  memberInputContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  memberPicker: {
    flex: 1,
    height: 40,
    marginRight: 8,
  },
  addMemberButton: {
    padding: 8,
    borderRadius: 4,
    justifyContent: 'center',
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    marginBottom: 4,
  },
  memberRole: {
    fontSize: 14,
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  rolePicker: {
    width: 120,
    height: 40,
  },
});

export default CategoryManager;
