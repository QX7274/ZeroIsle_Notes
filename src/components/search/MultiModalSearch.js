import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  Image,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SPACING } from '../../utils/constants/dimensions';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import { searchApi } from '../../services';

const MultiModalSearch = ({ onSearch, onCancel, initialQuery = '' }) => {
  const { theme } = useTheme();
  const [searchMode, setSearchMode] = useState('text');
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const searchInputRef = useRef(null);
  const audioRecorderPlayer = useRef(new AudioRecorderPlayer());
  const recordingTimerRef = useRef(null);
  const recordingPathRef = useRef('');

  // 权限检查
  const checkAudioPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: '麦克风权限申请',
            message: '需要访问您的麦克风以进行语音搜索',
            buttonNeutral: '稍后询问',
            buttonNegative: '取消',
            buttonPositive: '确定',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.error(err);
        return false;
      }
    }
    return true;
  };

  // 初始化聚焦
  useEffect(() => {
    if (searchMode === 'text' && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchMode]);

  // 清理资源
  useEffect(() => {
    return () => {
      recordingTimerRef.current && clearInterval(recordingTimerRef.current);
      audioRecorderPlayer.current.stopRecorder();
    };
  }, []);

  // 开始录音
  const startRecording = async () => {
    try {
      const hasPermission = await checkAudioPermission();
      if (!hasPermission) throw new Error('麦克风权限被拒绝');

      const path = Platform.select({
        ios: `${RNFS.LibraryDirectoryPath}/recording.m4a`,
        android: `${RNFS.ExternalDirectoryPath}/recording_${Date.now()}.mp3`,
      });

      await audioRecorderPlayer.current.startRecorder(path);
      audioRecorderPlayer.current.addRecordBackListener(() => {});

      recordingPathRef.current = path;
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError('无法开始录音: ' + err.message);
    }
  };

  // 停止录音
  const stopRecording = async () => {
    try {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      await audioRecorderPlayer.current.stopRecorder();
      audioRecorderPlayer.current.removeRecordBackListener();
      
      setIsRecording(false);

      if (recordingDuration < 1) {
        recordingPathRef.current = '';
        setError('录音时间太短');
        return;
      }

      handleSearch();
    } catch (err) {
      setError('录音失败: ' + err.message);
    }
  };

  // 处理搜索
  const handleSearch = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);

    try {
      let result;
      
      switch (searchMode) {
        case 'text':
          if (!searchQuery.trim()) throw new Error('请输入搜索内容');
          result = await searchApi.textSearch(searchQuery.trim());
          break;
          
        case 'voice':
          if (!recordingPathRef.current) throw new Error('没有录音文件');
          const audioData = await RNFS.readFile(recordingPathRef.current, 'base64');
          result = await searchApi.voiceSearch(audioData);
          break;
          
        case 'image':
          if (!selectedImage) throw new Error('没有选择图片');
          const imageData = await RNFS.readFile(selectedImage.uri, 'base64');
          result = await searchApi.imageSearch(imageData);
          break;
      }

      onSearch?.(result.data);
    } catch (err) {
      setError(err.message || '搜索失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 取消操作
  const handleCancel = () => {
    isRecording && stopRecording();
    onCancel?.();
  };

  // 切换搜索模式
  const switchSearchMode = (mode) => {
    if (mode === searchMode) return;
    
    if (searchMode === 'voice' && isRecording) {
      stopRecording();
    }
    
    setSearchMode(mode);
    setError(null);
    
    if (mode === 'text') {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      Keyboard.dismiss();
    }
  };

  // 选择图片
  const selectImage = async (source) => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
    };

    try {
      const result = source === 'camera' 
        ? await launchCamera(options) 
        : await launchImageLibrary(options);

      if (result.didCancel) return;
      if (result.errorCode) throw new Error(result.errorMessage);

      if (result.assets?.[0]) {
        setSelectedImage(result.assets[0]);
        setTimeout(handleSearch, 500);
      }
    } catch (err) {
      setError('选择图片失败: ' + err.message);
    }
  };

  // 格式化录音时间
  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 渲染文本搜索
  const renderTextSearch = () => (
    <View style={styles.textSearchContainer}>
      <TextInput
        ref={searchInputRef}
        style={[styles.searchInput, { color: theme.text, borderColor: theme.border }]}
        placeholder="搜索笔记、标签、内容..."
        placeholderTextColor={theme.textSecondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSubmitEditing={handleSearch}
        returnKeyType="search"
        autoCapitalize="none"
      />
      
      <TouchableOpacity
        style={[styles.searchButton, { backgroundColor: theme.primary }]}
        onPress={handleSearch}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Icon name="search" size={24} color="#FFFFFF" />
        )}
      </TouchableOpacity>
    </View>
  );

  // 渲染语音搜索
  const renderVoiceSearch = () => (
    <View style={styles.voiceSearchContainer}>
      <View style={styles.recordingInfo}>
        {isRecording ? (
          <Text style={[styles.recordingText, { color: theme.error }]}>
            正在录音... {formatRecordingTime(recordingDuration)}
          </Text>
        ) : recordingPathRef.current ? (
          <Text style={[styles.recordingText, { color: theme.text }]}>
            录音完成 ({formatRecordingTime(recordingDuration)})
          </Text>
        ) : (
          <Text style={[styles.recordingText, { color: theme.textSecondary }]}>
            点击麦克风图标开始录音
          </Text>
        )}
      </View>
      
      <TouchableOpacity
        style={[
          styles.recordButton,
          isRecording ? { backgroundColor: theme.error } : { backgroundColor: theme.primary },
        ]}
        onPress={isRecording ? stopRecording : startRecording}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Icon name={isRecording ? 'stop' : 'mic'} size={32} color="#FFFFFF" />
        )}
      </TouchableOpacity>
    </View>
  );

  // 渲染图片搜索
  const renderImageSearch = () => (
    <View style={styles.imageSearchContainer}>
      {selectedImage ? (
        <View style={styles.selectedImageContainer}>
          <Image
            source={{ uri: selectedImage.uri }}
            style={styles.selectedImage}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={[styles.removeImageButton, { backgroundColor: theme.error }]}
            onPress={() => setSelectedImage(null)}
          >
            <Icon name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.imageSourceButtons}>
          <TouchableOpacity
            style={[styles.imageSourceButton, { backgroundColor: theme.primary }]}
            onPress={() => selectImage('camera')}
          >
            <Icon name="camera-alt" size={24} color="#FFFFFF" />
            <Text style={styles.imageSourceButtonText}>拍照</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.imageSourceButton, { backgroundColor: theme.primary }]}
            onPress={() => selectImage('gallery')}
          >
            <Icon name="photo-library" size={24} color="#FFFFFF" />
            <Text style={styles.imageSourceButtonText}>从相册选择</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={isLoading}
        >
          <Icon name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        
        <View style={styles.searchModeButtons}>
          {['text', 'voice', 'image'].map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.searchModeButton,
                searchMode === mode && [
                  styles.activeSearchModeButton,
                  { borderBottomColor: theme.primary },
                ],
              ]}
              onPress={() => switchSearchMode(mode)}
              disabled={isLoading}
            >
              <Icon
                name={
                  mode === 'text' ? 'search' :
                  mode === 'voice' ? 'mic' : 'image-search'
                }
                size={24}
                color={searchMode === mode ? theme.primary : theme.textSecondary}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.searchContainer}>
        {searchMode === 'text' && renderTextSearch()}
        {searchMode === 'voice' && renderVoiceSearch()}
        {searchMode === 'image' && renderImageSearch()}
      </View>
      
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.error + '20' }]}>
          <Icon name="error" size={20} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
        </View>
      )}
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: SPACING.SMALL,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  cancelButton: {
    padding: SPACING.SMALL,
  },
  searchModeButtons: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  searchModeButton: {
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: SPACING.SMALL,
    marginHorizontal: SPACING.SMALL,
  },
  activeSearchModeButton: {
    borderBottomWidth: 2,
  },
  searchContainer: {
    padding: SPACING.MEDIUM,
  },
  textSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: SPACING.MEDIUM,
    fontSize: 16,
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginLeft: SPACING.SMALL,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceSearchContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.MEDIUM,
  },
  recordingInfo: {
    marginBottom: SPACING.MEDIUM,
  },
  recordingText: {
    fontSize: 16,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageSearchContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.MEDIUM,
  },
  imageSourceButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  imageSourceButton: {
    paddingHorizontal: SPACING.LARGE,
    paddingVertical: SPACING.MEDIUM,
    borderRadius: 8,
    alignItems: 'center',
  },
  imageSourceButtonText: {
    color: '#FFFFFF',
    marginTop: SPACING.SMALL,
    fontSize: 14,
  },
  selectedImageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: SPACING.SMALL,
    right: SPACING.SMALL,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.MEDIUM,
    marginHorizontal: SPACING.MEDIUM,
    marginBottom: SPACING.MEDIUM,
    borderRadius: 8,
  },
  errorText: {
    marginLeft: SPACING.SMALL,
    fontSize: 14,
  },
});

export default MultiModalSearch;
