/**
 * 共享笔记查看屏幕
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as noteShareApi from '../../services/api/noteShareApi';
import { colors } from '../../utils/constants/colors';
import { Button, Toast } from '../../components/common';
import Markdown from 'react-native-markdown-display';

const SharedNoteScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { shareId } = route.params || {};
  
  // 状态
  const [note, setNote] = useState(null);
  const [shareInfo, setShareInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // 显示Toast消息
  const showToast = (message) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };
  
  // 加载共享笔记
  const loadSharedNote = async (pwd = null) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await noteShareApi.accessSharedNote(shareId, pwd);
      setNote(response.data.note);
      setShareInfo(response.data.share);
      setEditedContent(response.data.note.content);
      setNeedsPassword(false);
    } catch (error) {
      console.error('加载共享笔记失败:', error);
      
      // 处理不同类型的错误
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 401 && data.requires_password) {
          setNeedsPassword(true);
        } else if (status === 403) {
          setError('访问被拒绝: ' + (data.message || data.error || '您没有权限访问此笔记'));
        } else if (status === 404) {
          setError('笔记不存在或链接已失效');
        } else {
          setError('加载笔记失败: ' + (data.message || data.error || '请稍后重试'));
        }
      } else {
        setError('网络错误，请检查您的网络连接');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // 提交密码
  const handleSubmitPassword = () => {
    if (!password.trim()) {
      Alert.alert('错误', '请输入访问密码');
      return;
    }
    
    loadSharedNote(password);
  };
  
  // 保存编辑内容
  const handleSaveEdit = async () => {
    if (!shareInfo.is_editable) {
      Alert.alert('错误', '此笔记不允许编辑');
      return;
    }
    
    try {
      setIsSaving(true);
      await noteShareApi.updateSharedNote(shareId, editedContent);
      setNote({ ...note, content: editedContent });
      setIsEditing(false);
      showToast('笔记已保存');
    } catch (error) {
      console.error('保存笔记失败:', error);
      Alert.alert('保存失败', error.response?.data?.error || '请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };
  
  // 初始加载
  useEffect(() => {
    if (shareId) {
      loadSharedNote();
    } else {
      setError('无效的分享链接');
      setIsLoading(false);
    }
  }, [shareId]);
  
  // 渲染密码输入界面
  const renderPasswordForm = () => (
    <View style={styles.passwordContainer}>
      <Icon name="lock" size={48} color={colors.primary} />
      <Text style={styles.passwordTitle}>此笔记需要密码访问</Text>
      <Text style={styles.passwordSubtitle}>请输入分享者提供的密码</Text>
      
      <TextInput
        style={styles.passwordInput}
        value={password}
        onChangeText={setPassword}
        placeholder="输入访问密码"
        secureTextEntry
        autoCapitalize="none"
      />
      
      <Button
        title="访问笔记"
        onPress={handleSubmitPassword}
        style={styles.passwordButton}
      />
    </View>
  );
  
  // 渲染错误界面
  const renderError = () => (
    <View style={styles.errorContainer}>
      <Icon name="error-outline" size={48} color={colors.danger} />
      <Text style={styles.errorText}>{error}</Text>
      <Button
        title="返回"
        onPress={() => navigation.goBack()}
        style={styles.errorButton}
      />
    </View>
  );
  
  // 渲染笔记内容
  const renderNoteContent = () => {
    if (!note) return null;
    
    return (
      <View style={styles.noteContainer}>
        <View style={styles.noteHeader}>
          <Text style={styles.noteTitle}>{note.title}</Text>
          <Text style={styles.noteInfo}>
            由 {note.owner_username} 创建于 {new Date(note.created_at).toLocaleDateString()}
          </Text>
          
          {shareInfo && shareInfo.is_editable && (
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => setIsEditing(!isEditing)}
            >
              <Icon name={isEditing ? 'visibility' : 'edit'} size={20} color={colors.primary} />
              <Text style={styles.editButtonText}>
                {isEditing ? '预览' : '编辑'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {isEditing ? (
          <View style={styles.editorContainer}>
            <TextInput
              style={styles.editor}
              value={editedContent}
              onChangeText={setEditedContent}
              multiline
              placeholder="编辑笔记内容..."
            />
            <Button
              title={isSaving ? '保存中...' : '保存'}
              onPress={handleSaveEdit}
              disabled={isSaving}
              style={styles.saveButton}
            />
          </View>
        ) : (
          <ScrollView style={styles.noteContent}>
            <Markdown style={markdownStyles}>
              {note.content}
            </Markdown>
          </ScrollView>
        )}
      </View>
    );
  };
  
  // 主渲染
  return (
    <View style={styles.container}>
      {/* 顶部导航栏 */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>共享笔记</Text>
      </View>
      
      {/* 内容区域 */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : error ? (
        renderError()
      ) : needsPassword ? (
        renderPasswordForm()
      ) : (
        renderNoteContent()
      )}
      
      {/* Toast消息 */}
      <Toast visible={toastVisible} message={toastMessage} />
    </View>
  );
};

// Markdown样式
const markdownStyles = StyleSheet.create({
  body: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  heading1: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginVertical: 10,
  },
  heading2: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginVertical: 8,
  },
  heading3: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginVertical: 6,
  },
  heading4: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginVertical: 4,
  },
  heading5: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginVertical: 2,
  },
  heading6: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginVertical: 2,
  },
  hr: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: 10,
  },
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    paddingLeft: 10,
    opacity: 0.8,
  },
  code_block: {
    backgroundColor: colors.backgroundDark,
    padding: 10,
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  code_inline: {
    backgroundColor: colors.backgroundDark,
    fontFamily: 'monospace',
    padding: 2,
    borderRadius: 2,
  },
  list_item: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  bullet_list: {
    marginLeft: 10,
  },
  ordered_list: {
    marginLeft: 10,
  },
});

// 组件样式
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginLeft: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: colors.textLight,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.danger,
    textAlign: 'center',
    marginVertical: 20,
  },
  errorButton: {
    marginTop: 20,
  },
  passwordContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  passwordTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 20,
    marginBottom: 5,
  },
  passwordSubtitle: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 20,
    textAlign: 'center',
  },
  passwordInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  passwordButton: {
    width: '100%',
  },
  noteContainer: {
    flex: 1,
    padding: 15,
  },
  noteHeader: {
    marginBottom: 15,
  },
  noteTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 5,
  },
  noteInfo: {
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 10,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    padding: 5,
    borderRadius: 4,
    backgroundColor: colors.primaryLight,
  },
  editButtonText: {
    fontSize: 14,
    color: colors.primary,
    marginLeft: 5,
  },
  noteContent: {
    flex: 1,
  },
  editorContainer: {
    flex: 1,
  },
  editor: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  saveButton: {
    marginBottom: 20,
  },
});

export default SharedNoteScreen;