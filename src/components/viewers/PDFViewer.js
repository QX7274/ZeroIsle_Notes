/**
 * PDF查看器组件
 * 用于在应用内查看PDF文件
 */
import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Pdf from 'react-native-pdf';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Text } from '../common/Typography';
import { useNavigation } from '@react-navigation/native';

/**
 * PDF查看器组件
 * @param {Object} route - 路由对象，包含PDF文件路径和名称
 * @param {string} route.params.uri - PDF文件路径
 * @param {string} route.params.name - PDF文件名称
 */
const PDFViewer = ({ route }) => {
  // 获取主题
  const { colors } = useTheme();
  
  // 导航
  const navigation = useNavigation();
  
  // 获取屏幕尺寸
  const { width, height } = Dimensions.get('window');
  
  // 状态
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState(null);
  
  // PDF引用
  const pdfRef = useRef(null);
  
  // 获取路由参数
  const { uri, name = 'PDF文档' } = route.params || {};
  
  // 处理PDF加载
  const handleLoadComplete = (numberOfPages, filePath) => {
    setLoading(false);
    setTotalPages(numberOfPages);
  };
  
  // 处理PDF加载错误
  const handleError = (error) => {
    setLoading(false);
    setError(error.message || '加载PDF文件失败');
    console.error('PDF加载错误:', error);
  };
  
  // 处理页面变化
  const handlePageChanged = (page) => {
    setCurrentPage(page);
  };
  
  // 跳转到上一页
  const goToPreviousPage = () => {
    if (currentPage > 1 && pdfRef.current) {
      pdfRef.current.setPage(currentPage - 1);
    }
  };
  
  // 跳转到下一页
  const goToNextPage = () => {
    if (currentPage < totalPages && pdfRef.current) {
      pdfRef.current.setPage(currentPage + 1);
    }
  };
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 顶部栏 */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text
          variant="heading"
          level="h6"
          style={styles.title}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {name}
        </Text>
        <View style={styles.placeholder} />
      </View>
      
      {/* PDF查看器 */}
      {uri ? (
        <View style={styles.pdfContainer}>
          <Pdf
            ref={pdfRef}
            source={{ uri }}
            style={[styles.pdf, { width, height: height - 120 }]}
            onLoadComplete={handleLoadComplete}
            onPageChanged={handlePageChanged}
            onError={handleError}
            enablePaging={true}
            horizontal={false}
            spacing={0}
            password={null}
            activityIndicator={
              <ActivityIndicator color={colors.primary} size="large" />
            }
            activityIndicatorProps={{ color: colors.primary }}
          />
          
          {/* 加载指示器 */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                variant="body"
                size="medium"
                style={{ marginTop: 16, color: colors.textSecondary }}
              >
                加载中...
              </Text>
            </View>
          )}
          
          {/* 错误信息 */}
          {error && (
            <View style={styles.errorContainer}>
              <Icon name="error-outline" size={48} color={colors.error} />
              <Text
                variant="body"
                size="medium"
                style={{ marginTop: 16, color: colors.error }}
              >
                {error}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setLoading(true);
                  setError(null);
                  // 重新加载PDF
                  if (pdfRef.current) {
                    pdfRef.current.reload();
                  }
                }}
              >
                <Text
                  variant="body"
                  size="medium"
                  style={{ color: colors.onPrimary }}
                >
                  重试
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color={colors.error} />
          <Text
            variant="body"
            size="medium"
            style={{ marginTop: 16, color: colors.error }}
          >
            未提供PDF文件路径
          </Text>
        </View>
      )}
      
      {/* 底部控制栏 */}
      {!loading && !error && uri && (
        <View style={[styles.controls, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              currentPage <= 1 && styles.disabledButton,
            ]}
            onPress={goToPreviousPage}
            disabled={currentPage <= 1}
          >
            <Icon
              name="navigate-before"
              size={24}
              color={currentPage <= 1 ? colors.textSecondary : colors.primary}
            />
          </TouchableOpacity>
          <Text
            variant="body"
            size="medium"
            style={{ color: colors.text }}
          >
            {currentPage} / {totalPages}
          </Text>
          <TouchableOpacity
            style={[
              styles.controlButton,
              currentPage >= totalPages && styles.disabledButton,
            ]}
            onPress={goToNextPage}
            disabled={currentPage >= totalPages}
          >
            <Icon
              name="navigate-next"
              size={24}
              color={currentPage >= totalPages ? colors.textSecondary : colors.primary}
            />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  pdfContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdf: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  controlButton: {
    padding: 8,
    borderRadius: 20,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default PDFViewer;
