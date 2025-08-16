import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, Platform, TextInput, ScrollView, TouchableOpacity, Text, Modal, Dimensions } from 'react-native';
import RNFS from 'react-native-fs';
import { useTheme } from '../../context/ThemeContext';
import AllInOneToolbar from '../../components/common/AllInOneToolbar';
import ViewerLayout from '../../components/viewer/ViewerLayout';
import ToolbarContainer from '../../components/viewer/ToolbarContainer';
import GlobalStylusOverlay from '../../components/viewer/GlobalStylusOverlay';
import PageControl from '../../components/viewer/PageControl';
import BookmarkPanel from '../../components/viewer/BookmarkPanel';
import DraggableImage from '../../components/viewer/DraggableImage';
import BackButton from '../../components/viewer/BackButton';
import { addBookmark } from '../../services/bookmarkService';
import { offlineStorageService } from '../../services/offline';
import MarkdownPreview from '../../components/common/MarkdownPreview';
import LoadingIndicator, { LoadingMessages, ErrorIndicator } from '../../components/common/LoadingIndicator';
import SaveButton, { SaveUtils } from '../../components/common/SaveButton';
import FileHistoryNavigation from '../../components/viewer/FileHistoryNavigation';
import fileHistoryService from '../../services/fileHistoryService';

function MarkdownViewer({ route, navigation }) {
  const { uri, title = 'Markdown', noteId, fromFileHistory } = route.params || {};
  const { colors } = useTheme();

  // 处理返回逻辑
  const handleGoBack = () => {
    if (fromFileHistory) {
      // 从文件历史进入，返回主页
      navigation.navigate('Home');
    } else {
      // 正常返回上一页
      navigation.goBack();
    }
  };
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState(false); // 默认编辑模式
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [strokeColor, setStrokeColor] = useState('#000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [bookmarkVisible, setBookmarkVisible] = useState(false);
  const [images, setImages] = useState([]); // {id, uri, x, y, z, scale}
  const [deselectTick, setDeselectTick] = useState(0);

  const scrollRef = useRef(null);
  const scrollYRef = useRef(0);

  const docId = noteId || uri || title;

  useEffect(() => {
    console.log('MarkdownViewer: 组件挂载，开始加载内容');

    // 添加到文件历史记录
    if (uri && title) {
      fileHistoryService.addFile({
        uri,
        title,
        type: 'markdown',
        fileName: title,
        noteId
      });
    }

    (async () => {
      try {
        setIsLoading(true);

        // 1. 首先尝试加载保存的内容
        let loadedContent = null;
        try {
          console.log('MarkdownViewer: 尝试加载保存的内容...');
          const savedKey = `markdown_content_${docId}`;
          const backupKey = `markdown_${docId}`;

          // 尝试主要保存位置
          loadedContent = await offlineStorageService.getItem(savedKey);

          // 如果主要位置没有，尝试备份位置
          if (!loadedContent) {
            loadedContent = await offlineStorageService.getItem(backupKey);
          }

          if (loadedContent) {
            console.log('MarkdownViewer: 找到保存的内容，长度:', loadedContent.length);
            setContent(loadedContent);
            return; // 成功加载保存的内容，直接返回
          }
        } catch (savedError) {
          console.warn('MarkdownViewer: 加载保存内容失败:', savedError);
        }

        // 2. 如果没有保存的内容，加载原始文件
        console.log('MarkdownViewer: 没有保存的内容，加载原始文件...');
        let path = uri;
        if (!path) throw new Error('无效的Markdown路径');

        if (path.startsWith('content://')) {
          const fname = `md_${Date.now()}.md`;
          const dest = `${RNFS.CachesDirectoryPath}/${fname}`;
          await RNFS.copyFile(path, dest);
          path = dest;
        }

        const txt = await RNFS.readFile(path, 'utf8');
        console.log('MarkdownViewer: 原始文件读取成功，长度:', txt.length);
        setContent(txt);

      } catch (e) {
        console.error('MarkdownViewer: 读取Markdown失败', e);
        setError(e.message || '读取失败');
      } finally {
        setIsLoading(false);
      }
    })();

    return () => console.log('MarkdownViewer: 组件卸载');
  }, [uri, docId]);

  // 渲染引擎
  // 已有 MarkdownPreview（react-native-markdown-display），无需 markdown-it 依赖
  // 确保内容是有效的 Markdown 格式，如果是纯文本，则包装为 Markdown
  const html = useMemo(() => {
    if (!content) return '';
    // 检查内容是否已经包含 Markdown 格式
    const hasMarkdownSyntax = /[#*_`>-]/.test(content);
    return hasMarkdownSyntax ? content : `${content}`;
  }, [content]);

  // 保存到本地
  const saveToLocal = async () => {
    await SaveUtils.saveMarkdownContent(docId, content, offlineStorageService);
  };

  // 页码（Markdown 默认1页，保留控件统一样式）
  useEffect(() => { setTotalPages(1); setCurrentPage(1); }, [content]);

  // 图片拖拽持久化
  const handleMoveImage = async (id, pos) => {
    try {
      const key = `md_images_${docId}`;
      const raw = (await offlineStorageService.getItem(key)) || '[]';
      const list = JSON.parse(raw);
      const idx = list.findIndex(x => x.id === id);
      if (idx >= 0) list[idx] = { ...list[idx], ...pos }; else list.push({ id, uri: images.find(x=>x.id===id)?.uri, ...pos });
      await offlineStorageService.setItem(key, JSON.stringify(list));
    } catch (e) { console.warn('保存图片位置失败', e); }
  };

  useEffect(() => { (async () => {
    try {
      const key = `md_images_${docId}`;
      const raw = (await offlineStorageService.getItem(key)) || '[]';
      const list = JSON.parse(raw);
      if (Array.isArray(list)) setImages(list);
    } catch {}
  })(); }, [docId]);

  // 添加图片（示例：通过工具栏 onImageUpload 回调注入）
  const addImage = async (img) => {
    // 获取屏幕尺寸
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
    setImages(prev => [...prev, item]);
    await handleMoveImage(item.id, { x: item.x, y: item.y });
    console.log('MarkdownViewer: 图片已添加到中央位置:', item);
  };

  // 添加书签
  const handleAddBookmark = () => {
    setBookmarkVisible(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header 与工具栏 */}
      <ToolbarContainer>
        <AllInOneToolbar
          onToolChange={() => {}}
          onColorChange={setStrokeColor}
          onStrokeWidthChange={setStrokeWidth}
          onImageUpload={addImage}
          onAIToolSelect={() => {}}
          // 书签入口：可在工具栏中添加按钮并通过回调控制面板
          onBookmarkAdd={handleAddBookmark}
          onBookmarkList={() => setBookmarkVisible(true)}
        />
      </ToolbarContainer>

      <ViewerLayout
        colors={colors}
        headerLeft={<BackButton onPress={handleGoBack} color={colors.primary} background={colors.primary + '20'} style={{ marginLeft: 12 }} />}
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
        externalToolbarHeight={Platform.OS === 'ios' ? 50 : 28}
        showHistoryNavigation={true}
        historyNavigationHeight={25}
        noteId={noteId}
        navigation={navigation}>
        {isLoading && (
          <LoadingIndicator
            message={LoadingMessages.MARKDOWN.LOADING}
            subMessage={LoadingMessages.MARKDOWN.FIRST_TIME}
            overlay={true}
          />
        )}
        {!isLoading && !!error && (
          <ErrorIndicator
            message="Markdown文档加载失败"
            subMessage={error}
            onRetry={() => {
              setError(null);
              setIsLoading(true);
            }}
          />
        )}
        {!isLoading && !error && (
          <View style={styles.viewer}>
            {/* 编辑模式 - 铺满整个界面 */}
            <TextInput
              style={[styles.fullScreenInput, {
                color: colors.text,
                backgroundColor: colors.background,
              }]}
              multiline
              value={content}
              onChangeText={setContent}
              placeholder="在此编辑 Markdown 内容..."
              placeholderTextColor={colors.textLight}
              textAlignVertical="top"
              autoCorrect={false}
              spellCheck={false}
            />

            {/* 浮动拖拽图片 */}
            <View onStartShouldSetResponder={()=>{ setDeselectTick(t=>t+1); return false; }}>
              {images.map(img => (
                <DraggableImage
                  key={img.id}
                  id={img.id}
                  uri={img.uri}
                  initial={{ x: img.x, y: img.y }}
                  initialScale={img.scale || 1}
                  zIndex={img.z ?? 10}
                  deselectSignal={deselectTick}
                  onMove={handleMoveImage}
                  onResize={(id, data)=>{
                    const next = images.map(it=>it.id===id?{...it, scale:data.scale}:it);
                    setImages(next);
                    offlineStorageService.setItem(`md_images_${docId}`, JSON.stringify(next));
                  }}
                  onRemove={async (id)=>{
                    const next = images.filter(it=>it.id!==id);
                    setImages(next);
                    await offlineStorageService.setItem(`md_images_${docId}`, JSON.stringify(next));
                  }}
                />
              ))}
            </View>

            {/* Stylus 书写覆盖层 */}
            <GlobalStylusOverlay color={strokeColor} width={strokeWidth} />
          </View>
        )}

        {/* 底部页码控件（Markdown 仍显示，以保持一致） */}
        <PageControl
          total={totalPages}
          current={currentPage}
          onPrev={() => {}}
          onNext={() => {}}
          onSubmitPage={() => {}}
          storageKey={`md_page_ctrl_${docId}`}
        />

        <BookmarkPanel
          visible={bookmarkVisible}
          onClose={() => setBookmarkVisible(false)}
          docId={docId}
          onJump={(bm)=>{
            console.log('MarkdownViewer onJump:', bm);
            setBookmarkVisible(false);
            // Markdown 书签滚动定位（后续可扩展带offsetY）
            if (scrollRef.current && typeof scrollRef.current.scrollTo === 'function' && typeof bm?.offsetY === 'number') {
              scrollRef.current.scrollTo({ y: bm.offsetY, animated: true });
            }
          }}
        />
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
    justifyContent: 'center'
  },
  viewer: {
    flex: 1
  },
  input: {
    minHeight: 400,
    textAlignVertical: 'top',
    fontSize: 16,
    lineHeight: 24
  },
  fullScreenInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
    padding: 16,
    margin: 0,
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
  editorScroll: {
    flex: 1
  },
  previewScroll: {
    flex: 1
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
});

export default MarkdownViewer;

