/**
 * 知识库问答（Q&A）标签页
 * @description 提供一个对话界面，用户可以向知识库提问并获得AI生成的答案。
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ToastAndroid,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { buildSimpleDocsFromNodes, searchTopSnippets } from '../../services/kbLocalIndex';
import { getSnippets, toDoc } from '../../services/kbSnippetStore';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants/dimensions';
import { EmptyState, Card } from '../../components/common';
import { askKnowledgeBase, clearConversation } from '../../redux/slices/knowledgeBaseSlice';

const QATab = ({ kbId }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const scrollViewRef = useRef();
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const { conversation, status, nodes } = useSelector((state) => state.knowledgeBase);
  const [input, setInput] = useState('');
  const [inlineHint, setInlineHint] = useState('');
  const docsRef = useRef([]);

  const notifyNonBlocking = (message) => {
    if (!message) {
      return;
    }
    setInlineHint(message);
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };

  useEffect(() => {
    // 清理之前的对话记录
    dispatch(clearConversation());
    // 返回一个清理函数，在组件卸载时再次清理
    return () => {
      dispatch(clearConversation());
    };
  }, [dispatch]);

  // 根据 nodes 与本地片段 构建本地检索文档
  useEffect(() => {
    (async () => {
      try {
        const nodeDocs = buildSimpleDocsFromNodes(nodes || []);
        const snippetList = await getSnippets(kbId);
        const snippetDocs = (snippetList || []).map(toDoc);
        docsRef.current = [...snippetDocs, ...nodeDocs];
      } catch (e) {
        docsRef.current = buildSimpleDocsFromNodes(nodes || []);
      }
    })();
  }, [nodes, kbId]);

  const handleSend = useCallback(() => {
    if (!input.trim() || status === 'loading') {return;}

    // 本地检索 TopK 片段（仅文本与最小源信息）
    const snippets = searchTopSnippets(docsRef.current || [], input.trim(), 5);
    const queryData = { query: input.trim(), snippets };

    dispatch(askKnowledgeBase({ id: kbId, queryData }));
    setInput('');
  }, [input, status, dispatch, kbId]);


  return (
    <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
    >
      {inlineHint ? <Text style={styles.hintText}>{inlineHint}</Text> : null}
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatContainer}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={() => scrollViewRef.current.scrollToEnd({ animated: true })}
      >
        {conversation.length === 0 && status !== 'loading' ? (
          <EmptyState message="向知识库提问，获取基于内容的答案" icon="psychology" />
        ) : (
          conversation.map((msg, index) => (
            <View key={`${msg.role}-${index}`} style={{ marginBottom: SPACING.small }}>
              <View style={[styles.messageBubble, styles[`${msg.role}Bubble`]]}>
                <Text style={msg.role === 'user' ? styles.userMessageText : styles.assistantMessageText}>{msg.content}</Text>
              </View>
              {msg.role !== 'user' && Array.isArray(msg.citations) && msg.citations.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                  {msg.citations.map((c, i) => (
                    <TouchableOpacity
                      key={i}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 16,
                        backgroundColor: theme.colors.card,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                        marginRight: 6,
                        marginTop: 6,
                      }}
                      onPress={() => {
                        if (c.kind === 'pdf' && c.uri) {
                          const pageMatch = c.anchor?.match(/#p(\d+)/);
                          const targetPage = pageMatch ? parseInt(pageMatch[1], 10) : undefined;
                          navigation.navigate('FileViewer', {
                            uri: c.uri,
                            name: c.title,
                            type: 'pdf',
                            kbId: kbId,
                            targetPage: targetPage,
                          });
                        } else {
                          notifyNonBlocking(`${c.title || '片段'}${c.anchor ? `  ${c.anchor}` : ''}`);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {c.kind === 'pdf' && <Icon name="picture-as-pdf" size={14} color={theme.colors.textSecondary} style={{ marginRight: 4 }} />}
                        <Text style={{ color: theme.colors.textSecondary, fontSize: FONT_SIZES.small }}>
                          {c.title || '片段'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
        {status === 'loading' && <ActivityIndicator style={styles.typingIndicator} color={theme.colors.primary} />}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="向你的知识库提问..."
          placeholderTextColor={theme.colors.textSecondary}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={status === 'loading'}>
          <Icon name="send" size={24} color={theme.colors.onPrimary} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  hintText: {
    marginHorizontal: SPACING.medium,
    marginTop: SPACING.small,
    color: theme.colors.warning || '#ff9800',
    fontSize: FONT_SIZES.small,
  },
  chatContainer: {
    flex: 1,
  },
  chatContent: {
    padding: SPACING.medium,
  },
  messageBubble: {
    padding: SPACING.medium,
    borderRadius: BORDER_RADIUS.large,
    marginBottom: SPACING.medium,
    maxWidth: '80%',
  },
  userBubble: {
    backgroundColor: theme.colors.primary,
    alignSelf: 'flex-end',
  },
  assistantBubble: {
    backgroundColor: theme.colors.card,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  userMessageText: {
    fontSize: FONT_SIZES.medium,
    color: theme.colors.onPrimary || '#FFFFFF',
    lineHeight: 22,
  },
  assistantMessageText: {
    fontSize: FONT_SIZES.medium,
    color: theme.colors.text,
    lineHeight: 22,
  },
  typingIndicator: {
    alignSelf: 'flex-start',
    marginLeft: SPACING.medium,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.small,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  textInput: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: BORDER_RADIUS.large,
    paddingHorizontal: SPACING.medium,
    paddingVertical: SPACING.small,
    fontSize: FONT_SIZES.medium,
    color: theme.colors.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sendButton: {
    marginLeft: SPACING.small,
    backgroundColor: theme.colors.primary,
    borderRadius: 50,
    padding: SPACING.small,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
});

export default QATab;
