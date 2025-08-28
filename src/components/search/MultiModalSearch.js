/**
 * 多模态搜索组件
 * 支持文本、语音和图像搜索
 */
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
  Animated,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  search,
  setSearchMode,
  selectSearchMode,
  selectIsLoading,
  selectError,
  addToSearchHistory,
} from '../../redux/slices/searchSlice';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import SearchSuggestions from './SearchSuggestions';
import SearchHistory from './SearchHistory';

/**
 * 多模态搜索组件
 * @param {Object} props - 组件属性
 * @param {Function} props.onSearch - 搜索回调函数
 * @param {Function} props.onCancel - 取消回调函数
 * @param {string} props.initialQuery - 初始搜索关键词
 * @param {string} props.searchScope - 搜索范围，可选值：'home', 'category', 'community'
 */
const MultiModalSearch = ({
  onSearch,
  onCancel,
  initialQuery = '',
  searchScope = 'home'
}) => {
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
  const [showHistory, setShowHistory] = useState(true);

  // 引用
  const searchInputRef = useRef(null);
  const audioRecorderPlayer = useRef(null);
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
    if (reduxSearchMode === 'text' && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [reduxSearchMode]);

  // 初始化AudioRecorderPlayer
  useEffect(() => {
    try {
      if (AudioRecorderPlayer && typeof AudioRecorderPlayer === 'function') {
        audioRecorderPlayer.current = new AudioRecorderPlayer();
      }
    } catch (error) {
      console.warn('AudioRecorderPlayer初始化失败:', error);
    }
  }, []);

  // 清理资源
  useEffect(() => {
    return () => {
      recordingTimerRef.current && clearInterval(recordingTimerRef.current);
      if (audioRecorderPlayer.current) {
        try {
          audioRecorderPlayer.current.stopRecorder();
        } catch (error) {
          console.warn('停止录音失败:', error);
        }
      }
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

      if (!audioRecorderPlayer.current) {
        Alert.alert('错误', '录音器未初始化');
        return;
      }

      await audioRecorderPlayer.current.startRecorder(path);
      audioRecorderPlayer.current.addRecordBackListener(() => {});

      recordingPathRef.current = path;
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setLocalError('无法开始录音: ' + err.message);
    }
  };

  // 停止录音
  const stopRecording = async () => {
    try {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      if (audioRecorderPlayer.current) {
        await audioRecorderPlayer.current.stopRecorder();
        audioRecorderPlayer.current.removeRecordBackListener();
      }

      setIsRecording(false);

      if (recordingDuration < 1) {
        recordingPathRef.current = '';
        setLocalError('录音时间太短');
        return;
      }

      handleSearch();
    } catch (err) {
      setLocalError('录音失败: ' + err.message);
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
        scope: searchScope,
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
        // 检查是否是离线搜索结果
        const isOfflineSearch = resultAction.payload?.isOfflineSearch || false;

        // 将搜索结果和离线状态传递给回调函数
        onSearch?.(resultAction.payload?.results || resultAction.payload, searchQuery, {
          isOfflineSearch,
          searchMode: reduxSearchMode,
          searchScope: searchScope
        });

        // 保存搜索历史
        dispatch(addToSearchHistory({
          query: searchQuery,
          mode: reduxSearchMode,
          scope: searchScope
        }));
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

  // 处理历史记录点击
  const handleHistoryItemPress = (query, mode) => {
    setSearchQuery(query);
    dispatch(setSearchMode(mode || 'text'));
    setShowHistory(false);
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

  // 检查相机权限
  const checkCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: '相机权限申请',
            message: '需要访问您的相机以拍照',
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
      // 如果是相机，先检查权限
      if (source === 'camera') {
        const hasPermission = await checkCameraPermission();
        if (!hasPermission) {
          setLocalError('相机权限被拒绝，请在设置中开启权限');
          return;
        }
      }

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
      console.error('图片选择错误:', err);
      setLocalError('选择图片失败: ' + (err.message || '未知错误'));
    }
  };

  // 格式化录音时间
  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 根据搜索范围获取占位文本
  const getPlaceholderText = () => {
    switch (searchScope) {
      case 'home':
        return '搜索笔记、标签、内容...';
      case 'category':
        return '搜索分类、标签、内容...';
      case 'community':
        return '搜索帖子、用户、标签...';
      case 'mind_map':
        return '搜索思维导图...';
      case 'knowledge_graph':
        return '搜索知识节点...';
      default:
        return '搜索...';
    }
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
        placeholder={getPlaceholderText()}
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
            点击开始录音
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
            style={[styles.imageSourceButton]}
            onPress={() => selectImage('camera')}
          >
            <Icon name="camera-alt" size={28} color="#2196F3" />
            <Text
              variant="body"
              size="medium"
              color="primary"
              center
              style={styles.imageSourceButtonText}
            >
              拍照
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.imageSourceButton]}
            onPress={() => selectImage('gallery')}
          >
            <Icon name="photo-library" size={28} color="#2196F3" />
            <Text
              variant="body"
              size="medium"
              color="primary"
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
                {
                  backgroundColor: reduxSearchMode === mode ? `${colors.primary}20` : '#ffffff',
                  borderColor: colors.primary
                },
                reduxSearchMode === mode && [
                  styles.activeSearchModeButton,
                  { borderBottomColor: colors.primary },
                ],
              ]}
              onPress={() => switchSearchMode(mode)}
              disabled={isLoading}
            >
              <View style={{ marginBottom: 2 }}>
                <Icon
                  name={
                    mode === 'text' ? 'search' :
                    mode === 'voice' ? 'mic' : 'image-search'
                  }
                  size={22}
                  color={reduxSearchMode === mode ? colors.primary : colors.text}
                />
              </View>
              <Text
                variant="body"
                size="medium" // 改为中等大小
                color={reduxSearchMode === mode ? "primary" : "text"}
                style={{
                  textAlign: 'center',
                  marginTop: -20, // 确保文字在正中
                  width: '100%', // 确保文字占满整个宽度
                  paddingBottom: 0, // 移除底部边距
                  fontWeight: '500' // 增加字体粗细
                }}
              >
                {mode === 'text' ? '文本' : mode === 'voice' ? '语音' : '图像'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.searchContainer}>
        {reduxSearchMode === 'text' && renderTextSearch()}
        {reduxSearchMode === 'voice' && renderVoiceSearch()}
        {reduxSearchMode === 'image' && renderImageSearch()}

        {/* 搜索历史 */}
        {reduxSearchMode === 'text' && !searchQuery && showHistory && (
          <View style={styles.historyContainer}>
            <SearchHistory
              onHistoryItemPress={handleHistoryItemPress}
              visible={true}
              searchScope={searchScope}
            />
          </View>
        )}
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
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2196F3',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    backgroundColor: '#ffffff',
    minHeight: 60, // 减小高度
  },
  cancelButton: {
    padding: 10,
    borderRadius: 20,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  searchModeButtons: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchModeButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    alignItems: 'center',
    justifyContent: 'center', // 居中对齐
    minWidth: 60,
    borderWidth: 1,
    borderColor: '#2196F3',
    height: 45, // 增加高度
  },
  activeSearchModeButton: {
    borderBottomWidth: 3,
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  searchContainer: {
    padding: 24,
  },
  textSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 22,
    fontSize: 16,
    fontWeight: '400',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  searchButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginLeft: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  voiceSearchContainer: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  recordingInfo: {
    marginBottom: 20,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    width: '100%',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  recordingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  recordButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  imageSearchContainer: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  imageSourceButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  imageSourceButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'space-evenly', // 均匀分布子元素
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#2196F3',
    width: '45%',
    backgroundColor: '#ffffff',
    height: 90, // 减小高度
  },
  imageSourceButtonText: {
    color: '#2196F3',
    marginTop: 5, // 减小顶部边距
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%', // 确保文字占满整个宽度
  },
  selectedImageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 18,
    backgroundColor: 'rgba(255,59,48,0.06)',
    elevation: 3,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.12)',
  },
  errorText: {
    marginLeft: 14,
    fontSize: 15,
    fontWeight: '500',
    color: '#FF3B30',
  },
  historyContainer: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#2196F3',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    maxHeight: 300,
  },
});

export default MultiModalSearch;
