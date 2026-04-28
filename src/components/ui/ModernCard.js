import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { BlurView } from '@react-native-blur/blur';

const { width: screenWidth } = Dimensions.get('window');

const ModernCard = ({
  children,
  title,
  subtitle,
  onPress,
  style = {},
  variant = 'default',
  elevation = 'medium',
  glassEffect = false,
  gradientBackground = false,
  borderRadius = 16,
  padding = 20,
  margin = 12,
  shadowColor = '#000',
  animated = true,
  ...props
}) => {
  const scaleValue = new Animated.Value(1);
  const shadowValue = new Animated.Value(0);

  const handlePressIn = () => {
    if (!animated) {return;}

    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 0.98,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(shadowValue, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (!animated) {return;}

    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(shadowValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const getCardStyles = () => {
    const baseStyles = [
      styles.card,
      {
        borderRadius,
        padding,
        margin,
      },
      styles[elevation],
      styles[variant],
    ];

    if (glassEffect) {
      baseStyles.push(styles.glassEffect);
    }

    return baseStyles;
  };

  const getShadowStyles = () => {
    if (!animated) {return {};}

    return {
      shadowOpacity: shadowValue.interpolate({
        inputRange: [0, 1],
        outputRange: [styles[elevation].shadowOpacity, styles[elevation].shadowOpacity * 1.5],
      }),
      shadowRadius: shadowValue.interpolate({
        inputRange: [0, 1],
        outputRange: [styles[elevation].shadowRadius, styles[elevation].shadowRadius * 1.2],
      }),
    };
  };

  const renderBackground = () => {
    if (glassEffect) {
      return (
        <BlurView
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          blurType="light"
          blurAmount={15}
        />
      );
    }

    if (gradientBackground) {
      const gradientColors = getGradientColors();
      return (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
      );
    }

    return null;
  };

  const getGradientColors = () => {
    switch (variant) {
      case 'primary':
        return ['#007AFF', '#0056CC'];
      case 'success':
        return ['#34C759', '#248A3D'];
      case 'warning':
        return ['#FF9500', '#CC7700'];
      case 'danger':
        return ['#FF3B30', '#D70015'];
      case 'dark':
        return ['#1C1C1E', '#2C2C2E'];
      default:
        return ['#F2F2F7', '#E5E5EA'];
    }
  };

  const renderHeader = () => {
    if (!title && !subtitle) {return null;}

    return (
      <View style={styles.header}>
        {title && (
          <Text style={[styles.title, styles[`${variant}Title`]]}>
            {title}
          </Text>
        )}
        {subtitle && (
          <Text style={[styles.subtitle, styles[`${variant}Subtitle`]]}>
            {subtitle}
          </Text>
        )}
      </View>
    );
  };

  const CardContent = () => (
    <View style={getCardStyles()}>
      {renderBackground()}

      <View style={styles.content}>
        {renderHeader()}
        {children}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Animated.View
        style={[
          { transform: [{ scale: scaleValue }] },
          getShadowStyles(),
          style,
        ]}
      >
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          {...props}
        >
          <CardContent />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[getShadowStyles(), style]}>
      <CardContent />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },

  // Elevation variants
  low: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  high: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },

  // Variant styles
  default: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  primary: {
    backgroundColor: '#007AFF',
  },
  success: {
    backgroundColor: '#34C759',
  },
  warning: {
    backgroundColor: '#FF9500',
  },
  danger: {
    backgroundColor: '#FF3B30',
  },
  dark: {
    backgroundColor: '#1C1C1E',
  },
  light: {
    backgroundColor: '#F2F2F7',
  },

  // Glass effect
  glassEffect: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },

  // Content layout
  content: {
    flex: 1,
  },
  header: {
    marginBottom: 12,
  },

  // Typography
  title: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'SF Pro Display',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro Text',
    opacity: 0.7,
  },

  // Title colors for variants
  defaultTitle: {
    color: '#000000',
  },
  primaryTitle: {
    color: '#FFFFFF',
  },
  successTitle: {
    color: '#FFFFFF',
  },
  warningTitle: {
    color: '#FFFFFF',
  },
  dangerTitle: {
    color: '#FFFFFF',
  },
  darkTitle: {
    color: '#FFFFFF',
  },
  lightTitle: {
    color: '#000000',
  },

  // Subtitle colors for variants
  defaultSubtitle: {
    color: '#8E8E93',
  },
  primarySubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  successSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  warningSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  dangerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  darkSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  lightSubtitle: {
    color: '#8E8E93',
  },
});

export default ModernCard;
