/**
 * 标签选择器组件
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import { fetchTags, createTag } from '../../redux/slices/tagsSlice';

/**
 * 标签选择器组件
 * @param {Array} selectedTags - 已选择的标签
 * @param {Function} onSelect - 选择回调
 * @param {Function} onCancel - 取消回调
 */
const TagSelector = ({
  selectedTags = [],
  onSelect,
  onCancel,
}) => {
  // 状态
  const [searchText, setSearchText] = useState('');
  const [filteredTags, setFilteredTags] = useState([]);
  const [newTagName, setNewTagName] = useState('');
  const [localSelectedTags, setLocalSelectedTags] = useState([]);
  
  // Redux
  const dispatch = useDispatch();
  const { tags, isLoading, error } = useSelector(state => state.tags);
  
  // 主题
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  
  // 初始化
  useEffect(() => {
    // 加载标签
    dispatch(fetchTags());
    
    // 设置本地选中标签
    setLocalSelectedTags(selectedTags);
  }, [dispatch, selectedTags]);
  
  // 过滤标签
  useEffect(() => {
    if (!tags) return;
    
    if (!searchText) {
      setFilteredTags(tags);
    } else {
      const filtered = tags.filter(tag => 
        tag.name.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredTags(filtered);
    }
  }, [tags, searchText]);
  
  // 处理标签选择
  const handleTagSelect = (tag) => {
    const isSelected = localSelectedTags.includes(tag.id);
    
    if (isSelected) {
      setLocalSelectedTags(localSelectedTags.filter(id => id !== tag.id));
    } else {
      setLocalSelectedTags([...localSelectedTags, tag.id]);
    }
  };
  
  // 创建新标签
  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      Alert.alert('提示', '请输入标签名称');
      return;
    }
    
    try {
      const result = await dispatch(createTag({ name: newTagName.trim() })).unwrap();
      
      // 添加到选中标签
      if (result && result.id) {
        setLocalSelectedTags([...localSelectedTags, result.id]);
      }
      
      // 清空输入
      setNewTagName('');
    } catch (error) {
      Alert.alert('错误', `创建标签失败: ${error.message || '未知错误'}`);
    }
  };
  
  // 确认选择
  const handleConfirm = () => {
    // 获取选中标签的完整信息
    const selectedTagsInfo = localSelectedTags.map(tagId => {
      const tag = tags.find(t => t.id === tagId);
      return tag ? tag.name : '';
    }).filter(Boolean);
    
    onSelect && onSelect(selectedTagsInfo);
  };
  
  // 渲染标签项
  const renderTagItem = ({ item }) => {
    const isSelected = localSelectedTags.includes(item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.tagItem,
          isSelected && styles.selectedTagItem,
          isSelected && { backgroundColor: colors.primary }
        ]}
        onPress={() => handleTagSelect(item)}
      >
        <Text
          variant="body"
          size="medium"
          color={isSelected ? 'card' : 'text'}
        >
          {item.name}
        </Text>
        
        {isSelected && (
          <Icon name="check" size={16} color={colors.card} style={styles.checkIcon} />
        )}
      </TouchableOpacity>
    );
  };
  
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <Text
              variant="heading"
              level="h5"
              style={styles.title}
            >
              选择标签
            </Text>
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onCancel}
            >
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <Icon name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="搜索标签"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          
          <View style={styles.newTagContainer}>
            <TextInput
              style={[styles.newTagInput, { color: colors.text, borderColor: colors.border }]}
              value={newTagName}
              onChangeText={setNewTagName}
              placeholder="创建新标签"
              placeholderTextColor={colors.textSecondary}
            />
            
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: colors.primary }]}
              onPress={handleCreateTag}
            >
              <Icon name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Icon name="error" size={24} color={colors.error} />
              <Text
                variant="body"
                size="medium"
                color="error"
                style={styles.errorText}
              >
                {error}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredTags}
              renderItem={renderTagItem}
              keyExtractor={item => item.id.toString()}
              style={styles.tagList}
              contentContainerStyle={styles.tagListContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text
                    variant="body"
                    size="medium"
                    color="hint"
                    center
                  >
                    {searchText ? '没有找到匹配的标签' : '暂无标签'}
                  </Text>
                </View>
              }
            />
          )}
          
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={onCancel}
            >
              <Text
                variant="body"
                size="medium"
                color="text"
              >
                取消
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: colors.primary }]}
              onPress={handleConfirm}
            >
              <Text
                variant="body"
                size="medium"
                color="card"
                bold
              >
                确定
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchIcon: {
    marginHorizontal: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  newTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  newTagInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    fontSize: 16,
    marginRight: 8,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagList: {
    flex: 1,
  },
  tagListContent: {
    padding: 8,
  },
  tagItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedTagItem: {
    borderWidth: 0,
  },
  checkIcon: {
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 8,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    marginRight: 8,
  },
  confirmButton: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    marginLeft: 8,
  },
});

export default TagSelector;
