/**
 * 群组详情屏幕
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { setCurrentGroup } from '../../redux/slices/groupsSlice';
import GroupDetail from '../../components/groups/GroupDetail';
import { COLORS } from '../../utils/theme';

const GroupDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { groupId } = route.params;

  useEffect(() => {
    // 设置当前群组
    return () => {
      dispatch(setCurrentGroup(null));
    };
  }, []);

  return (
    <View style={styles.container}>
      <GroupDetail groupId={groupId} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
});

export default GroupDetailScreen;
