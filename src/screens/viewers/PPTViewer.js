import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
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
import PptxWebView from '../../components/viewer/web/PptxWebView';
import LoadingIndicator, { LoadingMessages, ErrorIndicator } from '../../components/common/LoadingIndicator';
import SaveButton, { SaveUtils } from '../../components/common/SaveButton';

const PPTViewer = ({ route, navigation }) => {
  const { uri, title = '演示文稿', noteId } = route.params || {};
  const { colors } = useTheme();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [strokeColor, setStrokeColor] = useState('#000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [bookmarkVisible, setBookmarkVisible] = useState(false);
  const [images, setImages] = useState([]);
  const [pptxB64, setPptxB64] = useState(null);
  const [totalSlides, setTotalSlides] = useState(1);


  const docId = noteId || uri || title;

  // 保存PPT注释和标记
  const saveToLocal = async () => {
    const annotations = {
      images: images,
      currentPage: currentPage,
      totalPages: totalPages,
      updatedAt: new Date().toISOString()
    };
    await SaveUtils.savePPTAnnotations(docId, annotations, offlineStorageService);
  };

  useEffect(() => {
    (async () => {
      try {
        console.log('PPTViewer: 组件挂载', { component: 'PPTViewer', state: 'mount' });
        setIsLoading(true);
        setError(null);

        // 读取PPT文件为base64，用WebView渲染
        if (uri) {
          console.log('PPTViewer: 开始处理PPT文件:', uri);
          const RNFS = require('react-native-fs');
          let path = uri;

          // 设置超时机制
          const createTimeout = (ms) => new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`操作超时(${ms}ms)`)), ms)
          );

          // 处理content://协议的URI
          if (path.startsWith('content://')) {
            console.log('PPTViewer: 处理content://协议文件');
            try {
              // 直接尝试读取content://URI（设置超时）
              console.log('PPTViewer: 直接读取content://URI...');
              const data = await Promise.race([
                RNFS.readFile(path, 'base64'),
                createTimeout(15000) // 15秒超时
              ]);
              console.log('PPTViewer: content://直接读取成功，base64长度:', data ? data.length : 0);
              setPptxB64(data);
            } catch (e) {
              console.warn('PPTViewer: 直接读取content://URI失败:', e);

              // 如果直接读取失败，尝试复制到缓存目录
              try {
                console.log('PPTViewer: 尝试复制到缓存目录...');
                const dest = `${RNFS.CachesDirectoryPath}/ppt_${Date.now()}.pptx`;
                await Promise.race([
                  RNFS.copyFile(path, dest),
                  createTimeout(10000) // 10秒超时
                ]);
                path = dest;
                console.log('PPTViewer: PPT文件复制成功:', dest);

                // 从缓存读取
                console.log('PPTViewer: 从缓存读取文件...');
                const data = await Promise.race([
                  RNFS.readFile(path, 'base64'),
                  createTimeout(10000) // 10秒超时
                ]);
                console.log('PPTViewer: 缓存文件读取成功，base64长度:', data ? data.length : 0);
                setPptxB64(data);
              } catch (copyErr) {
                console.error('PPTViewer: 复制PPT文件失败:', copyErr);
                setError('无法访问文件，请确保应用有权限访问该文件。您可能需要重新选择文件。');
              }
            }
          } else {
            // 处理file://协议
            console.log('PPTViewer: 处理file://协议文件');
            if (path.startsWith('file://')) {
              path = path.replace('file://', '');
            }

            try {
              console.log('PPTViewer: 读取本地文件:', path);
              const data = await Promise.race([
                RNFS.readFile(path, 'base64'),
                createTimeout(12000) // 12秒超时
              ]);
              console.log('PPTViewer: 本地文件读取成功，base64长度:', data ? data.length : 0);
              setPptxB64(data);
            } catch (readErr) {
              console.error('PPTViewer: 读取本地PPTX文件失败:', readErr);
              setError('读取文件失败，请确保文件格式正确且未损坏。');
            }
          }
        } else {
          console.warn('PPTViewer: 未提供文件URI');
          setError('未提供有效的文件路径');
        }

        // 加载图片浮层数据
        try {
          console.log('PPTViewer: 加载图片浮层数据...');
          const key = `ppt_images_${docId}`;
          const raw = (await offlineStorageService.getItem(key)) || '[]';
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            setImages(list);
            console.log('PPTViewer: 图片浮层数据加载成功，数量:', list.length);
          }
        } catch (imageErr) {
          console.warn('PPTViewer: 加载图片浮层数据失败:', imageErr);
        }

      } catch (e) {
        console.error('PPTViewer: 初始化失败:', e);
        setError(e.message || '加载失败');
      } finally {
        // 注意：不在这里设置loading为false，让PptxWebView处理
        // setIsLoading(false);
      }
    })();

    return () => console.log('PPTViewer: 组件卸载', { component: 'PPTViewer', state: 'unmount' });
  }, [docId, uri]);

  const persistImages = async (next) => { try { await offlineStorageService.setItem(`ppt_images_${docId}`, JSON.stringify(next)); } catch {} };
  const addImage = async (img) => { const item={ id:`img_${Date.now()}`, uri: img.uri || img, x:20, y:20, z:10 }; const next=[...images, item]; setImages(next); await persistImages(next); };
  const moveImage = async (id, pos) => { const next=images.map(it=>it.id===id?{...it,...pos}:it); setImages(next); await persistImages(next); };

  const handleAddBookmark = async () => { await addBookmark(docId, { name:`书签_${currentPage}`, page: currentPage }); setBookmarkVisible(true); };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* <ToolbarContainer>
        <AllInOneToolbar
          onToolChange={() => {}}
          onColorChange={setStrokeColor}
          onStrokeWidthChange={setStrokeWidth}
          onImageUpload={(image)=>addImage(image?.uri || image)}
          onBookmarkAdd={handleAddBookmark}
          onBookmarkList={() => setBookmarkVisible(true)}
        />
      </ToolbarContainer> */}

      <ViewerLayout
        colors={colors}
        headerLeft={<BackButton onPress={() => navigation.goBack()} color={colors.primary} background={colors.primary + '20'} style={{ marginLeft: 12 }} />}
        headerRight={
          <SaveButton
            onSave={saveToLocal}
            text="保存"
            showSuccessToast={true}
            showErrorAlert={true}
            style={styles.saveButtonCompact}
          />
        }
        title={title}>
        {isLoading && (
          <LoadingIndicator
            message={LoadingMessages.PPT.LOADING}
            subMessage={LoadingMessages.PPT.FIRST_TIME}
            overlay={true}
          />
        )}
        {!isLoading && !!error && (
          <ErrorIndicator
            message="PPT文档加载失败"
            subMessage={error}
            onRetry={() => {
              setError(null);
              setIsLoading(true);
            }}
          />
        )}
        {!error && (
          <View style={styles.viewer} onStartShouldSetResponder={() => false}>
            {pptxB64 ? (
              <View style={{ flex: 1 }}>
                <PptxWebView
                  base64Pptx={pptxB64}
                  onMeta={({ totalSlides }) => {
                    console.log('PPTViewer: PPT元数据加载完成，总页数:', totalSlides);
                    setTotalPages(totalSlides || 1);
                    setTotalSlides(totalSlides || 1);
                    setCurrentPage(1);
                    setIsLoading(false); // PPT元数据加载完成，隐藏loading
                  }}
                  onPage={(current) => {
                    const page = Math.max(1, Math.min(totalSlides, Number(current) || 1));
                    console.log('PPTViewer: PPT页面切换到:', page);
                    setCurrentPage(page);
                  }}
                  onError={(msg) => {
                    console.error('PPTViewer: PPT渲染错误:', msg);
                    setError(msg || 'PPT渲染失败');
                    setIsLoading(false);
                  }}
                  onMessage={(e) => {
                    try {
                      const msg = JSON.parse(e.nativeEvent.data || '{}');
                      if (msg.type === 'loaded') {
                        console.log('PPTViewer: PPT完全加载完成');
                        setIsLoading(false);
                      }
                    } catch (err) {
                      console.warn('PPTViewer: 消息解析错误:', err);
                    }
                  }}
                  style={{ flex: 1 }}
                />
                {/* 加载覆盖层 */}
                {isLoading && (
                  <LoadingIndicator
                    message={LoadingMessages.PPT.RENDERING}
                    subMessage={LoadingMessages.PPT.FIRST_TIME}
                    overlay={true}
                  />
                )}
              </View>
            ) : isLoading ? (
              <LoadingIndicator
                message={LoadingMessages.PPT.PARSING}
                subMessage="请稍候，正在读取文件数据"
              />
            ) : (
              <ErrorIndicator
                message="PPT文件未加载"
                subMessage="请检查文件路径是否正确"
              />
            )}

            {images.map(img => (
              <DraggableImage
                key={img.id}
                id={img.id}
                uri={img.uri}
                initial={{ x: img.x, y: img.y }}
                initialScale={img.scale || 1}
                onMove={moveImage}
                onResize={(id, data)=>{ const next = images.map(it=>it.id===id?{...it, scale:data.scale}:it); setImages(next); persistImages(next); }}
                onRemove={(id)=>{ const next = images.filter(it=>it.id!==id); setImages(next); persistImages(next); }}
              />
            ))}

            <GlobalStylusOverlay color={strokeColor} width={strokeWidth} />
          </View>
        )}

        <PageControl
          total={totalPages}
          current={currentPage}
          onPrev={() => setCurrentPage(p => Math.max(1, p - 1))}
          onNext={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          onSubmitPage={(n)=>{ if (n>=1 && n<=totalPages) setCurrentPage(n); }}
          storageKey={`ppt_page_ctrl_${docId}`}
        />
        <BookmarkPanel visible={bookmarkVisible} onClose={() => setBookmarkVisible(false)} docId={docId} onJump={(bm)=>{ console.log('PPTViewer onJump:', bm); setBookmarkVisible(false); if (bm?.page) { setCurrentPage(bm.page); } }} />
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500'
  },
  loadingSubText: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center'
  },
  saveButtonCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
    minHeight: 24,
  },
});

export default PPTViewer;

