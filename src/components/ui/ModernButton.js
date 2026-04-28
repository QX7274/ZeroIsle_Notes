import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { BlurView } from '@react-native-blur/blur';

const { width: screenWidth } = Dimensions.get('window');

const ModernButton = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon = null,
  style = {},
  textStyle = {},
  hapticFeedback = true,
  glowEffect = false,
  ...props
}) => {
  const scaleValue = new Animated.Value(1);
  const opacityValue = new Animated.Value(1);
  const glowValue = new Animated.Value(0);

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 0.96,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(opacityValue, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      glowEffect && Animated.timing(glowValue, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(opacityValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      glowEffect && Animated.timing(glowValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const getButtonStyles = () => {
    const baseStyles = [styles.button, styles[size]];

    switch (variant) {
      case 'primary':
        return [...baseStyles, styles.primaryButton];
      case 'secondary':
        return [...baseStyles, styles.secondaryButton];
      case 'ghost':
        return [...baseStyles, styles.ghostButton];
      case 'danger':
        return [...baseStyles, styles.dangerButton];
      case 'success':
        return [...baseStyles, styles.successButton];
      default:
        return [...baseStyles, styles.primaryButton];
    }
  };

  const getTextStyles = () => {
    const baseTextStyles = [styles.buttonText, styles[`${size}Text`]];

    switch (variant) {
      case 'primary':
        return [...baseTextStyles, styles.primaryText];
      case 'secondary':
        return [...baseTextStyles, styles.secondaryText];
      case 'ghost':
        return [...baseTextStyles, styles.ghostText];
      case 'danger':
        return [...baseTextStyles, styles.dangerText];
      case 'success':
        return [...baseTextStyles, styles.successText];
      default:
        return [...baseTextStyles, styles.primaryText];
    }
  };

  const getGradientColors = () => {
    switch (variant) {
      case 'primary':
        return ['#007AFF', '#0056CC'];
      case 'secondary':
        return ['#8E8E93', '#636366'];
      case 'danger':
        return ['#FF3B30', '#D70015'];
      case 'success':
        return ['#34C759', '#248A3D'];
      default:
        return ['#007AFF', '#0056CC'];
    }
  };

  const renderButtonContent = () => {
    if (variant === 'ghost') {
      return (
        <BlurView
          style={[StyleSheet.absoluteFill, { borderRadius: styles[size].borderRadius }]}
          blurType="light"
          blurAmount={10}
        />
      );
    }

    if (variant === 'primary' || variant === 'danger' || variant === 'success') {
      return (
        <LinearGradient
          colors={getGradientColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: styles[size].borderRadius }]}
        />
      );
    }

    return null;
  };

  const renderGlowEffect = () => {
    if (!glowEffect) {return null;}

    return (
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: glowValue,
            shadowColor: getGradientColors()[0],
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 20,
            borderRadius: styles[size].borderRadius,
          },
        ]}
      />
    );
  };

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleValue }], opacity: opacityValue },
        style,
      ]}
    >
      {renderGlowEffect()}
      <TouchableOpacity
        style={[getButtonStyles(), disabled && styles.disabled]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={1}
        {...props}
      >
        {renderButtonContent()}

        <View style={styles.contentContainer}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}

          {loading ? (
            <View style={styles.loadingContainer}>
              <Animated.View
                style={[
                  styles.loadingSpinner,
                  {
                    transform: [{
                      rotate: glowValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    }],
                  },
                ]}
              />
            </View>
          ) : (
            <Text style={[getTextStyles(), textStyle]}>{title}</Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // Size variants
  small: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
    borderRadius: 8,
  },
  medium: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 48,
    borderRadius: 12,
  },
  large: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    minHeight: 56,
    borderRadius: 16,
  },

  // Button variants
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#D1D1D6',
  },
  ghostButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  successButton: {
    backgroundColor: '#34C759',
  },

  // Text styles
  buttonText: {
    fontFamily: 'SF Pro Display',
    fontWeight: '600',
    textAlign: 'center',
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },

  // Text color variants
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#007AFF',
  },
  ghostText: {
    color: '#FFFFFF',
  },
  dangerText: {
    color: '#FFFFFF',
  },
  successText: {
    color: '#FFFFFF',
  },

  // Content layout
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },

  // Loading state
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSpinner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: '#FFFFFF',
  },

  // Disabled state
  disabled: {
    opacity: 0.5,
  },
});

export default ModernButton;
