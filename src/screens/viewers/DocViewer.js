import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, TextInput, ScrollView, TouchableOpacity, Text, Dimensions, Modal, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { useTheme } from '../../context/ThemeContext';
import { AllInOneToolbar } from '../../components/common';
import ViewerLayout from '../../components/viewer/ViewerLayout';
import ToolbarContainer from '../../components/viewer/ToolbarContainer';
import GlobalStylusOverlay from '../../components/viewer/GlobalStylusOverlay';
import PageControl from '../../components/viewer/PageControl';
import BookmarkPanel from '../../components/viewer/BookmarkPanel';
import DraggableImage from '../../components/viewer/DraggableImage';
import BackButton from '../../components/viewer/BackButton';
import { addBookmark } from '../../services/bookmarkService';
import { offlineStorageService } from '../../services/offline';
import DocxWebView from '../../components/viewer/web/DocxWebView';
import LoadingIndicator, { ErrorIndicator } from '../../components/common/LoadingIndicator';
import SaveButton, { SaveUtils } from '../../components/common/SaveButton';
import documentCacheService from '../../services/document/documentCacheService';

const DocViewer = ({ route, navigation }) => {
  const { uri, title = '文档', noteId, type } = route.params || {};
  const { colors } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState(''); // 简易文本编辑模式
  const [isTextMode, setIsTextMode] = useState(true); // 默认直接编辑模式
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [strokeColor, setStrokeColor] = useState('#000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [bookmarkVisible, setBookmarkVisible] = useState(false);

  // 分块读取大文件的方法
  const readLargeFileInChunks = async (filePath, createTimeout) => {
    const RNFS = require('react-native-fs');
    const chunkSize = 5 * 1024 * 1024; // 5MB chunks

    try {
      // 获取文件大小
      const stat = await RNFS.stat(filePath);
      const fileSize = stat.size;
      const totalChunks = Math.ceil(fileSize / chunkSize);

      console.log(`DocViewer: 开始分块读取，文件大小: ${fileSize}, 分块数: ${totalChunks}`);

      let base64Data = '';

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileSize);
        const progress = ((i + 1) / totalChunks * 100).toFixed(1);

        setLoadingSubMessage(`正在读取文件块 ${i + 1}/${totalChunks} (${progress}%)`);

        try {
          // 读取文件块
          const chunkData = await Promise.race([
            RNFS.read(filePath, chunkSize, start, 'base64'),
            createTimeout(10000) // 每块10秒超时
          ]);

          base64Data += chunkData;

          // 给UI一些时间更新
          if (i % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        } catch (chunkError) {
          console.error(`DocViewer: 读取文件块 ${i + 1} 失败:`, chunkError);
          throw new Error(`读取文件块 ${i + 1} 失败: ${chunkError.message}`);
        }
      }

      console.log(`DocViewer: 分块读取完成，总长度: ${base64Data.length}`);
      return base64Data;
    } catch (error) {
      console.error('DocViewer: 分块读取失败:', error);
      throw error;
    }
  };
  const [images, setImages] = useState([]); // {id, uri, x, y, z, scale}
  const [deselectTick, setDeselectTick] = useState(0);
  const [docxB64, setDocxB64] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingSubMessage, setLoadingSubMessage] = useState('');


  const scrollRef = useRef(null);
  const docId = noteId || uri || title;

  // 在命令行中显示错误信息
  const logErrorToConsole = (errorType, message) => {
    console.error(`[${errorType}加载失败] ${message}`);
  };

  // 初始化：处理不同类型的文档
  useEffect(() => {
    console.log('DocViewer: 组件挂载', { component: 'DocViewer', state: 'mount' });
    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        let path = uri;

        console.log('DocViewer: 初始化参数', { uri, type, title });

        if (!path) {
          throw new Error('无效的文档路径');
        }

        // 处理content://协议的URI
        if (path.startsWith('content://')) {
          const guessedExt = (type === 'docx' || (uri || '').toLowerCase().endsWith('.docx')) ? 'docx'
            : ((type === 'doc' || (uri || '').toLowerCase().endsWith('.doc')) ? 'doc' : 'txt');
          const fname = `doc_${Date.now()}.${guessedExt}`;
          const dest = `${RNFS.CachesDirectoryPath}/${fname}`;

          try {
            console.log('DocViewer: 复制content://文件到缓存', { from: path, to: dest });
            await RNFS.copyFile(path, dest);
            path = dest;
            console.log('DocViewer: 文件复制成功:', dest);
          } catch (e) {
            console.warn('DocViewer: 复制文档失败，使用原URI', e);
          }
        }

        // 处理file://协议
        if (path.startsWith('file://')) {
          path = path.replace('file://', '');
        }

        // 判断文件类型并处理
        const isDocx = (type === 'docx') || ((uri || '').toLowerCase().endsWith('.docx'));
        const isDoc = (type === 'doc') || ((uri || '').toLowerCase().endsWith('.doc'));
        const isWordDoc = isDocx || isDoc;

        console.log('DocViewer: 文件类型判断', { isDocx, isDoc, isWordDoc, type });

        if (isWordDoc) {
          // Word文档：不尝试文本读取，交给DocxWebView处理
          console.log('DocViewer: 检测到Word文档，将使用DocxWebView渲染');
          setIsTextMode(false);
          setContent(''); // 清空内容，让DocxWebView处理
        } else {
          // 其他文档：尝试文本读取
          try {
            console.log('DocViewer: 尝试读取文本文件:', path);
            const txt = await RNFS.readFile(path, 'utf8');
            console.log('DocViewer: 文本读取成功，字节数:', txt.length);
            setContent(txt);
            setIsTextMode(true);
          } catch (err) {
            console.log('DocViewer: 文本读取失败:', err?.message);
            // 对于无法读取的文件，提供占位内容
            setContent('此文档暂不支持直接文本读取。\n\n您可以使用以下功能：\n• 手写注释覆盖层\n• 图片浮层标注\n• 书签功能');
            setIsTextMode(false);
          }
        }

      } catch (e) {
        console.error('DocViewer: 文档加载失败', e);
        const errorMsg = e.message || '加载失败';
        setError(errorMsg);
        logErrorToConsole('文档', errorMsg);
      } finally {
        // 对于Word文档，不在这里设置loading为false，让DocxWebView处理
        const isWordDoc = (type === 'docx') || (type === 'doc') ||
                         ((uri || '').toLowerCase().endsWith('.docx')) ||
                         ((uri || '').toLowerCase().endsWith('.doc'));
        if (!isWordDoc) {
          setIsLoading(false);
        }
      }
    })();

    return () => console.log('DocViewer: 组件卸载', { component: 'DocViewer', state: 'unmount' });
  }, [uri, type]);

  // 读取docx文件为base64供WebView使用 - 集成后台加载机制
  useEffect(() => {
    (async () => {
      try {
        const isDocx = (type === 'docx') || ((uri || '').toLowerCase().endsWith('.docx'));
        const isDoc = (type === 'doc') || ((uri || '').toLowerCase().endsWith('.doc'));

        if (isDocx || isDoc) {
          console.log('DocViewer: 开始加载Word文档', { type, uri });
          setIsLoading(true);
          setLoadingMessage('正在初始化Word文档加载...');
          setLoadingSubMessage('正在检查缓存和准备加载环境...');

          // 首先检查缓存
          setLoadingMessage('正在检查文档缓存...');
          setLoadingSubMessage('查找已缓存的文档数据...');
          const cached = await documentCacheService.getCachedDocument(uri, type);
          if (cached && cached.data) {
            console.log('DocViewer: 从缓存获取Word文档');
            setLoadingMessage('找到缓存文档');
            setLoadingSubMessage('正在从缓存加载，速度更快...');
            setDocxB64(cached.data);
            // 重要：设置加载完成状态
            setIsLoading(false);
            console.log('DocViewer: 缓存文档加载完成');
            return;
          }

          // 开始后台加载
          const loadFunction = async () => {
            let path = uri;

            // 处理content://协议
            if (path.startsWith('content://')) {
              const ext = isDocx ? 'docx' : 'doc';
              const dest = `${RNFS.CachesDirectoryPath}/doc_${Date.now()}.${ext}`;
              try {
                console.log('DocViewer: 复制Word文档到缓存', { from: path, to: dest });
                await RNFS.copyFile(path, dest);
                path = dest;
              } catch (e) {
                console.warn('DocViewer: 复制Word文档失败', e);
              }
            }

            // 处理file://协议
            if (path.startsWith('file://')) {
              path = path.replace('file://', '');
            }

            // 检查文件大小，决定使用哪种读取方式
            console.log('DocViewer: 检查Word文档文件大小...');
            let fileSize = 0;
            try {
              const stat = await RNFS.stat(path);
              fileSize = stat.size;
              console.log('DocViewer: Word文档大小:', fileSize, 'bytes');
            } catch (statError) {
              console.warn('DocViewer: 无法获取文件大小，使用默认处理:', statError);
            }

            // 如果文件大于50MB，提示用户并拒绝加载
            if (fileSize > 50 * 1024 * 1024) {
              throw new Error(`文件过大(${(fileSize / (1024 * 1024)).toFixed(1)}MB)，请使用较小的Word文档`);
            }

            // 如果文件大于20MB，使用分块处理
            if (fileSize > 20 * 1024 * 1024) {
              console.log('DocViewer: Word文档较大，使用分块读取...');
              const data = await readLargeFileInChunks(path, (ms) => new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`操作超时(${ms}ms)`)), ms)
              ));
              console.log('DocViewer: Word文档分块读取成功，长度:', data.length);
              return data;
            } else {
              // 小文件直接读取
              console.log('DocViewer: 读取Word文档文件为base64:', path);
              const data = await RNFS.readFile(path, 'base64');
              console.log('DocViewer: Word文档base64读取成功，长度:', data.length);
              return data;
            }
          };

          try {
            setLoadingMessage('正在读取Word文档文件...');
            setLoadingSubMessage('正在访问文件系统并读取文档数据...');

            const result = await documentCacheService.startBackgroundLoading(uri, type, loadFunction);
            setLoadingMessage('文档读取完成');
            setLoadingSubMessage('正在解析Word文档结构，准备渲染...');
            setDocxB64(result.data);
            console.log('DocViewer: Word文档后台加载完成');
          } catch (e) {
            console.error('DocViewer: 读取Word文档失败:', e);
            setError('无法读取Word文档文件：' + e.message);
            logErrorToConsole('Word文档', '文件读取失败：' + e.message);
          }
        }
      } catch (e) {
        console.error('DocViewer: Word文档处理异常:', e);
        setError('Word文档处理失败：' + e.message);
      }
    })();
  }, [uri, type]);

  useEffect(() => { (async () => {
    try { const raw = (await offlineStorageService.getItem(`doc_images_${docId}`)) || '[]'; const list = JSON.parse(raw); if (Array.isArray(list)) setImages(list); } catch {}
  })(); }, [docId]);
  const persistImages = async (next) => { try { await offlineStorageService.setItem(`doc_images_${docId}`, JSON.stringify(next)); } catch {} };
  const addImage = async (img) => {
    // 计算合适的图片尺寸和中央位置
    const maxWidth = screenWidth * 0.6;
    const maxHeight = screenHeight * 0.4;

    let imageWidth = img.width || 200;
    let imageHeight = img.height || 200;

    // 按比例缩放
    if (imageWidth > maxWidth || imageHeight > maxHeight) {
      const ratio = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
      imageWidth = imageWidth * ratio;
      imageHeight = imageHeight * ratio;
    }

    const centerX = (screenWidth - imageWidth) / 2;
    const centerY = (screenHeight - imageHeight) / 2;

    const item = {
      id: `img_${Date.now()}`,
      uri: img.uri || img,
      x: centerX,
      y: centerY,
      z: 10,
      width: imageWidth,
      height: imageHeight
    };
    const next = [...images, item];
    setImages(next);
    await persistImages(next);
    console.log('DocViewer: 图片已添加到中央位置:', item);
  };
  const moveImage = async (id, pos) => { const next = images.map(it => it.id===id?{...it, ...pos}:it); setImages(next); await persistImages(next); };

  // 保存文档内容
  const saveToLocal = async () => {
    // 直接保存编辑的文本内容
    await SaveUtils.saveMarkdownContent(docId, content, offlineStorageService);
  };

  // 书签
  const handleAddBookmark = () => {
    setBookmarkVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ToolbarContainer>
        <AllInOneToolbar
          onToolChange={() => {}}
          onColorChange={setStrokeColor}
          onStrokeWidthChange={setStrokeWidth}
          onImageUpload={(image) => addImage(image?.uri || image)}
          onBookmarkAdd={handleAddBookmark}
          onBookmarkList={() => setBookmarkVisible(true)}
        />
      </ToolbarContainer>

      <ViewerLayout
        colors={colors}
        headerLeft={<BackButton onPress={() => {
          try {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Home');
            }
          } catch (error) {
            console.warn('DocViewer: 导航返回失败:', error);
            navigation.navigate('Home');
          }
        }} color={colors.primary} background={colors.primary + '20'} style={{ marginLeft: 0 }} />}
        headerRight={
          <View style={styles.headerRightContainer}>
            <SaveButton
              onSave={saveToLocal}
              text="保存"
              showSuccessToast={true}
              showErrorAlert={true}
              style={styles.saveButtonCompact}
            />
          </View>
        }
        title={title}
        hasExternalToolbar={true}
        externalToolbarHeight={Platform.OS === 'ios' ? 65 : 35}>
        {/* 移除通用加载状态，只在有具体进度信息时显示 */}
        {!isLoading && !!error && (
          <ErrorIndicator
            message="文档加载失败"
            subMessage={error}
            onRetry={() => {
              setError(null);
              setIsLoading(true);
              // 可以在这里添加重新加载逻辑
            }}
          />
        )}
        {!error && (
          <View style={styles.viewer}>
            {/* Word文档显示 */}
            {((type === 'docx') || (type === 'doc') ||
              (uri||'').toLowerCase().endsWith('.docx') ||
              (uri||'').toLowerCase().endsWith('.doc')) ? (
              <View style={{ flex: 1 }}>
                {/* 详细的加载进度显示 - 只在有具体进度信息时显示 */}
                {(isLoading || !docxB64) && (loadingMessage || loadingSubMessage) && (
                  <View style={styles.loadingOverlay}>
                    <LoadingIndicator
                      message={loadingMessage || '正在处理Word文档...'}
                      subMessage={loadingSubMessage || '请稍候...'}
                      overlay={true}
                    />
                  </View>
                )}
                {/* 只有在docxB64存在时才渲染WebView */}
                {docxB64 && (
                  <DocxWebView
                    base64Docx={docxB64}
                    onReady={(message) => {
                      console.log('DocxWebView: Word文档渲染完成', message);
                      setIsLoading(false);
                    }}
                    onMessage={(event) => {
                      try {
                        const data = JSON.parse(event.nativeEvent.data);
                        if (data.type === 'loading') {
                          setLoadingMessage(data.message || '正在渲染Word文档...');
                          setLoadingSubMessage(data.subMessage || '');
                        } else if (data.type === 'error') {
                          setError(data.message || '文档加载失败');
                          setIsLoading(false);
                        }
                      } catch (error) {
                        console.log('解析WebView消息失败:', error);
                      }
                    }}
                    style={{ flex: 1 }}
                  />
                )}
              </View>
            ) : isTextMode ? (
              /* 文本编辑模式 */
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16 }}
                keyboardShouldPersistTaps="handled"
              >
                <TextInput
                  style={[styles.input, {
                    color: colors.text,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 8,
                    padding: 12
                  }]}
                  multiline
                  value={content}
                  onChangeText={setContent}
                  placeholder="在此编辑文档内容..."
                  placeholderTextColor={colors.textLight}
                  textAlignVertical="top"
                  autoCorrect={false}
                  spellCheck={false}
                />
              </ScrollView>
            ) : (
              /* 只读模式 */
              <View style={styles.errorContainer}>
                <Text style={[styles.errorText, { color: colors.text }]}>此文档当前以只读模式显示</Text>
                <Text style={[styles.errorText, { color: colors.textLight, marginTop: 8, fontSize: 14 }]}>
                  您可以使用以下功能：
                </Text>
                <Text style={[styles.errorText, { color: colors.textLight, marginTop: 4, fontSize: 14 }]}>
                  • 手写注释覆盖层
                </Text>
                <Text style={[styles.errorText, { color: colors.textLight, marginTop: 4, fontSize: 14 }]}>
                  • 图片浮层标注
                </Text>
                <Text style={[styles.errorText, { color: colors.textLight, marginTop: 4, fontSize: 14 }]}>
                  • 书签功能
                </Text>
                <ScrollView
                  style={{ flex: 1, marginTop: 20, width: '100%' }}
                  contentContainerStyle={{ padding: 16 }}
                >
                  <Text style={[styles.contentText, { color: colors.text }]}>
                    {content}
                  </Text>
                </ScrollView>
              </View>
            )}

            <View onStartShouldSetResponder={()=>{ setDeselectTick(t=>t+1); return false; }}>
              {images.map(img => (
                <DraggableImage
                  key={img.id}
                  id={img.id}
                  uri={img.uri}
                  initial={{ x: img.x, y: img.y }}
                  initialScale={img.scale || 1}
                  deselectSignal={deselectTick}
                  onMove={moveImage}
                  onResize={(id, data)=>{ const next = images.map(it=>it.id===id?{...it, scale:data.scale}:it); setImages(next); persistImages(next); }}
                  onRemove={(id)=>{ const next = images.filter(it=>it.id!==id); setImages(next); persistImages(next); }}
                />
              ))}
            </View>

            <GlobalStylusOverlay color={strokeColor} width={strokeWidth} />
          </View>
        )}

        <PageControl total={totalPages} current={currentPage} onPrev={() => {}} onNext={() => {}} onSubmitPage={() => {}} storageKey={`doc_page_ctrl_${docId}`} />

        <BookmarkPanel visible={bookmarkVisible} onClose={() => setBookmarkVisible(false)} docId={docId} onJump={(bm)=>{ console.log('DocViewer onJump:', bm); setBookmarkVisible(false); if (bm?.page) { setCurrentPage(bm.page); } }} />
      </ViewerLayout>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  viewer: {
    flex: 1
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    minHeight: 400,
    textAlignVertical: 'top',
    fontSize: 16,
    lineHeight: 24
  },

  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  saveButtonCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
    minHeight: 24,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'left'
  },
});

export default DocViewer;