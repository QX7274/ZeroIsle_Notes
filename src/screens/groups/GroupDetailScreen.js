import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import MIIcon from 'react-native-vector-icons/MaterialIcons';
import { useDispatch } from 'react-redux';
import { setCurrentGroup } from '../../redux/slices/groupsSlice';
import GroupDetail from '../../components/groups/GroupDetail';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import { COLORS } from '../../utils/constants/colors';

const GroupDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { groupId } = route.params || {};
  const hasGroupId = Boolean(groupId);
  const pageState = hasGroupId ? 'ready' : 'invalid';

  useEffect(() => {
    return () => {
      dispatch(setCurrentGroup(null));
    };
  }, [dispatch]);

  return (
    <View style={styles.container} testID={`state.group.detailScreen.state.${pageState}`}>
      <View testID="state.group.detailScreen.visibility.visible" />
      <View testID={`state.group.detailScreen.groupId.visibility.${hasGroupId ? 'visible' : 'hidden'}`} />
      <View testID={`state.group.detailScreen.invalid.visibility.${hasGroupId ? 'hidden' : 'visible'}`} />
      <View style={styles.headerBar}>
        <ScreenHeaderBackButton
          onPress={() => navigation.goBack()}
          testID="action.group.detailScreen.back"
          style={styles.backButton}
        />
        <Text style={styles.headerTitle}>群组详情</Text>
        <View style={styles.headerRight} />
      </View>

      {!hasGroupId ? (
        <View style={styles.invalidWrap} testID="state.group.detailScreen.invalid">
          <Text style={styles.invalidText}>缺少群组标识，无法加载详情</Text>
          <TouchableOpacity
            style={styles.invalidBackButton}
            onPress={() => navigation.goBack()}
            testID="action.group.detailScreen.invalidBack"
          >
            <Text style={styles.invalidBackText}>返回</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <GroupDetail groupId={groupId} />
      )}
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
    paddingVertical: 12,
    paddingTop: 24,
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
    marginLeft: -4,
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
  invalidWrap: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: 'rgba(254,242,242,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  invalidText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  invalidBackButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  invalidBackText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default GroupDetailScreen;
