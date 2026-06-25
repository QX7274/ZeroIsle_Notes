/**
 * 社区评论列表组件
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import CommentItem from './CommentItem';

const CommentList = ({
  comments = [],
  isLoading = false,
  error = null,
  onAddComment,
  onLikeComment,
  onReplyComment,
  onDeleteComment,
  onUserPress,
  allowComments = true,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;

  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const commentCount = Array.isArray(comments) ? comments.length : 0;
  const listState = isLoading ? 'loading' : error ? 'error' : commentCount > 0 ? 'ready' : 'empty';
  const submitBusy = Boolean(isSubmitting);

  const handleSubmitComment = async () => {
    if (!commentText.trim() || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onAddComment?.(commentText, replyTo?.id);
      setCommentText('');
      setReplyTo(null);
    } catch (submitError) {
      console.warn('Submit comment failed:', submitError?.message || submitError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplyComment = (comment) => {
    setReplyTo(comment);
    onReplyComment?.(comment);
  };

  const renderCommentInput = () => {
    if (!allowComments) {
      return null;
    }

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
          {replyTo ? (
            <View style={styles.replyToContainer} testID="state.community.commentList.replyTo.visible">
              <Text variant="caption" color="hint">回复：</Text>
              <Text variant="caption" color="primary" style={styles.replyToName}>
                {replyTo.user?.username || '匿名用户'}
              </Text>
              <TouchableOpacity style={styles.cancelReplyButton} onPress={() => setReplyTo(null)} testID="action.community.commentList.cancelReply">
                <Icon name="close" size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.background }]}
              placeholder={replyTo ? '写下你的回复...' : '写下你的评论...'}
              placeholderTextColor={colors.textSecondary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
              testID="input.community.commentList.comment"
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: colors.primary },
                (!commentText.trim() || isSubmitting) && styles.disabledSend,
              ]}
              onPress={handleSubmitComment}
              disabled={!commentText.trim() || isSubmitting}
              testID="action.community.commentList.submit"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Icon name="send" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return null;
    }
    return (
      <View style={styles.emptyContainer} testID="state.community.commentList.empty">
        <Icon name="chat-bubble-outline" size={48} color={colors.textSecondary} />
        <Text variant="body" size="medium" color="hint" style={styles.emptyText}>
          暂无评论
        </Text>
        {allowComments ? (
          <Text variant="body" size="small" color="hint">
            成为第一个评论的人吧
          </Text>
        ) : null}
      </View>
    );
  };

  const renderError = () => {
    if (!error) {
      return null;
    }
    return (
      <View style={styles.errorContainer} testID="state.community.commentList.error">
        <Icon name="error" size={32} color={colors.error} />
        <Text variant="body" size="medium" color="error" style={styles.errorText}>
          {error}
        </Text>
      </View>
    );
  };

  const renderLoading = () => {
    if (!isLoading) {
      return null;
    }
    return (
      <View style={styles.loadingContainer} testID="state.community.commentList.loading">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="body" size="medium" color="hint" style={styles.loadingText}>
          加载评论中...
        </Text>
      </View>
    );
  };

  const renderItem = ({ item }) => (
    <CommentItem
      comment={item}
      onLike={() => onLikeComment?.(item)}
      onReply={() => handleReplyComment(item)}
      onDelete={() => onDeleteComment?.(item)}
      onUserPress={() => onUserPress?.(item.user)}
    />
  );

  const renderCommentList = () => {
    if (isLoading) {
      return renderLoading();
    }
    if (error) {
      return renderError();
    }
    return (
      <FlatList
        data={comments}
        renderItem={renderItem}
        keyExtractor={(item, index) => String(item?.id || `comment-${index}`)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        testID="list.community.commentList"
      />
    );
  };

  return (
    <View style={styles.container} testID={`state.community.commentList.state.${listState}`}>
      <View testID={`state.community.commentList.count.${commentCount}`} />
      <View testID={`state.community.commentList.error.visibility.${error ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.commentList.allowComments.visibility.${allowComments ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.commentList.submitBusy.visibility.${submitBusy ? 'visible' : 'hidden'}`} />

      <View style={styles.header}>
        <Text variant="heading" level="h6" style={styles.title}>
          评论 ({commentCount})
        </Text>
        {!allowComments ? (
          <View style={styles.commentsDisabledContainer}>
            <Icon name="block" size={16} color={colors.error} />
            <Text variant="caption" color="error" style={styles.commentsDisabledText}>
              评论已关闭
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.commentsContainer}>
        {renderCommentList()}
      </View>

      {renderCommentInput()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    flex: 1,
  },
  commentsDisabledContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FFE0E0',
  },
  commentsDisabledText: {
    marginLeft: 4,
  },
  commentsContainer: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    marginTop: 8,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
  },
  inputContainer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  replyToContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  replyToName: {
    marginLeft: 4,
  },
  cancelReplyButton: {
    marginLeft: 8,
    padding: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingRight: 40,
    fontSize: 14,
  },
  sendButton: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledSend: {
    opacity: 0.5,
  },
});

export default CommentList;
