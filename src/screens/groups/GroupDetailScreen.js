/**
 * 群组详情屏幕
 */
import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import MIIcon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch } from 'react-redux';
import { setCurrentGroup } from '../../redux/slices/groupsSlice';
import GroupDetail from '../../components/groups/GroupDetail';
import { useTheme } from '../../context/ThemeContext';
import { COLORS } from '../../utils/constants/colors';

const GroupDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { theme } = useTheme();
  const { groupId } = route.params;

  useEffect(() => {
    // 设置当前群组
    return () => {
      dispatch(setCurrentGroup(null));
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* 顶部导航栏（统一返回按钮样式） */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MIIcon name="arrow-back" size={22} color={COLORS.PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>群组详情</Text>
        <View style={styles.headerRight} />
      </View>

      <GroupDetail groupId={groupId} />
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
    width: 40,
  },
});

export default GroupDetailScreen;
