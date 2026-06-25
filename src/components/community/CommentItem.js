/**
 * 社区评论项组件
 */
import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { MarkdownPreview } from '../common';
import { Text } from '../common/Typography';

const CommentItem = ({
  comment,
  onLike,
  onReply,
  onDelete,
  onUserPress,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const [showReplies, setShowReplies] = useState(false);

  const {
    id,
    content,
    created_at,
    user,
    like_count,
    is_liked,
    replies = [],
    reply_to,
    is_author = false,
  } = comment || {};

  const username = user?.username || '匿名用户';
  const canDelete = Boolean(user?.is_current_user || is_author);
  const commentId = String(id || 'unknown');

  const formatDate = (dateString) => {
    if (!dateString) {
      return '';
    }
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) {
      return '刚刚';
    }
    if (diffMinutes < 60) {
      return `${diffMinutes}分钟前`;
    }
    if (diffMinutes < 24 * 60) {
      return `${Math.floor(diffMinutes / 60)}小时前`;
    }
    if (diffMinutes < 7 * 24 * 60) {
      return `${Math.floor(diffMinutes / (24 * 60))}天前`;
    }
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  };

  const renderReplies = () => {
    if (!replies || replies.length === 0) {
      return null;
    }

    if (!showReplies) {
      return (
        <TouchableOpacity
          style={styles.showRepliesButton}
          onPress={() => setShowReplies(true)}
          testID={`action.community.commentItem.showReplies.${commentId}`}
        >
          <Icon name="subdirectory-arrow-right" size={16} color={colors.primary} />
          <Text variant="body" size="small" color="primary" style={styles.showRepliesText}>
            查看 {replies.length} 条回复
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.repliesContainer} testID={`state.community.commentItem.replies.${commentId}.expanded`}>
        {replies.map((reply, index) => (
          <CommentItem
            key={`reply-${reply?.id || `${commentId}-${index}`}`}
            comment={reply}
            onLike={onLike}
            onReply={onReply}
            onDelete={onDelete}
            onUserPress={onUserPress}
          />
        ))}

        <TouchableOpacity
          style={styles.hideRepliesButton}
          onPress={() => setShowReplies(false)}
          testID={`action.community.commentItem.hideReplies.${commentId}`}
        >
          <Icon name="keyboard-arrow-up" size={16} color={colors.textSecondary} />
          <Text variant="caption" color="hint" style={styles.hideRepliesText}>
            收起回复
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const contentText = content || '';
  const useMarkdown = contentText.includes('**') || contentText.includes('*') || contentText.includes('`');

  return (
    <View style={styles.container} testID={`state.community.commentItem.state.${commentId}`}>
      <View testID={`state.community.commentItem.liked.${commentId}.${is_liked ? 'on' : 'off'}`} />
      <View testID={`state.community.commentItem.hasReplies.${commentId}.${replies?.length > 0 ? 'on' : 'off'}`} />

      <TouchableOpacity style={styles.avatarContainer} onPress={() => onUserPress?.()} testID={`action.community.commentItem.user.${commentId}`}>
        <Image
          source={user?.avatar ? { uri: user.avatar } : require('../../assets/images/default-avatar.png')}
          style={styles.avatar}
        />
      </TouchableOpacity>

      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => onUserPress?.()} testID={`action.community.commentItem.userName.${commentId}`}>
            <Text variant="body" size="small" bold style={styles.username}>
              {username}
              {is_author ? (
                <Text variant="caption" color="primary" style={styles.authorBadge}>
                  {' '}作者
                </Text>
              ) : null}
            </Text>
          </TouchableOpacity>

          <Text variant="caption" color="hint">
            {formatDate(created_at)}
          </Text>
        </View>

        {reply_to ? (
          <View style={styles.replyToContainer}>
            <Icon name="reply" size={12} color={colors.textSecondary} />
            <Text variant="caption" color="hint" style={styles.replyToText}>
              回复
            </Text>
            <Text variant="caption" color="primary">
              {reply_to.user?.username || '匿名用户'}
            </Text>
          </View>
        ) : null}

        <View style={styles.commentContent}>
          {useMarkdown ? (
            <MarkdownPreview content={contentText} scrollEnabled={false} />
          ) : (
            <Text variant="body" size="medium">
              {contentText}
            </Text>
          )}
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={() => onLike?.()} testID={`action.community.commentItem.like.${commentId}`}>
            <Icon name={is_liked ? 'favorite' : 'favorite-border'} size={16} color={is_liked ? colors.error : colors.text} />
            {like_count > 0 ? (
              <Text variant="caption" color={is_liked ? 'error' : 'text'} style={styles.actionText}>
                {like_count}
              </Text>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => onReply?.()} testID={`action.community.commentItem.reply.${commentId}`}>
            <Icon name="reply" size={16} color={colors.text} />
            <Text variant="caption" color="text" style={styles.actionText}>
              回复
            </Text>
          </TouchableOpacity>

          {canDelete ? (
            <TouchableOpacity style={styles.actionButton} onPress={() => onDelete?.()} testID={`action.community.commentItem.delete.${commentId}`}>
              <Icon name="delete" size={16} color={colors.error} />
              <Text variant="caption" color="error" style={styles.actionText}>
                删除
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {renderReplies()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    marginRight: 8,
  },
  authorBadge: {
    fontSize: 10,
  },
  replyToContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  replyToText: {
    marginHorizontal: 4,
  },
  commentContent: {
    marginBottom: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    marginLeft: 4,
  },
  showRepliesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  showRepliesText: {
    marginLeft: 4,
  },
  repliesContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  hideRepliesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  hideRepliesText: {
    marginLeft: 4,
  },
});

export default CommentItem;
