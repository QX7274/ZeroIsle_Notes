/**
 * 创建群组屏幕
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import CreateGroup from '../../components/groups/CreateGroup';
import { COLORS } from '../../utils/theme';

const CreateGroupScreen = () => {
  const navigation = useNavigation();

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
