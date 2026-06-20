import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import UserProfile from '../../components/community/UserProfile';
import useHideMainTabBar from './useHideMainTabBar';
import communityApi from '../../services/api/communityApi';

const FALLBACK_COLORS = {
  background: '#F2F7FB',
  text: '#102A43',
  textSecondary: '#5B7083',
  primary: '#2196F3',
};

const extractPayload = (response) => response?.data?.data || response?.data || response || {};

const mapPostsForProfile = (response) => {
  const payload = extractPayload(response);
  const results = Array.isArray(payload?.results)
    ? payload.results
    : Array.isArray(payload?.data?.results)
      ? payload.data.results
      : [];

  return results.slice(0, 3).map((item) => ({
    id: item.id,
    title: item.title || '未命名帖子',
    created_at: item.published_at || item.created_at,
    like_count: item.like_count ?? item.likes ?? 0,
    comment_count: item.comment_count ?? item.comments ?? 0,
  }));
};

const mapCount = (response, fallback = 0) => {
  const payload = extractPayload(response);
  if (typeof payload?.count === 'number') {
    return payload.count;
  }
  if (typeof payload?.data?.count === 'number') {
    return payload.data.count;
  }
  if (Array.isArray(payload?.results)) {
    return payload.results.length;
  }
  if (Array.isArray(payload)) {
    return payload.length;
  }
  return fallback;
};

const normalizeInitialUser = (targetId, initialUser, currentUser, isCurrentUser) => ({
  id: targetId,
  username: initialUser?.nickname
    || initialUser?.username
    || (isCurrentUser ? currentUser?.nickname || currentUser?.username : '')
    || '社区用户',
  avatar: initialUser?.avatar
    || (isCurrentUser ? currentUser?.avatar : '')
    || '',
  bio: initialUser?.bio || '',
  follower_count: Number(initialUser?.follower_count || 0),
  following_count: Number(initialUser?.following_count || 0),
  post_count: Number(initialUser?.post_count || 0),
  level: Number(initialUser?.level || 1),
  join_date: initialUser?.join_date || currentUser?.date_joined || currentUser?.createdAt || '',
  badges: Array.isArray(initialUser?.badges) ? initialUser.badges : [],
  recent_posts: Array.isArray(initialUser?.recent_posts) ? initialUser.recent_posts : [],
  isFollowing: Boolean(initialUser?.isFollowing),
});

const UserProfileScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const colors = theme?.colors || FALLBACK_COLORS;
  const insets = useSafeAreaInsets();
  const currentUser = useSelector((state) => state.auth?.user);
  const routeUserId = route.params?.userId;
  const initialUser = useMemo(() => route.params?.initialUser || {}, [route.params?.initialUser]);
  const targetUserId = String(routeUserId || initialUser?.id || currentUser?.id || '');
  const isCurrentUser = String(currentUser?.id || '') === targetUserId;

  const [profileUser, setProfileUser] = useState(() => normalizeInitialUser(targetUserId, initialUser, currentUser, isCurrentUser));
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowBusy, setIsFollowBusy] = useState(false);
  const [statusCard, setStatusCard] = useState(null);

  useHideMainTabBar();

  useEffect(() => {
    setProfileUser(normalizeInitialUser(targetUserId, initialUser, currentUser, isCurrentUser));
  }, [currentUser, initialUser, isCurrentUser, targetUserId]);

  const loadProfile = useCallback(async (silent = false) => {
    if (!targetUserId) {
      setStatusCard({
        tone: 'error',
        title: '个人主页暂不可用',
        message: '当前没有可用的用户标识，暂时无法继续加载社区个人主页。',
      });
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    if (!silent) {
      setIsLoading(true);
    }

    try {
      const [followersResult, followingResult, postsResult] = await Promise.allSettled([
        communityApi.getUserFollowers(targetUserId, { page: 1, page_size: 1 }, { suppressGlobalErrorUI: true }),
        communityApi.getUserFollowing(targetUserId, { page: 1, page_size: 1 }, { suppressGlobalErrorUI: true }),
        communityApi.getPosts({ page: 1, page_size: 3, user: targetUserId }, { suppressGlobalErrorUI: true }),
      ]);

      setProfileUser((current) => ({
        ...current,
        follower_count: followersResult.status === 'fulfilled'
          ? mapCount(followersResult.value, current.follower_count)
          : current.follower_count,
        following_count: followingResult.status === 'fulfilled'
          ? mapCount(followingResult.value, current.following_count)
          : current.following_count,
        post_count: postsResult.status === 'fulfilled'
          ? mapCount(postsResult.value, current.post_count)
          : current.post_count,
        recent_posts: postsResult.status === 'fulfilled'
          ? mapPostsForProfile(postsResult.value)
          : current.recent_posts,
      }));

      const failedCount = [followersResult, followingResult, postsResult].filter((item) => item.status === 'rejected').length;
      if (failedCount > 0) {
        setStatusCard({
          tone: 'info',
          title: '部分资料已降级展示',
          message: '当前已尽量展示个人主页基础信息，但部分统计或最近发布未能从后端取回，稍后可下拉重试。',
        });
      } else {
        setStatusCard(null);
      }
    } catch (error) {
      setStatusCard({
        tone: 'error',
        title: '个人主页加载失败',
        message: '当前无法获取这位用户的社区资料，请稍后下拉重试。',
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleRefresh = useCallback(() => {
    if (refreshing) {
      return;
    }
    setStatusCard(null);
    setRefreshing(true);
    loadProfile(true);
  }, [loadProfile, refreshing]);

  const handleFollowToggle = useCallback(async () => {
    if (!targetUserId || isCurrentUser || isFollowBusy) {
      return;
    }

    setIsFollowBusy(true);
    try {
      const response = await communityApi.toggleFollow(targetUserId);
      const nextFollowed = Boolean(response?.data?.is_active ?? response?.data?.is_followed ?? false);
      setProfileUser((current) => ({
        ...current,
        isFollowing: nextFollowed,
        follower_count: Math.max(0, Number(current.follower_count || 0) + (nextFollowed ? 1 : -1)),
      }));
      setStatusCard({
        tone: 'success',
        title: nextFollowed ? '已关注该用户' : '已取消关注',
        message: nextFollowed ? '后续可继续从粉丝/关注链路验证联动状态。' : '当前主页统计已同步更新为最新关注状态。',
      });
    } catch (error) {
      setStatusCard({
        tone: 'error',
        title: '关注状态更新失败',
        message: '当前无法更新关注关系，请确认网络与后端状态后重试。',
      });
    } finally {
      setIsFollowBusy(false);
    }
  }, [isCurrentUser, isFollowBusy, targetUserId]);

  const handleMessage = useCallback(() => {
    setStatusCard({
      tone: 'info',
      title: '私信入口仍在联调',
      message: '社区个人主页已保留消息按钮位，但当前版本尚未接入完整私信会话链路。',
    });
  }, []);

  const handleEditProfile = useCallback(() => {
    navigation.navigate('Profile');
  }, [navigation]);

  const handlePostPress = useCallback((post) => {
    if (!post?.id) {
      return;
    }
    navigation.navigate('PostDetail', {
      postId: String(post.id),
      title: post.title || '帖子详情',
    });
  }, [navigation]);

  const statusAccent = useMemo(() => {
    if (statusCard?.tone === 'error') {
      return '#EF4444';
    }
    if (statusCard?.tone === 'success') {
      return '#16A34A';
    }
    return colors.primary || FALLBACK_COLORS.primary;
  }, [colors.primary, statusCard?.tone]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background || FALLBACK_COLORS.background,
          paddingTop: Platform.OS === 'android' ? 0 : Math.max(insets.top, 12),
        },
      ]}
      testID="screen.community.userProfile"
    >
      <View testID={`state.community.userProfile.loading.visibility.${isLoading ? 'visible' : 'hidden'}`} />
      <View testID={`state.community.userProfile.currentUser.${isCurrentUser ? 'true' : 'false'}`} />

      <View style={styles.headerCard} testID="panel.community.userProfile.header">
        <View style={styles.headerRow}>
          <ScreenHeaderBackButton
            onPress={() => navigation.goBack()}
            testID="action.community.userProfile.back"
            style={styles.backButton}
          />
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: colors.text || FALLBACK_COLORS.text }]}>个人主页</Text>
            <Text style={[styles.headerMeta, { color: colors.textSecondary || FALLBACK_COLORS.textSecondary }]}>
              {isCurrentUser ? '当前账号的社区资料概览' : '社区用户资料与最近发布'}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.refreshButton,
              {
                backgroundColor: colors.primary ? `${colors.primary}14` : 'rgba(33,150,243,0.12)',
              },
            ]}
            onPress={handleRefresh}
            disabled={refreshing || isLoading}
            testID="action.community.userProfile.refresh"
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.primary || FALLBACK_COLORS.primary} />
            ) : (
              <Icon name="refresh" size={18} color={colors.primary || FALLBACK_COLORS.primary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {statusCard ? (
        <View
          style={[
            styles.statusCard,
            {
              borderColor: `${statusAccent}22`,
              backgroundColor: `${statusAccent}10`,
            },
          ]}
          testID={`state.community.userProfile.status.${statusCard.tone}`}
        >
          <Text style={[styles.statusTitle, { color: statusAccent }]}>{statusCard.title}</Text>
          <Text style={[styles.statusMessage, { color: colors.textSecondary || FALLBACK_COLORS.textSecondary }]}>
            {statusCard.message}
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingWrap} testID="state.community.userProfile.loading">
          <ActivityIndicator size="large" color={colors.primary || FALLBACK_COLORS.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary || FALLBACK_COLORS.textSecondary }]}>
            正在整理个人主页资料...
          </Text>
        </View>
      ) : (
        <UserProfile
          user={profileUser}
          isCurrentUser={isCurrentUser}
          isFollowing={Boolean(profileUser?.isFollowing)}
          onFollow={handleFollowToggle}
          onUnfollow={handleFollowToggle}
          onMessage={handleMessage}
          onEditProfile={handleEditProfile}
          onPostPress={handlePostPress}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerCard: {
    marginHorizontal: 14,
    marginTop: 0,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(33,150,243,0.20)',
    backgroundColor: 'rgba(255,255,255,0.84)',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
  },
  headerTitleWrap: {
    flex: 1,
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerMeta: {
    marginTop: 2,
    fontSize: 12,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCard: {
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusMessage: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
});

export default UserProfileScreen;
