/**
 * 朋友圈式日记时间线项目组件
 */
import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { formatRelativeTime } from '../../utils/timeFormat';

const { width } = Dimensions.get('window');

const DiaryTimelineItem = ({ activity, onPress, onImagePress }) => {
  const { colors } = useTheme();

  const getContentTypeIcon = (type) => {
    switch (type) {
      case 'diary': return 'book';
      case 'thought': return 'lightbulb';
      case 'activity': return 'event';
      default: return 'note';
    }
  };

  const getContentTypeLabel = (type) => {
    switch (type) {
      case 'diary': return '日记随笔';
      case 'thought': return '想法灵感';
      case 'activity': return '活动记录';
      default: return '记录';
    }
  };

  const getMoodEmoji = (mood) => {
    switch (mood) {
      case 'happy': return '😊';
      case 'neutral': return '😐';
      case 'sad': return '😢';
      case 'excited': return '🤩';
      case 'stressed': return '😰';
      default: return '';
    }
  };

  // 使用统一的时间格式化函数

  const renderImages = () => {
    if (!activity.images || activity.images.length === 0) {return null;}

    const imageCount = activity.images.length;
    const imageSize = imageCount === 1 ? (width - 64) : (width - 80) / 3;

    return (
      <View style={[
        styles.imagesContainer,
        imageCount === 1 && styles.singleImageContainer,
        imageCount === 2 && styles.doubleImageContainer,
      ]}>
        {activity.images.slice(0, 9).map((image, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.imageWrapper,
              { width: imageSize, height: imageSize },
              imageCount === 1 && styles.singleImage,
              imageCount === 2 && styles.doubleImage,
            ]}
            onPress={() => onImagePress && onImagePress(activity.images, index)}
          >
            <Image
              source={{ uri: image.thumbnail_url || image.url }}
              style={styles.image}
              resizeMode="cover"
            />
            {index === 8 && imageCount > 9 && (
              <View style={styles.moreImagesOverlay}>
                <Text style={styles.moreImagesText}>+{imageCount - 9}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderTags = () => {
    if (!activity.tags || activity.tags.length === 0) {return null;}

    return (
      <View style={styles.tagsContainer}>
        {activity.tags.slice(0, 3).map((tag, index) => (
          <View key={index} style={[styles.tag, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.tagText, { color: colors.primary }]}>#{tag}</Text>
          </View>
        ))}
        {activity.tags.length > 3 && (
          <Text style={[styles.moreTagsText, { color: colors.text + '60' }]}>
            +{activity.tags.length - 3}
          </Text>
        )}
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card }]}
      onPress={() => onPress && onPress(activity)}
      activeOpacity={0.95}
    >
      {/* 头部信息 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.typeIcon, { backgroundColor: colors.primary + '15' }]}>
            <Icon
              name={getContentTypeIcon(activity.content_type)}
              size={16}
              color={colors.primary}
            />
          </View>
          <View style={styles.headerInfo}>
            <Text variant="body" style={styles.title}>
              {activity.title || getContentTypeLabel(activity.content_type)}
            </Text>
            <View style={styles.metaInfo}>
              <Text variant="caption" style={[styles.timeText, { color: colors.text + '60' }]}>
                {formatRelativeTime(activity.start_time || activity.created_at)}
              </Text>
              {activity.location_name && (
                <>
                  <Text style={[styles.separator, { color: colors.text + '40' }]}>·</Text>
                  <Icon name="place" size={12} color={colors.text + '60'} />
                  <Text variant="caption" style={[styles.locationText, { color: colors.text + '60' }]}>
                    {activity.location_name}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>

        {activity.category && (
          <View style={[styles.categoryBadge, { backgroundColor: activity.category.color + '20' }]}>
            <Icon name={activity.category.icon} size={12} color={activity.category.color} />
            <Text style={[styles.categoryText, { color: activity.category.color }]}>
              {activity.category.name}
            </Text>
          </View>
        )}
      </View>

      {/* 内容文本 */}
      {activity.content && (
        <Text variant="body" style={[styles.content, { color: colors.text }]} numberOfLines={6}>
          {activity.content}
        </Text>
      )}

      {/* 图片网格 */}
      {renderImages()}

      {/* 底部信息 */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {activity.mood && (
            <View style={styles.moodContainer}>
              <Text style={styles.moodEmoji}>{getMoodEmoji(activity.mood)}</Text>
            </View>
          )}

          {activity.satisfaction && (
            <View style={styles.ratingContainer}>
              <Icon name="star" size={14} color={colors.warning} />
              <Text variant="caption" style={[styles.ratingText, { color: colors.text + '80' }]}>
                {activity.satisfaction}/5
              </Text>
            </View>
          )}
        </View>

        {renderTags()}
      </View>

      {/* 公开标识 */}
      {activity.is_public && (
        <View style={styles.publicBadge}>
          <Icon name="public" size={12} color={colors.success} />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontWeight: '600',
    marginBottom: 4,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
  },
  separator: {
    marginHorizontal: 6,
    fontSize: 12,
  },
  locationText: {
    fontSize: 12,
    marginLeft: 2,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 11,
    marginLeft: 4,
    fontWeight: '500',
  },
  content: {
    lineHeight: 20,
    marginBottom: 12,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 12,
  },
  singleImageContainer: {
    justifyContent: 'center',
  },
  doubleImageContainer: {
    justifyContent: 'space-between',
  },
  imageWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  singleImage: {
    height: 200,
  },
  doubleImage: {
    height: 120,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  moreImagesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodContainer: {
    marginRight: 12,
  },
  moodEmoji: {
    fontSize: 18,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  ratingText: {
    fontSize: 12,
    marginLeft: 2,
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 2,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  moreTagsText: {
    fontSize: 11,
  },
  publicBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default DiaryTimelineItem;
