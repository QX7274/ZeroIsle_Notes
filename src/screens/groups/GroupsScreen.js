/**
 * 群组屏幕
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MIIcon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import networkErrorService from '../../services/networkErrorService';

import {
  selectGroupInvitations,
  fetchGroupInvitations,
  selectGroupsLoading,
  selectGroupsError,
} from '../../redux/slices/groupsSlice';
import GroupList from '../../components/groups/GroupList';
import { useTheme } from '../../context/ThemeContext';
import { COLORS } from '../../utils/constants/colors';

const GroupsScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const invitations = useSelector(selectGroupInvitations) || [];
  const isLoading = useSelector(selectGroupsLoading);
  const groupsError = useSelector(selectGroupsError);
  const { theme } = useTheme();
  const primary = theme?.primary || '#2563EB';
  const lastNetworkErrorRef = useRef('');

  const invitationCount = invitations.length;
  const invitationBadgeVisible = invitationCount > 0;
  const invitationLabel = `邀请${invitationCount ? `(${invitationCount})` : ''}`;
  const topInset = Math.max(insets.top, 16);
  const bottomInset = Math.max(insets.bottom, 12);
  const isNetworkLikeError = useMemo(() => {
    const message = String(groupsError || '');
    return (
      message.toLowerCase().includes('network error')
      || message.includes('网络')
      || message.includes('离线')
      || message.includes('无缓存')
      || message.includes('offline')
    );
  }, [groupsError]);
  const showErrorCard = Boolean(groupsError) && !isNetworkLikeError;
  const pageState = isLoading
    ? 'loading'
    : groupsError
      ? 'error'
      : invitationCount > 0
        ? 'readyWithInvitations'
        : 'ready';

  useEffect(() => {
    dispatch(fetchGroupInvitations());
  }, [dispatch]);

  useEffect(() => {
    if (!isNetworkLikeError || !groupsError) {
      lastNetworkErrorRef.current = '';
      return;
    }

    const resolvedMessage = String(groupsError);
    if (lastNetworkErrorRef.current === resolvedMessage) {
      return;
    }

    lastNetworkErrorRef.current = resolvedMessage;
    networkErrorService.handleApiError(new Error(resolvedMessage), {
      context: '加载群组邀请',
      customMessage: '网络连接失败，无法加载群组邀请',
    });
  }, [groupsError, isNetworkLikeError]);

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]} testID={`state.groups.screen.state.${pageState}`}>
      <View testID="state.groups.screen.visibility.visible" />
      <View testID={`state.groups.screen.loading.visibility.${isLoading ? 'visible' : 'hidden'}`} />
      <View testID={`state.groups.screen.error.visibility.${showErrorCard ? 'visible' : 'hidden'}`} />
      <View testID={`state.groups.invitations.count.${invitationCount}`} />
      <View testID={`state.groups.invitations.badge.visibility.${invitationBadgeVisible ? 'visible' : 'hidden'}`} />
      <View testID={`state.groups.invitations.label.visibility.${invitationLabel ? 'visible' : 'hidden'}`} />

      <View style={styles.headerBar}>
        <View testID="state.groups.header.visibility.visible" />
        <ScreenHeaderBackButton
          onPress={() => navigation.goBack()}
          testID="action.group.screen.back"
          style={styles.backButton}
        />

        <Text style={styles.headerTitle}>群组</Text>

        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.headerButton, styles.glassButtonWarning]}
            onPress={() => navigation.navigate('Invitations')}
            testID="action.group.openInvitations"
          >
            <Icon name="email" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>{invitationLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerButton, styles.glassButtonPrimary]}
            onPress={() => navigation.navigate('JoinGroup')}
            testID="action.group.openJoin"
          >
            <Icon name="account-plus" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>加入</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerButton, styles.glassButtonPrimary]}
            onPress={() => navigation.navigate('CreateGroup')}
            testID="action.group.openCreate"
          >
            <Icon name="plus" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>创建</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showErrorCard ? (
        <View style={styles.errorCard} testID="state.groups.screen.errorCard">
          <MIIcon name="error-outline" size={16} color="#B91C1C" />
          <Text style={styles.errorText}>{String(groupsError)}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingBar} testID="state.groups.screen.loadingBar">
          <ActivityIndicator size="small" color={primary} />
          <Text style={styles.loadingText}>正在同步群组数据...</Text>
        </View>
      ) : null}

      <GroupList />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6FAFF',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#CFE1FF',
    backgroundColor: 'rgba(255,255,255,0.90)',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
  },
  backButton: {
    marginLeft: -4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 18,
    color: COLORS.TEXT,
    letterSpacing: 0.2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D9E8FF',
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  headerButton: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginLeft: 8,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  glassButtonPrimary: {
    backgroundColor: 'rgba(37,99,235,0.9)',
  },
  glassButtonWarning: {
    backgroundColor: 'rgba(59,130,246,0.72)',
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  errorCard: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: 'rgba(254,242,242,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#B91C1C',
    flex: 1,
    lineHeight: 18,
    fontSize: 13,
  },
  loadingBar: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: '#D9E8FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#4B627A',
    fontSize: 12,
  },
});

export default GroupsScreen;
