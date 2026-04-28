/**
 * 社区用户资料组件
 */
import React from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../common';

/**
 * 社区用户资料组件
 * @param {Object} user - 用户对象
 * @param {boolean} isCurrentUser - 是否为当前用户
 * @param {boolean} isFollowing - 是否已关注
 * @param {Function} onFollow - 关注回调
 * @param {Function} onUnfollow - 取消关注回调
 * @param {Function} onMessage - 发送消息回调
 * @param {Function} onEditProfile - 编辑资料回调
 * @param {Function} onPostPress - 帖子点击回调
 */
const UserProfile = ({
  user,
  isCurrentUser = false,
  isFollowing = false,
  onFollow,
  onUnfollow,
  onMessage,
  onEditProfile,
  onPostPress,
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  // 提取用户信息
  const {
    username,
    avatar,
    bio,
    follower_count,
    following_count,
    post_count,
    level,
    join_date,
    badges = [],
    recent_posts = [],
  } = user || {};

  // 格式化日期
  const formatDate = (dateString) => {
    if (!dateString) {return '';}

    const date = new Date(dateString);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // 渲染徽章
  const renderBadges = () => {
    if (!badges || badges.length === 0) {return null;}

    return (
      <View style={styles.badgesContainer}>
        {badges.map((badge, index) => (
          <View
            key={`badge-${index}`}
            style={[
              styles.badgeItem,
              { backgroundColor: badge.color || colors.primary },
            ]}
          >
            <Icon name={badge.icon || 'star'} size={12} color="#FFFFFF" />
            <Text
              variant="caption"
              color="card"
              style={styles.badgeText}
            >
              {badge.name}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // 渲染最近帖子
  const renderRecentPosts = () => {
    if (!recent_posts || recent_posts.length === 0) {return null;}

    return (
      <View style={styles.recentPostsContainer}>
        <Text
          variant="heading"
          level="h6"
          style={styles.sectionTitle}
        >
          最近发布
        </Text>

        {recent_posts.map((post, index) => (
          <TouchableOpacity
            key={`post-${index}`}
            style={[
              styles.postItem,
              { backgroundColor: colors.card },
            ]}
            onPress={() => onPostPress && onPostPress(post)}
          >
            <Text
              variant="body"
              size="medium"
              bold
              numberOfLines={1}
              style={styles.postTitle}
            >
              {post.title}
            </Text>

            <View style={styles.postMeta}>
              <Text
                variant="caption"
                color="hint"
              >
                {formatDate(post.created_at)}
              </Text>

              <View style={styles.postStats}>
                <Icon name="favorite" size={12} color={colors.textSecondary} />
                <Text
                  variant="caption"
                  color="hint"
                  style={styles.postStatText}
                >
                  {post.like_count || 0}
                </Text>

                <Icon name="comment" size={12} color={colors.textSecondary} style={styles.postStatIcon} />
                <Text
                  variant="caption"
                  color="hint"
                  style={styles.postStatText}
                >
                  {post.comment_count || 0}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View style={styles.headerContent}>
          <Image
            source={
              avatar
                ? { uri: avatar }
                : require('../../assets/images/default-avatar.png')
            }
            style={styles.avatar}
          />

          <View style={styles.userInfo}>
            <Text
              variant="heading"
              level="h5"
              color="card"
              style={styles.username}
            >
              {username || '匿名用户'}
            </Text>

            <View style={styles.levelContainer}>
              <Icon name="military-tech" size={16} color="#FFD700" />
              <Text
                variant="caption"
                color="card"
                style={styles.levelText}
              >
                Lv.{level || 1}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text
            variant="heading"
            level="h6"
            center
          >
            {post_count || 0}
          </Text>
          <Text
            variant="caption"
            color="hint"
            center
          >
            帖子
          </Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <Text
            variant="heading"
            level="h6"
            center
          >
            {follower_count || 0}
          </Text>
          <Text
            variant="caption"
            color="hint"
            center
          >
            粉丝
          </Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statItem}>
          <Text
            variant="heading"
            level="h6"
            center
          >
            {following_count || 0}
          </Text>
          <Text
            variant="caption"
            color="hint"
            center
          >
            关注
          </Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        {isCurrentUser ? (
          <Button
            title="编辑资料"
            onPress={onEditProfile}
            type="outline"
            icon="edit"
            style={styles.actionButton}
          />
        ) : (
          <>
            <Button
              title={isFollowing ? '已关注' : '关注'}
              onPress={isFollowing ? onUnfollow : onFollow}
              type={isFollowing ? 'outline' : 'solid'}
              icon={isFollowing ? 'check' : 'add'}
              style={styles.actionButton}
            />

            <Button
              title="发消息"
              onPress={onMessage}
              type="outline"
              icon="chat"
              style={styles.actionButton}
            />
          </>
        )}
      </View>

      {renderBadges()}

      <View style={styles.bioContainer}>
        <Text
          variant="heading"
          level="h6"
          style={styles.sectionTitle}
        >
          个人简介
        </Text>

        <Text
          variant="body"
          size="medium"
          style={styles.bioText}
        >
          {bio || '这个人很懒，什么都没有留下...'}
        </Text>

        <View style={styles.joinDateContainer}>
          <Icon name="event" size={16} color={colors.textSecondary} />
          <Text
            variant="caption"
            color="hint"
            style={styles.joinDateText}
          >
            {join_date ? `加入于 ${formatDate(join_date)}` : '最近加入'}
          </Text>
        </View>
      </View>

      {renderRecentPosts()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  userInfo: {
    marginLeft: 16,
  },
  username: {
    marginBottom: 4,
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelText: {
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#f0f0f0',
    alignSelf: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  badgeText: {
    marginLeft: 4,
  },
  bioContainer: {
    padding: 16,
    borderTopWidth: 8,
    borderTopColor: '#f0f0f0',
  },
  sectionTitle: {
    marginBottom: 8,
  },
  bioText: {
    marginBottom: 16,
  },
  joinDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinDateText: {
    marginLeft: 8,
  },
  recentPostsContainer: {
    padding: 16,
    borderTopWidth: 8,
    borderTopColor: '#f0f0f0',
  },
  postItem: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  postTitle: {
    marginBottom: 8,
  },
  postMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postStatText: {
    marginLeft: 4,
  },
  postStatIcon: {
    marginLeft: 8,
  },
});

export default UserProfile;
