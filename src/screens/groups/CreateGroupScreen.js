/**
 * 创建群组屏幕
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import CreateGroup from '../../components/groups/CreateGroup';
import { useTheme } from '../../context/ThemeContext';
import { COLORS } from '../../utils/constants/colors';

const CreateGroupScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <CreateGroup />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
});

export default CreateGroupScreen;
