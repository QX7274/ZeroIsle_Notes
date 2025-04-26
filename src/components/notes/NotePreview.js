/**
 * 笔记预览组件
 */
import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MarkdownPreview from '../common/MarkdownPreview';

/**
 * 笔记预览组件
 * @param {Object} note - 笔记对象
 * @param {Function} onPress - 点击回调
 * @param {Function} onLongPress - 长按回调
 * @param {Object} style - 自定义样式
 * @param {boolean} showActions - 是否显示操作按钮
 * @param {Function} onEdit - 编辑回调
 * @param {Function} onDelete - 删除回调
 * @param {Function} onShare - 分享回调
 */
const NotePreview = ({
  note,
  onPress,
  onLongPress,
  style,
  showActions = false,
  onEdit,
  onDelete,
  onShare,
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  
  // 提取笔记信息
  const {
    title,
    content,
    created_at,
    updated_at,
    category,
    tags = [],
    is_pinned,
    is_favorite,
    has_images,
    has_attachments,
  } = note || {};
  
  // 格式化日期
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      // 今天
      return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDays === 1) {
      // 昨天
      return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDays < 7) {
      // 一周内
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return `${days[date.getDay()]} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else {
      // 一周前
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    }
  };
  
  // 获取预览内容
  const getPreviewContent = () => {
    if (!content) return '';
    
    // 移除Markdown语法
    let previewText = content
      .replace(/#{1,6}\s+/g, '') // 移除标题
      .replace(/\*\*(.+?)\*\*/g, '$1') // 移除粗体
      .replace(/\*(.+?)\*/g, '$1') // 移除斜体
      .replace(/~~(.+?)~~/g, '$1') // 移除删除线
      .replace(/`(.+?)`/g, '$1') // 移除行内代码
      .replace(/```[\s\S]+?```/g, '[代码块]') // 替换代码块
      .replace(/!\[.*?\]\(.*?\)/g, '[图片]') // 替换图片
      .replace(/\[(.+?)\]\(.*?\)/g, '$1') // 替换链接
      .replace(/^\s*>\s+/gm, '') // 移除引用
      .replace(/^\s*[-*+]\s+/gm, '') // 移除无序列表
      .replace(/^\s*\d+\.\s+/gm, '') // 移除有序列表
      .replace(/\|.+\|/g, '[表格]') // 替换表格
      .trim();
    
    // 限制长度
    if (previewText.length > 100) {
      previewText = previewText.substring(0, 100) + '...';
    }
    
    return previewText;
  };
  
  // 渲染标签
  const renderTags = () => {
    if (!tags || tags.length === 0) return null;
    
    return (
      <View style={styles.tagsContainer}>
        {tags.slice(0, 3).map((tag, index) => (
          <View
            key={`tag-${index}`}
            style={[
              styles.tagChip,
              { backgroundColor: colors.primary + '20' }
            ]}
          >
            <Text
              variant="caption"
              color="primary"
              style={styles.tagText}
            >
              {tag.name || tag}
            </Text>
          </View>
        ))}
        
        {tags.length > 3 && (
          <Text
            variant="caption"
            color="hint"
            style={styles.moreTagsText}
          >
            +{tags.length - 3}
          </Text>
        )}
      </View>
    );
  };
  
  // 渲染操作按钮
  const renderActions = () => {
    if (!showActions) return null;
    
    return (
      <View style={styles.actionsContainer}>
        {onEdit && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
            onPress={() => onEdit(note)}
          >
            <Icon name="edit" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
        
        {onShare && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.success + '20' }]}
            onPress={() => onShare(note)}
          >
            <Icon name="share" size={16} color={colors.success} />
          </TouchableOpacity>
        )}
        
        {onDelete && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
            onPress={() => onDelete(note)}
          >
            <Icon name="delete" size={16} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>
    );
  };
  
  // 渲染指示器
  const renderIndicators = () => {
    return (
      <View style={styles.indicatorsContainer}>
        {is_pinned && (
          <Icon name="push-pin" size={16} color={colors.primary} style={styles.indicator} />
        )}
        
        {is_favorite && (
          <Icon name="star" size={16} color={colors.warning} style={styles.indicator} />
        )}
        
        {has_images && (
          <Icon name="image" size={16} color={colors.success} style={styles.indicator} />
        )}
        
        {has_attachments && (
          <Icon name="attachment" size={16} color={colors.info} style={styles.indicator} />
        )}
      </View>
    );
  };
  
  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: colors.card },
        style
      ]}
      onPress={() => onPress && onPress(note)}
      onLongPress={() => onLongPress && onLongPress(note)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text
          variant="heading"
          level="h6"
          numberOfLines={1}
          style={styles.title}
        >
          {title || '无标题笔记'}
        </Text>
        
        {renderIndicators()}
      </View>
      
      <View style={styles.content}>
        <Text
          variant="body"
          size="small"
          numberOfLines={3}
          style={styles.previewText}
        >
          {getPreviewContent()}
        </Text>
      </View>
      
      <View style={styles.footer}>
        <View style={styles.metaContainer}>
          {category && (
            <View style={styles.categoryContainer}>
              <View
                style={[
                  styles.categoryColor,
                  { backgroundColor: category.color || colors.primary }
                ]}
              />
              <Text
                variant="caption"
                color="hint"
                style={styles.categoryText}
              >
                {category.name}
              </Text>
            </View>
          )}
          
          <Text
            variant="caption"
            color="hint"
            style={styles.dateText}
          >
            {formatDate(updated_at || created_at)}
          </Text>
        </View>
        
        {renderTags()}
      </View>
      
      {renderActions()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    marginRight: 8,
  },
  indicatorsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicator: {
    marginLeft: 8,
  },
  content: {
    marginBottom: 8,
  },
  previewText: {
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  categoryColor: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  categoryText: {
    fontSize: 12,
  },
  dateText: {
    fontSize: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  tagChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 4,
  },
  tagText: {
    fontSize: 10,
  },
  moreTagsText: {
    marginLeft: 4,
    fontSize: 10,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

export default NotePreview;
