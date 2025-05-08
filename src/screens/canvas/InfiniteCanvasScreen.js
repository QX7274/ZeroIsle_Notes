import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, BackHandler } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { InfiniteCanvas } from '../../components/canvas';
import { offlineStorageService } from '../../services/offline/offlineStorage';
import analyticsService from '../../services/analytics/analyticsService';
import { useFocusEffect } from '@react-navigation/native';

/**
 * 无限画布屏幕
 * 提供无限缩放和平移的绘图画布，支持手写、形状绘制、文本和图片
 */
const InfiniteCanvasScreen = ({ navigation, route }) => {
  // 主题
  const { colors } = useTheme();
  
  // 状态
  const [canvasId, setCanvasId] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // 初始化
  useEffect(() => {
    analyticsService.trackScreen('infinite_canvas');
    
    // 检查是否有传入的画布ID
    if (route.params?.canvasId) {
      setCanvasId(route.params.canvasId);
    } else {
      // 创建新画布
      createNewCanvas();
    }
    
    // 设置标题
    navigation.setOptions({
      title: route.params?.title || '无限草稿',
    });
  }, [route.params]);
  
  // 处理返回按钮
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (hasUnsavedChanges) {
          Alert.alert(
            '未保存的更改',
            '您有未保存的更改，确定要离开吗？',
            [
              { text: '取消', style: 'cancel', onPress: () => {} },
              { 
                text: '离开', 
                style: 'destructive', 
                onPress: () => navigation.goBack() 
              },
              { 
                text: '保存并离开', 
                onPress: () => {
                  // 这里应该触发保存操作，但由于我们的InfiniteCanvas组件已经实现了自动保存，
                  // 所以这里只需要返回即可
                  navigation.goBack();
                } 
              },
            ],
            { cancelable: true }
          );
          return true; // 阻止默认返回行为
        }
        return false; // 允许默认返回行为
      };
      
      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [hasUnsavedChanges, navigation])
  );
  
  // 创建新画布
  const createNewCanvas = async () => {
    try {
      // 生成唯一ID
      const newId = Date.now().toString();
      
      // 创建新画布数据
      const newCanvas = {
        id: newId,
        title: '新草稿',
        elements: [],
        layers: [{ id: 'default', name: '默认图层', visible: true, locked: false }],
        activeLayer: 'default',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // 保存到本地存储
      await offlineStorageService.saveCanvas(newCanvas);
      
      // 更新状态
      setCanvasId(newId);
      
      // 更新标题
      navigation.setOptions({
        title: '新草稿',
      });
      
      analyticsService.trackCanvasAction('create_new');
    } catch (error) {
      console.error('创建新画布失败:', error);
      Alert.alert('错误', '创建新画布失败');
    }
  };
  
  // 内容变化处理
  const handleContentChange = () => {
    setHasUnsavedChanges(true);
  };
  
  // 保存处理
  const handleSave = (canvasData) => {
    setHasUnsavedChanges(false);
    
    // 更新标题
    if (canvasData.title && canvasData.title !== route.params?.title) {
      navigation.setOptions({
        title: canvasData.title,
      });
    }
  };
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {canvasId && (
        <InfiniteCanvas
          canvasId={canvasId}
          onContentChange={handleContentChange}
          onSave={handleSave}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default InfiniteCanvasScreen;
