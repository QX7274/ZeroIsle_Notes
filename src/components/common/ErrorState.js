/**
 * 错误状态组件
 * 用于显示加载失败时的错误信息
 */
import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SPACING } from '../../utils/constants/dimensions';
import { COLORS } from '../../utils/constants/colors';

const ErrorState = ({
  icon = 'alert-circle',
  title = '出错了',
  message,
  buttonTitle = '重试',
  onRetry,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <Icon
        name={icon}
        size={64}
        color={COLORS.ERROR}
        style={styles.icon}
      />
      
      <Text style={styles.title}>{title}</Text>
      
      {message && (
        <Text style={styles.message}>{message}</Text>
      )}
      
      {onRetry && (
        <TouchableOpacity
          style={styles.button}
          onPress={onRetry}
        >
          <Text style={styles.buttonText}>{buttonTitle}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.XLARGE,
  },
  icon: {
    marginBottom: SPACING.MEDIUM,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SMALL,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: SPACING.LARGE,
    lineHeight: 22,
  },
  button: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SPACING.LARGE,
    paddingVertical: SPACING.MEDIUM,
    borderRadius: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default ErrorState;
