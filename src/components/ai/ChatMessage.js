/**
 * 聊天消息组件
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Clipboard,
  ToastAndroid,
  Platform,
  Alert,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Markdown from 'react-native-markdown-display';

/**
 * 聊天消息组件
 * @param {Object} message - 消息对象
 * @param {string} message.id - 消息ID
 * @param {string} message.text - 消息文本
 * @param {string} message.sender - 消息发送者：user, assistant
 * @param {string} message.timestamp - 消息时间戳
 * @param {boolean} message.isStreaming - 是否正在流式响应
 * @param {boolean} message.isError - 是否为错误消息
 * @param {boolean} markdownEnabled - 是否启用Markdown渲染
 * @param {Function} onRetry - 重试回调
 */
const ChatMessage = ({
  message,
  markdownEnabled = true,
  onRetry,
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  
  // 本地状态
  const [showActions, setShowActions] = useState(false);
  
  // 是否为用户消息
  const isUser = message.sender === 'user';
  
  // 复制消息
  const handleCopy = () => {
    Clipboard.setString(message.text);
    
    if (Platform.OS === 'android') {
      ToastAndroid.show('已复制到剪贴板', ToastAndroid.SHORT);
    } else {
      Alert.alert('提示', '已复制到剪贴板');
    }
    
    setShowActions(false);
  };
  
  // 重试消息
  const handleRetry = () => {
    onRetry && onRetry(message);
    setShowActions(false);
  };
  
  // 渲染消息内容
  const renderContent = () => {
    // 如果是错误消息
    if (message.isError) {
      return (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={20} color={colors.error} />
          <Text
            variant="body"
            size="medium"
            color="error"
            style={styles.errorText}
          >
            {message.text}
          </Text>
        </View>
      );
    }
    
    // 如果启用了Markdown渲染且不是用户消息
    if (markdownEnabled && !isUser && !message.isStreaming) {
      return (
        <Markdown
          style={{
            body: {
              color: colors.text,
              fontSize: dimensions.FONT_SIZE.MEDIUM,
            },
            heading1: {
              color: colors.text,
              fontSize: dimensions.FONT_SIZE.XLARGE,
              fontWeight: 'bold',
              marginTop: dimensions.SPACING.MEDIUM,
              marginBottom: dimensions.SPACING.SMALL,
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
              fontSize: dimensions.FONT_SIZE.REGULAR,
              fontWeight: 'bold',
              marginTop: dimensions.SPACING.SMALL,
              marginBottom: dimensions.SPACING.XSMALL,
            },
            code_block: {
              backgroundColor: colors.card,
              padding: dimensions.SPACING.SMALL,
              borderRadius: dimensions.BORDER_RADIUS.SMALL,
              fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            },
            code_inline: {
              backgroundColor: colors.card,
              padding: 2,
              borderRadius: dimensions.BORDER_RADIUS.XSMALL,
              fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            },
            link: {
              color: colors.primary,
              textDecorationLine: 'underline',
            },
            blockquote: {
              backgroundColor: colors.card,
              borderLeftWidth: 4,
              borderLeftColor: colors.primary,
              paddingHorizontal: dimensions.SPACING.SMALL,
              paddingVertical: dimensions.SPACING.XSMALL,
              marginVertical: dimensions.SPACING.SMALL,
            },
            bullet_list: {
              marginVertical: dimensions.SPACING.SMALL,
            },
            ordered_list: {
              marginVertical: dimensions.SPACING.SMALL,
            },
            table: {
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: dimensions.BORDER_RADIUS.SMALL,
              marginVertical: dimensions.SPACING.SMALL,
            },
            th: {
              backgroundColor: colors.card,
              padding: dimensions.SPACING.SMALL,
              borderWidth: 1,
              borderColor: colors.border,
            },
            td: {
              padding: dimensions.SPACING.SMALL,
              borderWidth: 1,
              borderColor: colors.border,
            },
          }}
        >
          {message.text}
        </Markdown>
      );
    }
    
    // 普通文本
    return (
      <Text
        variant="body"
        size="medium"
        style={styles.messageText}
      >
        {message.text}
      </Text>
    );
  };
  
  return (
    <View style={[
      styles.container,
      isUser ? styles.userContainer : styles.assistantContainer,
    ]}>
      <View style={[
        styles.messageContainer,
        isUser ? [
          styles.userMessage,
          { backgroundColor: colors.primary }
        ] : [
          styles.assistantMessage,
          { backgroundColor: colors.card }
        ],
      ]}>
        {renderContent()}
        
        {message.isStreaming && (
          <View style={styles.streamingIndicator}>
            <Text
              variant="body"
              size="small"
              color="hint"
            >
              正在输入...
            </Text>
          </View>
        )}
      </View>
      
      {!isUser && !message.isStreaming && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCopy}
          >
            <Icon name="content-copy" size={20} color={colors.text} />
          </TouchableOpacity>
          
          {message.isError && onRetry && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleRetry}
            >
              <Icon name="refresh" size={20} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    maxWidth: '85%',
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  assistantContainer: {
    alignSelf: 'flex-start',
  },
  messageContainer: {
    borderRadius: 16,
    padding: 12,
    minWidth: 60,
  },
  userMessage: {
    borderTopRightRadius: 4,
  },
  assistantMessage: {
    borderTopLeftRadius: 4,
  },
  messageText: {
    lineHeight: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    marginLeft: 8,
  },
  streamingIndicator: {
    marginTop: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 4,
    marginLeft: 8,
  },
  actionButton: {
    padding: 4,
    marginRight: 8,
  },
});

export default ChatMessage;
