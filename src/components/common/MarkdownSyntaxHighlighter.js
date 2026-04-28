/**
 * Markdown Syntax Highlighter Component
 * Provides syntax highlighting for markdown text in the editor
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { parseInlineElements } from '../../utils/markdownParser';

/**
 * Markdown Syntax Highlighter Component
 * @param {string} content - Markdown content to highlight
 * @param {object} style - Custom styles
 * @param {number} fontSize - Font size
 * @param {number} lineHeight - Line height
 * @param {boolean} showLineNumbers - Show line numbers
 */
const MarkdownSyntaxHighlighter = ({
  content = '',
  style,
  fontSize = 16,
  lineHeight = 24,
  showLineNumbers = false,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;

  // Parse and highlight markdown content
  const highlightedContent = useMemo(() => {
    if (!content.trim()) {return [];}

    const lines = content.split('\n');
    return lines.map((line, index) => ({
      number: index + 1,
      content: highlightLine(line),
      raw: line,
    }));
  }, [content]);

  // Highlight a single line
  const highlightLine = (line) => {
    const elements = [];
    let currentPos = 0;

    // Check for block-level elements first
    const blockElement = getBlockElement(line);
    if (blockElement) {
      elements.push(blockElement);
      return elements;
    }

    // Parse inline elements
    const inlineElements = parseInlineElements(line);

    // Build highlighted elements
    inlineElements.forEach((element, index) => {
      // Add text before this element
      if (element.start > currentPos) {
        const beforeText = line.substring(currentPos, element.start);
        if (beforeText) {
          elements.push({
            type: 'text',
            content: beforeText,
            key: `text-${index}-before`,
          });
        }
      }

      // Add the highlighted element
      elements.push({
        ...element,
        key: `element-${index}`,
      });

      currentPos = element.end;
    });

    // Add remaining text
    if (currentPos < line.length) {
      const remainingText = line.substring(currentPos);
      if (remainingText) {
        elements.push({
          type: 'text',
          content: remainingText,
          key: 'text-end',
        });
      }
    }

    // If no inline elements, treat as plain text
    if (elements.length === 0 && line.trim()) {
      elements.push({
        type: 'text',
        content: line,
        key: 'text-only',
      });
    }

    return elements;
  };

  // Get block-level element type and styling
  const getBlockElement = (line) => {
    const trimmed = line.trim();

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      return {
        type: 'header',
        level: headerMatch[1].length,
        marker: headerMatch[1],
        content: headerMatch[2],
        raw: line,
        key: 'header',
      };
    }

    // Code block markers
    if (trimmed.startsWith('```')) {
      return {
        type: 'codeBlockMarker',
        language: trimmed.substring(3).trim(),
        content: line,
        key: 'code-marker',
      };
    }

    // Blockquotes
    if (line.match(/^>\s+/)) {
      return {
        type: 'blockquote',
        marker: '>',
        content: line.substring(line.indexOf('>') + 1).trim(),
        raw: line,
        key: 'blockquote',
      };
    }

    // Lists
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const indent = listMatch[1];
      const marker = listMatch[2];
      const content = listMatch[3];

      // Check for task list
      const taskMatch = content.match(/^\[([ x])\]\s+(.+)$/);
      if (taskMatch) {
        return {
          type: 'taskList',
          indent,
          marker,
          checked: taskMatch[1] === 'x',
          checkbox: `[${taskMatch[1]}]`,
          content: taskMatch[2],
          raw: line,
          key: 'task-list',
        };
      }

      return {
        type: 'list',
        indent,
        marker,
        content,
        raw: line,
        key: 'list',
      };
    }

    // Horizontal rules
    if (/^(---|\*\*\*|___)$/.test(trimmed)) {
      return {
        type: 'horizontalRule',
        content: trimmed,
        key: 'hr',
      };
    }

    // Table rows
    if (trimmed.includes('|') && trimmed.length > 1) {
      return {
        type: 'table',
        content: line,
        cells: line.split('|').map(cell => cell.trim()),
        key: 'table',
      };
    }

    return null;
  };

  // Render highlighted element
  const renderElement = (element, lineIndex) => {
    const elementStyles = getElementStyles(element.type, element);

    switch (element.type) {
      case 'header':
        return (
          <Text key={element.key} style={elementStyles.container}>
            <Text style={elementStyles.marker}>{element.marker} </Text>
            <Text style={elementStyles.content}>{element.content}</Text>
          </Text>
        );

      case 'codeBlockMarker':
        return (
          <Text key={element.key} style={elementStyles.container}>
            <Text style={elementStyles.marker}>```</Text>
            {element.language && (
              <Text style={elementStyles.language}>{element.language}</Text>
            )}
          </Text>
        );

      case 'blockquote':
        return (
          <Text key={element.key} style={elementStyles.container}>
            <Text style={elementStyles.marker}>&gt; </Text>
            <Text style={elementStyles.content}>{element.content}</Text>
          </Text>
        );

      case 'list':
        return (
          <Text key={element.key} style={elementStyles.container}>
            <Text style={elementStyles.indent}>{element.indent}</Text>
            <Text style={elementStyles.marker}>{element.marker} </Text>
            <Text style={elementStyles.content}>{element.content}</Text>
          </Text>
        );

      case 'taskList':
        return (
          <Text key={element.key} style={elementStyles.container}>
            <Text style={elementStyles.indent}>{element.indent}</Text>
            <Text style={elementStyles.marker}>{element.marker} </Text>
            <Text style={[elementStyles.checkbox, element.checked && elementStyles.checkedBox]}>
              {element.checkbox}
            </Text>
            <Text> </Text>
            <Text style={[elementStyles.content, element.checked && elementStyles.checkedText]}>
              {element.content}
            </Text>
          </Text>
        );

      case 'horizontalRule':
        return (
          <Text key={element.key} style={elementStyles.container}>
            {element.content}
          </Text>
        );

      case 'table':
        return (
          <Text key={element.key} style={elementStyles.container}>
            {element.cells.map((cell, index) => (
              <Text key={`cell-${index}`}>
                {index > 0 && <Text style={elementStyles.separator}>|</Text>}
                <Text style={elementStyles.cell}>{cell}</Text>
              </Text>
            ))}
          </Text>
        );

      case 'bold':
        return (
          <Text key={element.key} style={elementStyles.container}>
            <Text style={elementStyles.marker}>**</Text>
            <Text style={elementStyles.content}>{element.text}</Text>
            <Text style={elementStyles.marker}>**</Text>
          </Text>
        );

      case 'italic':
        return (
          <Text key={element.key} style={elementStyles.container}>
            <Text style={elementStyles.marker}>*</Text>
            <Text style={elementStyles.content}>{element.text}</Text>
            <Text style={elementStyles.marker}>*</Text>
          </Text>
        );

      case 'strikethrough':
        return (
          <Text key={element.key} style={elementStyles.container}>
            <Text style={elementStyles.marker}>~~</Text>
            <Text style={elementStyles.content}>{element.text}</Text>
            <Text style={elementStyles.marker}>~~</Text>
          </Text>
        );

      case 'code':
        return (
          <Text key={element.key} style={elementStyles.container}>
            <Text style={elementStyles.marker}>`</Text>
            <Text style={elementStyles.content}>{element.text}</Text>
            <Text style={elementStyles.marker}>`</Text>
          </Text>
        );

      case 'link':
        return (
          <Text key={element.key} style={elementStyles.container}>
            <Text style={elementStyles.marker}>[</Text>
            <Text style={elementStyles.content}>{element.text}</Text>
            <Text style={elementStyles.marker}>](</Text>
            <Text style={elementStyles.url}>{element.url}</Text>
            <Text style={elementStyles.marker}>)</Text>
          </Text>
        );

      case 'image':
        return (
          <Text key={element.key} style={elementStyles.container}>
            <Text style={elementStyles.marker}>![</Text>
            <Text style={elementStyles.content}>{element.alt}</Text>
            <Text style={elementStyles.marker}>](</Text>
            <Text style={elementStyles.url}>{element.src}</Text>
            <Text style={elementStyles.marker}>)</Text>
          </Text>
        );

      case 'text':
      default:
        return (
          <Text key={element.key} style={elementStyles.container}>
            {element.content}
          </Text>
        );
    }
  };

  // Get styles for different element types
  const getElementStyles = (type, element = {}) => {
    const baseStyles = {
      container: {
        color: colors.text,
        fontSize,
        lineHeight,
      },
      marker: {
        color: colors.textSecondary,
        fontWeight: '600',
      },
      content: {
        color: colors.text,
      },
    };

    switch (type) {
      case 'header':
        const headerSize = Math.max(fontSize - (element.level - 1) * 2, fontSize * 0.8);
        return {
          ...baseStyles,
          container: {
            ...baseStyles.container,
            fontSize: headerSize,
            fontWeight: '700',
            color: colors.primary,
          },
          marker: {
            ...baseStyles.marker,
            color: colors.primary,
          },
        };

      case 'codeBlockMarker':
        return {
          ...baseStyles,
          container: {
            ...baseStyles.container,
            backgroundColor: colors.card,
            color: colors.primary,
            fontFamily: 'monospace',
          },
          language: {
            color: colors.textSecondary,
            fontStyle: 'italic',
          },
        };

      case 'blockquote':
        return {
          ...baseStyles,
          container: {
            ...baseStyles.container,
            fontStyle: 'italic',
            color: colors.textSecondary,
          },
          marker: {
            ...baseStyles.marker,
            color: colors.primary,
            fontWeight: 'bold',
          },
        };

      case 'list':
        return {
          ...baseStyles,
          marker: {
            ...baseStyles.marker,
            color: colors.primary,
            fontWeight: 'bold',
          },
        };

      case 'taskList':
        return {
          ...baseStyles,
          checkbox: {
            color: colors.primary,
            fontWeight: 'bold',
          },
          checkedBox: {
            color: colors.success || colors.primary,
          },
          checkedText: {
            textDecorationLine: 'line-through',
            color: colors.textSecondary,
          },
        };

      case 'horizontalRule':
        return {
          ...baseStyles,
          container: {
            ...baseStyles.container,
            color: colors.border,
            fontWeight: 'bold',
          },
        };

      case 'table':
        return {
          ...baseStyles,
          separator: {
            color: colors.primary,
            fontWeight: 'bold',
          },
          cell: {
            color: colors.text,
          },
        };

      case 'bold':
        return {
          ...baseStyles,
          content: {
            ...baseStyles.content,
            fontWeight: 'bold',
          },
          marker: {
            ...baseStyles.marker,
            color: colors.primary,
          },
        };

      case 'italic':
        return {
          ...baseStyles,
          content: {
            ...baseStyles.content,
            fontStyle: 'italic',
          },
          marker: {
            ...baseStyles.marker,
            color: colors.primary,
          },
        };

      case 'strikethrough':
        return {
          ...baseStyles,
          content: {
            ...baseStyles.content,
            textDecorationLine: 'line-through',
          },
          marker: {
            ...baseStyles.marker,
            color: colors.primary,
          },
        };

      case 'code':
        return {
          ...baseStyles,
          container: {
            ...baseStyles.container,
            backgroundColor: colors.card,
            fontFamily: 'monospace',
          },
          content: {
            ...baseStyles.content,
            color: colors.primary,
          },
          marker: {
            ...baseStyles.marker,
            color: colors.primary,
          },
        };

      case 'link':
        return {
          ...baseStyles,
          content: {
            ...baseStyles.content,
            color: colors.primary,
          },
          url: {
            color: colors.textSecondary,
            textDecorationLine: 'underline',
          },
          marker: {
            ...baseStyles.marker,
            color: colors.primary,
          },
        };

      case 'image':
        return {
          ...baseStyles,
          content: {
            ...baseStyles.content,
            color: colors.success || colors.primary,
          },
          url: {
            color: colors.textSecondary,
            textDecorationLine: 'underline',
          },
          marker: {
            ...baseStyles.marker,
            color: colors.success || colors.primary,
          },
        };

      default:
        return baseStyles;
    }
  };

  const styles = getStyles(colors);

  return (
    <ScrollView style={[styles.container, style]} horizontal={false}>
      {highlightedContent.map((line, index) => (
        <View key={`line-${index}`} style={styles.line}>
          {showLineNumbers && (
            <Text style={styles.lineNumber}>{line.number}</Text>
          )}
          <View style={styles.lineContent}>
            {line.content.map((element) => renderElement(element, index))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

// Styles
const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 24,
  },
  lineNumber: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: 'monospace',
    width: 40,
    textAlign: 'right',
    paddingRight: 8,
    paddingTop: 2,
  },
  lineContent: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
});

export default MarkdownSyntaxHighlighter;
