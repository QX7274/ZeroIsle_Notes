/**
 * Word文档查看器组件
 * 用于在应用内查看Word文档
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Text } from '../common/Typography';
import { useNavigation } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import { WebView } from 'react-native-webview';

/**
 * Word文档查看器组件
 * @param {Object} route - 路由对象，包含文档文件路径和名称
 * @param {string} route.params.uri - 文档文件路径
 * @param {string} route.params.name - 文档文件名称
 */
const DocViewer = ({ route }) => {
  // 获取主题
  const { colors } = useTheme();
  
  // 导航
  const navigation = useNavigation();
  
  // 状态
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [htmlContent, setHtmlContent] = useState('');
  
  // 获取路由参数
  const { uri, name = 'Word文档' } = route.params || {};
  
  // 加载文档内容
  useEffect(() => {
    if (!uri) {
      setLoading(false);
      setError('未提供文档文件路径');
      return;
    }
    
    const loadDocument = async () => {
      try {
        setLoading(true);
        
        // 检查文件是否存在
        const fileExists = await RNFS.exists(uri);
        if (!fileExists) {
          throw new Error('文件不存在');
        }
        
        // 创建临时HTML文件来显示文档
        // 注意：这里使用WebView来显示文档，实际上需要将Word转换为HTML
        // 在真实应用中，你可能需要使用第三方服务或库来转换Word文档
        
        // 这里我们创建一个简单的HTML来显示文档不能直接查看的信息
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                  padding: 20px;
                  color: ${colors.text};
                  background-color: ${colors.background};
                }
                .container {
                  max-width: 800px;
                  margin: 0 auto;
                }
                .header {
                  text-align: center;
                  margin-bottom: 30px;
                }
                .file-info {
                  background-color: ${colors.card};
                  border-radius: 8px;
                  padding: 20px;
                  margin-bottom: 20px;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .message {
                  background-color: #FFF8E1;
                  border-left: 4px solid #FFC107;
                  padding: 15px;
                  border-radius: 4px;
                  margin-bottom: 20px;
                }
                .file-path {
                  word-break: break-all;
                  background-color: #F5F5F5;
                  padding: 10px;
                  border-radius: 4px;
                  font-family: monospace;
                  margin-top: 10px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>${name}</h1>
                </div>
                <div class="file-info">
                  <h2>文件信息</h2>
                  <p><strong>文件名:</strong> ${name}</p>
                  <p><strong>文件路径:</strong></p>
                  <div class="file-path">${uri}</div>
                </div>
                <div class="message">
                  <p>Word文档需要转换后才能在应用内查看。您可以使用外部应用打开此文档。</p>
                </div>
              </div>
            </body>
          </html>
        `;
        
        setHtmlContent(html);
        setLoading(false);
      } catch (err) {
        console.error('加载文档错误:', err);
        setError(err.message || '加载文档失败');
        setLoading(false);
      }
    };
    
    loadDocument();
  }, [uri, name, colors]);
  
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
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            // 在这里添加打开外部应用的逻辑
            console.log('打开外部应用');
          }}
        >
          <Icon name="open-in-new" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
      
      {/* 文档查看器 */}
      <View style={styles.viewerContainer}>
        {loading ? (
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
        ) : error ? (
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
              onPress={() => navigation.goBack()}
            >
              <Text
                variant="body"
                size="medium"
                style={{ color: colors.onPrimary }}
              >
                返回
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            source={{ html: htmlContent }}
            style={styles.webView}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              setError(`WebView错误: ${nativeEvent.description}`);
            }}
          />
        )}
      </View>
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
  actionButton: {
    padding: 8,
  },
  viewerContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  webView: {
    flex: 1,
  },
});

export default DocViewer;
