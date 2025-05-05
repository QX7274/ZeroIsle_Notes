/**
 * 加入群组屏幕
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import JoinGroup from '../../components/groups/JoinGroup';
import { useTheme } from '../../context/ThemeContext';
import { COLORS } from '../../utils/constants/colors';

const JoinGroupScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();

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
