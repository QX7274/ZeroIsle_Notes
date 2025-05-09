/**
 * 群组屏幕
 */
import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import GroupList from '../../components/groups/GroupList';
import { useTheme } from '../../context/ThemeContext';
import { COLORS } from '../../utils/constants/colors';

const GroupsScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  useEffect(() => {
    // 设置导航选项
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: '#2196F3' }]}
            onPress={() => navigation.navigate('JoinGroup')}
          >
            <Icon name="account-plus" size={22} color="#FFFFFF" />
            <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>加入</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: '#2196F3' }]}
            onPress={() => navigation.navigate('CreateGroup')}
          >
            <Icon name="plus" size={22} color="#FFFFFF" />
            <Text style={styles.buttonText}>创建</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <GroupList />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  fabButton: {
    position: 'absolute',
    right: 26, // 使用固定值替代 SPACING.LARGE
    bottom: 30, // 使用固定值替代 SPACING.LARGE + 4
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
  },
});

export default GroupsScreen;
