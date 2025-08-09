import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

const ToolbarContainer = ({ children, style }) => (
  <View style={[styles.toolbarContainer, style]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  toolbarContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 70 : 50,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
});

export default ToolbarContainer;

