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
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../services/api';
import { API_ENDPOINTS } from '../../config/api';

const ReminderCategoryView = ({ navigation }) => {
  const { theme } = useTheme();
  const [categories, setCategories] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 鑾峰彇鍒嗙被鏁版嵁
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(API_ENDPOINTS.REMINDER.CATEGORIES);
      setCategories(response.data);

      // 榛樿閫夋嫨绗竴涓垎绫?
      if (response.data.length > 0 && !selectedCategory) {
        setSelectedCategory(response.data[0].id);
        fetchRemindersByCategory(response.data[0].id);
      }
    } catch (fetchError) {
      console.error('鑾峰彇鍒嗙被鏁版嵁澶辫触:', fetchError);
      setError('鑾峰彇鍒嗙被鏁版嵁澶辫触锛岃绋嶅悗閲嶈瘯');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  // 鑾峰彇鎸囧畾鍒嗙被鐨勬彁閱?
  const fetchRemindersByCategory = async (categoryId) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(API_ENDPOINTS.REMINDER.BASE, {
        params: { category: categoryId, is_completed: false },
      });

      // 鎸変紭鍏堢骇鍒嗙粍
      const highPriority = response.data.results.filter(item => item.priority === 'high');
      const mediumPriority = response.data.results.filter(item => item.priority === 'medium');
      const lowPriority = response.data.results.filter(item => item.priority === 'low');

      const sections = [];

      if (highPriority.length > 0) {
        sections.push({
          title: '楂樹紭鍏堢骇',
          data: highPriority,
          priority: 'high',
        });
      }

      if (mediumPriority.length > 0) {
        sections.push({
          title: '涓紭鍏堢骇',
          data: mediumPriority,
          priority: 'medium',
        });
      }

      if (lowPriority.length > 0) {
        sections.push({
          title: '浣庝紭鍏堢骇',
          data: lowPriority,
          priority: 'low',
        });
      }

      setReminders(sections);
    } catch (fetchError) {
      console.error('鑾峰彇鎻愰啋鏁版嵁澶辫触:', fetchError);
      setError('鑾峰彇鎻愰啋鏁版嵁澶辫触锛岃绋嶅悗閲嶈瘯');
    } finally {
      setLoading(false);
    }
  };

  // 鍒濆鍔犺浇
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // 澶勭悊鍒嗙被閫夋嫨
  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    fetchRemindersByCategory(categoryId);
  };

  // 娓叉煋鍒嗙被椤?
  const renderCategoryItem = ({ item }) => {
    const isSelected = selectedCategory === item.id;
    const chipStyle = {
      backgroundColor: isSelected ? theme.primary : `${theme.cardBackground || '#FFFFFF'}E6`,
      borderColor: isSelected ? theme.primary : `${theme.border || '#D9E2EC'}CC`,
      shadowColor: isSelected ? theme.primary : '#94A3B8',
    };
    const nameColor = isSelected ? '#FFFFFF' : theme.text;
    const badgeStyle = {
      backgroundColor: isSelected ? '#FFFFFF' : `${theme.primary}1A`,
    };

    return (
      <TouchableOpacity
        style={[styles.categoryItem, chipStyle]}
        onPress={() => handleCategorySelect(item.id)}
      >
        <Text style={[styles.categoryName, { color: nameColor }]}>
          {item.name}
        </Text>
        <View style={[styles.categoryBadge, badgeStyle]}>
          <Text style={[styles.categoryCount, { color: theme.primary }]}>
            {item.count}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // 娓叉煋鎻愰啋椤?
  const renderReminderItem = ({ item }) => {
    const titleStyle = {
      color: theme.text,
      textDecorationLine: item.is_completed ? 'line-through' : 'none',
    };

    return (
      <TouchableOpacity
        style={[
          styles.reminderItem,
          {
            backgroundColor: `${theme.cardBackground || '#FFFFFF'}EE`,
            borderLeftColor: item.color || theme.primary,
          },
        ]}
        onPress={() => navigation.navigate('ReminderDetail', { id: item.id, reminder: item })}
      >
        <View style={styles.reminderContent}>
          <Text style={[styles.reminderTitle, titleStyle]}>
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
  };

  // 娓叉煋鍒嗙粍澶撮儴
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

  // 鑾峰彇褰撳墠閫変腑鍒嗙被鍚嶇О
  const getSelectedCategoryName = () => {
    const category = categories.find(cat => cat.id === selectedCategory);
    return category ? category.name : '鍏ㄩ儴';
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
            {getSelectedCategoryName()} 鎻愰啋
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
              璇ュ垎绫讳笅娌℃湁鎻愰啋
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
    paddingVertical: 9,
    marginRight: 10,
    borderRadius: 22,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
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
    backgroundColor: '#FFFFFFD9',
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
    padding: 13,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#D9E2EC99',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
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

