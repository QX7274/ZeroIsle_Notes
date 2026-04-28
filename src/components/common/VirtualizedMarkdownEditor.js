/**
 * Virtualized Markdown Editor
 * Renders large documents efficiently using a FlatList.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, TextInput, FlatList, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const VirtualizedMarkdownEditor = ({ value, onChange, style }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [lines, setLines] = useState(value.split('\n'));
  const inputRefs = useRef([]);

  // Update internal state if the external value changes
  useEffect(() => {
    setLines(value.split('\n'));
  }, [value]);

  const handleLineChange = (text, index) => {
    const newLines = [...lines];
    newLines[index] = text;
    setLines(newLines);
    onChange(newLines.join('\n'));
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Enter') {
      e.preventDefault();
      const currentLine = lines[index];
      const currentInput = inputRefs.current[index];
      if (!currentInput) {return;}

      currentInput.getSelection((start, end) => {
        const textBeforeCursor = currentLine.substring(0, start);
        const textAfterCursor = currentLine.substring(start);

        const newLines = [...lines];
        newLines[index] = textBeforeCursor;
        newLines.splice(index + 1, 0, textAfterCursor);

        setLines(newLines);
        onChange(newLines.join('\n'));

        // Focus the new line
        setTimeout(() => {
          const nextInput = inputRefs.current[index + 1];
          if (nextInput) {
            nextInput.focus();
          }
        }, 50);
      });
    } else if (e.nativeEvent.key === 'Backspace' && lines[index].length === 0 && index > 0) {
      e.preventDefault();
      const newLines = [...lines];
      const prevLineContent = newLines[index - 1];
      newLines.splice(index, 1);
      newLines[index - 1] = prevLineContent; // Cursor will be at the end

      setLines(newLines);
      onChange(newLines.join('\n'));

      // Focus the previous line at the end
      setTimeout(() => {
        const prevInput = inputRefs.current[index - 1];
        if (prevInput) {
          prevInput.focus();
          prevInput.setSelection(prevLineContent.length, prevLineContent.length);
        }
      }, 50);
    }
  };

  const renderLine = ({ item, index }) => (
    <TextInput
      ref={el => inputRefs.current[index] = el}
      style={styles.lineInput}
      value={item}
      onChangeText={(text) => handleLineChange(text, index)}
      onKeyPress={(e) => handleKeyPress(e, index)}
      multiline={false} // Each TextInput handles a single line
      blurOnSubmit={false}
      placeholder={index === 0 && lines.length === 1 ? 'Start writing...' : ''}
      placeholderTextColor={theme.colors.textSecondary}
    />
  );

  return (
    <FlatList
      data={lines}
      renderItem={renderLine}
      keyExtractor={(item, index) => index.toString()}
      style={[styles.container, style]}
      contentContainerStyle={styles.contentContainer}
      windowSize={10}
      initialNumToRender={20}
      maxToRenderPerBatch={10}
    />
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  lineInput: {
    fontSize: 16,
    color: theme.colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 24,
    paddingVertical: 0, // Remove default padding
    paddingHorizontal: 2,
  },
});

export default VirtualizedMarkdownEditor;
