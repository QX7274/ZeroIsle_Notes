/**
 * 社区用户资料组件
 */
import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';

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
  const { colors } = theme;
  const { width } = useWindowDimensions();
  const isTabletLayout = width >= 900;

  const {
    id,
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

  const userId = String(id || 'unknown');
  const displayName = username || '匿名用户';
  const hasRecentPosts = Array.isArray(recent_posts) && recent_posts.length > 0;

  const formatDate = (dateString) => {
    if (!dateString) {
      return '';
    }
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const renderBadges = () => {
    if (!Array.isArray(badges) || badges.length === 0) {
      return null;
    }
    return (
      <View style={styles.badgesContainer} testID={`state.community.userProfile.badges.${userId}.visible`}>
        {badges.map((badge, index) => (
          <View
            key={`badge-${userId}-${index}`}
            style={[styles.badgeItem, { backgroundColor: badge?.color || colors.primary }]}
          >
            <Icon name={badge?.icon || 'star'} size={12} color="#FFFFFF" />
            <Text variant="caption" color="card" style={styles.badgeText}>
              {badge?.name || '徽章'}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderRecentPosts = () => {
    if (!hasRecentPosts) {
      return (
        <View
          style={[
            styles.sectionCard,
            styles.emptyRecentSectionCard,
            isTabletLayout ? styles.emptyRecentSectionCardTablet : null,
            { borderColor: `${colors.primary || '#2196F3'}16` },
          ]}
        >
          <Text variant="heading" level="h6" style={[styles.sectionTitle, { color: colors.text }]}>
            最近发布
          </Text>
          <View style={styles.emptyRecentBody}>
            <View style={[styles.emptyRecentIconShell, { backgroundColor: `${colors.primary || '#2196F3'}10`, borderColor: `${colors.primary || '#2196F3'}18` }]}>
              <Icon name="article" size={20} color={colors.primary || '#2196F3'} />
            </View>
            <Text variant="body" size="medium" style={[styles.emptySectionText, styles.emptyRecentText, { color: colors.textSecondary }]}>
              当前还没有可展示的最近发布内容。
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.sectionCard, { borderColor: `${colors.primary || '#2196F3'}16` }]}>
        <Text variant="heading" level="h6" style={[styles.sectionTitle, { color: colors.text }]}>
          最近发布
        </Text>
        {recent_posts.map((post, index) => (
          <TouchableOpacity
            key={`post-${userId}-${post?.id || index}`}
            style={[styles.postItem, { backgroundColor: 'rgba(248,250,252,0.96)', borderColor: `${colors.primary || '#2196F3'}14` }]}
            onPress={() => onPostPress && onPostPress(post)}
            testID={`action.community.userProfile.openPost.${post?.id || index}`}
          >
            <Text variant="body" size="medium" bold numberOfLines={1} style={[styles.postTitle, { color: colors.text }]}>
              {post?.title || '未命名帖子'}
            </Text>
            <View style={styles.postMeta}>
              <Text variant="caption" color="hint">
                {formatDate(post?.created_at)}
              </Text>
              <View style={styles.postStats}>
                <Icon name="favorite" size={12} color={colors.textSecondary} />
                <Text variant="caption" color="hint" style={styles.postStatText}>
                  {post?.like_count || 0}
                </Text>
                <Icon name="comment" size={12} color={colors.textSecondary} style={styles.postStatIcon} />
                <Text variant="caption" color="hint" style={styles.postStatText}>
                  {post?.comment_count || 0}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background || '#F2F7FB' }]}
      contentContainerStyle={[styles.contentContainer, !hasRecentPosts && isTabletLayout ? styles.contentContainerTabletEmpty : null]}
      testID={`state.community.userProfile.state.${userId}`}
    >
      <View testID={`state.community.userProfile.isCurrentUser.${isCurrentUser ? 'on' : 'off'}`} />
      <View testID={`state.community.userProfile.isFollowing.${isFollowing ? 'on' : 'off'}`} />

      <View
        style={[
          styles.heroCard,
          {
            borderColor: `${colors.primary || '#2196F3'}20`,
            backgroundColor: 'rgba(255,255,255,0.88)',
          },
        ]}
      >
        <View style={styles.headerContent}>
          <Image
            source={avatar ? { uri: avatar } : require('../../assets/images/default_avatar.png')}
            style={styles.avatar}
          />
          <View style={styles.userInfo}>
            <Text variant="heading" level="h5" style={[styles.username, { color: colors.text }]}>
              {displayName}
            </Text>
            <View style={styles.metaChips}>
              <View style={[styles.metaChip, { borderColor: `${colors.primary || '#2196F3'}24`, backgroundColor: `${colors.primary || '#2196F3'}10` }]}>
                <Icon name="military-tech" size={14} color={colors.primary || '#2196F3'} />
                <Text variant="caption" style={[styles.metaChipText, { color: colors.primary || '#2196F3' }]}>
                  Lv.{level || 1}
                </Text>
              </View>
              <View style={[styles.metaChip, { borderColor: 'rgba(148,163,184,0.22)', backgroundColor: 'rgba(248,250,252,0.96)' }]}>
                <Icon name="event" size={14} color={colors.textSecondary} />
                <Text variant="caption" style={[styles.metaChipText, { color: colors.textSecondary }]}>
                  {join_date ? `加入于 ${formatDate(join_date)}` : '社区新成员'}
                </Text>
              </View>
            </View>
            <Text variant="body" size="medium" style={[styles.heroBio, { color: colors.textSecondary }]}>
              {bio || '这个人还没有补充个人简介。'}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.statsContainer, { borderColor: `${colors.primary || '#2196F3'}18` }]}>
        <View style={styles.statItem}>
          <Text variant="heading" level="h6" center style={[styles.statValue, { color: colors.text }]}>{post_count || 0}</Text>
          <Text variant="caption" color="hint" center style={styles.statLabel}>帖子</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text variant="heading" level="h6" center style={[styles.statValue, { color: colors.text }]}>{follower_count || 0}</Text>
          <Text variant="caption" color="hint" center style={styles.statLabel}>粉丝</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text variant="heading" level="h6" center style={[styles.statValue, { color: colors.text }]}>{following_count || 0}</Text>
          <Text variant="caption" color="hint" center style={styles.statLabel}>关注</Text>
        </View>
      </View>

      <View style={styles.actionsContainer} testID="panel.community.userProfile.actions">
        {isCurrentUser ? (
          <TouchableOpacity
            style={[styles.primaryActionButton, { backgroundColor: colors.primary || '#2196F3' }]}
            onPress={onEditProfile}
            testID="action.community.userProfile.editProfile"
          >
            <Icon name="edit" size={18} color="#FFFFFF" />
            <Text variant="body" size="medium" style={styles.primaryActionText}>
              编辑资料
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[
                isFollowing ? styles.secondaryActionButton : styles.primaryActionButton,
                isFollowing
                  ? { borderColor: `${colors.primary || '#2196F3'}32`, backgroundColor: 'rgba(255,255,255,0.92)' }
                  : { backgroundColor: colors.primary || '#2196F3' },
              ]}
              onPress={isFollowing ? onUnfollow : onFollow}
              testID="action.community.userProfile.followToggle"
            >
              <Icon name={isFollowing ? 'check' : 'person-add'} size={18} color={isFollowing ? (colors.primary || '#2196F3') : '#FFFFFF'} />
              <Text
                variant="body"
                size="medium"
                style={isFollowing ? [styles.secondaryActionText, { color: colors.primary || '#2196F3' }] : styles.primaryActionText}
              >
                {isFollowing ? '已关注' : '关注'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryActionButton, { borderColor: `${colors.primary || '#2196F3'}32` }]}
              onPress={onMessage}
              testID="action.community.userProfile.message"
            >
              <Icon name="chat-bubble-outline" size={18} color={colors.primary || '#2196F3'} />
              <Text variant="body" size="medium" style={[styles.secondaryActionText, { color: colors.primary || '#2196F3' }]}>
                发消息
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {renderBadges()}

      <View style={[styles.sectionCard, { borderColor: `${colors.primary || '#2196F3'}16` }]}>
        <Text variant="heading" level="h6" style={[styles.sectionTitle, { color: colors.text }]}>
          个人简介
        </Text>
        <Text variant="body" size="medium" style={[styles.bioText, { color: colors.textSecondary }]}>
          {bio || '这个人还没有补充个人简介。'}
        </Text>
      </View>

      {renderRecentPosts()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  contentContainerTabletEmpty: {
    paddingBottom: 36,
  },
  heroCard: {
    marginTop: 2,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 22,
    borderWidth: 1,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#D9ECFD',
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  username: {
    marginBottom: 8,
  },
  metaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaChipText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  heroBio: {
    marginTop: 10,
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontWeight: '700',
  },
  statLabel: {
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: '68%',
    backgroundColor: '#E7EFF7',
    alignSelf: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  primaryActionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 2,
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  primaryActionText: {
    marginLeft: 6,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryActionText: {
    marginLeft: 6,
    fontSize: 15,
    fontWeight: '700',
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
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
  sectionCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.88)',
    marginBottom: 10,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  bioText: {
    lineHeight: 21,
  },
  emptySectionText: {
    lineHeight: 21,
  },
  emptyRecentSectionCard: {
    justifyContent: 'flex-start',
  },
  emptyRecentSectionCardTablet: {
    minHeight: 280,
  },
  emptyRecentBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  emptyRecentIconShell: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyRecentText: {
    textAlign: 'center',
  },
  postItem: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
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
