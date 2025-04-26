/**
 * 聊天输入组件
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';

/**
 * 聊天输入组件
 * @param {Function} onSend - 发送回调
 * @param {boolean} isLoading - 是否正在加载
 * @param {boolean} voiceEnabled - 是否启用语音
 * @param {Function} onStartVoice - 开始语音输入回调
 * @param {Function} onStopVoice - 停止语音输入回调
 * @param {boolean} isRecording - 是否正在录音
 * @param {Function} onCancel - 取消回调
 */
const ChatInput = ({
  onSend,
  isLoading = false,
  voiceEnabled = true,
  onStartVoice,
  onStopVoice,
  isRecording = false,
  onCancel,
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  
  // 本地状态
  const [message, setMessage] = useState('');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  
  // 输入框引用
  const inputRef = useRef(null);
  
  // 监听键盘显示/隐藏
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);
  
  // 发送消息
  const handleSend = () => {
    if (message.trim() === '') return;
    
    onSend && onSend(message.trim());
    setMessage('');
  };
  
  // 处理语音按钮
  const handleVoiceButton = () => {
    if (isRecording) {
      onStopVoice && onStopVoice();
    } else {
      onStartVoice && onStartVoice();
    }
  };
  
  // 处理取消
  const handleCancel = () => {
    onCancel && onCancel();
  };
  
  // 渲染发送按钮
  const renderSendButton = () => {
    if (isLoading) {
      return (
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: colors.error }
          ]}
          onPress={handleCancel}
        >
          <Icon name="close" size={24} color={colors.card} />
        </TouchableOpacity>
      );
    }
    
    if (message.trim() === '') {
      if (voiceEnabled) {
        return (
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: isRecording ? colors.error : colors.primary }
            ]}
            onPress={handleVoiceButton}
          >
            <Icon
              name={isRecording ? 'mic-off' : 'mic'}
              size={24}
              color={colors.card}
            />
          </TouchableOpacity>
        );
      }
      
      return (
        <View
          style={[
            styles.sendButton,
            { backgroundColor: colors.primary + '80' }
          ]}
        >
          <Icon name="send" size={24} color={colors.card} />
        </View>
      );
    }
    
    return (
      <TouchableOpacity
        style={[
          styles.sendButton,
          { backgroundColor: colors.primary }
        ]}
        onPress={handleSend}
      >
        <Icon name="send" size={24} color={colors.card} />
      </TouchableOpacity>
    );
  };
  
  return (
    <View style={[
      styles.container,
      { backgroundColor: colors.card }
    ]}>
      <View style={[
        styles.inputContainer,
        { backgroundColor: colors.background }
      ]}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            { color: colors.text }
          ]}
          value={message}
          onChangeText={setMessage}
          placeholder="输入消息..."
          placeholderTextColor={colors.textHint}
          multiline
          maxLength={2000}
          editable={!isLoading && !isRecording}
        />
        
        {isRecording && (
          <ActivityIndicator
            style={styles.recordingIndicator}
            color={colors.error}
            size="small"
          />
        )}
      </View>
      
      {renderSendButton()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 0,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingTop: Platform.OS === 'ios' ? 0 : 8,
    paddingBottom: Platform.OS === 'ios' ? 0 : 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingIndicator: {
    marginLeft: 8,
  },
});

export default ChatInput;
