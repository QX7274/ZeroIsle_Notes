/**
 * 空状态组件
 * 用于显示列表为空时的提示信息
 */
import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SPACING } from '../../utils/constants/dimensions';
import { COLORS } from '../../utils/constants/colors';

const EmptyState = ({
  icon,
  title,
  message,
  buttonTitle,
  onButtonPress,
  secondaryButtonTitle,
  onSecondaryButtonPress,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {icon && (
        <Icon
          name={icon}
          size={64}
          color={COLORS.TEXT_SECONDARY}
          style={styles.icon}
        />
      )}
      
      {title && (
        <Text style={styles.title}>{title}</Text>
      )}
      
      {message && (
        <Text style={styles.message}>{message}</Text>
      )}
      
      {buttonTitle && onButtonPress && (
        <TouchableOpacity
          style={styles.button}
          onPress={onButtonPress}
        >
          <Text style={styles.buttonText}>{buttonTitle}</Text>
        </TouchableOpacity>
      )}
      
      {secondaryButtonTitle && onSecondaryButtonPress && (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onSecondaryButtonPress}
        >
          <Text style={styles.secondaryButtonText}>{secondaryButtonTitle}</Text>
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
    marginBottom: SPACING.MEDIUM,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: SPACING.LARGE,
    paddingVertical: SPACING.MEDIUM,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
  },
  secondaryButtonText: {
    color: COLORS.PRIMARY,
    fontWeight: '600',
    fontSize: 16,
  },
});

export default EmptyState;
