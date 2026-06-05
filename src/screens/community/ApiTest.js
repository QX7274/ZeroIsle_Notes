/**
 * API 测试页面（开发验证）
 */
import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { ApiTestComponent } from '../../components/common';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';

const ApiTest = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} testID="state.community.apiTest.state.ready">
      <View testID="state.community.apiTest.visibility.visible" />
      <View style={styles.header} testID="panel.community.apiTest.header">
        <ScreenHeaderBackButton onPress={() => navigation.goBack()} testID="action.community.apiTest.back" style={styles.backButton} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>API 测试</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.content} testID="panel.community.apiTest.content">
        <ApiTestComponent />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33,150,243,0.18)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  backButton: {
    width: 40,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerRight: {
    width: 36,
    height: 36,
  },
  content: {
    flex: 1,
  },
});

export default ApiTest;
