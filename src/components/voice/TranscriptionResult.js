import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import SpeakerLabel from './SpeakerLabel';

/**
 * 转写结果组件
 * 显示语音转写结果，支持说话人分离
 * 优化版本：更现代的UI和交互体验
 */
const TranscriptionResult = ({
  transcription,
  isLoading = false,
  showSpeakers = true,
  onProcessDiarization,
  isDiarizationProcessing = false,
  onUpdateSpeaker = null,
  style = {},
  onSegmentPress = null, // 点击片段回调
  highlightCurrentSegment = false, // 是否高亮当前播放的片段
  currentSegmentId = null // 当前播放的片段ID
}) => {
  const { colors } = useTheme();
  const [speakers, setSpeakers] = useState([]);
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [filteredSegments, setFilteredSegments] = useState([]);
  const [expandedSegment, setExpandedSegment] = useState(null);
  const scrollViewRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // 动画效果
  useEffect(() => {
    if (transcription) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start();
    }
  }, [transcription]);

  // 处理转写数据变化
  useEffect(() => {
    if (!transcription) return;

    // 提取所有说话人
    const uniqueSpeakers = new Set();
    transcription.segments?.forEach(segment => {
      if (segment.speaker !== undefined) {
        uniqueSpeakers.add(segment.speaker);
      }
    });

    // 转换为数组
    const speakersArray = Array.from(uniqueSpeakers).map(id => ({
      id,
      name: transcription.segments?.find(s => s.speaker === id)?.speaker_name || `说话人 ${id + 1}`
    }));

    setSpeakers(speakersArray);
    setFilteredSegments(transcription.segments || []);
  }, [transcription]);

  // 处理说话人筛选
  useEffect(() => {
    if (!transcription) return;

    if (activeSpeaker !== null) {
      // 筛选特定说话人的片段
      setFilteredSegments(
        transcription.segments?.filter(segment =>
          segment.speaker === activeSpeaker
        ) || []
      );
    } else {
      // 显示所有片段
      setFilteredSegments(transcription.segments || []);
    }
  }, [activeSpeaker, transcription]);

  // 当当前片段ID变化时，自动滚动到该片段
  useEffect(() => {
    if (highlightCurrentSegment && currentSegmentId !== null && scrollViewRef.current) {
      // 找到当前片段的索引
      const segmentIndex = filteredSegments.findIndex(s => s.id === currentSegmentId);
      if (segmentIndex !== -1) {
        // 计算滚动位置（每个片段约100高度）
        scrollViewRef.current.scrollTo({ y: segmentIndex * 100, animated: true });
      }
    }
  }, [currentSegmentId, highlightCurrentSegment, filteredSegments]);

  // 切换说话人筛选
  const toggleSpeakerFilter = (speakerId) => {
    if (activeSpeaker === speakerId) {
      setActiveSpeaker(null);
    } else {
      setActiveSpeaker(speakerId);
    }
  };

  // 处理说话人重命名
  const handleRenameSpeaker = (speakerId, newName) => {
    // 更新本地状态
    const updatedSpeakers = speakers.map(speaker => {
      if (speaker.id === speakerId) {
        return { ...speaker, name: newName };
      }
      return speaker;
    });
    setSpeakers(updatedSpeakers);

    // 更新转写数据中的说话人名称
    if (transcription && transcription.segments) {
      const updatedSegments = transcription.segments.map(segment => {
        if (segment.speaker === speakerId) {
          return { ...segment, speaker_name: newName };
        }
        return segment;
      });

      // 如果有回调函数，通知父组件
      if (onUpdateSpeaker) {
        onUpdateSpeaker(speakerId, newName, updatedSegments);
      }
    }
  };

  // 切换片段展开/折叠状态
  const toggleSegmentExpand = (segmentId) => {
    if (expandedSegment === segmentId) {
      setExpandedSegment(null);
    } else {
      setExpandedSegment(segmentId);
    }
  };

  // 格式化时间
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 获取说话人颜色
  const getSpeakerColor = (speakerId) => {
    if (speakerId === undefined) return colors.text;

    // 为每个说话人分配不同的颜色
    const speakerColors = [
      colors.primary,
      colors.notification || '#ff9500',
      colors.error || '#ff3b30',
      '#34c759', // 绿色
      '#5856d6', // 紫色
      '#007aff', // 蓝色
    ];

    return speakerColors[speakerId % speakerColors.length];
  };

  // 如果没有转写数据
  if (!transcription && !isLoading) {
    return (
      <View style={[styles.container, styles.emptyContainer, { backgroundColor: colors.card }, style]}>
        <Icon name="text-to-speech" size={60} color={colors.primary} style={styles.emptyIcon} />
        <Text style={[styles.emptyText, { color: colors.text }]}>
          暂无转写内容
        </Text>
        <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
          录制或上传音频后开始转写
        </Text>
      </View>
    );
  }

  // 如果正在加载
  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.card }, style]}>
        <View style={styles.loadingIconContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <Text style={[styles.loadingText, { color: colors.text }]}>
          正在转写...
        </Text>
        <Text style={[styles.loadingSubText, { color: colors.textSecondary }]}>
          转写速度取决于音频长度和网络状况
        </Text>
      </View>
    );
  }

  // 是否有说话人分离数据
  const hasSpeakerDiarization = transcription?.is_speaker_diarization &&
                               transcription.segments?.some(s => s.speaker !== undefined);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          opacity: fadeAnim,
          transform: [{
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0]
            })
          }]
        },
        style
      ]}
    >
      {/* 说话人筛选区域 */}
      {showSpeakers && (
        <View style={[styles.speakersContainer, { borderBottomColor: colors.border }]}>
          {hasSpeakerDiarization ? (
            <>
              <View style={styles.speakersHeader}>
                <Text style={[styles.speakersTitle, { color: colors.text }]}>
                  说话人
                </Text>
                <Text style={[styles.speakersCount, { color: colors.textSecondary }]}>
                  共 {speakers.length} 人
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.speakersList}
              >
                {speakers.map(speaker => (
                  <TouchableOpacity
                    key={`speaker-${speaker.id}`}
                    onPress={() => toggleSpeakerFilter(speaker.id)}
                    activeOpacity={0.7}
                  >
                    <SpeakerLabel
                      speakerId={speaker.id}
                      speakerName={speaker.name}
                      isActive={activeSpeaker === speaker.id}
                      editable={true}
                      onRename={handleRenameSpeaker}
                      similarity={speaker.similarity}
                      color={getSpeakerColor(speaker.id)}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : (
            <View style={styles.diarizationButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.diarizationButton,
                  { backgroundColor: colors.primary }
                ]}
                onPress={onProcessDiarization}
                disabled={isDiarizationProcessing}
              >
                {isDiarizationProcessing ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.diarizationButtonText}>
                      处理中...
                    </Text>
                  </>
                ) : (
                  <>
                    <Icon name="account-voice" size={18} color="#fff" style={styles.diarizationIcon} />
                    <Text style={styles.diarizationButtonText}>
                      识别说话人
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={[styles.diarizationHint, { color: colors.textSecondary }]}>
                识别不同说话人并区分对话内容
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 转写内容 */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.contentContainer}
        contentContainerStyle={styles.contentInner}
      >
        {filteredSegments.map((segment, index) => {
          const isExpanded = expandedSegment === segment.id;
          const isCurrentSegment = currentSegmentId === segment.id;
          const speakerColor = getSpeakerColor(segment.speaker);

          return (
            <Pressable
              key={`segment-${index}`}
              style={[
                styles.segmentContainer,
                isCurrentSegment && styles.currentSegment,
                isCurrentSegment && { borderColor: speakerColor }
              ]}
              onPress={() => {
                if (onSegmentPress) {
                  onSegmentPress(segment);
                } else {
                  toggleSegmentExpand(segment.id);
                }
              }}
              android_ripple={{ color: colors.primary + '20' }}
            >
              <View style={styles.segmentHeader}>
                {/* 时间戳 */}
                <View style={styles.timestampContainer}>
                  <Icon name="clock-outline" size={12} color={colors.textSecondary} style={styles.timestampIcon} />
                  <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                    {formatTime(segment.start)}
                  </Text>
                </View>

                {/* 说话人标签 */}
                {hasSpeakerDiarization && segment.speaker !== undefined && (
                  <SpeakerLabel
                    speakerId={segment.speaker}
                    speakerName={segment.speaker_name}
                    size="small"
                    style={styles.segmentSpeaker}
                    color={speakerColor}
                  />
                )}
              </View>

              {/* 文本内容 */}
              <View style={[
                styles.textContainer,
                hasSpeakerDiarization && { borderLeftColor: speakerColor }
              ]}>
                <Text
                  style={[
                    styles.segmentText,
                    { color: colors.text },
                    isExpanded && styles.expandedText
                  ]}
                  numberOfLines={isExpanded ? 0 : 3}
                >
                  {segment.text}
                </Text>

                {/* 展开/折叠按钮 */}
                {segment.text.length > 100 && (
                  <TouchableOpacity
                    style={styles.expandButton}
                    onPress={() => toggleSegmentExpand(segment.id)}
                  >
                    <Text style={[styles.expandButtonText, { color: colors.primary }]}>
                      {isExpanded ? '收起' : '展开'}
                    </Text>
                    <Icon
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* 播放指示器 */}
              {isCurrentSegment && (
                <View style={[styles.playingIndicator, { backgroundColor: speakerColor }]}>
                  <Icon name="play" size={10} color="#fff" />
                </View>
              )}
            </Pressable>
          );
        })}

        {/* 底部信息 */}
        {filteredSegments.length > 0 && (
          <View style={styles.footerContainer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              共 {filteredSegments.length} 个片段
              {activeSpeaker !== null && ` (已筛选)`}
            </Text>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.7,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  loadingSubText: {
    fontSize: 14,
    textAlign: 'center',
  },
  speakersContainer: {
    padding: 12,
    borderBottomWidth: 1,
  },
  speakersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  speakersTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  speakersCount: {
    fontSize: 14,
  },
  speakersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 4,
  },
  diarizationButtonContainer: {
    alignItems: 'center',
    padding: 8,
  },
  diarizationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    minWidth: 150,
  },
  diarizationIcon: {
    marginRight: 8,
  },
  diarizationButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  diarizationHint: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  contentInner: {
    padding: 12,
  },
  segmentContainer: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    position: 'relative',
  },
  currentSegment: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestampIcon: {
    marginRight: 4,
  },
  timestamp: {
    fontSize: 12,
  },
  segmentSpeaker: {
    alignSelf: 'flex-start',
  },
  textContainer: {
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
    paddingLeft: 10,
  },
  segmentText: {
    fontSize: 16,
    lineHeight: 24,
  },
  expandedText: {
    lineHeight: 26,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  expandButtonText: {
    fontSize: 13,
    marginRight: 4,
  },
  playingIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerContainer: {
    marginTop: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
  }
});

export default TranscriptionResult;
