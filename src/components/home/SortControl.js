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
        {
          backgroundColor: currentSort === item.id ? `${colors.primary}15` : colors.card,
          borderColor: currentSort === item.id ? `${colors.primary}30` : 'rgba(0,0,0,0.03)',
        }
      ]}
      onPress={() => selectSortOption(item)}
      activeOpacity={0.7}
    >
      <View style={styles.sortOptionLeft}>
        <View style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: currentSort === item.id ? `${colors.primary}20` : `${colors.textSecondary}10`,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Icon
            name={item.icon}
            size={20}
            color={currentSort === item.id ? colors.primary : colors.textSecondary}
          />
        </View>
        <View style={styles.sortOptionTextContainer}>
          <Text
            variant="body"
            size="medium"
            color={currentSort === item.id ? 'primary' : 'text'}
            style={{ fontWeight: currentSort === item.id ? '600' : '500', fontSize: 16 }}
          >
            {item.label}
          </Text>
          <Text
            variant="caption"
            color="textSecondary"
            style={{ fontSize: 13, lineHeight: 18, marginTop: 2 }}
          >
            {item.description}
          </Text>
        </View>
      </View>

      {currentSort === item.id && (
        <Icon name="check-circle" size={22} color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.sortButton,
          {
            backgroundColor: colors.card,
            borderColor: `${colors.border}80`,
          }
        ]}
        onPress={() => setShowSortModal(true)}
        activeOpacity={0.7}
      >
        <View style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: `${colors.primary}10`,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 6,
        }}>
          <Icon name="sort" size={16} color={colors.primary} />
        </View>
        <Text
          variant="body"
          size="small"
          color="text"
          style={styles.sortButtonText}
        >
          {getCurrentSortLabel()}
        </Text>
        <Icon name="keyboard-arrow-down" size={18} color={colors.primary} />
      </TouchableOpacity>

      <Modal
        visible={showSortModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSortModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[
            styles.modalContent,
            {
              backgroundColor: colors.card,
              borderTopWidth: 1,
              borderColor: `${colors.border}40`,
            }
          ]}>
            <View style={styles.modalHeader}>
              <Text
                variant="heading"
                level="h6"
                style={{ fontSize: 20, fontWeight: '700' }}
              >
                排序方式
              </Text>
              <TouchableOpacity
                onPress={() => setShowSortModal(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: `${colors.error}10`,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Icon name="close" size={20} color={colors.error} />
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
    marginHorizontal: 20,
    marginBottom: 12,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-end',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  sortButtonText: {
    marginHorizontal: 6,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
    maxHeight: '80%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  sortOptionsList: {
    padding: 12,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  sortOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sortOptionTextContainer: {
    marginLeft: 14,
    flex: 1,
  },
});

export default SortControl;
