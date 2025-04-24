import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  PanResponder,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

const CanvasElement = ({ element, scale, onUpdate, onDelete }) => {
  const { theme } = useTheme();
  const [isSelected, setIsSelected] = useState(false);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      setIsSelected(true);
    },
    onPanResponderMove: (_, gestureState) => {
      onUpdate(element.id, {
        x: element.x + gestureState.dx / scale,
        y: element.y + gestureState.dy / scale,
      });
    },
    onPanResponderRelease: () => {
      setIsSelected(false);
    },
  });

  const handleDelete = () => {
    onDelete(element.id);
  };

  const renderElement = () => {
    switch (element.type) {
      case 'text':
        return (
          <Text
            style={[
              styles.text,
              { color: element.color || theme.colors.text },
              element.style,
            ]}
          >
            {element.content}
          </Text>
        );
      case 'image':
        return (
          <Image
            source={{ uri: element.content }}
            style={[styles.image, element.style]}
            resizeMode="contain"
          />
        );
      case 'shape':
        switch (element.shapeType) {
          case 'rectangle':
            return (
              <View
                style={[
                  styles.shape,
                  styles.rectangle,
                  { backgroundColor: element.color || theme.colors.primary },
                  element.style,
                ]}
              />
            );
          case 'circle':
            return (
              <View
                style={[
                  styles.shape,
                  styles.circle,
                  { backgroundColor: element.color || theme.colors.primary },
                  element.style,
                ]}
              />
            );
          case 'triangle':
            return (
              <View
                style={[
                  styles.shape,
                  styles.triangle,
                  { borderBottomColor: element.color || theme.colors.primary },
                  element.style,
                ]}
              />
            );
          case 'line':
            return (
              <View
                style={[
                  styles.line,
                  { backgroundColor: element.color || theme.colors.primary },
                  element.style,
                ]}
              />
            );
          default:
            return null;
        }
      default:
        return null;
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          transform: [
            { translateX: element.x },
            { translateY: element.y },
            { scale: element.scale || 1 },
            { rotate: `${element.rotation || 0}rad` },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      {renderElement()}
      {isSelected && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
        >
          <Text style={styles.deleteButtonText}>×</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
  text: {
    fontSize: 16,
  },
  image: {
    width: 100,
    height: 100,
  },
  shape: {
    width: 100,
    height: 100,
  },
  rectangle: {
    borderRadius: 5,
  },
  circle: {
    borderRadius: 50,
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 50,
    borderRightWidth: 50,
    borderBottomWidth: 100,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  line: {
    width: 100,
    height: 2,
  },
  deleteButton: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CanvasElement; 