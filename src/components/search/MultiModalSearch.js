import React, { useState, useEffect, useRef } from 'react';
import {
  View,
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
import { useDispatch, useSelector } from 'react-redux';
import {
  search,
  setSearchMode,
  selectSearchMode,
  selectIsLoading,
  selectError,
} from '../../redux/slices/searchSlice';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import SearchSuggestions from './SearchSuggestions';

const MultiModalSearch = ({ onSearch, onCancel, initialQuery = '' }) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  const dispatch = useDispatch();

  // 从Redux获取状态
  const reduxSearchMode = useSelector(selectSearchMode);
  const isLoading = useSelector(selectIsLoading);
  const reduxError = useSelector(selectError);

  // 本地状态
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedImage, setSelectedImage] = useState(null);
  const [localError, setLocalError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 引用
  const searchInputRef = useRef(null);
  const audioRecorderPlayer = useRef(new AudioRecorderPlayer());
  const recordingTimerRef = useRef(null);
  const recordingPathRef = useRef('');

  // 合并错误
  const error = localError || reduxError;

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

    setLocalError(null);
    setShowSuggestions(false);

    try {
      const searchData = {
        mode: reduxSearchMode,
      };

      switch (reduxSearchMode) {
        case 'text':
          if (!searchQuery.trim()) throw new Error('请输入搜索内容');
          searchData.query = searchQuery.trim();
          break;

        case 'voice':
          if (!recordingPathRef.current) throw new Error('没有录音文件');
          const audioData = await RNFS.readFile(recordingPathRef.current, 'base64');
          searchData.audioBase64 = audioData;
          break;

        case 'image':
          if (!selectedImage) throw new Error('没有选择图片');
          const imageData = await RNFS.readFile(selectedImage.uri, 'base64');
          searchData.imageBase64 = imageData;
          break;

        default:
          throw new Error('不支持的搜索模式');
      }

      // 分发搜索Action
      const resultAction = await dispatch(search(searchData));

      if (search.fulfilled.match(resultAction)) {
        onSearch?.(resultAction.payload);
      }
    } catch (err) {
      setLocalError(err.message || '搜索失败');
    }
  };

  // 处理建议点击
  const handleSuggestionPress = (suggestion) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    setTimeout(() => handleSearch(), 100);
  };

  // 取消操作
  const handleCancel = () => {
    isRecording && stopRecording();
    onCancel?.();
  };

  // 切换搜索模式
  const switchSearchMode = (mode) => {
    if (mode === reduxSearchMode) return;

    if (reduxSearchMode === 'voice' && isRecording) {
      stopRecording();
    }

    // 更新Redux状态
    dispatch(setSearchMode(mode));

    setLocalError(null);
    setShowSuggestions(false);

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
        style={[
          styles.searchInput,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.card,
          }
        ]}
        placeholder="搜索笔记、标签、内容..."
        placeholderTextColor={colors.textSecondary}
        value={searchQuery}
        onChangeText={(text) => {
          setSearchQuery(text);
          setShowSuggestions(text.length >= 2);
        }}
        onSubmitEditing={handleSearch}
        onFocus={() => setShowSuggestions(searchQuery.length >= 2)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        returnKeyType="search"
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={[styles.searchButton, { backgroundColor: colors.primary }]}
        onPress={handleSearch}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Icon name="search" size={24} color="#FFFFFF" />
        )}
      </TouchableOpacity>

      <SearchSuggestions
        query={searchQuery}
        onSuggestionPress={handleSuggestionPress}
        visible={showSuggestions}
      />
    </View>
  );

  // 渲染语音搜索
  const renderVoiceSearch = () => (
    <View style={styles.voiceSearchContainer}>
      <View style={styles.recordingInfo}>
        {isRecording ? (
          <Text
            variant="body"
            size="medium"
            color="error"
            center
          >
            正在录音... {formatRecordingTime(recordingDuration)}
          </Text>
        ) : recordingPathRef.current ? (
          <Text
            variant="body"
            size="medium"
            color="text"
            center
          >
            录音完成 ({formatRecordingTime(recordingDuration)})
          </Text>
        ) : (
          <Text
            variant="body"
            size="medium"
            color="hint"
            center
          >
            点击麦克风图标开始录音
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.recordButton,
          isRecording ? { backgroundColor: colors.error } : { backgroundColor: colors.primary },
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

      {recordingPathRef.current && (
        <TouchableOpacity
          style={[styles.searchButton, { backgroundColor: colors.primary, marginTop: 16 }]}
          onPress={handleSearch}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Icon name="search" size={24} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      )}
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
            style={[styles.removeImageButton, { backgroundColor: colors.error }]}
            onPress={() => setSelectedImage(null)}
          >
            <Icon name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.searchButton,
              {
                backgroundColor: colors.primary,
                position: 'absolute',
                bottom: 16,
                right: 16,
              }
            ]}
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
      ) : (
        <View style={styles.imageSourceButtons}>
          <TouchableOpacity
            style={[styles.imageSourceButton, { backgroundColor: colors.primary }]}
            onPress={() => selectImage('camera')}
          >
            <Icon name="camera-alt" size={24} color="#FFFFFF" />
            <Text
              variant="body"
              size="small"
              color="card"
              center
              style={styles.imageSourceButtonText}
            >
              拍照
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.imageSourceButton, { backgroundColor: colors.primary }]}
            onPress={() => selectImage('gallery')}
          >
            <Icon name="photo-library" size={24} color="#FFFFFF" />
            <Text
              variant="body"
              size="small"
              color="card"
              center
              style={styles.imageSourceButtonText}
            >
              从相册选择
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={isLoading}
        >
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.searchModeButtons}>
          {['text', 'voice', 'image'].map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.searchModeButton,
                reduxSearchMode === mode && [
                  styles.activeSearchModeButton,
                  { borderBottomColor: colors.primary },
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
                color={reduxSearchMode === mode ? colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.searchContainer}>
        {reduxSearchMode === 'text' && renderTextSearch()}
        {reduxSearchMode === 'voice' && renderVoiceSearch()}
        {reduxSearchMode === 'image' && renderImageSearch()}
      </View>

      {error && (
        <View style={[styles.errorContainer, { backgroundColor: colors.errorLight }]}>
          <Icon name="error" size={20} color={colors.error} />
          <Text
            variant="body"
            size="small"
            color="error"
            style={styles.errorText}
          >
            {error}
          </Text>
        </View>
      )}
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cancelButton: {
    padding: 10,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  searchModeButtons: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  searchModeButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 8,
  },
  activeSearchModeButton: {
    borderBottomWidth: 3,
  },
  searchContainer: {
    padding: 20,
  },
  textSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 54,
    borderWidth: 1,
    borderRadius: 27,
    paddingHorizontal: 20,
    fontSize: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  searchButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  voiceSearchContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  recordingInfo: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    width: '100%',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  recordingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  recordButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  imageSearchContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  imageSourceButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  imageSourceButton: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    width: '45%',
  },
  imageSourceButtonText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  selectedImageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255,59,48,0.05)',
    elevation: 2,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.1)',
  },
  errorText: {
    marginLeft: 12,
    fontSize: 15,
    color: '#FF3B30',
  },
});

export default MultiModalSearch;
