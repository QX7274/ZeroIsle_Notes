import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING } from '../../utils/constants/dimensions';
import knowledgeGraphApi from '../../services/api/knowledgeGraphApi';

/**
 * 标签生成组件
 * 根据文本内容自动生成标签，支持手动添加和删除
 */
const TagGenerator = ({
  text,
  title,
  initialTags = [],
  onTagsChange,
  maxTags = 10,
}) => {
  const { theme } = useTheme();
  const [tags, setTags] = useState(initialTags);
  const [suggestedTags, setSuggestedTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customTag, setCustomTag] = useState('');

  // 当初始标签变化时更新
  useEffect(() => {
    setTags(initialTags);
  }, [initialTags]);

  // 生成标签
  const generateTags = async () => {
    if (!text || loading) {return;}

    setLoading(true);
    try {
      const response = await knowledgeGraphApi.generateTags({
        text,
        title,
        count: 10,
      });

      // 过滤掉已有的标签
      const newSuggestions = response.data.tags.filter(
        (tag) => !tags.includes(tag)
      );
      setSuggestedTags(newSuggestions);
    } catch (error) {
      console.error('生成标签失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 添加标签
  const addTag = (tag) => {
    if (tags.length >= maxTags || tags.includes(tag)) {return;}

    const newTags = [...tags, tag];
    setTags(newTags);

    // 从建议中移除
    setSuggestedTags(suggestedTags.filter((t) => t !== tag));

    // 通知父组件
    if (onTagsChange) {
      onTagsChange(newTags);
    }
  };

  // 移除标签
  const removeTag = (tag) => {
    const newTags = tags.filter((t) => t !== tag);
    setTags(newTags);

    // 通知父组件
    if (onTagsChange) {
      onTagsChange(newTags);
    }
  };

  // 添加自定义标签
  const addCustomTag = () => {
    if (!customTag.trim() || tags.includes(customTag.trim())) {
      setCustomTag('');
      return;
    }

    addTag(customTag.trim());
    setCustomTag('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>标签</Text>
        <TouchableOpacity
          style={[styles.generateButton, { backgroundColor: theme.primary }]}
          onPress={generateTags}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.generateButtonText}>自动生成</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 已选标签 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tagsContainer}
        contentContainerStyle={styles.tagsContent}
      >
        {tags.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            尚未添加标签
          </Text>
        ) : (
          tags.map((tag) => (
            <View
              key={tag}
              style={[
                styles.tagItem,
                { backgroundColor: theme.primary + '20' },
              ]}
            >
              <Text style={[styles.tagText, { color: theme.primary }]}>
                {tag}
              </Text>
              <TouchableOpacity
                style={styles.removeTagButton}
                onPress={() => removeTag(tag)}
              >
                <Icon name="close" size={16} color={theme.primary} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* 自定义标签输入 */}
      <View style={styles.customTagContainer}>
        <TextInput
          style={[
            styles.customTagInput,
            { color: theme.text, borderColor: theme.border },
          ]}
          placeholder="添加自定义标签..."
          placeholderTextColor={theme.textSecondary}
          value={customTag}
          onChangeText={setCustomTag}
          onSubmitEditing={addCustomTag}
          maxLength={20}
        />
        <TouchableOpacity
          style={[
            styles.addCustomButton,
            { backgroundColor: theme.primary },
          ]}
          onPress={addCustomTag}
          disabled={!customTag.trim()}
        >
          <Icon name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* 建议标签 */}
      {suggestedTags.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={[styles.suggestionsTitle, { color: theme.text }]}>
            建议标签
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.suggestionsScroll}
            contentContainerStyle={styles.suggestionsContent}
          >
            {suggestedTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.suggestionItem,
                  { borderColor: theme.border },
                ]}
                onPress={() => addTag(tag)}
              >
                <Text style={[styles.suggestionText, { color: theme.text }]}>
                  {tag}
                </Text>
                <Icon name="add" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.MEDIUM,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.SMALL,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  generateButton: {
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: SPACING.SMALL,
    borderRadius: 4,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  tagsContainer: {
    marginBottom: SPACING.MEDIUM,
  },
  tagsContent: {
    paddingVertical: SPACING.SMALL,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.SMALL,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: SPACING.SMALL,
  },
  tagText: {
    fontSize: 14,
    marginRight: 4,
  },
  removeTagButton: {
    padding: 2,
  },
  customTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.MEDIUM,
  },
  customTagInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: SPACING.SMALL,
  },
  addCustomButton: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginLeft: SPACING.SMALL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionsContainer: {
    marginBottom: SPACING.MEDIUM,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: SPACING.SMALL,
  },
  suggestionsScroll: {
    flexGrow: 0,
  },
  suggestionsContent: {
    paddingVertical: SPACING.SMALL,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.SMALL,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: SPACING.SMALL,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 14,
    marginRight: 4,
  },
});

export default TagGenerator;
