/**
 * 搜索过滤组件
 * 提供日期、标签、类型等过滤选项
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 内容类型选项
const CONTENT_TYPES = [
  { id: 'all', label: '全部', icon: 'apps' },
  { id: 'note', label: '笔记', icon: 'description' },
  { id: 'canvas', label: '画布', icon: 'dashboard' },
  { id: 'knowledge', label: '知识点', icon: 'bubble-chart' },
  { id: 'tag', label: '标签', icon: 'local-offer' },
];

// 排序选项
const SORT_OPTIONS = [
  { id: 'relevance', label: '相关度', icon: 'sort' },
  { id: 'date_desc', label: '最新创建', icon: 'arrow-downward' },
  { id: 'date_asc', label: '最早创建', icon: 'arrow-upward' },
  { id: 'updated_desc', label: '最近更新', icon: 'update' },
  { id: 'title_asc', label: '标题 A-Z', icon: 'sort-by-alpha' },
  { id: 'title_desc', label: '标题 Z-A', icon: 'sort-by-alpha' },
];

const SearchFilters = ({ onApplyFilters, initialFilters = {} }) => {
  const { theme } = useTheme();
  const { colors } = theme;

  // 过滤器状态
  const [filters, setFilters] = useState({
    contentType: initialFilters.contentType || 'all',
    tags: initialFilters.tags || [],
    dateFrom: initialFilters.dateFrom || null,
    dateTo: initialFilters.dateTo || null,
    sortBy: initialFilters.sortBy || 'relevance',
    ...initialFilters,
  });

  // 模态框状态
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [showDateFromPicker, setShowDateFromPicker] = useState(false);
  const [showDateToPicker, setShowDateToPicker] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);

  // 加载可用标签
  useEffect(() => {
    // 这里应该从API或Redux获取标签列表
    // 暂时使用模拟数据
    setAvailableTags([
      { id: '1', name: '学习' },
      { id: '2', name: '工作' },
      { id: '3', name: '生活' },
      { id: '4', name: '项目' },
      { id: '5', name: '重要' },
      { id: '6', name: '待办' },
      { id: '7', name: '参考' },
      { id: '8', name: '灵感' },
    ]);
  }, []);

  // 应用过滤器
  const applyFilters = () => {
    onApplyFilters(filters);
  };

  // 重置过滤器
  const resetFilters = () => {
    setFilters({
      contentType: 'all',
      tags: [],
      dateFrom: null,
      dateTo: null,
      sortBy: 'relevance',
    });
  };

  // 更新过滤器
  const updateFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // 切换标签选择
  const toggleTag = (tagId) => {
    setFilters(prev => {
      const tags = [...prev.tags];
      const index = tags.indexOf(tagId);
      
      if (index >= 0) {
        tags.splice(index, 1);
      } else {
        tags.push(tagId);
      }
      
      return {
        ...prev,
        tags,
      };
    });
  };

  // 格式化日期
  const formatDate = (date) => {
    if (!date) return '选择日期';
    return format(date, 'yyyy-MM-dd', { locale: zhCN });
  };

  // 获取内容类型标签
  const getContentTypeLabel = () => {
    const type = CONTENT_TYPES.find(t => t.id === filters.contentType);
    return type ? type.label : '全部';
  };

  // 获取排序选项标签
  const getSortLabel = () => {
    const sort = SORT_OPTIONS.find(s => s.id === filters.sortBy);
    return sort ? sort.label : '相关度';
  };

  // 渲染标签选择模态框
  const renderTagsModal = () => (
    <Modal
      visible={showTagsModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowTagsModal(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text variant="heading" level="h6">选择标签</Text>
            <TouchableOpacity onPress={() => setShowTagsModal(false)}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={availableTags}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.tagItem,
                  filters.tags.includes(item.id) && { backgroundColor: colors.primaryLight }
                ]}
                onPress={() => toggleTag(item.id)}
              >
                <Text
                  variant="body"
                  size="medium"
                  color={filters.tags.includes(item.id) ? 'primary' : 'text'}
                >
                  {item.name}
                </Text>
                {filters.tags.includes(item.id) && (
                  <Icon name="check" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.tagsList}
          />
          
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.footerButton, { borderColor: colors.border }]}
              onPress={() => updateFilter('tags', [])}
            >
              <Text variant="body" size="medium" color="textSecondary">清除</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowTagsModal(false)}
            >
              <Text variant="body" size="medium" color="onPrimary">确定</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // 渲染内容类型选择模态框
  const renderTypeModal = () => (
    <Modal
      visible={showTypeModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowTypeModal(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text variant="heading" level="h6">内容类型</Text>
            <TouchableOpacity onPress={() => setShowTypeModal(false)}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={CONTENT_TYPES}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.optionItem,
                  filters.contentType === item.id && { backgroundColor: colors.primaryLight }
                ]}
                onPress={() => {
                  updateFilter('contentType', item.id);
                  setShowTypeModal(false);
                }}
              >
                <Icon
                  name={item.icon}
                  size={24}
                  color={filters.contentType === item.id ? colors.primary : colors.textSecondary}
                />
                <Text
                  variant="body"
                  size="medium"
                  color={filters.contentType === item.id ? 'primary' : 'text'}
                  style={styles.optionLabel}
                >
                  {item.label}
                </Text>
                {filters.contentType === item.id && (
                  <Icon name="check" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.optionsList}
          />
        </View>
      </View>
    </Modal>
  );

  // 渲染排序选项模态框
  const renderSortModal = () => (
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
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.optionItem,
                  filters.sortBy === item.id && { backgroundColor: colors.primaryLight }
                ]}
                onPress={() => {
                  updateFilter('sortBy', item.id);
                  setShowSortModal(false);
                }}
              >
                <Icon
                  name={item.icon}
                  size={24}
                  color={filters.sortBy === item.id ? colors.primary : colors.textSecondary}
                />
                <Text
                  variant="body"
                  size="medium"
                  color={filters.sortBy === item.id ? 'primary' : 'text'}
                  style={styles.optionLabel}
                >
                  {item.label}
                </Text>
                {filters.sortBy === item.id && (
                  <Icon name="check" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.optionsList}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        {/* 内容类型过滤器 */}
        <TouchableOpacity
          style={[
            styles.filterChip,
            { backgroundColor: colors.card, borderColor: colors.border }
          ]}
          onPress={() => setShowTypeModal(true)}
        >
          <Icon name="category" size={16} color={colors.textSecondary} />
          <Text
            variant="body"
            size="small"
            color="text"
            style={styles.filterChipText}
          >
            {getContentTypeLabel()}
          </Text>
          <Icon name="arrow-drop-down" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* 标签过滤器 */}
        <TouchableOpacity
          style={[
            styles.filterChip,
            { backgroundColor: colors.card, borderColor: colors.border },
            filters.tags.length > 0 && { borderColor: colors.primary }
          ]}
          onPress={() => setShowTagsModal(true)}
        >
          <Icon
            name="local-offer"
            size={16}
            color={filters.tags.length > 0 ? colors.primary : colors.textSecondary}
          />
          <Text
            variant="body"
            size="small"
            color={filters.tags.length > 0 ? 'primary' : 'text'}
            style={styles.filterChipText}
          >
            {filters.tags.length > 0 ? `${filters.tags.length}个标签` : '标签'}
          </Text>
          <Icon
            name="arrow-drop-down"
            size={16}
            color={filters.tags.length > 0 ? colors.primary : colors.textSecondary}
          />
        </TouchableOpacity>

        {/* 日期范围过滤器 - 开始日期 */}
        <TouchableOpacity
          style={[
            styles.filterChip,
            { backgroundColor: colors.card, borderColor: colors.border },
            filters.dateFrom && { borderColor: colors.primary }
          ]}
          onPress={() => setShowDateFromPicker(true)}
        >
          <Icon
            name="event"
            size={16}
            color={filters.dateFrom ? colors.primary : colors.textSecondary}
          />
          <Text
            variant="body"
            size="small"
            color={filters.dateFrom ? 'primary' : 'text'}
            style={styles.filterChipText}
          >
            {filters.dateFrom ? formatDate(filters.dateFrom) : '开始日期'}
          </Text>
        </TouchableOpacity>

        {/* 日期范围过滤器 - 结束日期 */}
        <TouchableOpacity
          style={[
            styles.filterChip,
            { backgroundColor: colors.card, borderColor: colors.border },
            filters.dateTo && { borderColor: colors.primary }
          ]}
          onPress={() => setShowDateToPicker(true)}
        >
          <Icon
            name="event"
            size={16}
            color={filters.dateTo ? colors.primary : colors.textSecondary}
          />
          <Text
            variant="body"
            size="small"
            color={filters.dateTo ? 'primary' : 'text'}
            style={styles.filterChipText}
          >
            {filters.dateTo ? formatDate(filters.dateTo) : '结束日期'}
          </Text>
        </TouchableOpacity>

        {/* 排序选项 */}
        <TouchableOpacity
          style={[
            styles.filterChip,
            { backgroundColor: colors.card, borderColor: colors.border }
          ]}
          onPress={() => setShowSortModal(true)}
        >
          <Icon name="sort" size={16} color={colors.textSecondary} />
          <Text
            variant="body"
            size="small"
            color="text"
            style={styles.filterChipText}
          >
            {getSortLabel()}
          </Text>
          <Icon name="arrow-drop-down" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* 重置按钮 */}
        <TouchableOpacity
          style={[
            styles.filterChip,
            { backgroundColor: colors.errorLight, borderColor: colors.error }
          ]}
          onPress={resetFilters}
        >
          <Icon name="refresh" size={16} color={colors.error} />
          <Text
            variant="body"
            size="small"
            color="error"
            style={styles.filterChipText}
          >
            重置
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 应用按钮 */}
      <TouchableOpacity
        style={[styles.applyButton, { backgroundColor: colors.primary }]}
        onPress={applyFilters}
      >
        <Text variant="body" size="medium" color="onPrimary">
          应用过滤器
        </Text>
      </TouchableOpacity>

      {/* 日期选择器 - 开始日期 */}
      {showDateFromPicker && (
        <DateTimePicker
          value={filters.dateFrom || new Date()}
          mode="date"
          display="default"
          onChange={(_, date) => {
            setShowDateFromPicker(false);
            if (date) {
              updateFilter('dateFrom', date);
            }
          }}
        />
      )}

      {/* 日期选择器 - 结束日期 */}
      {showDateToPicker && (
        <DateTimePicker
          value={filters.dateTo || new Date()}
          mode="date"
          display="default"
          onChange={(_, date) => {
            setShowDateToPicker(false);
            if (date) {
              updateFilter('dateTo', date);
            }
          }}
        />
      )}

      {/* 模态框 */}
      {renderTagsModal()}
      {renderTypeModal()}
      {renderSortModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  filtersRow: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    marginHorizontal: 4,
  },
  applyButton: {
    marginTop: 8,
    marginHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
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
  tagsList: {
    padding: 16,
  },
  tagItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  footerButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
    borderWidth: 1,
  },
  optionsList: {
    padding: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  optionLabel: {
    flex: 1,
    marginLeft: 12,
  },
});

export default SearchFilters;
