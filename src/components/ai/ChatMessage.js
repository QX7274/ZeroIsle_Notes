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
          {
            backgroundColor: colors.primary,
            borderWidth: 0,
          }
        ] : [
          styles.assistantMessage,
          {
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: `${colors.border}80`,
          }
        ],
      ]}>
        {renderContent()}

        {message.isStreaming && (
          <View style={styles.streamingIndicator}>
            <View style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.primary,
              marginRight: 6,
              opacity: 0.7,
            }} />
            <Text
              variant="body"
              size="small"
              color="hint"
              style={{ fontStyle: 'italic' }}
            >
              正在输入...
            </Text>
          </View>
        )}
      </View>

      {!isUser && !message.isStreaming && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: `${colors.primary}10` }
            ]}
            onPress={handleCopy}
            activeOpacity={0.7}
          >
            <Icon name="content-copy" size={16} color={colors.primary} />
          </TouchableOpacity>

          {message.isError && onRetry && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: `${colors.error}10` }
              ]}
              onPress={handleRetry}
              activeOpacity={0.7}
            >
              <Icon name="refresh" size={16} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    maxWidth: '88%',
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  assistantContainer: {
    alignSelf: 'flex-start',
  },
  messageContainer: {
    borderRadius: 20,
    padding: 14,
    minWidth: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  userMessage: {
    borderTopRightRadius: 4,
  },
  assistantMessage: {
    borderTopLeftRadius: 4,
  },
  messageText: {
    lineHeight: 22,
    fontSize: 15,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  errorText: {
    marginLeft: 10,
    lineHeight: 20,
  },
  streamingIndicator: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 6,
    marginLeft: 10,
  },
  actionButton: {
    padding: 6,
    marginRight: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChatMessage;
