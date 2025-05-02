/**
 * 加入群组屏幕
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import JoinGroup from '../../components/groups/JoinGroup';
import { COLORS } from '../../utils/theme';

const JoinGroupScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <JoinGroup />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
});

export default JoinGroupScreen;
