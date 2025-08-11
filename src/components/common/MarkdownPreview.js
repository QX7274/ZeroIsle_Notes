/**
 * Markdown预览组件
 */
import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../../context/ThemeContext';

/**
 * Markdown预览组件
 * @param {string} content - Markdown内容
 * @param {object} style - 自定义样式
 * @param {boolean} scrollEnabled - 是否启用滚动
 * @param {function} onLinkPress - 链接点击回调
 */
const MarkdownPreview = ({
  content = '',
  style,
  scrollEnabled = true,
  onLinkPress,
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  
  // 获取Markdown样式
  const markdownStyles = {
    body: {
      color: colors.text,
      fontSize: dimensions.FONT_SIZE.MEDIUM,
      lineHeight: dimensions.LINE_HEIGHT.MEDIUM,
    },
    heading1: {
      color: colors.text,
      fontSize: dimensions.FONT_SIZE.XLARGE,
      fontWeight: 'bold',
      marginTop: dimensions.SPACING.LARGE,
      marginBottom: dimensions.SPACING.MEDIUM,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: dimensions.SPACING.SMALL,
    },
    heading2: {
      color: colors.text,
      fontSize: dimensions.FONT_SIZE.LARGE,
      fontWeight: 'bold',
      marginTop: dimensions.SPACING.MEDIUM,
      marginBottom: dimensions.SPACING.SMALL,
    },
    heading3: {
      color: colors.text,
      fontSize: dimensions.FONT_SIZE.MEDIUM,
      fontWeight: 'bold',
      marginTop: dimensions.SPACING.SMALL,
      marginBottom: dimensions.SPACING.XSMALL,
    },
    heading4: {
      color: colors.text,
      fontSize: dimensions.FONT_SIZE.MEDIUM,
      fontWeight: 'bold',
      marginTop: dimensions.SPACING.SMALL,
      marginBottom: dimensions.SPACING.XSMALL,
    },
    heading5: {
      color: colors.text,
      fontSize: dimensions.FONT_SIZE.SMALL,
      fontWeight: 'bold',
      marginTop: dimensions.SPACING.SMALL,
      marginBottom: dimensions.SPACING.XSMALL,
    },
    heading6: {
      color: colors.text,
      fontSize: dimensions.FONT_SIZE.XSMALL,
      fontWeight: 'bold',
      marginTop: dimensions.SPACING.SMALL,
      marginBottom: dimensions.SPACING.XSMALL,
    },
    hr: {
      backgroundColor: colors.border,
      height: 1,
      marginVertical: dimensions.SPACING.MEDIUM,
    },
    strong: {
      fontWeight: 'bold',
    },
    em: {
      fontStyle: 'italic',
    },
    s: {
      textDecorationLine: 'line-through',
    },
    blockquote: {
      backgroundColor: colors.card,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
      paddingHorizontal: dimensions.SPACING.MEDIUM,
      paddingVertical: dimensions.SPACING.SMALL,
      marginVertical: dimensions.SPACING.SMALL,
    },
    bullet_list: {
      marginVertical: dimensions.SPACING.SMALL,
    },
    ordered_list: {
      marginVertical: dimensions.SPACING.SMALL,
    },
    list_item: {
      flexDirection: 'row',
      marginVertical: dimensions.SPACING.XSMALL,
    },
    code_inline: {
      backgroundColor: colors.card,
      color: colors.primary,
      fontFamily: 'monospace',
      paddingHorizontal: dimensions.SPACING.XSMALL,
      borderRadius: dimensions.BORDER_RADIUS.SMALL,
    },
    code_block: {
      backgroundColor: colors.card,
      padding: dimensions.SPACING.MEDIUM,
      borderRadius: dimensions.BORDER_RADIUS.MEDIUM,
      fontFamily: 'monospace',
      marginVertical: dimensions.SPACING.MEDIUM,
    },
    fence: {
      backgroundColor: colors.card,
      padding: dimensions.SPACING.MEDIUM,
      borderRadius: dimensions.BORDER_RADIUS.MEDIUM,
      fontFamily: 'monospace',
      marginVertical: dimensions.SPACING.MEDIUM,
    },
    table: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: dimensions.BORDER_RADIUS.SMALL,
      marginVertical: dimensions.SPACING.MEDIUM,
    },
    thead: {
      backgroundColor: colors.card,
    },
    th: {
      padding: dimensions.SPACING.SMALL,
      borderWidth: 1,
      borderColor: colors.border,
    },
    td: {
      padding: dimensions.SPACING.SMALL,
      borderWidth: 1,
      borderColor: colors.border,
    },
    link: {
      color: colors.primary,
      textDecorationLine: 'underline',
    },
    image: {
      marginVertical: dimensions.SPACING.MEDIUM,
      borderRadius: dimensions.BORDER_RADIUS.MEDIUM,
    },
  };
  
  // 渲染内容
  const renderContent = () => {
    // 确保内容不为空
    if (!content) return <Text>没有内容</Text>;
    
    return (
      <Markdown
        style={markdownStyles}
        onLinkPress={(url) => {
          if (onLinkPress) {
            return onLinkPress(url);
          }
          return true; // 默认行为
        }}
      >
        {content}
      </Markdown>
    );
  };
  
  // 如果启用滚动，则使用ScrollView包装
  if (scrollEnabled) {
    return (
      <ScrollView
        style={[styles.container, style]}
        contentContainerStyle={styles.contentContainer}
      >
        {renderContent()}
      </ScrollView>
    );
  }
  
  // 否则直接渲染
  return (
    <View style={[styles.container, style]}>
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
});

export default MarkdownPreview;
