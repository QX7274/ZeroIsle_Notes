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
  buttonTestID,
  secondaryButtonTestID,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {icon ? (
        <Icon
          name={icon}
          size={64}
          color={COLORS.TEXT_SECONDARY}
          style={styles.icon}
        />
      ) : null}

      {title ? <Text style={styles.title}>{title}</Text> : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {buttonTitle && onButtonPress ? (
        <TouchableOpacity
          style={styles.button}
          onPress={onButtonPress}
          testID={buttonTestID}
        >
          <Text style={styles.buttonText}>{buttonTitle}</Text>
        </TouchableOpacity>
      ) : null}

      {secondaryButtonTitle && onSecondaryButtonPress ? (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onSecondaryButtonPress}
          testID={secondaryButtonTestID}
        >
          <Text style={styles.secondaryButtonText}>{secondaryButtonTitle}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.XLARGE,
    backgroundColor: 'transparent',
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
    backgroundColor: '#1D4ED8',
    paddingHorizontal: SPACING.LARGE,
    paddingVertical: SPACING.MEDIUM,
    borderRadius: 16,
    marginBottom: SPACING.MEDIUM,
    borderWidth: 1,
    borderColor: '#2563EB',
    shadowColor: '#4C8DFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: SPACING.LARGE,
    paddingVertical: SPACING.MEDIUM,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CFE1FF',
  },
  secondaryButtonText: {
    color: '#2563EB',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default EmptyState;
