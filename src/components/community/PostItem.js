/**
 * 社区帖子项组件
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
import { MarkdownPreview } from '../common';

/**
 * 社区帖子项组件
 * @param {Object} post - 帖子对象
 * @param {Function} onPress - 点击回调
 * @param {Function} onLikePress - 点赞回调
 * @param {Function} onCommentPress - 评论回调
 * @param {Function} onSharePress - 分享回调
 * @param {Function} onUserPress - 用户点击回调
 */
const PostItem = ({
  post,
  onPress,
  onLikePress,
  onCommentPress,
  onSharePress,
  onUserPress,
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  // 提取帖子信息
  const {
    title,
    content,
    excerpt,
    created_at,
    updated_at,
    user,
    like_count,
    comment_count,
    is_liked,
    category,
    tags = [],
    has_images,
    is_featured,
  } = post || {};

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

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: colors.card }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* 帖子头部 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.userContainer}
          onPress={onUserPress}
        >
          <Image
            source={
              user?.avatar
                ? { uri: user.avatar }
                : require('../../assets/images/default-avatar.png')
            }
            style={styles.avatar}
          />
          <View style={styles.userInfo}>
            <Text
              variant="body"
              size="medium"
              bold
            >
              {user?.username || '匿名用户'}
            </Text>
            <Text
              variant="caption"
              color="hint"
            >
              {formatDate(created_at)}
            </Text>
          </View>
        </TouchableOpacity>

        {is_featured && (
          <View
            style={[
              styles.featuredBadge,
              { backgroundColor: colors.warning }
            ]}
          >
            <Icon name="star" size={12} color="#FFFFFF" />
            <Text
              variant="caption"
              color="card"
              style={styles.featuredText}
            >
              精选
            </Text>
          </View>
        )}
      </View>

      {/* 帖子内容 */}
      <View style={styles.content}>
        <Text
          variant="heading"
          level="h6"
          numberOfLines={2}
          style={styles.title}
        >
          {title}
        </Text>

        {excerpt ? (
          <Text
            variant="body"
            size="medium"
            numberOfLines={3}
            style={styles.excerpt}
          >
            {excerpt}
          </Text>
        ) : (
          <View style={styles.markdownContainer}>
            <MarkdownPreview
              content={content}
              scrollEnabled={false}
            />
          </View>
        )}
      </View>

      {/* 帖子底部 */}
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

          {renderTags()}
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onLikePress}
          >
            <Icon
              name={is_liked ? 'favorite' : 'favorite-border'}
              size={20}
              color={is_liked ? colors.error : colors.text}
            />
            <Text
              variant="caption"
              color={is_liked ? 'error' : 'text'}
              style={styles.actionText}
            >
              {like_count || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={onCommentPress}
          >
            <Icon
              name="comment"
              size={20}
              color={colors.text}
            />
            <Text
              variant="caption"
              color="text"
              style={styles.actionText}
            >
              {comment_count || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={onSharePress}
          >
            <Icon
              name="share"
              size={20}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  userInfo: {
    marginLeft: 14,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  featuredText: {
    marginLeft: 6,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    paddingTop: 8,
  },
  title: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  excerpt: {
    lineHeight: 22,
    fontSize: 15,
    opacity: 0.85,
  },
  markdownContainer: {
    maxHeight: 120,
    overflow: 'hidden',
    marginTop: 4,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 12,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(0,0,0,0.03)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 6,
  },
  categoryColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginRight: 6,
    marginBottom: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  moreTagsText: {
    marginLeft: 6,
    fontSize: 12,
    opacity: 0.7,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.03)',
    paddingTop: 12,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 20,
    backgroundColor: 'rgba(0,0,0,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  actionText: {
    marginLeft: 6,
    fontWeight: '500',
  },
});

export default PostItem;
