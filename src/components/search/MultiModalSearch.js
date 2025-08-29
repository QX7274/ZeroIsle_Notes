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
  ScrollView,
  PermissionsAndroid,
  Animated,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  search,
  localSearch,
  setSearchMode,
  selectSearchMode,
  selectIsLoading,
  selectError,
  addToSearchHistory,
} from '../../redux/slices/searchSlice';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import nativeAudioService from '../../services/audio/nativeAudioService';
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
  navigation,
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
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [localError, setLocalError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  // 语音录制和播放状态
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioPlayer, setAudioPlayer] = useState(null);

  // 搜索历史状态
  const [searchHistory, setSearchHistory] = useState([]);

  // 加载搜索历史
  useEffect(() => {
    const loadSearchHistory = async () => {
      try {
        // 从本地存储加载真实搜索历史
        const historyKey = 'search_history';
        const storedHistory = await AsyncStorage.getItem(historyKey);

        if (storedHistory) {
          const parsedHistory = JSON.parse(storedHistory);
          setSearchHistory(parsedHistory.slice(0, 10)); // 最多显示10条
        } else {
          setSearchHistory([]);
        }
      } catch (error) {
        console.error('加载搜索历史失败:', error);
        setSearchHistory([]);
      }
    };

    loadSearchHistory();
  }, []);

  // 保存搜索历史
  const saveSearchHistory = async (query) => {
    try {
      const historyKey = 'search_history';
      const storedHistory = await AsyncStorage.getItem(historyKey);
      let history = storedHistory ? JSON.parse(storedHistory) : [];

      // 移除重复项
      history = history.filter(item => item.query !== query);

      // 添加新的搜索记录到开头
      history.unshift({
        query,
        timestamp: Date.now()
      });

      // 限制历史记录数量
      history = history.slice(0, 20);

      await AsyncStorage.setItem(historyKey, JSON.stringify(history));
      setSearchHistory(history.slice(0, 10));
    } catch (error) {
      console.error('保存搜索历史失败:', error);
    }
  };

  // 引用
  const searchInputRef = useRef(null);

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

  // 初始化语音识别服务
  useEffect(() => {
    // 添加语音识别事件监听器
    nativeAudioService.addListener('speechResults', (e) => {
      if (e.value && e.value.length > 0) {
        const recognizedText = e.value[0];
        setRecognizedText(recognizedText);
        setSearchQuery(recognizedText); // 直接设置到搜索框
        setIsListening(false);

        // 自动执行搜索
        setTimeout(() => {
          handleSearch();
        }, 500);
      }
    });

    nativeAudioService.addListener('speechError', (e) => {
      console.error('语音识别错误:', e);
      setIsListening(false);
      setLocalError('语音识别失败，请重试');
    });

    nativeAudioService.addListener('speechEnd', () => {
      setIsListening(false);
    });

    return () => {
      nativeAudioService.destroy();
    };
  }, []);

  // 清理资源
  useEffect(() => {
    return () => {
      if (isListening) {
        nativeAudioService.stopSpeechToText().catch(console.error);
      }
    };
  }, [isListening]);

  // 开始语音识别和录制
  const startVoiceRecognition = async () => {
    try {
      setLocalError(null);
      setRecognizedText('');
      setIsListening(true);
      setIsRecording(true);
      setRecordingDuration(0);

      // 开始语音识别
      await nativeAudioService.startSpeechToText('zh-CN');

      // 启动录音计时器
      const timer = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // 保存计时器引用
      setAudioPlayer({ timer });

    } catch (error) {
      console.error('开始语音识别失败:', error);
      setIsListening(false);
      setIsRecording(false);
      setLocalError('语音识别启动失败: ' + error.message);
    }
  };

  // 停止语音识别
  const stopVoiceRecognition = async () => {
    try {
      await nativeAudioService.stopSpeechToText();
      setIsListening(false);
      setIsRecording(false);

      // 清除计时器
      if (audioPlayer?.timer) {
        clearInterval(audioPlayer.timer);
      }

    } catch (error) {
      console.error('停止语音识别失败:', error);
      setIsListening(false);
      setIsRecording(false);
    }
  };

  // 播放录音
  const playRecording = async () => {
    if (!recordingUri) return;

    try {
      setIsPlaying(true);
      // 模拟播放录音
      setTimeout(() => {
        setIsPlaying(false);
      }, recordingDuration * 1000);

    } catch (error) {
      console.error('播放录音失败:', error);
      setIsPlaying(false);
    }
  };

  // 停止播放
  const stopPlaying = () => {
    setIsPlaying(false);
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
          if (!searchQuery.trim()) throw new Error('没有识别到语音内容');
          searchData.query = searchQuery.trim();
          break;

        case 'image':
          if (!selectedImage) throw new Error('没有选择图片');
          const imageData = await RNFS.readFile(selectedImage.uri, 'base64');
          searchData.imageBase64 = imageData;
          break;

        default:
          throw new Error('不支持的搜索模式');
      }

      // 使用本地搜索
      console.log('MultiModalSearch: 执行本地搜索', searchData);
      const resultAction = await dispatch(localSearch(searchData));

      if (localSearch.fulfilled.match(resultAction)) {
        const results = resultAction.payload?.results || [];
        const hasResults = resultAction.payload?.hasResults || false;

        if (!hasResults) {
          setLocalError('未找到相关内容，请尝试其他关键词');
        }

        // 将搜索结果传递给回调函数，包含跳转功能
        onSearch?.(results, searchQuery, {
          isLocalSearch: true,
          searchMode: reduxSearchMode,
          searchScope: searchScope,
          hasResults,
          onNavigateToFile: handleNavigateToFile
        });

        // 如果有结果，导航到搜索结果页面
        if (hasResults && results.length > 0) {
          console.log('搜索成功，准备导航到结果页面，结果数量:', results.length);

          // 确保navigation对象存在
          if (navigation && navigation.navigate) {
            navigation.navigate('SearchResults', {
              results,
              query: searchQuery,
              searchMode: reduxSearchMode,
              onNavigateToFile: handleNavigateToFile
            });
          } else {
            console.error('Navigation对象不可用，无法跳转到搜索结果页面');
            // 如果navigation不可用，直接调用onSearch回调
            onSearch?.(results, searchQuery, {
              isLocalSearch: true,
              searchMode: reduxSearchMode,
              searchScope: searchScope,
              hasResults,
              onNavigateToFile: handleNavigateToFile
            });
          }
        } else {
          // 没有结果时显示提示
          setLocalError('未找到相关内容，请尝试其他关键词');
        }

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
  const handleHistoryItemPress = (historyItem) => {
    setSearchQuery(historyItem.query);
    setShowHistory(false);

    // 立即执行搜索
    setTimeout(() => {
      handleSearch();
    }, 100);
  };

  // 处理文件跳转 - 智能识别所有类型
  const handleNavigateToFile = (file) => {
    console.log('跳转到文件:', file);

    try {
      const fileId = file.id || file._id;
      const fileTitle = file.title || file.name || file.fileName || '未命名';

      // 优先根据sourceType判断
      if (file.sourceType === 'note' || file.type === 'note' || file.noteType === 'paged') {
        navigation.navigate('FluidPagedNote', {
          noteId: fileId,
          title: fileTitle
        });
      } else if (file.sourceType === 'canvas' || file.type === 'canvas' || file.noteType === 'canvas') {
        navigation.navigate('InfiniteCanvas', {
          noteId: fileId,
          title: fileTitle
        });
      } else if (file.type === 'card' || file.noteType === 'card') {
        navigation.navigate('CardNote', {
          noteId: fileId,
          title: fileTitle
        });
      } else if (file.type === 'pdf' || file.file_type === 'pdf' ||
                 (fileTitle && fileTitle.toLowerCase().includes('.pdf'))) {
        navigation.navigate('PDFViewer', {
          uri: file.path || file.uri || file.filePath,
          title: fileTitle
        });
      } else if (file.type === 'ppt' || file.file_type === 'ppt' ||
                 (fileTitle && (fileTitle.toLowerCase().includes('.ppt') ||
                                fileTitle.toLowerCase().includes('.pptx')))) {
        navigation.navigate('PPTViewer', {
          uri: file.path || file.uri || file.filePath,
          title: fileTitle
        });
      } else if (file.type === 'doc' || file.file_type === 'doc' ||
                 (fileTitle && (fileTitle.toLowerCase().includes('.doc') ||
                                fileTitle.toLowerCase().includes('.docx')))) {
        navigation.navigate('DocViewer', {
          uri: file.path || file.uri || file.filePath,
          title: fileTitle
        });
      } else if (file.type === 'md' || file.file_type === 'markdown' ||
                 (fileTitle && fileTitle.toLowerCase().includes('.md'))) {
        navigation.navigate('MarkdownViewer', {
          uri: file.path || file.uri || file.filePath,
          title: fileTitle
        });
      } else if (fileId) {
        // 有ID的默认当作笔记处理
        if (fileId.includes('canvas')) {
          navigation.navigate('InfiniteCanvas', {
            noteId: fileId,
            title: fileTitle
          });
        } else if (fileId.includes('card')) {
          navigation.navigate('CardNote', {
            noteId: fileId,
            title: fileTitle
          });
        } else {
          navigation.navigate('FluidPagedNote', {
            noteId: fileId,
            title: fileTitle
          });
        }
      } else {
        // 最后的兜底：创建新笔记
        navigation.navigate('FluidPagedNote', {
          title: fileTitle,
          createNew: true // 明确标记为新建
        });
      }

      // 关闭搜索界面
      onCancel?.();
    } catch (error) {
      console.error('文件跳转失败:', error);
      Alert.alert('跳转失败', '无法打开该文件，请稍后重试');
    }
  };

  // 取消操作
  const handleCancel = () => {
    if (isListening) {
      stopVoiceRecognition();
    }
    onCancel?.();
  };

  // 切换搜索模式
  const switchSearchMode = (mode) => {
    if (mode === reduxSearchMode) return;

    if (reduxSearchMode === 'voice' && isListening) {
      stopVoiceRecognition();
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

  // 删除不需要的录音时间格式化函数

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
        {isListening ? (
          <Text
            variant="body"
            size="medium"
            color="primary"
            center
          >
            正在识别语音...
          </Text>
        ) : recognizedText ? (
          <View style={styles.recognizedTextContainer}>
            <Text
              variant="body"
              size="medium"
              color="text"
              center
            >
              识别结果：
            </Text>
            <Text
              variant="body"
              size="large"
              color="primary"
              center
              style={styles.recognizedText}
            >
              "{recognizedText}"
            </Text>
          </View>
        ) : (
          <Text
            variant="body"
            size="medium"
            color="hint"
            center
          >
            点击开始语音识别
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.recordButton,
          isListening ? { backgroundColor: colors.error } : { backgroundColor: colors.primary },
        ]}
        onPress={isListening ? stopVoiceRecognition : startVoiceRecognition}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Icon name={isListening ? 'stop' : 'keyboard-voice'} size={32} color="#FFFFFF" />
        )}
      </TouchableOpacity>

      {/* 录音播放控件 */}
      {recordingUri && !isListening && (
        <View style={[styles.recordingControls, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[styles.playButton, { backgroundColor: colors.primary }]}
            onPress={isPlaying ? stopPlaying : playRecording}
          >
            <Icon
              name={isPlaying ? 'pause' : 'play-arrow'}
              size={20}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <View style={styles.recordingInfo}>
            <Text style={[styles.recordingDuration, { color: colors.text }]}>
              {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
            </Text>
            <Text style={[styles.recordingLabel, { color: colors.textSecondary }]}>
              录音时长
            </Text>
          </View>
        </View>
      )}

      {recognizedText && !isListening && (
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

        {/* 快速搜索历史 - 在输入框下方显示 */}
        {reduxSearchMode === 'text' && !searchQuery && searchHistory.length > 0 && (
          <View style={[styles.quickHistoryContainer, { backgroundColor: colors.surface }]}>
            <Text style={[styles.quickHistoryTitle, { color: colors.textSecondary }]}>
              最近搜索
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.quickHistoryScrollView}
            >
              {searchHistory.slice(0, 8).map((item, index) => (
                <TouchableOpacity
                  key={`quick-${item.query}-${index}`}
                  style={[styles.quickHistoryChip, {
                    backgroundColor: colors.primary + '15',
                    borderColor: colors.primary + '30'
                  }]}
                  onPress={() => handleHistoryItemPress(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.quickHistoryChipText, { color: colors.primary }]}>
                    {item.query}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 完整搜索历史面板 */}
        {reduxSearchMode === 'text' && !searchQuery && showHistory && (
          <View style={[styles.historyContainer, { elevation: 0 }]}>
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
    overflow: 'visible', // 改为visible，避免遮挡点击事件
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
    pointerEvents: 'auto', // 确保可以接收点击事件
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
  recordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    backgroundColor: '#FFFFFF', // 纯白背景，与文件背景一致
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recordingInfo: {
    flex: 1,
  },
  recordingDuration: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  recordingLabel: {
    fontSize: 12,
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
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E3F2FD',
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    maxHeight: 220,
  },
  recognizedTextContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.3)',
  },
  recognizedText: {
    marginTop: 4,
    fontWeight: '600',
  },
  quickHistoryContainer: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  quickHistoryTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  quickHistoryScrollView: {
    flexDirection: 'row',
  },
  quickHistoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
  },
  quickHistoryChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default MultiModalSearch;
