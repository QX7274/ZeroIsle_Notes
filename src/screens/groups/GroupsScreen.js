/**
 * 群组屏幕
 */
import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { selectGroupInvitations, fetchGroupInvitations } from '../../redux/slices/groupsSlice';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MIIcon from 'react-native-vector-icons/MaterialIcons';
import GroupList from '../../components/groups/GroupList';
import { useTheme } from '../../context/ThemeContext';

import { COLORS } from '../../utils/constants/colors';

const GroupsScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const invitations = useSelector(selectGroupInvitations) || [];
  const { theme } = useTheme();

  useEffect(() => {
    // 初始化加载邀请数量
    dispatch(fetchGroupInvitations());
  }, [dispatch]);

  return (
    <View style={styles.container}>
      {/* 顶部导航栏（统一返回按钮样式） */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: (theme?.primary || '#2196F3') + '15' }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MIIcon name="arrow-back" size={22} color={theme?.primary || '#2196F3'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>群组</Text>
        <View style={styles.headerRight}>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: '#FF9800' }]}
              onPress={() => navigation.navigate('Invitations')}
            >
              <Icon name="email" size={22} color="#FFFFFF" />
              <Text style={styles.buttonText}>邀请{invitations?.length ? `(${invitations.length})` : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: '#2196F3' }]}
              onPress={() => navigation.navigate('JoinGroup')}
            >
              <Icon name="account-plus" size={22} color="#FFFFFF" />
              <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>加入</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: '#2196F3' }]}
              onPress={() => navigation.navigate('CreateGroup')}
            >
              <Icon name="plus" size={22} color="#FFFFFF" />
              <Text style={styles.buttonText}>创建</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <GroupList />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -4,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 18,
    color: COLORS.TEXT,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  fabButton: {
    position: 'absolute',
    right: 26, // 使用固定值替代 SPACING.LARGE
    bottom: 30, // 使用固定值替代 SPACING.LARGE + 4
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
  },
});

export default GroupsScreen;
