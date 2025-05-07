/**
 * API测试屏幕
 */
import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { ApiTestComponent } from '../../components/common';

const ApiTest = () => {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ApiTestComponent />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default ApiTest;
