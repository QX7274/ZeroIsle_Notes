import React, { useState, useEffect } from 'react';
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
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Button, Card } from '../../components/common';
import { SPACING } from '../../utils/constants/dimensions';
import {
  fetchPostDetail,
  fetchComments,
  likePost,
  toggleBookmark,
  postComment
} from '../../redux/slices/communitySlice';

/**
 * 社区帖子详情屏幕
 * 用于查看帖子详情、评论和互动
 */
const PostDetailScreen = ({ route, navigation }) => {
  const { postId } = route.params;
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const [commentText, setCommentText] = useState('');

  // 从Redux获取状态
  const {
    currentPost: post,
    comments,
    isLoading,
    error,
    likedPosts,
    bookmarkedPosts
  } = useSelector(state => state.community);

  const liked = post ? likedPosts[post.id] : false;
  const bookmarked = post ? bookmarkedPosts[post.id] : false;

  // 模拟帖子数据
  const mockPost = {
    id: '1',
    title: '高效笔记方法分享',
    author: '学习达人',
    authorAvatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    content: `在使用零屿笔记的过程中，我总结了一些提高效率的方法，希望对大家有所帮助。

1. **结构化笔记法**
   使用标题、子标题和列表来组织笔记内容，让信息层次分明。零屿笔记的富文本编辑器支持多级标题和各种列表格式，非常适合这种方法。

2. **关键词标记**
   在笔记中使用标签功能标记关键词，方便日后通过关键词快速检索相关笔记。

3. **知识图谱关联**
   对于相关联的知识点，使用知识图谱功能建立连接，形成知识网络，帮助理解复杂概念之间的关系。

4. **定期复习提醒**
   对重要的笔记设置复习提醒，按照艾宾浩斯遗忘曲线的时间间隔进行复习，提高记忆效果。

5. **语音笔记转文本**
   在灵感突发或没有时间打字的情况下，使用语音转文本功能快速记录想法，后续再整理完善。

希望这些方法对大家有所帮助，欢迎在评论区分享你的笔记方法！`,
    likes: 128,
    comments: 32,
    downloads: 56,
    timestamp: '2025-04-20T10:30:00Z',
    tags: ['学习方法', '效率提升', '笔记技巧'],
    attachments: [
      {
        id: '1',
        name: '高效笔记模板.pdf',
        size: '2.5MB',
        type: 'pdf',
      },
    ],
  };

  // 模拟评论数据
  const mockComments = [
    {
      id: '1',
      author: '知识探索者',
      authorAvatar: 'https://randomuser.me/api/portraits/women/22.jpg',
      content: '非常实用的方法，特别是知识图谱关联这一点，帮我理清了很多复杂概念之间的关系！',
      timestamp: '2025-04-20T14:25:00Z',
      likes: 15,
    },
    {
      id: '2',
      author: '效率控',
      authorAvatar: 'https://randomuser.me/api/portraits/men/45.jpg',
      content: '语音转文本功能确实很方便，我经常在通勤路上用它记录想法。',
      timestamp: '2025-04-20T16:10:00Z',
      likes: 8,
    },
    {
      id: '3',
      author: '学习达人',
      authorAvatar: 'https://randomuser.me/api/portraits/men/32.jpg',
      content: '谢谢大家的支持！我后续会分享更多使用技巧。',
      timestamp: '2025-04-20T18:30:00Z',
      likes: 20,
    },
  ];

  // 加载数据
  useEffect(() => {
    loadPostData();

    // 组件卸载时清除当前帖子
    return () => {
      dispatch({ type: 'community/clearCurrentPost' });
    };
  }, [postId, dispatch]);

  const loadPostData = () => {
    dispatch(fetchPostDetail(postId));
    dispatch(fetchComments({ postId, page: 1 }));
  };

  // 提交评论
  const handleSubmitComment = () => {
    if (!commentText.trim() || !post) return;

    dispatch(postComment({
      postId: post.id,
      content: commentText
    }));

    setCommentText('');
  };

  // 点赞
  const handleLike = () => {
    if (!post) return;
    dispatch(likePost({ postId: post.id, liked: !liked }));
  };

  // 收藏
  const handleBookmark = () => {
    if (!post) return;
    dispatch(toggleBookmark(post.id));
  };

  // 分享
  const handleShare = async () => {
    if (!post) return;

    try {
      await Share.share({
        message: `${post.title} - ${post.author}\n\n${post.content.substring(0, 100)}...\n\n在零屿笔记社区查看更多`,
        title: post.title,
      });
    } catch (error) {
      console.error('分享失败:', error);
    }
  };

  // 下载附件
  const handleDownload = (attachment) => {
    // 实际应用中需要实现下载逻辑
    console.log('下载附件:', attachment);
  };

  if (isLoading && !post) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>加载中...</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.background }]}>
        <Icon name="error" size={64} color={theme.error} />
        <Text style={[styles.errorText, { color: theme.text }]}>帖子不存在或已被删除</Text>
        <Button
          title="返回"
          onPress={() => navigation.goBack()}
          type="primary"
          style={styles.backButton}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : null}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>帖子详情</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleBookmark} style={styles.headerButton}>
            <Icon
              name={bookmarked ? 'bookmark' : 'bookmark-border'}
              size={24}
              color={bookmarked ? theme.primary : theme.text}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
            <Icon name="share" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.postHeader}>
          <View style={styles.authorContainer}>
            <Image source={{ uri: post.authorAvatar }} style={styles.avatar} />
            <Text style={[styles.authorName, { color: theme.text }]}>{post.author}</Text>
          </View>
          <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
            {new Date(post.timestamp).toLocaleDateString()}
          </Text>
        </View>

        <Text style={[styles.postTitle, { color: theme.text }]}>{post.title}</Text>

        <View style={styles.tagsContainer}>
          {post.tags.map((tag, index) => (
            <View key={index} style={[styles.tag, { backgroundColor: theme.primary + '20' }]}>
              <Text style={[styles.tagText, { color: theme.primary }]}>{tag}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.postContent, { color: theme.text }]}>{post.content}</Text>

        {post.attachments && post.attachments.length > 0 && (
          <View style={[styles.attachmentsContainer, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.attachmentsTitle, { color: theme.text }]}>附件</Text>
            {post.attachments.map((attachment) => (
              <TouchableOpacity
                key={attachment.id}
                style={styles.attachmentItem}
                onPress={() => handleDownload(attachment)}
              >
                <Icon
                  name={attachment.type === 'pdf' ? 'picture-as-pdf' : 'insert-drive-file'}
                  size={24}
                  color={theme.primary}
                />
                <View style={styles.attachmentInfo}>
                  <Text style={[styles.attachmentName, { color: theme.text }]}>
                    {attachment.name}
                  </Text>
                  <Text style={[styles.attachmentSize, { color: theme.textSecondary }]}>
                    {attachment.size}
                  </Text>
                </View>
                <Icon name="file-download" size={24} color={theme.primary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.postStats}>
          <TouchableOpacity style={styles.statButton} onPress={handleLike}>
            <Icon
              name={liked ? 'thumb-up' : 'thumb-up-off-alt'}
              size={20}
              color={liked ? theme.primary : theme.textSecondary}
            />
            <Text
              style={[
                styles.statText,
                { color: liked ? theme.primary : theme.textSecondary },
              ]}
            >
              {post.likes}
            </Text>
          </TouchableOpacity>
          <View style={styles.statItem}>
            <Icon name="comment" size={20} color={theme.textSecondary} />
            <Text style={[styles.statText, { color: theme.textSecondary }]}>
              {comments.length}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="file-download" size={20} color={theme.textSecondary} />
            <Text style={[styles.statText, { color: theme.textSecondary }]}>
              {post.downloads}
            </Text>
          </View>
        </View>

        <View style={styles.commentsSection}>
          <Text style={[styles.commentsTitle, { color: theme.text }]}>
            评论 ({comments.length})
          </Text>

          {comments.map((comment) => (
            <View
              key={comment.id}
              style={[styles.commentItem, { backgroundColor: theme.cardBackground }]}
            >
              <View style={styles.commentHeader}>
                <View style={styles.commentAuthor}>
                  <Image source={{ uri: comment.authorAvatar }} style={styles.commentAvatar} />
                  <Text style={[styles.commentAuthorName, { color: theme.text }]}>
                    {comment.author}
                  </Text>
                </View>
                <Text style={[styles.commentTimestamp, { color: theme.textSecondary }]}>
                  {new Date(comment.timestamp).toLocaleDateString()}
                </Text>
              </View>
              <Text style={[styles.commentContent, { color: theme.text }]}>
                {comment.content}
              </Text>
              <View style={styles.commentFooter}>
                <TouchableOpacity style={styles.commentLike}>
                  <Icon name="thumb-up-off-alt" size={16} color={theme.textSecondary} />
                  <Text style={[styles.commentLikeCount, { color: theme.textSecondary }]}>
                    {comment.likes}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.commentReply}>
                  <Text style={[styles.commentReplyText, { color: theme.primary }]}>回复</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.commentInputContainer, { backgroundColor: theme.cardBackground }]}>
        <TextInput
          style={[styles.commentInput, { color: theme.text, backgroundColor: theme.background }]}
          placeholder="写下你的评论..."
          placeholderTextColor={theme.textSecondary}
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        <TouchableOpacity
          style={[
            styles.commentSubmitButton,
            { backgroundColor: commentText.trim() ? theme.primary : theme.disabled },
          ]}
          onPress={handleSubmitComment}
          disabled={!commentText.trim()}
        >
          <Icon name="send" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.MEDIUM,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.LARGE,
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: SPACING.MEDIUM,
    marginBottom: SPACING.LARGE,
  },
  backButton: {
    marginTop: SPACING.MEDIUM,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.MEDIUM,
    paddingTop: SPACING.LARGE,
    paddingBottom: SPACING.MEDIUM,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: SPACING.SMALL,
    marginLeft: SPACING.SMALL,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.MEDIUM,
    paddingBottom: SPACING.XLARGE,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.MEDIUM,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: SPACING.SMALL,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 14,
  },
  postTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: SPACING.MEDIUM,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.MEDIUM,
  },
  tag: {
    paddingHorizontal: SPACING.SMALL,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: SPACING.SMALL,
    marginBottom: SPACING.SMALL,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  postContent: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: SPACING.LARGE,
  },
  attachmentsContainer: {
    borderRadius: 8,
    padding: SPACING.MEDIUM,
    marginBottom: SPACING.LARGE,
  },
  attachmentsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: SPACING.MEDIUM,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.SMALL,
  },
  attachmentInfo: {
    flex: 1,
    marginLeft: SPACING.SMALL,
  },
  attachmentName: {
    fontSize: 14,
    fontWeight: '500',
  },
  attachmentSize: {
    fontSize: 12,
  },
  postStats: {
    flexDirection: 'row',
    marginBottom: SPACING.LARGE,
  },
  statButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.LARGE,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.LARGE,
  },
  statText: {
    fontSize: 14,
    marginLeft: 4,
  },
  commentsSection: {
    marginBottom: SPACING.LARGE,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: SPACING.MEDIUM,
  },
  commentItem: {
    borderRadius: 8,
    padding: SPACING.MEDIUM,
    marginBottom: SPACING.MEDIUM,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.SMALL,
  },
  commentAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: SPACING.SMALL,
  },
  commentAuthorName: {
    fontSize: 14,
    fontWeight: '500',
  },
  commentTimestamp: {
    fontSize: 12,
  },
  commentContent: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.SMALL,
  },
  commentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  commentLike: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentLikeCount: {
    fontSize: 12,
    marginLeft: 4,
  },
  commentReply: {},
  commentReplyText: {
    fontSize: 12,
    fontWeight: '500',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.MEDIUM,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  commentInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: SPACING.SMALL,
    maxHeight: 100,
  },
  commentSubmitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.SMALL,
  },
});

export default PostDetailScreen;
