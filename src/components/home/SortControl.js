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
  Dimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import realmService from '../../services/database/realmService';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import useOrientation from '../../utils/hooks/useOrientation';

// 排序选项
const SORT_OPTIONS = [
  { id: 'updated_desc', label: '最近更新', icon: 'update', description: '按最近更新和访问时间排序', color: '#2196F3' }, // 蓝色
  { id: 'created_desc', label: '最新创建', icon: 'schedule', description: '按创建时间从新到旧排序', color: '#4CAF50' }, // 绿色
  { id: 'title_asc', label: '名称 A-Z', icon: 'sort-by-alpha', description: '按名称字母顺序排序', color: '#9C27B0' }, // 紫色
  { id: 'title_desc', label: '名称 Z-A', icon: 'sort-by-alpha', description: '按名称字母倒序排序', color: '#673AB7' }, // 深紫色
  { id: 'type', label: '文件类型', icon: 'category', description: '按文件类型分组排序', color: '#FF9800' }, // 橙色
  { id: 'size_desc', label: '文件大小↓', icon: 'storage', description: '按文件大小从大到小排序', color: '#E91E63' }, // 粉色
  { id: 'size_asc', label: '文件大小↑', icon: 'storage', description: '按文件大小从小到大排序', color: '#F06292' }, // 浅粉色
  { id: 'created_asc', label: '最早创建', icon: 'schedule', description: '按创建时间从旧到新排序', color: '#8BC34A' }, // 浅绿色
  { id: 'updated_asc', label: '最早更新', icon: 'update', description: '按更新时间从旧到新排序', color: '#03A9F4' }, // 浅蓝色
];

// 存储键
const SORT_PREFERENCE_KEY = 'home_sort_preference';

const SortControl = ({ onSortChange, initialSortOption = 'updated_desc', compact = false }) => {
  const { theme } = useTheme();
  const { colors } = theme;

  // 状态
  const [showSortModal, setShowSortModal] = useState(false);
  const [currentSort, setCurrentSort] = useState(initialSortOption);

  // 获取屏幕方向信息
  const { isLandscape } = useOrientation();

  // 获取当前排序选项标签
  const getCurrentSortLabel = () => {
    const option = SORT_OPTIONS.find(opt => opt.id === currentSort);
    return option ? option.label : '排序';
  };

  // 保存排序偏好
  const saveSortPreference = async (sortId) => {
    try {
      const realm = await realmService.getRealm();
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "${SORT_PREFERENCE_KEY}"`);
        if (existingItem.length > 0) {
          existingItem[0].value = sortId;
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: SORT_PREFERENCE_KEY,
            value: sortId,
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });
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
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: currentSort === item.id
            ? `${item.color}20`
            : `${item.color}10`,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: currentSort === item.id ? 1 : 0,
          borderColor: `${item.color}40`,
        }}>
          <Icon
            name={item.icon}
            size={16}
            color={currentSort === item.id ? item.color : `${item.color}99`}
          />
        </View>
        <View style={styles.sortOptionTextContainer}>
          <Text
            variant="body"
            size="medium"
            style={{
              fontWeight: currentSort === item.id ? '600' : '500',
              fontSize: 14,
              color: currentSort === item.id ? item.color : colors.text
            }}
          >
            {item.label}
          </Text>
          <Text
            variant="caption"
            color="textSecondary"
            style={{ fontSize: 11, lineHeight: 14, marginTop: 1, opacity: 0.8 }}
          >
            {item.description}
          </Text>
        </View>
      </View>

      {currentSort === item.id && (
        <Icon name="check-circle" size={20} color={item.color} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[
      styles.container,
      compact && styles.compactContainer,
      // 横屏模式下的样式调整
      isLandscape && {
        marginHorizontal: 0,
        marginBottom: 0,
      }
    ]}>
      <TouchableOpacity
        style={[
          styles.sortButton,
          {
            backgroundColor: colors.card,
            borderColor: `${colors.border}80`,
          },
          compact && styles.compactSortButton,
          // 横屏模式下的样式调整
          isLandscape && compact && {
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderRadius: 24,
            minWidth: 48,
          }
        ]}
        onPress={() => setShowSortModal(true)}
        activeOpacity={0.7}
      >
        <View style={{
          width: compact ? 30 : 28,
          height: compact ? 30 : 28,
          borderRadius: compact ? 15 : 14,
          backgroundColor: `${colors.primary}15`,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: compact ? 4 : 6,
        }}>
          <Icon name="sort" size={compact ? 18 : 16} color={colors.primary} />
        </View>
        {!compact ? (
          <Text
            variant="body"
            size="small"
            color="text"
            style={styles.sortButtonText}
          >
            {getCurrentSortLabel()}
          </Text>
        ) : (
          <Text
            variant="body"
            size="small"
            color="primary"
            style={[styles.sortButtonText, { marginHorizontal: 0, fontSize: 12, fontWeight: '600' }]}
          >
            排序
          </Text>
        )}
        <Icon
          name="expand-more"
          size={compact ? 18 : 18}
          color={colors.primary}
        />
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
            },
            // 横屏模式下的样式调整
            isLandscape && {
              maxHeight: '80%',
              width: '50%',
              alignSelf: 'center',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              marginBottom: 20,
            }
          ]}>
            <View style={styles.modalHeader}>
              <Text
                variant="heading"
                level="h6"
                style={{ fontSize: 16, fontWeight: '700', letterSpacing: -0.3 }}
              >
                选择排序方式
              </Text>
              <TouchableOpacity
                onPress={() => setShowSortModal(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: `${colors.error}10`,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Icon name="close" size={18} color={colors.error} />
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
  // 紧凑模式容器
  compactContainer: {
    marginHorizontal: 0,
    marginBottom: 0,
    alignItems: 'flex-end',
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
  // 紧凑模式按钮
  compactSortButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 40,
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: '70%',
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  sortOptionsList: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  sortOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sortOptionTextContainer: {
    marginLeft: 8,
    flex: 1,
  },
});

export default SortControl;
