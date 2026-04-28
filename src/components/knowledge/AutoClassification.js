/**
 * 自动分类组件
 * 提供自动分类、标签推荐、相似笔记查找等功能
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import autoClassificationApi from '../../services/api/autoClassificationApi';
import { SPACING, TYPOGRAPHY } from '../../styles/constants';

/**
 * 自动分类组件
 * @param {string} noteId - 笔记ID
 * @param {Array} currentTags - 当前标签列表
 * @param {string} currentCategory - 当前分类
 * @param {function} onTagsSelected - 标签选择回调
 * @param {function} onCategorySelected - 分类选择回调
 * @param {function} onNoteSelected - 笔记选择回调
 */
const AutoClassification = ({
  noteId,
  currentTags = [],
  currentCategory = null,
  onTagsSelected,
  onCategorySelected,
  onNoteSelected,
}) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [suggestedCategories, setSuggestedCategories] = useState([]);
  const [similarNotes, setSimilarNotes] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // 加载推荐
  const loadRecommendations = async () => {
    if (!noteId) {return;}

    setLoading(true);
    setError(null);

    try {
      // 获取标签推荐
      const tagsResponse = await autoClassificationApi.suggestTags(noteId, 10);
      if (tagsResponse.success) {
        // 过滤掉已有的标签
        const newTags = tagsResponse.data.tags.filter(
          (tag) => !currentTags.includes(tag)
        );
        setSuggestedTags(newTags);
      }

      // 获取分类推荐
      const classifyResponse = await autoClassificationApi.autoClassifyNote(noteId);
      if (classifyResponse.success) {
        setSuggestedCategories(classifyResponse.data.categories || []);
      }

      // 获取相似笔记
      const similarResponse = await autoClassificationApi.findSimilarNotes(noteId, 0.3, 5);
      if (similarResponse.success) {
        setSimilarNotes(similarResponse.data.similar_notes || []);
      }
    } catch (err) {
      setError('加载推荐失败，请稍后重试');
      console.error('加载推荐失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    if (noteId) {
      loadRecommendations();
    }
  }, [noteId]);

  // 选择标签
  const handleTagSelect = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // 选择分类
  const handleCategorySelect = (category) => {
    setSelectedCategory(category === selectedCategory ? null : category);
  };

  // 应用选择
  const handleApply = () => {
    if (selectedTags.length > 0 && onTagsSelected) {
      onTagsSelected(selectedTags);
    }

    if (selectedCategory && onCategorySelected) {
      onCategorySelected(selectedCategory);
    }
  };

  // 选择相似笔记
  const handleNoteSelect = (note) => {
    if (onNoteSelected) {
      onNoteSelected(note);
    }
  };

  // 渲染标签项
  const renderTagItem = (tag) => {
    const isSelected = selectedTags.includes(tag);
    return (
      <TouchableOpacity
        key={tag}
        style={[
          styles.tagItem,
          {
            backgroundColor: isSelected
              ? colors.primary + '30'
              : colors.card,
            borderColor: isSelected
              ? colors.primary
              : colors.border,
          },
        ]}
        onPress={() => handleTagSelect(tag)}
      >
        <Text
          style={[
            styles.tagText,
            { color: isSelected ? colors.primary : colors.text },
          ]}
        >
          {tag}
        </Text>
        {isSelected && (
          <Icon name="check" size={16} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  // 渲染分类项
  const renderCategoryItem = (category) => {
    const isSelected = selectedCategory && selectedCategory.id === category.id;
    return (
      <TouchableOpacity
        key={category.id}
        style={[
          styles.categoryItem,
          {
            backgroundColor: isSelected
              ? colors.primary + '30'
              : colors.card,
            borderColor: isSelected
              ? colors.primary
              : colors.border,
          },
        ]}
        onPress={() => handleCategorySelect(category)}
      >
        <Text
          style={[
            styles.categoryName,
            { color: isSelected ? colors.primary : colors.text },
          ]}
        >
          {category.name}
        </Text>
        <Text
          style={[
            styles.categorySimilarity,
            { color: isSelected ? colors.primary : colors.text },
          ]}
        >
          {Math.round(category.similarity * 100)}% 匹配
        </Text>
        {isSelected && (
          <Icon name="check" size={16} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  // 渲染相似笔记项
  const renderNoteItem = (note) => {
    return (
      <TouchableOpacity
        key={note.id}
        style={[
          styles.noteItem,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        onPress={() => handleNoteSelect(note)}
      >
        <Text style={[styles.noteTitle, { color: colors.text }]}>
          {note.title}
        </Text>
        <Text style={[styles.noteSimilarity, { color: colors.text }]}>
          {Math.round(note.similarity * 100)}% 相似
        </Text>
        <Icon name="chevron-right" size={20} color={colors.text} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          正在分析笔记内容...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Icon name="error" size={40} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={loadRecommendations}
        >
          <Text style={[styles.retryButtonText, { color: colors.white }]}>
            重试
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 标签推荐 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          推荐标签
        </Text>
        {suggestedTags.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagsContainer}
          >
            {suggestedTags.map(renderTagItem)}
          </ScrollView>
        ) : (
          <Text style={[styles.emptyText, { color: colors.text }]}>
            没有找到推荐标签
          </Text>
        )}
      </View>

      {/* 分类推荐 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          推荐分类
        </Text>
        {suggestedCategories.length > 0 ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
          >
            {suggestedCategories.map(renderCategoryItem)}
          </ScrollView>
        ) : (
          <Text style={[styles.emptyText, { color: colors.text }]}>
            没有找到推荐分类
          </Text>
        )}
      </View>

      {/* 相似笔记 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          相似笔记
        </Text>
        {similarNotes.length > 0 ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.notesContainer}
          >
            {similarNotes.map(renderNoteItem)}
          </ScrollView>
        ) : (
          <Text style={[styles.emptyText, { color: colors.text }]}>
            没有找到相似笔记
          </Text>
        )}
      </View>

      {/* 应用按钮 */}
      {(selectedTags.length > 0 || selectedCategory) && (
        <TouchableOpacity
          style={[styles.applyButton, { backgroundColor: colors.primary }]}
          onPress={handleApply}
        >
          <Text style={[styles.applyButtonText, { color: colors.white }]}>
            应用选择
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.MEDIUM,
  },
  loadingText: {
    marginTop: SPACING.MEDIUM,
    fontSize: TYPOGRAPHY.FONT_SIZE_MEDIUM,
    textAlign: 'center',
  },
  errorText: {
    marginTop: SPACING.MEDIUM,
    fontSize: TYPOGRAPHY.FONT_SIZE_MEDIUM,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SPACING.MEDIUM,
    paddingVertical: SPACING.SMALL,
    paddingHorizontal: SPACING.MEDIUM,
    borderRadius: 4,
  },
  retryButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MEDIUM,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: SPACING.MEDIUM,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MEDIUM,
    fontWeight: 'bold',
    marginBottom: SPACING.SMALL,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    paddingVertical: SPACING.SMALL,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.SMALL,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: SPACING.SMALL,
    borderWidth: 1,
  },
  tagText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
    marginRight: 4,
  },
  categoriesContainer: {
    paddingVertical: SPACING.SMALL,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.SMALL,
    paddingVertical: SPACING.SMALL,
    borderRadius: 4,
    marginBottom: SPACING.SMALL,
    borderWidth: 1,
  },
  categoryName: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MEDIUM,
    flex: 1,
  },
  categorySimilarity: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
    marginRight: SPACING.SMALL,
  },
  notesContainer: {
    paddingVertical: SPACING.SMALL,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.SMALL,
    paddingVertical: SPACING.SMALL,
    borderRadius: 4,
    marginBottom: SPACING.SMALL,
    borderWidth: 1,
  },
  noteTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MEDIUM,
    flex: 1,
  },
  noteSimilarity: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
    marginRight: SPACING.SMALL,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: SPACING.SMALL,
  },
  applyButton: {
    paddingVertical: SPACING.SMALL,
    paddingHorizontal: SPACING.MEDIUM,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: SPACING.SMALL,
  },
  applyButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MEDIUM,
    fontWeight: 'bold',
  },
});

export default AutoClassification;
