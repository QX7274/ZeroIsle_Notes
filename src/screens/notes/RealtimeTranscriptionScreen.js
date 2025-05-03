/**
 * 实时转写屏幕
 * 提供实时语音转文字功能
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch } from 'react-redux';

// 组件
import { Button, Loading, Toast } from '../../components/common';
import RealtimeTranscription from '../../components/voice/RealtimeTranscription';

// API服务
import * as voiceApi from '../../services/api/voiceApi';
import * as noteApi from '../../services/api/notesApi';

const RealtimeTranscriptionScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  
  // 状态管理
  const [transcribedText, setTranscribedText] = useState('');
  const [transcriptionId, setTranscriptionId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('zh');
  
  // 路由参数
  const { onTranscribed, noteId } = route.params || {};
  
  // 引用
  const toastTimerRef = useRef(null);
  
  // 处理转写完成
  const handleTranscriptionComplete = (result) => {
    if (result && result.text) {
      setTranscribedText(result.text);
      
      if (result.transcriptionId) {
        setTranscriptionId(result.transcriptionId);
      }
      
      displayToast('转写完成');
    }
  };
  
  // 处理错误
  const handleError = (error) => {
    displayToast(`错误: ${error.message || '转写失败'}`);
  };
  
  // 显示Toast消息
  const displayToast = (message) => {
    setToastMessage(message);
    setShowToast(true);
    
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    
    toastTimerRef.current = setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };
  
  // 清除所有内容
  const clearAll = () => {
    if (transcribedText) {
      Alert.alert(
        '清除内容',
        '确定要清除所有转写内容吗？',
        [
          { text: '取消', style: 'cancel' },
          { 
            text: '确定', 
            style: 'destructive',
            onPress: () => {
              setTranscribedText('');
              setTranscriptionId(null);
            }
          }
        ]
      );
    }
  };
  
  // 保存转写文本
  const saveTranscribedText = async () => {
    if (!transcribedText) {
      displayToast('没有可保存的转写内容');
      return;
    }
    
    try {
      setIsLoading(true);
      
      if (onTranscribed) {
        // 返回到上一个屏幕
        onTranscribed(transcribedText);
        navigation.goBack();
      } else if (noteId) {
        // 保存到指定笔记
        const result = await voiceApi.saveTranscribedTextToNote(transcribedText, noteId);
        
        if (result.success) {
          displayToast('转写内容已保存到笔记');
          navigation.goBack();
        } else {
          throw new Error(result.message || '保存失败');
        }
      } else {
        // 显示保存对话框
        setShowSaveModal(true);
      }
    } catch (error) {
      console.error('保存转写内容失败:', error);
      displayToast(`保存失败: ${error.message || '请稍后重试'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 创建新笔记
  const createNewNote = async () => {
    if (!transcribedText) {
      setShowSaveModal(false);
      return;
    }
    
    try {
      setIsLoading(true);
      
      // 创建新笔记
      const title = noteTitle.trim() || '实时转写笔记';
      
      const result = await noteApi.createNote({
        title,
        content: transcribedText,
        type: 'text'
      });
      
      if (result.success) {
        displayToast('已创建新笔记');
        setShowSaveModal(false);
        
        // 导航到笔记编辑页面
        navigation.replace('NoteEdit', {
          noteId: result.note.id,
          title: result.note.title
        });
      } else {
        throw new Error(result.message || '创建笔记失败');
      }
    } catch (error) {
      console.error('创建笔记失败:', error);
      displayToast(`创建笔记失败: ${error.message || '请稍后重试'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 生成会议纪要
  const generateMeetingSummary = async () => {
    if (!transcribedText) {
      displayToast('没有可处理的转写内容');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // 调用会议纪要API
      const result = await voiceApi.generateMeetingSummary(transcribedText);
      
      if (result.success && result.summary) {
        // 创建新笔记
        const noteResult = await noteApi.createNote({
          title: '会议纪要',
          content: result.summary,
          type: 'text'
        });
        
        if (noteResult.success) {
          displayToast('会议纪要已生成');
          
          // 导航到笔记编辑页面
          navigation.replace('NoteEdit', {
            noteId: noteResult.note.id,
            title: noteResult.note.title
          });
        } else {
          throw new Error(noteResult.message || '保存会议纪要失败');
        }
      } else {
        throw new Error(result.message || '生成会议纪要失败');
      }
    } catch (error) {
      console.error('生成会议纪要失败:', error);
      displayToast(`生成会议纪要失败: ${error.message || '请稍后重试'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 语言选项
  const languages = [
    { code: 'zh', name: '中文' },
    { code: 'en', name: '英文' },
    { code: 'ja', name: '日语' },
    { code: 'ko', name: '韩语' }
  ];
  
  // 切换语言
  const changeLanguage = (code) => {
    setSelectedLanguage(code);
  };
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 顶部导航栏 */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: colors.text }]}>实时转写</Text>
        
        <TouchableOpacity onPress={clearAll} style={styles.clearButton}>
          <Icon name="delete-outline" size={24} color={colors.danger} />
        </TouchableOpacity>
      </View>
      
      {/* 语言选择 */}
      <View style={styles.languageContainer}>
        <Text style={[styles.languageLabel, { color: colors.text }]}>语言:</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.languageOptions}
        >
          {languages.map(lang => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageOption,
                selectedLanguage === lang.code && { 
                  backgroundColor: colors.primary,
                  borderColor: colors.primary
                },
                { borderColor: colors.border }
              ]}
              onPress={() => changeLanguage(lang.code)}
            >
              <Text 
                style={[
                  styles.languageText,
                  { color: selectedLanguage === lang.code ? '#fff' : colors.text }
                ]}
              >
                {lang.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {/* 实时转写组件 */}
      <RealtimeTranscription
        onTranscriptionComplete={handleTranscriptionComplete}
        onError={handleError}
        language={selectedLanguage}
        style={styles.transcriptionContainer}
      />
      
      {/* 底部操作按钮 */}
      {transcribedText ? (
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={saveTranscribedText}
            disabled={isLoading}
          >
            <Icon name="content-save-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>保存文本</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.info }]}
            onPress={generateMeetingSummary}
            disabled={isLoading}
          >
            <Icon name="text-box-check-outline" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>生成会议纪要</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      
      {/* 加载指示器 */}
      {isLoading && <Loading />}
      
      {/* Toast消息 */}
      {showToast && (
        <Toast message={toastMessage} />
      )}
      
      {/* 保存笔记对话框 */}
      <Modal
        visible={showSaveModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              保存为笔记
            </Text>
            
            <TextInput
              style={[
                styles.titleInput,
                { 
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.background
                }
              ]}
              placeholder="输入笔记标题"
              placeholderTextColor={colors.text + '80'}
              value={noteTitle}
              onChangeText={setNoteTitle}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowSaveModal(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={createNewNote}
              >
                <Text style={styles.saveButtonText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 8,
  },
  clearButton: {
    padding: 8,
  },
  languageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  languageLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 12,
  },
  languageOptions: {
    paddingRight: 16,
  },
  languageOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  languageText: {
    fontSize: 14,
    fontWeight: '500',
  },
  transcriptionContainer: {
    flex: 1,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    flex: 1,
    marginHorizontal: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    borderRadius: 10,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  titleInput: {
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  saveButton: {
    backgroundColor: '#4285F4',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  }
});

export default RealtimeTranscriptionScreen;
