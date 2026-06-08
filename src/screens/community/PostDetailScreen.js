import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../components/common';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import { SPACING } from '../../utils/constants/dimensions';
import {
  fetchPostDetail,
  fetchComments,
  likePost,
  toggleBookmark,
  postComment,
  toggleUserFollow,
  toggleCommentLike,
} from '../../redux/slices/communitySlice';
import networkErrorService from '../../services/networkErrorService';
import useHideMainTabBar from './useHideMainTabBar';
import tryRestoreDevSession from '../../services/auth/devSessionRestore';
import resolvePostDetailCommentStats from './postDetailCommentStats';
import {
  setAuthRefreshToken,
  setAuthToken,
  setIsAuthenticated,
  setUserInfo,
} from '../../redux/slices/authSlice';

/**
 * 社区帖子详情屏幕
 * 用于查看帖子详情、评论与互动
 */
const PostDetailScreen = ({ route, navigation }) => {
  const { postId } = route.params;
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);

  useHideMainTabBar();

  const {
    currentPost: post,
    comments,
    commentsPagination,
    isLoading,
    error,
    likedPosts,
    bookmarkedPosts,
    likedComments,
    followedUsers,
  } = useSelector((state) => state.community);
  const isAuthenticated = useSelector((state) => state.auth?.isAuthenticated);

  const liked = post ? likedPosts[post.id] : false;
  const bookmarked = post ? bookmarkedPosts[post.id] : false;
  const followed = post && post.authorId ? (followedUsers[post.authorId] ?? post.followed) : false;

  const busy = isLoading || submittingComment;
  const pageState = isLoading && !post ? 'loading' : post ? 'ready' : error ? 'error' : 'empty';
  const { totalCommentCount: commentsTotal } = resolvePostDetailCommentStats({
    post,
    commentsPagination,
    comments,
  });
  const hasMoreComments = (commentsPagination?.page ?? 1) < (commentsPagination?.totalPages ?? 1);

  const applyRestoredSession = useCallback((restoredSession) => {
    if (!restoredSession?.token) {
      return false;
    }

    dispatch(setIsAuthenticated(true));
    dispatch(setUserInfo(restoredSession.user || null));
    dispatch(setAuthToken(restoredSession.token));

    if (restoredSession.refreshToken) {
      dispatch(setAuthRefreshToken(restoredSession.refreshToken));
    }

    return true;
  }, [dispatch]);

  const loadPostData = useCallback(async () => {
    try {
      if (!isAuthenticated) {
        const restoredSession = await tryRestoreDevSession();
        applyRestoredSession(restoredSession);
      }

      await dispatch(fetchPostDetail(postId)).unwrap();
      await dispatch(fetchComments({ postId, page: 1 })).unwrap();
    } catch (requestError) {
      if (String(requestError || '').includes('登录状态已失效')) {
        const restoredSession = await tryRestoreDevSession({ forceRefresh: true });
        if (applyRestoredSession(restoredSession)) {
          await dispatch(fetchPostDetail(postId)).unwrap();
          await dispatch(fetchComments({ postId, page: 1 })).unwrap();
          return;
        }
      }

      if (networkErrorService.isNetworkError(requestError)) {
        networkErrorService.handleApiError(requestError, {
          context: '加载帖子详情',
          customMessage: '网络连接失败，无法加载帖子详情',
        });
      }
    }
  }, [applyRestoredSession, dispatch, isAuthenticated, postId]);

  const renderAvatar = useCallback((avatarUri, style, fallbackStyle) => {
    if (avatarUri) {
      return <Image source={{ uri: avatarUri }} style={style} />;
    }

    return <View style={[style, fallbackStyle]} />;
  }, []);

  useEffect(() => {
    loadPostData();
    return () => {
      dispatch({ type: 'community/clearCurrentPost' });
    };
  }, [dispatch, loadPostData]);

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !post || submittingComment) {return;}
    setSubmittingComment(true);
    try {
      await dispatch(
        postComment({
          postId: post.id,
          content: commentText,
          parentId: replyTarget?.id ?? null,
        })
      ).unwrap();
      await dispatch(fetchComments({ postId, page: 1 })).unwrap();
      setCommentText('');
      setReplyTarget(null);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReplyComment = (comment) => {
    setReplyTarget(comment);
  };

  const handleCancelReply = () => {
    setReplyTarget(null);
  };

  const handleLoadMoreComments = async () => {
    if (isLoading || !post || !hasMoreComments) {return;}
    await dispatch(fetchComments({ postId, page: (commentsPagination?.page ?? 1) + 1 })).unwrap();
  };

  const renderReplyItem = (reply, parentCommentId) => (
    <View
      key={reply.id}
      style={[styles.replyItem, { borderColor: `${theme.primary}16`, backgroundColor: `${theme.background}E6` }]}
      testID={`item.community.postDetail.reply.${parentCommentId}.${reply.id}`}
    >
      <View style={styles.replyHeader}>
        <View style={styles.commentAuthor}>
          {renderAvatar(reply.authorAvatar, styles.commentAvatar, styles.avatarFallback)}
          <Text style={[styles.commentAuthorName, { color: theme.text }]}>{reply.author}</Text>
        </View>
        <Text style={[styles.commentTimestamp, { color: theme.textSecondary }]}>
          {reply.timestamp ? new Date(reply.timestamp).toLocaleDateString() : '时间未知'}
        </Text>
      </View>
      <Text style={[styles.replyContent, { color: theme.text }]}>{reply.content}</Text>
      <View style={styles.replyFooter}>
        <TouchableOpacity
          style={styles.commentLike}
          onPress={() => dispatch(toggleCommentLike(reply.id))}
          testID={`action.community.postDetail.replyLike.${parentCommentId}.${reply.id}`}
        >
          <Icon
            name={likedComments?.[reply.id] ? 'thumb-up' : 'thumb-up-off-alt'}
            size={15}
            color={likedComments?.[reply.id] ? theme.primary : theme.textSecondary}
          />
          <Text style={[styles.commentLikeCount, { color: likedComments?.[reply.id] ? theme.primary : theme.textSecondary }]}>
            {reply.likes}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const handleLike = () => {
    if (!post) {return;}
    dispatch(likePost({ postId: post.id, liked: !liked }));
  };

  const handleBookmark = () => {
    if (!post) {return;}
    dispatch(toggleBookmark(post.id));
  };

  const handleFollow = () => {
    if (!post || !post.authorId) {return;}
    dispatch(toggleUserFollow(post.authorId));
  };

  const handleShare = async () => {
    if (!post) {return;}
    try {
      await Share.share({
        message: `${post.title} - ${post.author}\n\n${(post.content || '').substring(0, 100)}...\n\n在零屿笔记社区查看更多`,
        title: post.title,
      });
    } catch (_) {}
  };

  const handleDownload = (attachment) => {
    console.log('下载附件:', attachment);
  };

  const renderHeader = () => (
    <View
      style={[
        styles.header,
        styles.glassBlock,
        {
          borderBottomColor: `${theme.primary}22`,
          paddingTop: Math.max(insets.top, SPACING.MEDIUM),
        },
      ]}
    >
      <ScreenHeaderBackButton onPress={() => navigation.goBack()} testID="action.community.postDetail.back" style={styles.backIconBtn} />
      <Text style={[styles.headerTitle, { color: theme.text }]}>帖子详情</Text>
      <View style={styles.headerRight}>
        {post ? (
          <>
            <TouchableOpacity onPress={handleBookmark} style={styles.headerButton} testID="action.community.postDetail.bookmark">
              <Icon name={bookmarked ? 'bookmark' : 'bookmark-border'} size={22} color={bookmarked ? theme.primary : theme.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.headerButton} testID="action.community.postDetail.share">
              <Icon name="share" size={22} color={theme.text} />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.headerPlaceholder} />
        )}
      </View>
    </View>
  );

  if (isLoading && !post) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: theme.background }]}
        testID="state.community.postDetail.loading"
      >
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>加载中...</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]} testID="state.community.postDetail.empty">
        {renderHeader()}
        <View style={styles.emptyStateContainer}>
          <View style={[styles.emptyStateCard, styles.glassBlock, { borderColor: `${theme.primary}18` }]}>
            <Icon name="error" size={64} color={theme.error} />
            <Text style={[styles.errorText, { color: theme.text }]}>帖子不存在或已被删除</Text>
            <Button title="返回" onPress={() => navigation.goBack()} type="primary" style={styles.backButton} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : null}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      testID="screen.community.postDetail"
    >
      <View testID={`state.community.postDetail.state.${pageState}`} />
      <View testID={`state.community.postDetail.busy.visibility.${busy ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.postDetail.comments.count.${comments.length}`} />
      <View testID={`state.community.postDetail.comments.total.${commentsTotal}`} />
      {renderHeader()}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.postShell, styles.glassBlock, { borderColor: `${theme.primary}20` }]}>
          <View style={styles.postHeader}>
            <View style={styles.authorContainer}>
              {renderAvatar(post.authorAvatar, styles.avatar, styles.avatarFallback)}
              <Text style={[styles.authorName, { color: theme.text }]}>{post.author}</Text>
            </View>
            <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
              {post.timestamp ? new Date(post.timestamp).toLocaleDateString() : '时间未知'}
            </Text>
          </View>

          <Text style={[styles.postTitle, { color: theme.text }]}>{post.title}</Text>

          <View style={styles.tagsContainer}>
            {(post.tags || []).map((tag, index) => (
              <View key={`${tag}-${index}`} style={[styles.tag, { backgroundColor: `${theme.primary}1E`, borderColor: `${theme.primary}30` }]}>
                <Text style={[styles.tagText, { color: theme.primary }]}>{tag}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.postContent, { color: theme.text }]}>{post.content}</Text>
        </View>

        {post.attachments && post.attachments.length > 0 && (
          <View style={[styles.attachmentsContainer, styles.glassBlock, { borderColor: `${theme.primary}20` }]}>
            <Text style={[styles.attachmentsTitle, { color: theme.text }]}>附件</Text>
            {post.attachments.map((attachment) => (
              <TouchableOpacity
                key={attachment.id}
                style={styles.attachmentItem}
                onPress={() => handleDownload(attachment)}
                testID={`action.community.postDetail.download.${attachment.id}`}
              >
                <Icon name={attachment.type === 'pdf' ? 'picture-as-pdf' : 'insert-drive-file'} size={24} color={theme.primary} />
                <View style={styles.attachmentInfo}>
                  <Text style={[styles.attachmentName, { color: theme.text }]}>{attachment.name}</Text>
                  <Text style={[styles.attachmentSize, { color: theme.textSecondary }]}>{attachment.size}</Text>
                </View>
                <Icon name="file-download" size={22} color={theme.primary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={[styles.postStats, styles.glassBlock, { borderColor: `${theme.primary}20` }]}>
          <TouchableOpacity style={styles.statButton} onPress={handleLike} testID="action.community.postDetail.like">
            <Icon name={liked ? 'thumb-up' : 'thumb-up-off-alt'} size={20} color={liked ? theme.primary : theme.textSecondary} />
            <Text style={[styles.statText, { color: liked ? theme.primary : theme.textSecondary }]}>{post.likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statButton} onPress={handleFollow} testID="action.community.postDetail.follow">
            <Icon name={followed ? 'person-remove' : 'person-add'} size={20} color={followed ? theme.primary : theme.textSecondary} />
            <Text style={[styles.statText, { color: followed ? theme.primary : theme.textSecondary }]}>{followed ? '已关注' : '关注'}</Text>
          </TouchableOpacity>
          <View style={styles.statItem}>
            <Icon name="comment" size={20} color={theme.textSecondary} />
            <Text style={[styles.statText, { color: theme.textSecondary }]}>{commentsTotal}</Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="file-download" size={20} color={theme.textSecondary} />
            <Text style={[styles.statText, { color: theme.textSecondary }]}>{post.downloads}</Text>
          </View>
        </View>

        <View style={styles.commentsSection}>
          <Text style={[styles.commentsTitle, { color: theme.text }]}>评论 ({commentsTotal})</Text>

          {comments.map((comment) => (
            <View key={comment.id} style={[styles.commentItem, styles.glassBlock, { borderColor: `${theme.primary}20` }]} testID={`item.community.postDetail.comment.${comment.id}`}>
              <View style={styles.commentHeader}>
                <View style={styles.commentAuthor}>
                  {renderAvatar(comment.authorAvatar, styles.commentAvatar, styles.avatarFallback)}
                  <Text style={[styles.commentAuthorName, { color: theme.text }]}>{comment.author}</Text>
                </View>
                <Text style={[styles.commentTimestamp, { color: theme.textSecondary }]}>
                  {comment.timestamp ? new Date(comment.timestamp).toLocaleDateString() : '时间未知'}
                </Text>
              </View>
              <Text style={[styles.commentContent, { color: theme.text }]}>{comment.content}</Text>
              {comment.replyCount > 0 && (
                <Text style={[styles.replyCountText, { color: theme.textSecondary }]}>
                  回复 ({comment.replyCount})
                </Text>
              )}
              {Array.isArray(comment.replies) && comment.replies.length > 0 && (
                <View style={styles.replyList}>
                  {comment.replies.map(reply => renderReplyItem(reply, comment.id))}
                </View>
              )}
              <View style={styles.commentFooter}>
                <TouchableOpacity style={styles.commentLike} onPress={() => dispatch(toggleCommentLike(comment.id))} testID={`action.community.postDetail.commentLike.${comment.id}`}>
                  <Icon
                    name={likedComments?.[comment.id] ? 'thumb-up' : 'thumb-up-off-alt'}
                    size={16}
                    color={likedComments?.[comment.id] ? theme.primary : theme.textSecondary}
                  />
                  <Text style={[styles.commentLikeCount, { color: likedComments?.[comment.id] ? theme.primary : theme.textSecondary }]}>
                    {comment.likes}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.commentReply}
                  onPress={() => handleReplyComment(comment)}
                  testID={`action.community.postDetail.commentReply.${comment.id}`}
                >
                  <Text style={[styles.commentReplyText, { color: theme.primary }]}>回复</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {hasMoreComments && (
            <TouchableOpacity
              style={[styles.loadMoreCommentsButton, styles.glassBlock, { borderColor: `${theme.primary}18` }]}
              onPress={handleLoadMoreComments}
              disabled={isLoading}
              testID="action.community.postDetail.loadMoreComments"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <>
                  <Icon name="expand-more" size={18} color={theme.primary} />
                  <Text style={[styles.loadMoreCommentsText, { color: theme.primary }]}>
                    加载更多评论
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <View style={[styles.commentInputContainer, styles.glassBlock, { borderColor: `${theme.primary}16` }]}>
        {replyTarget && (
          <View style={[styles.replyBanner, { backgroundColor: `${theme.primary}14`, borderColor: `${theme.primary}26` }]}>
            <View style={styles.replyBannerTextWrap}>
              <Text style={[styles.replyBannerTitle, { color: theme.primary }]}>正在回复 {replyTarget.author}</Text>
              <Text style={[styles.replyBannerContent, { color: theme.textSecondary }]} numberOfLines={1}>
                {replyTarget.content}
              </Text>
            </View>
            <TouchableOpacity onPress={handleCancelReply} testID="action.community.postDetail.cancelReply">
              <Icon name="close" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.commentInputRow}>
          <TextInput
            style={[styles.commentInput, { color: theme.text, backgroundColor: `${theme.background}EE`, borderColor: `${theme.primary}1C` }]}
            placeholder={replyTarget ? `回复 ${replyTarget.author}...` : '写下你的评论...'}
            placeholderTextColor={theme.textSecondary}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            testID="input.community.postDetail.comment"
          />
          <TouchableOpacity
            style={[styles.commentSubmitButton, { backgroundColor: commentText.trim() ? theme.primary : theme.disabled }]}
            onPress={handleSubmitComment}
            disabled={!commentText.trim() || submittingComment}
            testID="action.community.postDetail.submitComment"
          >
            {submittingComment ? <ActivityIndicator size="small" color="#FFF" /> : <Icon name="send" size={20} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: SPACING.MEDIUM, fontSize: 16 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.LARGE },
  emptyStateContainer: {
    flex: 1,
    paddingHorizontal: SPACING.LARGE,
    paddingTop: SPACING.XLARGE,
    alignItems: 'center',
  },
  emptyStateCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: SPACING.XLARGE,
    paddingVertical: SPACING.XLARGE,
    alignItems: 'center',
  },
  errorText: { fontSize: 18, textAlign: 'center', marginTop: SPACING.MEDIUM, marginBottom: SPACING.LARGE },
  backButton: { marginTop: SPACING.MEDIUM },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.MEDIUM,
    paddingTop: SPACING.MEDIUM,
    paddingBottom: SPACING.SMALL,
    borderBottomWidth: 1,
  },
  backIconBtn: { width: 40 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerRight: { flexDirection: 'row' },
  headerPlaceholder: { width: 72 },
  headerButton: { padding: SPACING.SMALL, marginLeft: SPACING.SMALL },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.MEDIUM, paddingBottom: SPACING.XLARGE },
  postShell: {
    borderRadius: 14,
    borderWidth: 1,
    padding: SPACING.MEDIUM,
    marginBottom: SPACING.MEDIUM,
  },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.MEDIUM },
  authorContainer: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: SPACING.SMALL, backgroundColor: '#D5DEE9' },
  avatarFallback: { backgroundColor: '#D5DEE9' },
  authorName: { fontSize: 16, fontWeight: '500' },
  timestamp: { fontSize: 14 },
  postTitle: { fontSize: 22, fontWeight: '700', marginBottom: SPACING.MEDIUM },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.MEDIUM },
  tag: {
    paddingHorizontal: SPACING.SMALL,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: SPACING.SMALL,
    marginBottom: SPACING.SMALL,
    borderWidth: 1,
  },
  tagText: { fontSize: 12, fontWeight: '500' },
  postContent: { fontSize: 16, lineHeight: 24 },
  attachmentsContainer: {
    borderRadius: 12,
    padding: SPACING.MEDIUM,
    marginBottom: SPACING.LARGE,
    borderWidth: 1,
  },
  attachmentsTitle: { fontSize: 16, fontWeight: '700', marginBottom: SPACING.MEDIUM },
  attachmentItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.SMALL },
  attachmentInfo: { flex: 1, marginLeft: SPACING.SMALL },
  attachmentName: { fontSize: 14, fontWeight: '500' },
  attachmentSize: { fontSize: 12 },
  postStats: {
    flexDirection: 'row',
    marginBottom: SPACING.LARGE,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  statButton: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flexDirection: 'row', alignItems: 'center' },
  statText: { fontSize: 14, marginLeft: 4 },
  commentsSection: { marginBottom: SPACING.LARGE },
  commentsTitle: { fontSize: 18, fontWeight: '700', marginBottom: SPACING.MEDIUM },
  loadMoreCommentsButton: {
    marginTop: SPACING.SMALL,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: SPACING.MEDIUM,
    paddingHorizontal: SPACING.MEDIUM,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.XSMALL,
  },
  loadMoreCommentsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentItem: {
    borderRadius: 10,
    padding: SPACING.MEDIUM,
    marginBottom: SPACING.MEDIUM,
    borderWidth: 1,
  },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.SMALL },
  commentAuthor: { flexDirection: 'row', alignItems: 'center' },
  commentAvatar: { width: 24, height: 24, borderRadius: 12, marginRight: SPACING.SMALL, backgroundColor: '#D5DEE9' },
  commentAuthorName: { fontSize: 14, fontWeight: '500' },
  commentTimestamp: { fontSize: 12 },
  commentContent: { fontSize: 14, lineHeight: 20, marginBottom: SPACING.SMALL },
  replyCountText: { fontSize: 12, marginBottom: SPACING.SMALL },
  replyList: { marginTop: SPACING.SMALL, gap: SPACING.SMALL },
  replyItem: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: SPACING.SMALL,
  },
  replyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  replyContent: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  replyFooter: { flexDirection: 'row', justifyContent: 'flex-start' },
  commentFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  commentLike: { flexDirection: 'row', alignItems: 'center' },
  commentLikeCount: { fontSize: 12, marginLeft: 4 },
  commentReply: {},
  commentReplyText: { fontSize: 12, fontWeight: '500' },
  commentInputContainer: {
    gap: SPACING.SMALL,
    padding: SPACING.MEDIUM,
    borderTopWidth: 1,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: SPACING.SMALL,
  },
  replyBannerTextWrap: { flex: 1, marginRight: SPACING.SMALL },
  replyBannerTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  replyBannerContent: { fontSize: 12 },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: SPACING.SMALL,
    maxHeight: 100,
    borderWidth: 1,
  },
  commentSubmitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.SMALL,
  },
  glassBlock: {
    backgroundColor: 'rgba(255,255,255,0.84)',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
});

export default PostDetailScreen;
