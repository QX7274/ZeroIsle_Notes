import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../services/api';
import { API_ENDPOINTS } from '../../config/api';

const ReminderCategoryView = ({ navigation }) => {
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const [categories, setCategories] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 获取分类数据
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(API_ENDPOINTS.REMINDER.CATEGORIES);
      setCategories(response.data);

      // 默认选择第一个分类
      if (response.data.length > 0 && !selectedCategory) {
        setSelectedCategory(response.data[0].id);
        fetchRemindersByCategory(response.data[0].id);
      }
    } catch (error) {
      console.error('获取分类数据失败:', error);
      setError('获取分类数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  // 获取指定分类的提醒
  const fetchRemindersByCategory = async (categoryId) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(API_ENDPOINTS.REMINDER.BASE, {
        params: { category: categoryId, is_completed: false },
      });

      // 按优先级分组
      const highPriority = response.data.results.filter(item => item.priority === 'high');
      const mediumPriority = response.data.results.filter(item => item.priority === 'medium');
      const lowPriority = response.data.results.filter(item => item.priority === 'low');

      const sections = [];

      if (highPriority.length > 0) {
        sections.push({
          title: '高优先级',
          data: highPriority,
          priority: 'high',
        });
      }

      if (mediumPriority.length > 0) {
        sections.push({
          title: '中优先级',
          data: mediumPriority,
          priority: 'medium',
        });
      }

      if (lowPriority.length > 0) {
        sections.push({
          title: '低优先级',
          data: lowPriority,
          priority: 'low',
        });
      }

      setReminders(sections);
    } catch (error) {
      console.error('获取提醒数据失败:', error);
      setError('获取提醒数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // 处理分类选择
  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    fetchRemindersByCategory(categoryId);
  };

  // 渲染分类项
  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        {
          backgroundColor: selectedCategory === item.id ? theme.primary : theme.cardBackground,
        },
      ]}
      onPress={() => handleCategorySelect(item.id)}
    >
      <Text
        style={[
          styles.categoryName,
          {
            color: selectedCategory === item.id ? '#ffffff' : theme.text,
          },
        ]}
      >
        {item.name}
      </Text>
      <View
        style={[
          styles.categoryBadge,
          {
            backgroundColor: selectedCategory === item.id ? '#ffffff' : theme.primary,
          },
        ]}
      >
        <Text
          style={[
            styles.categoryCount,
            {
              color: selectedCategory === item.id ? theme.primary : '#ffffff',
            },
          ]}
        >
          {item.count}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // 渲染提醒项
  const renderReminderItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.reminderItem,
        {
          backgroundColor: theme.cardBackground,
          borderLeftColor: item.color || theme.primary,
        },
      ]}
      onPress={() => navigation.navigate('ReminderDetail', { id: item.id, reminder: item })}
    >
      <View style={styles.reminderContent}>
        <Text
          style={[
            styles.reminderTitle,
            {
              color: theme.text,
              textDecorationLine: item.is_completed ? 'line-through' : 'none',
            },
          ]}
        >
          {item.title}
        </Text>
        {item.description && (
          <Text
            style={[styles.reminderDescription, { color: theme.textSecondary }]}
            numberOfLines={2}
          >
            {item.description}
          </Text>
        )}
        {item.tags && (
          <View style={styles.tagsContainer}>
            {item.tag_list && item.tag_list.map((tag, index) => (
              <View
                key={index}
                style={[styles.tagBadge, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}
              >
                <Text style={[styles.tagText, { color: theme.textSecondary }]}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <Icon
        name={item.is_completed ? 'check-circle' : 'arrow-forward'}
        size={24}
        color={item.is_completed ? theme.success : theme.primary}
      />
    </TouchableOpacity>
  );

  // 渲染分组头部
  const renderSectionHeader = ({ section }) => (
    <View
      style={[
        styles.sectionHeader,
        {
          backgroundColor: theme.background,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {section.title}
      </Text>
    </View>
  );

  // 获取当前选中分类名称
  const getSelectedCategoryName = () => {
    const category = categories.find(cat => cat.id === selectedCategory);
    return category ? category.name : '全部';
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.categoriesContainer}>
        <FlatList
          data={categories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />
      </View>

      <View style={styles.reminderSection}>
        <View style={[styles.reminderHeader, { borderBottomColor: theme.border }]}>
          <Text style={[styles.reminderHeaderTitle, { color: theme.text }]}>
            {getSelectedCategoryName()} 提醒
          </Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate('ReminderAdd', { category: selectedCategory })}
          >
            <Icon name="add" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
        ) : error ? (
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
        ) : reminders.length > 0 ? (
          <SectionList
            sections={reminders}
            renderItem={renderReminderItem}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.reminderList}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Icon name="category" size={48} color={theme.textDisabled} />
            <Text style={[styles.emptyText, { color: theme.textDisabled }]}>
              该分类下没有提醒
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  categoriesContainer: {
    paddingVertical: 12,
  },
  categoriesList: {
    paddingHorizontal: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  categoryBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryCount: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  reminderSection: {
    flex: 1,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  reminderHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  reminderList: {
    paddingBottom: 16,
  },
  reminderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 8,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  reminderContent: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  reminderDescription: {
    fontSize: 14,
    marginBottom: 4,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 4,
    marginBottom: 4,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 12,
  },
  loader: {
    marginTop: 20,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 20,
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
  },
});

export default ReminderCategoryView;
