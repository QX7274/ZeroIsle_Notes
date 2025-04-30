/**
 * 排序控件组件
 * 提供多种排序选项，如创建时间、名称等
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 排序选项
const SORT_OPTIONS = [
  { id: 'created_desc', label: '最新创建', icon: 'schedule', description: '按创建时间从新到旧排序' },
  { id: 'created_asc', label: '最早创建', icon: 'schedule', description: '按创建时间从旧到新排序' },
  { id: 'updated_desc', label: '最近更新', icon: 'update', description: '按更新时间从新到旧排序' },
  { id: 'updated_asc', label: '最早更新', icon: 'update', description: '按更新时间从旧到新排序' },
  { id: 'title_asc', label: '名称 A-Z', icon: 'sort-by-alpha', description: '按名称字母顺序排序' },
  { id: 'title_desc', label: '名称 Z-A', icon: 'sort-by-alpha', description: '按名称字母倒序排序' },
  { id: 'type', label: '文件类型', icon: 'category', description: '按文件类型分组排序' },
];

// 存储键
const SORT_PREFERENCE_KEY = 'home_sort_preference';

const SortControl = ({ onSortChange, initialSortOption = 'updated_desc' }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  
  // 状态
  const [showSortModal, setShowSortModal] = useState(false);
  const [currentSort, setCurrentSort] = useState(initialSortOption);
  
  // 获取当前排序选项标签
  const getCurrentSortLabel = () => {
    const option = SORT_OPTIONS.find(opt => opt.id === currentSort);
    return option ? option.label : '排序';
  };
  
  // 保存排序偏好
  const saveSortPreference = async (sortId) => {
    try {
      await AsyncStorage.setItem(SORT_PREFERENCE_KEY, sortId);
    } catch (error) {
      console.error('保存排序偏好失败:', error);
    }
  };
  
  // 选择排序选项
  const selectSortOption = (option) => {
    setCurrentSort(option.id);
    saveSortPreference(option.id);
    onSortChange(option.id);
    setShowSortModal(false);
  };
  
  // 渲染排序选项
  const renderSortOption = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.sortOption,
        currentSort === item.id && { backgroundColor: colors.primaryLight }
      ]}
      onPress={() => selectSortOption(item)}
    >
      <View style={styles.sortOptionLeft}>
        <Icon
          name={item.icon}
          size={24}
          color={currentSort === item.id ? colors.primary : colors.textSecondary}
        />
        <View style={styles.sortOptionTextContainer}>
          <Text
            variant="body"
            size="medium"
            color={currentSort === item.id ? 'primary' : 'text'}
          >
            {item.label}
          </Text>
          <Text
            variant="caption"
            color="textSecondary"
          >
            {item.description}
          </Text>
        </View>
      </View>
      
      {currentSort === item.id && (
        <Icon name="check" size={20} color={colors.primary} />
      )}
    </TouchableOpacity>
  );
  
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.sortButton,
          { backgroundColor: colors.card, borderColor: colors.border }
        ]}
        onPress={() => setShowSortModal(true)}
      >
        <Icon name="sort" size={18} color={colors.textSecondary} />
        <Text
          variant="body"
          size="small"
          color="text"
          style={styles.sortButtonText}
        >
          {getCurrentSortLabel()}
        </Text>
        <Icon name="arrow-drop-down" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      
      <Modal
        visible={showSortModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSortModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text variant="heading" level="h6">排序方式</Text>
              <TouchableOpacity onPress={() => setShowSortModal(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={SORT_OPTIONS}
              renderItem={renderSortOption}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.sortOptionsList}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    alignSelf: 'flex-end',
  },
  sortButtonText: {
    marginHorizontal: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  sortOptionsList: {
    padding: 8,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  sortOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sortOptionTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
});

export default SortControl;
