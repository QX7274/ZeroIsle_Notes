import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  clearInviteCandidates,
  clearLastInvitation,
  inviteUserToGroup,
  searchGroupInviteCandidates,
  selectInviteActionLoading,
  selectInviteCandidates,
  selectInviteCandidatesError,
  selectInviteCandidatesLoading,
  selectLastInvitation,
} from '../../redux/slices/groupsSlice';
import { COLORS } from '../../utils/constants/colors';
import networkErrorService from '../../services/networkErrorService';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';

const MIN_KEYWORD_LENGTH = 2;

const InviteMembersScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { groupId } = route.params || {};

  const inviteCandidates = useSelector(selectInviteCandidates) || [];
  const inviteCandidatesLoading = useSelector(selectInviteCandidatesLoading);
  const inviteCandidatesError = useSelector(selectInviteCandidatesError);
  const inviteActionLoading = useSelector(selectInviteActionLoading);
  const lastInvitation = useSelector(selectLastInvitation);

  const [keyword, setKeyword] = useState('');
  const [inlineHint, setInlineHint] = useState('请输入用户名、昵称或邮箱关键词搜索用户');

  const trimmedKeyword = keyword.trim();
  const canSearch = trimmedKeyword.length >= MIN_KEYWORD_LENGTH;
  const isSearchingVisible = Boolean(inviteCandidatesLoading);
  const isActionBusyVisible = Boolean(inviteActionLoading);
  const isErrorVisible = Boolean(inviteCandidatesError);
  const searchStateLabel = !trimmedKeyword
    ? 'idle'
    : canSearch
      ? 'ready'
      : 'keyword-too-short';

  const notifyNonBlocking = (message) => {
    if (!message) {return;}
    setInlineHint(String(message));
  };

  useEffect(() => {
    return () => {
      dispatch(clearInviteCandidates());
      dispatch(clearLastInvitation());
    };
  }, [dispatch]);

  useEffect(() => {
    if (!trimmedKeyword) {
      dispatch(clearInviteCandidates());
      return;
    }

    if (!canSearch) {
      setInlineHint(`至少输入 ${MIN_KEYWORD_LENGTH} 个字符后再搜索`);
      dispatch(clearInviteCandidates());
      return;
    }

    const timer = setTimeout(async () => {
      try {
        await dispatch(
          searchGroupInviteCandidates({ groupId, keyword: trimmedKeyword })
        ).unwrap();
        setInlineHint(`已搜索“${trimmedKeyword}”相关用户`);
      } catch (error) {
        if (networkErrorService.isNetworkError(error)) {
          networkErrorService.handleApiError(error, {
            context: '搜索群组邀请候选',
            customMessage: '网络连接失败，无法搜索候选用户',
          });
          setInlineHint('网络连接失败，无法搜索候选用户');
        } else {
          notifyNonBlocking(error || '搜索失败，请稍后重试');
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [canSearch, dispatch, groupId, trimmedKeyword]);

  const invitationSummary = useMemo(() => {
    const invitee = lastInvitation?.invitee;
    if (!invitee) {return null;}
    const displayName = invitee.nickname || invitee.username || invitee.id;
    return {
      title: `已向 ${displayName} 发送邀请`,
      detail: '邀请默认 7 天内有效，对方接受后即可加入群组。',
    };
  }, [lastInvitation]);

  const handleInvite = async (candidate) => {
    if (!candidate?.id || !candidate?.can_invite) {
      notifyNonBlocking(candidate?.invite_block_reason || '该用户当前不可邀请');
      return;
    }
    try {
      const invitation = await dispatch(
        inviteUserToGroup({ groupId, userId: candidate.id })
      ).unwrap();
      const invitee = invitation?.invitee;
      const displayName =
        invitee?.nickname || invitee?.username || candidate.nickname || candidate.username || candidate.id;
      notifyNonBlocking(`已向 ${displayName} 发送邀请`);
    } catch (error) {
      if (networkErrorService.isNetworkError(error)) {
        networkErrorService.handleApiError(error, {
          context: '邀请成员',
          customMessage: '网络连接失败，无法发送邀请',
        });
        setInlineHint('网络连接失败，无法发送邀请');
      } else {
        notifyNonBlocking(error || '邀请失败，请稍后重试');
      }
    }
  };

  const renderCandidate = ({ item }) => {
    const displayName = item.nickname || item.username || item.id;
    const secondaryText = item.username && item.nickname
      ? `@${item.username}`
      : item.username
        ? `@${item.username}`
        : item.id;
    return (
      <View style={styles.card} testID={`entry.group.invite.candidate.${item.id}`}>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{displayName}</Text>
          <Text style={styles.cardSubtitle}>{secondaryText}</Text>
          {item.invite_block_reason ? (
            <Text style={styles.blockHint}>{item.invite_block_reason}</Text>
          ) : null}
        </View>
        <Button
          mode={item.can_invite ? 'contained' : 'outlined'}
          compact
          disabled={!item.can_invite || inviteActionLoading}
          loading={inviteActionLoading}
          onPress={() => handleInvite(item)}
          testID={`action.group.invite.send.${item.id}`}
        >
          {item.can_invite ? '发送邀请' : '不可邀请'}
        </Button>
      </View>
    );
  };

  const renderEmpty = () => {
    if (inviteCandidatesLoading) {return null;}
    if (!trimmedKeyword) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>先搜索，再邀请</Text>
          <Text style={styles.emptyText}>
            支持按用户名、昵称或邮箱关键词搜索，系统会自动标记已是成员、已存在待处理邀请或你自己。
          </Text>
        </View>
      );
    }
    if (!canSearch) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>关键词过短</Text>
          <Text style={styles.emptyText}>请至少输入 2 个字符，以返回更稳定的候选结果。</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>没有找到可展示的候选用户</Text>
        <Text style={styles.emptyText}>
          你可以尝试更换关键词，或确认对方是否已是群成员、已存在待处理邀请。
        </Text>
      </View>
    );
  };

  const isSuccessVisible = Boolean(invitationSummary);
  const topInset = Math.max(insets.top, 8);
  const bottomInset = Math.max(insets.bottom, 12);

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]} testID={`state.group.invite.state.${searchStateLabel}`}>
      <View testID="state.group.invite.visibility.visible" />
      <View testID={`state.group.invite.searching.visibility.${isSearchingVisible ? 'visible' : 'hidden'}`} />
      <View testID={`state.group.invite.actionBusy.visibility.${isActionBusyVisible ? 'visible' : 'hidden'}`} />
      <View testID={`state.group.invite.error.visibility.${isErrorVisible ? 'visible' : 'hidden'}`} />
      <View testID={`state.group.invite.success.visibility.${isSuccessVisible ? 'visible' : 'hidden'}`} />

      <View style={styles.headerBar}>
        <ScreenHeaderBackButton
          onPress={() => navigation.goBack()}
          testID="action.group.invite.back"
          style={styles.backButton}
        />
        <Text style={styles.headerBarTitle}>邀请成员</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.pageTitle}>邀请成员</Text>
        <Text style={styles.pageDescription}>
          仅群主或管理员可邀请成员。输入用户名、昵称或邮箱关键词搜索后，选择候选人发送邀请。
        </Text>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          style={styles.input}
          placeholder="搜索用户名、昵称或邮箱"
          value={keyword}
          onChangeText={setKeyword}
          autoCapitalize="none"
          autoCorrect={false}
          testID="input.group.invite.keyword"
        />
        {inviteCandidatesLoading ? <ActivityIndicator size="small" color={COLORS.PRIMARY} /> : null}
      </View>

      {inlineHint ? <Text style={styles.hintText} testID="state.group.invite.inlineHint">{inlineHint}</Text> : null}
      {inviteCandidatesError ? <Text style={styles.errorText}>{inviteCandidatesError}</Text> : null}

      {invitationSummary ? (
        <View style={styles.successCard} testID="state.group.invite.successCard">
          <Text style={styles.successTitle}>{invitationSummary.title}</Text>
          <Text style={styles.successText}>{invitationSummary.detail}</Text>
        </View>
      ) : null}

      <FlatList
        data={inviteCandidates}
        keyExtractor={(item) => item.id}
        renderItem={renderCandidate}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={inviteCandidates.length ? styles.listContent : styles.emptyContent}
        testID="list.group.invite.candidates"
      />

      <TouchableOpacity
        style={styles.resetButton}
        onPress={() => {
          setKeyword('');
          setInlineHint('请输入用户名、昵称或邮箱关键词搜索用户');
          dispatch(clearInviteCandidates());
          dispatch(clearLastInvitation());
        }}
        testID="action.group.invite.reset"
      >
        <Text style={styles.resetButtonText}>清空搜索与结果</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    paddingHorizontal: 16,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 16,
    marginHorizontal: -16,
    borderBottomWidth: 1,
    borderBottomColor: '#CFE1FF',
    backgroundColor: 'rgba(255,255,255,0.90)',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.11,
    shadowRadius: 14,
    elevation: 3,
  },
  backButton: {
    marginLeft: 12,
  },
  headerBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 18,
    color: COLORS.TEXT,
  },
  headerRight: {
    width: 56,
  },
  heroCard: {
    marginTop: 12,
    marginBottom: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CFE1FF',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY || '#111827',
    marginBottom: 6,
  },
  pageDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.TEXT_SECONDARY || '#6B7280',
    marginBottom: 14,
  },
  searchBox: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFD8FF',
    backgroundColor: 'rgba(255,255,255,0.86)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
  },
  input: {
    flex: 1,
    minHeight: 48,
    color: COLORS.TEXT_PRIMARY || '#111827',
  },
  hintText: {
    marginTop: 10,
    color: COLORS.TEXT_SECONDARY || '#6B7280',
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    marginTop: 8,
    color: COLORS.DANGER || '#DC2626',
    fontSize: 13,
    lineHeight: 18,
  },
  successCard: {
    marginTop: 14,
    borderRadius: 14,
    padding: 14,
    backgroundColor: 'rgba(239,248,255,0.92)',
    borderWidth: 1,
    borderColor: '#BFD8FF',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
  },
  successTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F6B3A',
    marginBottom: 4,
  },
  successText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#2E7D4B',
  },
  listContent: {
    paddingTop: 14,
    paddingBottom: 20,
  },
  emptyContent: {
    flexGrow: 1,
    paddingTop: 18,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CFE1FF',
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY || '#111827',
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY || '#6B7280',
  },
  blockHint: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.WARNING || '#D97706',
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    padding: 18,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY || '#111827',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.TEXT_SECONDARY || '#6B7280',
  },
  resetButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  resetButtonText: {
    fontSize: 13,
    color: COLORS.PRIMARY || '#2563EB',
    fontWeight: '600',
  },
});

export default InviteMembersScreen;
