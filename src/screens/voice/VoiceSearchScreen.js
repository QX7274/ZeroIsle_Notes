import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import { useDispatch } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import NetInfo from '@react-native-community/netinfo';

// 导入API服务
import * as searchApi from '../../services/api/searchApi';
import * as voiceApi from '../../services/api/voiceApi';

// 导入组件
import { SearchResults } from '../../components/search';
import { Button, Loading, Toast } from '../../components/common';

// 导入常量和工具函数
import { colors } from '../../utils/constants/colors';
import { dimensions } from '../../utils/constants/dimensions';
import { useTheme } from '../../context/ThemeContext';

const { width, height } = Dimensions.get('window');

const VoiceSearchScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const dispatch = useDispatch();
  
  // 状态管理
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingPath, setRecordingPath] = useState(null);
  const [audioUri, setAudioUri] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [recognizedText, setRecognizedText] = useState('');
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  
  // 引用
  const audioRecorderPlayer = useRef(null);
  const durationTimerRef = useRef(null);

  // 初始化AudioRecorderPlayer
  useEffect(() => {
    try {
      if (AudioRecorderPlayer && typeof AudioRecorderPlayer === 'function') {
        audioRecorderPlayer.current = new AudioRecorderPlayer();
        console.log('VoiceSearchScreen: AudioRecorderPlayer初始化成功');
      } else {
        console.warn('VoiceSearchScreen: AudioRecorderPlayer模块不可用或不是构造函数');
      }
    } catch (error) {
      console.warn('VoiceSearchScreen: AudioRecorderPlayer初始化失败:', error);
    }
  }, []);
  
  // 清理函数
  useEffect(() => {
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
      if (audioRecorderPlayer.current) {
        try {
          audioRecorderPlayer.current.stopRecorder();
          audioRecorderPlayer.current.removeRecordBackListener();
        } catch (error) {
          console.warn('VoiceSearchScreen: 清理AudioRecorderPlayer失败:', error);
        }
      }
    };
  }, []);
  
  // 请求录音权限
  const requestAudioPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ]);
        
        if (
          grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED &&
          grants[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED &&
          grants[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED
        ) {
          return true;
        } else {
          displayToast('需要录音和存储权限');
          return false;
        }
      } catch (err) {
        console.error('请求权限错误:', err);
        return false;
      }
    } else {
      return true; // iOS会自动请求权限
    }
  };
  
  // 显示提示
  const displayToast = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };
  
  // 开始录音
  const startRecording = async () => {
    try {
      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        return;
      }
      
      const path = Platform.select({
        ios: `${RNFS.LibraryDirectoryPath}/voice_search.m4a`,
        android: `${RNFS.ExternalDirectoryPath}/voice_search_${Date.now()}.mp3`,
      });
      
      if (!audioRecorderPlayer.current) {
        displayToast('录音器未初始化');
        return;
      }

      await audioRecorderPlayer.current.startRecorder(path);
      audioRecorderPlayer.current.addRecordBackListener(() => {});
      
      setRecordingPath(path);
      setIsRecording(true);
      setRecordingDuration(0);
      setAudioUri(null);
      setSearchResults([]);
      setRecognizedText('');
      
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      displayToast('开始录音...');
    } catch (error) {
      console.error('开始录音失败:', error);
      displayToast(`录音失败: ${error.message}`);
    }
  };
  
  // 停止录音
  const stopRecording = async () => {
    try {
      clearInterval(durationTimerRef.current);
      const path = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      
      setIsRecording(false);
      setAudioUri(`file://${path}`);
      displayToast('录音已完成，准备搜索');
      
      // 自动开始搜索
      performVoiceSearch(`file://${path}`);
    } catch (error) {
      console.error('停止录音失败:', error);
      displayToast('停止录音失败');
    }
  };
  
  // 执行语音搜索
  const performVoiceSearch = async (uri) => {
    if (!uri) {
      displayToast('没有录音文件');
      return;
    }
    
    try {
      // 检查网络连接
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        displayToast('需要网络连接');
        return;
      }
      
      setIsSearching(true);
      setError(null);
      
      // 读取音频文件
      const fileContent = await RNFS.readFile(uri.replace('file://', ''), 'base64');
      
      // 调用语音搜索API
      const result = await searchApi.voiceSearch(fileContent, {
        useKnowledgeGraph: true,
      });
      
      if (result.success) {
        setSearchResults(result.data.results || []);
        setRecognizedText(result.data.recognized_text || '');
        
        if (result.data.results?.length === 0) {
          displayToast('未找到相关结果');
        }
      } else {
        throw new Error(result.message || '搜索失败');
      }
    } catch (error) {
      console.error('语音搜索错误:', error);
      setError(error.message || '搜索失败，请重试');
      displayToast(`搜索失败: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  };
  
  // 处理结果点击
  const handleResultPress = (item) => {
    // 根据结果类型导航到不同页面
    switch (item.type) {
      case 'note':
        navigation.navigate('NoteEdit', { noteId: item.id });
        break;
      case 'knowledge':
        navigation.navigate('NodeDetail', { nodeId: item.id });
        break;
      case 'tag':
        navigation.navigate('NoteList', { tag: item.title });
        break;
      default:
        navigation.navigate('NoteList');
    }
  };
  
  // 格式化录音时长
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>语音搜索</Text>
      </View>
      
      <View style={styles.contentContainer}>
        <View style={styles.recordingSection}>
          <View style={[styles.recordingVisualizer, { backgroundColor: colors.cardBackground }]}>
            {isRecording ? (
              <View style={styles.recordingIndicator}>
                <Text style={[styles.recordingDuration, { color: colors.text }]}>
                  {formatDuration(recordingDuration)}
                </Text>
                <View style={styles.waveContainer}>
                  {[...Array(5)].map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.wave,
                        {
                          height: 10 + Math.random() * 30,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>
            ) : recognizedText ? (
              <View style={styles.recognizedTextContainer}>
                <Text style={[styles.recognizedTextLabel, { color: colors.textSecondary }]}>
                  识别到的内容:
                </Text>
                <Text style={[styles.recognizedText, { color: colors.text }]}>
                  {recognizedText}
                </Text>
              </View>
            ) : (
              <Text style={[styles.recordingPlaceholder, { color: colors.textSecondary }]}>
                点击下方按钮开始语音搜索
              </Text>
            )}
          </View>
          
          <View style={styles.controlsContainer}>
            {isRecording ? (
              <TouchableOpacity
                style={[styles.recordButton, styles.stopButton]}
                onPress={stopRecording}
              >
                <Icon name="stop" size={36} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.recordButton, { backgroundColor: colors.primary }]}
                onPress={startRecording}
              >
                <Icon name="mic" size={36} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        <View style={styles.resultsContainer}>
          {isSearching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.text }]}>
                正在搜索...
              </Text>
            </View>
          ) : searchResults.length > 0 ? (
            <ScrollView style={styles.resultsScroll}>
              <Text style={[styles.resultsTitle, { color: colors.text }]}>
                搜索结果 ({searchResults.length})
              </Text>
              <SearchResults
                results={searchResults}
                onResultPress={handleResultPress}
                navigation={navigation}
              />
            </ScrollView>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Icon name="error-outline" size={48} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.text }]}>
                {error}
              </Text>
              <Button
                title="重试"
                onPress={() => audioUri && performVoiceSearch(audioUri)}
                style={{ marginTop: 16 }}
              />
            </View>
          ) : null}
        </View>
      </View>
      
      {showToast && (
        <Toast message={toastMessage} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  recordingSection: {
    marginBottom: 24,
  },
  recordingVisualizer: {
    height: 120,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    padding: 16,
  },
  recordingIndicator: {
    alignItems: 'center',
  },
  recordingDuration: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  wave: {
    width: 4,
    marginHorizontal: 2,
    borderRadius: 2,
  },
  recordingPlaceholder: {
    fontSize: 16,
    textAlign: 'center',
  },
  recognizedTextContainer: {
    width: '100%',
  },
  recognizedTextLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  recognizedText: {
    fontSize: 16,
    fontWeight: '500',
  },
  controlsContainer: {
    alignItems: 'center',
  },
  recordButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  stopButton: {
    backgroundColor: '#e74c3c',
  },
  resultsContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  resultsScroll: {
    flex: 1,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
});

export default VoiceSearchScreen;
