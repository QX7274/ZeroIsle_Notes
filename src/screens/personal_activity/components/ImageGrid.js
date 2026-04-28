/**
 * 朋友圈式图片网格组件
 */
import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const GRID_GAP = 4;

const normalizeUri = (img) => {
  if (!img) {return undefined;}
  if (typeof img === 'string') {return img;}
  return img.thumbnail_url || img.url || img.uri;
};

const ImageGrid = ({ images, onImagePress }) => {
  if (!images || images.length === 0) {
    return null;
  }

  const containerWidth = width - 32; // 减去父容器的 padding

  const renderImages = () => {
    const imageCount = images.length;

    // 单张图片
    if (imageCount === 1) {
      const singleImageSize = containerWidth * 0.6;
      const uri = normalizeUri(images[0]);
      return (
        <TouchableOpacity onPress={() => onImagePress(0)}>
          <Image source={{ uri }} style={[styles.image, { width: singleImageSize, height: singleImageSize }]} />
        </TouchableOpacity>
      );
    }

    // 4张图片，2x2布局
    if (imageCount === 4) {
        const imageSize = (containerWidth - GRID_GAP) / 2;
        return (
            <View style={styles.gridContainer}>
                {images.map((img, index) => {
                  const uri = normalizeUri(img);
                  return (
                    <TouchableOpacity key={index} onPress={() => onImagePress(index)}>
                        <Image source={{ uri }} style={[styles.image, { width: imageSize, height: imageSize, margin: GRID_GAP / 2 }]} />
                    </TouchableOpacity>
                  );
                })}
            </View>
        );
    }

    // 其他情况，3列布局
    const imageSize = (containerWidth - GRID_GAP * 2) / 3;
    return (
      <View style={styles.gridContainer}>
        {images.map((img, index) => {
          const uri = normalizeUri(img);
          return (
            <TouchableOpacity key={index} onPress={() => onImagePress(index)}>
              <Image source={{ uri }} style={[styles.image, { width: imageSize, height: imageSize, margin: GRID_GAP / 2 }]} />
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return <View style={styles.container}>{renderImages()}</View>;
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    margin: -GRID_GAP / 2,
  },
  image: {
    borderRadius: 8,
    backgroundColor: '#eee',
  },
});

export default ImageGrid;

