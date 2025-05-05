/**
 * 屏幕共享屏幕
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import ScreenShare from '../../components/groups/ScreenShare';

const ScreenShareScreen = () => {
  const route = useRoute();
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
    backgroundColor: theme => theme.colors.background,
  },
});

export default ScreenShareScreen;
