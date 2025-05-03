import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Text, Image, Dimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { analyticsService } from '../../services/analytics';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const Canvas = ({ elements, onContentChange, onElementSelect }) => {
  const [selectedElement, setSelectedElement] = useState(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handlePan = useCallback((event) => {
    if (selectedElement) {
      const newElements = elements.map(element => {
        if (element.id === selectedElement.id) {
          return {
            ...element,
            x: element.x + event.translationX / scale,
            y: element.y + event.translationY / scale,
          };
        }
        return element;
      });
      onContentChange(newElements);
      analyticsService.trackCanvasAction('move_element', {
        elementId: selectedElement.id,
        elementType: selectedElement.type,
      });
    } else {
      setOffset(prev => ({
        x: prev.x + event.translationX,
        y: prev.y + event.translationY,
      }));
    }
  }, [selectedElement, elements, onContentChange, scale]);

  const handleScale = useCallback((event) => {
    if (selectedElement) {
      const newElements = elements.map(element => {
        if (element.id === selectedElement.id) {
          return {
            ...element,
            scale: element.scale * event.scale,
          };
        }
        return element;
      });
      onContentChange(newElements);
      analyticsService.trackCanvasAction('scale_element', {
        elementId: selectedElement.id,
        elementType: selectedElement.type,
      });
    } else {
      setScale(prev => Math.min(Math.max(prev * event.scale, 0.1), 5));
    }
  }, [selectedElement, elements, onContentChange]);

  const handleRotate = useCallback((event) => {
    if (selectedElement) {
      const newElements = elements.map(element => {
        if (element.id === selectedElement.id) {
          return {
            ...element,
            rotation: element.rotation + event.rotation,
          };
        }
        return element;
      });
      onContentChange(newElements);
      analyticsService.trackCanvasAction('rotate_element', {
        elementId: selectedElement.id,
        elementType: selectedElement.type,
      });
    }
  }, [selectedElement, elements, onContentChange]);

  const panGesture = Gesture.Pan()
    .onUpdate(handlePan);

  const scaleGesture = Gesture.Pinch()
    .onUpdate(handleScale);

  const rotateGesture = Gesture.Rotation()
    .onUpdate(handleRotate);

  const composed = Gesture.Simultaneous(panGesture, scaleGesture, rotateGesture);

  const handleElementPress = useCallback((element) => {
    setSelectedElement(element);
    onElementSelect(element);
  }, [onElementSelect]);

  const renderElement = (element) => {
    switch (element.type) {
      case 'text':
        return (
          <Text style={[styles.text, { color: element.color || '#000' }]}>
            {element.content}
          </Text>
        );
      case 'image':
        return (
          <Image
            source={{ uri: element.content }}
            style={styles.image}
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
                  { backgroundColor: element.color || '#000' },
                ]}
              />
            );
          case 'circle':
            return (
              <View
                style={[
                  styles.shape,
                  styles.circle,
                  { backgroundColor: element.color || '#000' },
                ]}
              />
            );
          case 'triangle':
            return (
              <View
                style={[
                  styles.shape,
                  styles.triangle,
                  { borderBottomColor: element.color || '#000' },
                ]}
              />
            );
          case 'line':
            return (
              <View
                style={[
                  styles.line,
                  { backgroundColor: element.color || '#000' },
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
    <GestureDetector gesture={composed}>
      <View style={styles.container}>
        <View
          style={[
            styles.canvas,
            {
              transform: [
                { translateX: offset.x },
                { translateY: offset.y },
                { scale },
              ],
            },
          ]}
        >
          {elements.map(element => (
            <View
              key={element.id}
              style={[
                styles.element,
                {
                  transform: [
                    { translateX: element.x },
                    { translateY: element.y },
                    { scale: element.scale },
                    { rotate: `${element.rotation}rad` },
                  ],
                },
              ]}
              onTouchStart={() => handleElementPress(element)}
            >
              {renderElement(element)}
            </View>
          ))}
        </View>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(245,245,250,0.5)',
    borderRadius: 16,
    margin: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  canvas: {
    width: screenWidth * 2,
    height: screenHeight * 2,
    position: 'absolute',
    top: -screenHeight / 2,
    left: -screenWidth / 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  element: {
    position: 'absolute',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
});

export default Canvas;
