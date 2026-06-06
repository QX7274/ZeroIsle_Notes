/**
 * 加入群组屏幕
 */
import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import JoinGroup from '../../components/groups/JoinGroup';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import { COLORS } from '../../utils/constants/colors';

const JoinGroupScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container} testID="state.group.joinScreen.state.ready">
      <View testID="state.group.joinScreen.visibility.visible" />
      <View testID="panel.group.joinScreen.wrapper.visible" />
      <View style={styles.headerBar}>
        <ScreenHeaderBackButton
          onPress={() => navigation.goBack()}
          testID="action.group.joinScreen.back"
          style={styles.backButton}
        />
        <Text style={styles.headerTitle}>加入群组</Text>
        <View style={styles.headerRight} />
      </View>
      <JoinGroup />
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
    paddingTop: 16,
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
});

export default JoinGroupScreen;
