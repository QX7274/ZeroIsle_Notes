/**
 * 社区评论列表组件
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import CommentItem from './CommentItem';

/**
 * 社区评论列表组件
 * @param {Array} comments - 评论数组
 * @param {boolean} isLoading - 是否正在加载
 * @param {string} error - 错误信息
 * @param {Function} onAddComment - 添加评论回调
 * @param {Function} onLikeComment - 点赞评论回调
 * @param {Function} onReplyComment - 回复评论回调
 * @param {Function} onDeleteComment - 删除评论回调
 * @param {Function} onUserPress - 用户点击回调
 * @param {boolean} allowComments - 是否允许评论
 */
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
  const { colors, dimensions } = theme;
  
  // 本地状态
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 处理评论提交
  const handleSubmitComment = async () => {
    if (!commentText.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      await onAddComment(commentText, replyTo?.id);
      setCommentText('');
      setReplyTo(null);
    } catch (error) {
      console.error('提交评论失败:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // 处理回复评论
  const handleReplyComment = (comment) => {
    setReplyTo(comment);
    onReplyComment && onReplyComment(comment);
  };
  
  // 渲染评论输入框
  const renderCommentInput = () => {
    if (!allowComments) return null;
    
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
          {replyTo && (
            <View style={styles.replyToContainer}>
              <Text
                variant="caption"
                color="hint"
              >
                回复: 
              </Text>
              <Text
                variant="caption"
                color="primary"
                style={styles.replyToName}
              >
                {replyTo.user?.username || '匿名用户'}
              </Text>
              <TouchableOpacity
                style={styles.cancelReplyButton}
                onPress={() => setReplyTo(null)}
              >
                <Icon name="close" size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
          )}
          
          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.background }
              ]}
              placeholder={replyTo ? '写下你的回复...' : '写下你的评论...'}
              placeholderTextColor={colors.textSecondary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: colors.primary },
                (!commentText.trim() || isSubmitting) && { opacity: 0.5 }
              ]}
              onPress={handleSubmitComment}
              disabled={!commentText.trim() || isSubmitting}
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
  
  // 渲染空状态
  const renderEmpty = () => {
    if (isLoading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Icon name="chat-bubble-outline" size={48} color={colors.textSecondary} />
        <Text
          variant="body"
          size="medium"
          color="hint"
          style={styles.emptyText}
        >
          暂无评论
        </Text>
        {allowComments && (
          <Text
            variant="body"
            size="small"
            color="hint"
          >
            成为第一个评论的人吧
          </Text>
        )}
      </View>
    );
  };
  
  // 渲染错误状态
  const renderError = () => {
    if (!error) return null;
    
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={32} color={colors.error} />
        <Text
          variant="body"
          size="medium"
          color="error"
          style={styles.errorText}
        >
          {error}
        </Text>
      </View>
    );
  };
  
  // 渲染加载状态
  const renderLoading = () => {
    if (!isLoading) return null;
    
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text
          variant="body"
          size="medium"
          color="hint"
          style={styles.loadingText}
        >
          加载评论中...
        </Text>
      </View>
    );
  };
  
  // 渲染评论项
  const renderItem = ({ item }) => (
    <CommentItem
      comment={item}
      onLike={() => onLikeComment && onLikeComment(item)}
      onReply={() => handleReplyComment(item)}
      onDelete={() => onDeleteComment && onDeleteComment(item)}
      onUserPress={() => onUserPress && onUserPress(item.user)}
    />
  );
  
  // 渲染评论列表
  const renderCommentList = () => {
    if (isLoading) return renderLoading();
    if (error) return renderError();
    
    return (
      <FlatList
        data={comments}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
    );
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text
          variant="heading"
          level="h6"
          style={styles.title}
        >
          评论 ({comments.length})
        </Text>
        
        {!allowComments && (
          <View style={styles.commentsDisabledContainer}>
            <Icon name="block" size={16} color={colors.error} />
            <Text
              variant="caption"
              color="error"
              style={styles.commentsDisabledText}
            >
              评论已关闭
            </Text>
          </View>
        )}
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
    borderRadius: 4,
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
});

export default CommentList;
