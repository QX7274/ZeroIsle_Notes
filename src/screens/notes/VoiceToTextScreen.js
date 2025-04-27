/**
 * 语音转文本屏幕（原生实现版）
 * 使用 React Native 原生方案替代 Expo 依赖
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
  Platform,
  PermissionsAndroid,
  Modal,
  NativeModules,
} from 'react-native';
import { useDispatch } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import { pick, types } from '@react-native-documents/picker';
import NetInfo from '@react-native-community/netinfo';

// 常量和工具函数
import { colors } from '../../utils/constants/colors';
import { dimensions } from '../../utils/constants/dimensions';

// API 服务
import * as voiceApi from '../../services/api/voiceApi';

// 组件
import { Button, Loading, Toast } from '../../components/common';

const { width, height } = Dimensions.get('window');
const audioRecorderPlayer = new AudioRecorderPlayer();

const VoiceToTextScreen = ({ navigation, route }) => {
  const dispatch = useDispatch();

  // 状态管理
  const [isRecording, setIsRecording] = useState(false);
  const [recordingPath, setRecordingPath] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUri, setAudioUri] = useState(null);
  const [transcribedText, setTranscribedText] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [meetingSummary, setMeetingSummary] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  // 路由参数
  const { onTranscribed, noteId } = route.params || {};

  // 引用
  const durationTimerRef = useRef(null);
  const toastTimerRef = useRef(null);

  // 权限管理
  const requestAudioPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ]);

        return (
          granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.error(err);
        return false;
      }
    }
    return true;
  };

  // Toast 消息
  const displayToast = (message) => {
    setToastMessage(message);
    setShowToast(true);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 3000);
  };

  // 录音管理
  const startRecording = async () => {
    try {
      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        displayToast('需要麦克风和存储权限');
        return;
      }

      const path = Platform.select({
        ios: `${RNFS.LibraryDirectoryPath}/recording.m4a`,
        android: `${RNFS.ExternalDirectoryPath}/recording_${Date.now()}.mp3`,
      });

      await audioRecorderPlayer.startRecorder(path);
      audioRecorderPlayer.addRecordBackListener(() => {});

      setRecordingPath(path);
      setIsRecording(true);
      setRecordingDuration(0);

      durationTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      displayToast('开始录音...');
    } catch (error) {
      console.error('开始录音失败:', error);
      displayToast(`录音失败: ${error.message}`);
    }
  };

  const stopRecording = async () => {
    try {
      clearInterval(durationTimerRef.current);
      const path = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();

      setIsRecording(false);
      setAudioUri(`file://${path}`);
      displayToast('录音已保存');
    } catch (error) {
      console.error('停止录音失败:', error);
      displayToast('保存录音失败');
    }
  };

  // 音频播放
  const playRecording = async () => {
    try {
      if (!audioUri) {
        displayToast('没有可播放的录音');
        return;
      }

      await audioRecorderPlayer.startPlayer(audioUri);
      audioRecorderPlayer.addPlayBackListener((e) => {
        if (e.current_position === e.duration) {
          audioRecorderPlayer.stopPlayer();
        }
      });
    } catch (error) {
      console.error('播放失败:', error);
      displayToast('播放录音失败');
    }
  };

  // 文件选择
  const selectAudioFile = async () => {
    try {
      const [res] = await pick({
        type: [types.audio],
      });

      setAudioUri(res.uri);
      displayToast('音频文件已选择');
    } catch (error) {
      console.error('选择文件失败:', error);
      if (error.code !== 'DOCUMENT_PICKER_CANCELED') {
        displayToast('选择文件失败');
      }
    }
  };

  // 语音转写
  const transcribeAudio = async () => {
    if (!audioUri) {
      displayToast('请先选择音频');
      return;
    }

    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        displayToast('需要网络连接');
        return;
      }

      setIsTranscribing(true);

      const fileContent = await RNFS.readFile(audioUri, 'base64');
      const result = await voiceApi.transcribeFromRecording(fileContent, noteId);

      if (result.success) {
        setTranscribedText(result.text);
        displayToast('转写成功');
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('转写失败:', error);
      displayToast(`转写失败: ${error.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // 生成会议纪要
  const generateMeetingSummary = async () => {
    if (!transcribedText) {
      displayToast('请先转写语音内容');
      return;
    }

    try {
      // 检查网络连接
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        displayToast('无网络连接，无法生成会议纪要');
        return;
      }

      setIsGeneratingSummary(true);

      // 调用会议纪要API
      const result = await voiceApi.generateMeetingSummary(transcribedText);

      if (result.success && result.summary) {
        setMeetingSummary(result.summary);
        setShowSummary(true);
        displayToast('会议纪要生成成功');
      } else {
        throw new Error(result.message || '生成会议纪要失败');
      }
    } catch (error) {
      console.error('生成会议纪要错误:', error);
      displayToast(`生成会议纪要失败: ${error.message || '请稍后重试'}`);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // 保存转写文本
  const saveTranscribedText = () => {
    if (!transcribedText) {
      displayToast('没有可保存的转写内容');
      return;
    }

    if (onTranscribed) {
      onTranscribed(transcribedText);
      navigation.goBack();
    } else if (noteId) {
      // 保存到指定笔记
      voiceApi.saveTranscribedTextToNote(transcribedText, noteId)
        .then(() => {
          displayToast('转写内容已保存到笔记');
          navigation.goBack();
        })
        .catch(error => {
          console.error('保存转写内容失败:', error);
          displayToast(`保存失败: ${error.message || '请稍后重试'}`);
        });
    } else {
      // 创建新笔记
      navigation.navigate('NoteEdit', {
        isNew: true,
        initialContent: transcribedText,
        title: '语音转写笔记',
      });
    }
  };

  // 保存会议纪要
  const saveMeetingSummary = () => {
    if (!meetingSummary) {
      displayToast('没有可保存的会议纪要');
      return;
    }

    if (onTranscribed) {
      onTranscribed(meetingSummary);
      setShowSummary(false);
      navigation.goBack();
    } else if (noteId) {
      // 保存到指定笔记
      voiceApi.saveTranscribedTextToNote(meetingSummary, noteId)
        .then(() => {
          displayToast('会议纪要已保存到笔记');
          setShowSummary(false);
          navigation.goBack();
        })
        .catch(error => {
          console.error('保存会议纪要失败:', error);
          displayToast(`保存失败: ${error.message || '请稍后重试'}`);
        });
    } else {
      // 创建新笔记
      navigation.navigate('NoteEdit', {
        isNew: true,
        initialContent: meetingSummary,
        title: '会议纪要',
      });
      setShowSummary(false);
    }
  };

  // 清除录音和转写内容
  const clearAll = () => {
    if (isRecording) {
      stopRecording();
    }

    setAudioUri(null);
    setTranscribedText('');
    setRecordingDuration(0);
    setMeetingSummary('');
    displayToast('已清除所有内容');
  };

  // 格式化时间
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 组件清理
  useEffect(() => {
    return () => {
      audioRecorderPlayer.stopPlayer();
      audioRecorderPlayer.removePlayBackListener();
      clearInterval(durationTimerRef.current);
      clearTimeout(toastTimerRef.current);
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* 顶部导航栏 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>语音转文本</Text>
        <TouchableOpacity onPress={clearAll} style={styles.clearButton}>
          <Icon name="delete-outline" size={24} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* 录音控制区域 */}
        <View style={styles.recordingSection}>
          <View style={styles.durationDisplay}>
            <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
            {isRecording && <View style={styles.recordingIndicator} />}
          </View>

          <View style={styles.controlsRow}>
            {isRecording ? (
              <TouchableOpacity onPress={stopRecording} style={[styles.controlButton, styles.stopButton]}>
                <Icon name="stop" size={36} color={colors.white} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={startRecording} style={[styles.controlButton, styles.recordButton]}>
                <Icon name="mic" size={36} color={colors.white} />
              </TouchableOpacity>
            )}

            {audioUri && !isRecording && (
              <TouchableOpacity onPress={playRecording} style={[styles.controlButton, styles.playButton]}>
                <Icon name="play-arrow" size={36} color={colors.white} />
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={selectAudioFile} style={[styles.controlButton, styles.fileButton]}>
              <Icon name="folder-open" size={28} color={colors.white} />
            </TouchableOpacity>
          </View>

          {audioUri && !isRecording && (
            <TouchableOpacity
              onPress={transcribeAudio}
              style={[styles.actionButton, styles.transcribeButton]}
              disabled={isTranscribing}
            >
              {isTranscribing ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Icon name="translate" size={20} color={colors.white} />
                  <Text style={styles.actionButtonText}>转写音频</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* 转写结果区域 */}
        {transcribedText ? (
          <View style={styles.transcriptionSection}>
            <Text style={styles.sectionTitle}>转写结果</Text>
            <View style={styles.transcriptionContainer}>
              <ScrollView style={styles.transcriptionScroll}>
                <Text style={styles.transcriptionText}>{transcribedText}</Text>
              </ScrollView>
            </View>

            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                onPress={saveTranscribedText}
                style={[styles.actionButton, styles.saveButton]}
              >
                <Icon name="save" size={20} color={colors.white} />
                <Text style={styles.actionButtonText}>保存文本</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={generateMeetingSummary}
                style={[styles.actionButton, styles.summaryButton]}
                disabled={isGeneratingSummary}
              >
                {isGeneratingSummary ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Icon name="summarize" size={20} color={colors.white} />
                    <Text style={styles.actionButtonText}>生成会议纪要</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Toast消息 */}
      {showToast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* 会议纪要弹窗 */}
      <Modal
        visible={showSummary}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSummary(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>会议纪要</Text>
              <TouchableOpacity onPress={() => setShowSummary(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.summaryScrollView}>
              <Text style={styles.summaryText}>{meetingSummary}</Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => setShowSummary(false)}
                style={[styles.modalButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={saveMeetingSummary}
                style={[styles.modalButton, styles.confirmButton]}
              >
                <Text style={styles.confirmButtonText}>保存纪要</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  clearButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  recordingSection: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  durationDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  durationText: {
    fontSize: 48,
    fontWeight: '300',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.danger,
    marginLeft: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  recordButton: {
    backgroundColor: colors.danger,
  },
  stopButton: {
    backgroundColor: colors.danger,
  },
  playButton: {
    backgroundColor: colors.primary,
  },
  fileButton: {
    backgroundColor: colors.secondary,
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 8,
  },
  actionButtonText: {
    color: colors.white,
    fontWeight: '600',
    marginLeft: 8,
  },
  transcribeButton: {
    backgroundColor: colors.primary,
    minWidth: 140,
  },
  transcriptionSection: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  transcriptionContainer: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
  },
  transcriptionScroll: {
    maxHeight: 176,
  },
  transcriptionText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  saveButton: {
    backgroundColor: colors.success,
    flex: 1,
    marginRight: 8,
  },
  summaryButton: {
    backgroundColor: colors.info,
    flex: 1,
    marginLeft: 8,
  },
  toast: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    color: colors.white,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    width: '100%',
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  summaryScrollView: {
    maxHeight: 300,
  },
  summaryText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 12,
  },
  cancelButton: {
    backgroundColor: colors.lightGray,
  },
  cancelButtonText: {
    color: colors.text,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  confirmButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
});

export default VoiceToTextScreen;