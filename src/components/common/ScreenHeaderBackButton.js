import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';

const ScreenHeaderBackButton = ({ onPress, testID = 'action.header.back', style }) => {
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const backgroundColor = colors.primary ? `${colors.primary}14` : 'rgba(33,150,243,0.12)';
  const iconColor = colors.primary || '#2196F3';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? `${backgroundColor}CC` : backgroundColor },
        style,
      ]}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="返回"
      hitSlop={8}
    >
      <Icon name="arrow-back" size={20} color={iconColor} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ScreenHeaderBackButton;
