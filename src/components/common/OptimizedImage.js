/**
 * 优化图像组件
 * 提供图像加载优化、缓存和渐进式加载
 */
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Animated, Platform, Image } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { FileSystem, Crypto } from '../../utils/expoCompatibility';

/**
 * 优化图像组件
 * @param {string|object} source - 图像源
 * @param {string} placeholder - 占位图像
 * @param {string} fallback - 加载失败时显示的图像
 * @param {object} style - 自定义样式
 * @param {string} resizeMode - 调整模式：contain, cover, stretch, center
 * @param {boolean} progressive - 是否使用渐进式加载
 * @param {boolean} cacheEnabled - 是否启用缓存
 * @param {number} priority - 加载优先级：low, normal, high
 * @param {function} onLoad - 加载完成回调
 * @param {function} onError - 加载失败回调
 */
const OptimizedImage = ({
  source,
  placeholder,
  fallback,
  style,
  resizeMode = 'cover',
  progressive = true,
  cacheEnabled = true,
  priority = 'normal',
  onLoad,
  onError,
  ...props
}) => {
  const { theme } = useTheme();
  const { colors } = theme;

  const [imageOpacity] = useState(new Animated.Value(0));
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [cachedSource, setCachedSource] = useState(null);

  // 处理图像源
  useEffect(() => {
    if (!source) {
      setIsError(true);
      setIsLoading(false);
      return;
    }

    // 如果是网络图像且启用了缓存，尝试从缓存加载
    if (cacheEnabled && typeof source === 'object' && source.uri && source.uri.startsWith('http')) {
      cacheImage(source.uri)
        .then(cachedUri => {
          if (cachedUri) {
            setCachedSource({ uri: cachedUri });
          } else {
            setCachedSource(source);
          }
        })
        .catch(() => {
          setCachedSource(source);
        });
    } else {
      setCachedSource(source);
    }
  }, [source, cacheEnabled]);

  // 缓存图像
  const cacheImage = async (uri) => {
    try {
      // 生成缓存文件名
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        uri
      );
      const ext = uri.split('.').pop() || 'jpg';
      const cacheDir = `${FileSystem.cacheDirectory}images/`;
      const cacheFilePath = `${cacheDir}${hash}.${ext}`;

      // 检查缓存目录是否存在
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      }

      // 检查缓存文件是否存在
      const fileInfo = await FileSystem.getInfoAsync(cacheFilePath);
      if (fileInfo.exists) {
        return cacheFilePath;
      }

      // 下载图像到缓存
      await FileSystem.downloadAsync(uri, cacheFilePath);
      return cacheFilePath;
    } catch (error) {
      console.error('缓存图像失败:', error);
      return null;
    }
  };

  // 处理图像加载完成
  const handleLoad = () => {
    setIsLoading(false);

    if (progressive) {
      Animated.timing(imageOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }

    onLoad && onLoad();
  };

  // 处理图像加载失败
  const handleError = (error) => {
    setIsLoading(false);
    setIsError(true);
    onError && onError(error);
  };

  // 渲染占位图
  const renderPlaceholder = () => {
    if (!placeholder) {
      return (
        <View
          style={[
            styles.placeholder,
            { backgroundColor: colors.surfaceVariant || colors.card },
          ]}
        />
      );
    }

    return (
      <Image
        source={placeholder}
        style={[styles.image, styles.placeholder]}
        resizeMode="cover"
      />
    );
  };

  // 渲染图像
  return (
    <View style={[styles.container, style]}>
      {/* 占位图 */}
      {isLoading && renderPlaceholder()}

      {/* 主图像 */}
      {cachedSource && !isError && (
        <Animated.View
          style={[
            styles.imageContainer,
            progressive ? { opacity: imageOpacity } : null,
          ]}
        >
          <Image
            source={cachedSource}
            style={styles.image}
            resizeMode={resizeMode}
            onLoad={handleLoad}
            onError={handleError}
            {...props}
          />
        </Animated.View>
      )}

      {/* 加载失败图像 */}
      {isError && fallback && (
        <Image
          source={fallback}
          style={styles.image}
          resizeMode="cover"
        />
      )}
    </View>
  );
};

// 创建样式
const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  imageContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default OptimizedImage;
