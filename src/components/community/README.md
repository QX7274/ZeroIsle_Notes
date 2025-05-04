# 社区组件

本目录包含与社区功能相关的组件。

## 组件列表

### PostCard

帖子卡片组件，用于显示社区帖子的预览。

**主要功能**：
- 显示帖子标题和摘要
- 显示作者信息
- 显示点赞和评论数
- 支持图片预览

### PostDetail

帖子详情组件，用于显示完整的帖子内容。

**主要功能**：
- 显示完整帖子内容
- 支持富文本渲染
- 支持代码块渲染
- 支持图片查看

### CommentList

评论列表组件，用于显示帖子的评论。

**主要功能**：
- 显示评论列表
- 支持嵌套评论
- 支持评论分页
- 支持评论排序

### CommentInput

评论输入组件，用于发表评论。

**主要功能**：
- 支持文本输入
- 支持@用户
- 支持表情选择
- 支持图片上传

### UserProfile

用户资料组件，用于显示用户信息。

**主要功能**：
- 显示用户头像和昵称
- 显示用户简介
- 显示用户统计信息
- 支持关注/取消关注

### ActivityFeed

活动流组件，用于显示社区活动。

**主要功能**：
- 显示用户活动
- 显示关注用户的活动
- 支持活动分类
- 支持活动筛选

## 使用方法

```javascript
import { PostCard, CommentList, CommentInput } from '../components/community';

function CommunityScreen() {
  const [posts, setPosts] = useState([]);
  
  useEffect(() => {
    // 获取帖子列表
    fetchPosts().then(setPosts);
  }, []);
  
  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
          />
        )}
      />
    </View>
  );
}

function PostDetailScreen({ route }) {
  const { postId } = route.params;
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  
  useEffect(() => {
    // 获取帖子详情
    fetchPostDetail(postId).then(setPost);
    // 获取评论列表
    fetchComments(postId).then(setComments);
  }, [postId]);
  
  return (
    <View style={styles.container}>
      {post && <PostDetail post={post} />}
      
      <CommentList
        comments={comments}
        onLikeComment={handleLikeComment}
      />
      
      <CommentInput
        postId={postId}
        onSubmit={handleSubmitComment}
      />
    </View>
  );
}
```
