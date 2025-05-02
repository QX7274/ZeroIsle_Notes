/**
 * 屏幕共享屏幕
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import ScreenShare from '../../components/groups/ScreenShare';
import { COLORS } from '../../utils/theme';

const ScreenShareScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { groupId } = route.params;

  return (
    <View style={styles.container}>
      <ScreenShare groupId={groupId} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
});

export default ScreenShareScreen;
