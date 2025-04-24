import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';

const LayerManager = ({ elements, selectedElement, onElementSelect, onLayerOrderChange }) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const handleMoveUp = (index) => {
    if (index > 0) {
      const newElements = [...elements];
      [newElements[index], newElements[index - 1]] = [newElements[index - 1], newElements[index]];
      onLayerOrderChange(newElements);
    }
  };

  const handleMoveDown = (index) => {
    if (index < elements.length - 1) {
      const newElements = [...elements];
      [newElements[index], newElements[index + 1]] = [newElements[index + 1], newElements[index]];
      onLayerOrderChange(newElements);
    }
  };

  const getElementIcon = (type) => {
    switch (type) {
      case 'text':
        return 'text';
      case 'image':
        return 'image';
      case 'shape':
        return 'square';
      default:
        return 'help';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBackground }]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={[styles.title, { color: theme.text }]}>图层</Text>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.text}
        />
      </TouchableOpacity>
      {expanded && (
        <ScrollView style={styles.layers}>
          {elements.map((element, index) => (
            <View
              key={element.id}
              style={[
                styles.layer,
                selectedElement?.id === element.id && styles.selectedLayer,
              ]}
            >
              <TouchableOpacity
                style={styles.layerContent}
                onPress={() => onElementSelect(element)}
              >
                <Icon
                  name={getElementIcon(element.type)}
                  size={16}
                  color={theme.text}
                />
                <Text style={[styles.layerText, { color: theme.text }]}>
                  {element.type === 'text' ? element.content : `${element.type} ${index + 1}`}
                </Text>
              </TouchableOpacity>
              <View style={styles.layerControls}>
                <TouchableOpacity
                  style={[styles.controlButton, { opacity: index > 0 ? 1 : 0.5 }]}
                  onPress={() => handleMoveUp(index)}
                  disabled={index === 0}
                >
                  <Icon name="arrow-up" size={16} color={theme.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.controlButton, { opacity: index < elements.length - 1 ? 1 : 0.5 }]}
                  onPress={() => handleMoveDown(index)}
                  disabled={index === elements.length - 1}
                >
                  <Icon name="arrow-down" size={16} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 200,
    maxHeight: 300,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  layers: {
    maxHeight: 200,
  },
  layer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedLayer: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  layerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  layerText: {
    marginLeft: 8,
  },
  layerControls: {
    flexDirection: 'row',
  },
  controlButton: {
    padding: 4,
  },
});

export default LayerManager; 