import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, Platform, TextInput, ScrollView, TouchableOpacity, Text, Modal, Dimensions, AppState } from 'react-native';
import RNFS from 'react-native-fs';
import { useTheme } from '../../context/ThemeContext';
import AllInOneToolbar from '../../components/common/AllInOneToolbar';
import ViewerLayout from '../../components/viewer/ViewerLayout';
import PageControl from '../../components/viewer/PageControl';
import BookmarkPanel from '../../components/viewer/BookmarkPanel';
import DraggableImage from '../../components/viewer/DraggableImage';
import BackButton from '../../components/viewer/BackButton';
import { addBookmark } from '../../services/bookmarkService';
// 已移除 offlineStorageService 导入，现在直接使用 realmService
import realmService from '../../services/database/realmService';
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
  const [lastSavedContent, setLastSavedContent] = useState(''); // 记录上次保存的内容
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
  const autoSaveTimerRef = useRef(null);

  // ✅ 监听屏幕焦点变化，失焦时保存数据
  useEffect(() => {
    const unsubscribeBlur = navigation.addListener('blur', () => {
      console.log('[MarkdownViewer] 屏幕失去焦点，保存数据...');
      // 失焦时保存数据
      if (content !== lastSavedContent) {
        saveToLocal().catch(err => console.error('[MarkdownViewer] 失焦保存失败:', err));
      }
    });

    return () => {
      unsubscribeBlur();
    };
  }, [navigation, content, lastSavedContent]);

  // ✅ 组件卸载时保存数据
  useEffect(() => {
    return () => {
      console.log('[MarkdownViewer] 组件卸载，保存数据...');
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      // 如果内容有变化，保存
      if (content !== lastSavedContent) {
        saveToLocal().catch(err => console.warn('[MarkdownViewer] 组件卸载时保存失败:', err));
      }
    };
  }, [content, lastSavedContent]);

  // ✅ 监听应用状态变化，应用进入后台时保存数据
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'background' && content && content !== lastSavedContent) {
        console.log('[MarkdownViewer] 应用进入后台，立即保存数据...');
        try {
          // 自动保存内容
          autoSave(content).catch(err => {
            console.error('[MarkdownViewer] 后台自动保存失败:', err);
          });
        } catch (err) {
          console.error('[MarkdownViewer] 后台保存失败:', err);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [content, lastSavedContent]);

  useEffect(() => {
    console.log('MarkdownViewer: 组件挂载，开始加载内容');

    // 添加到文件历史记录
    if (uri && title) {
      fileHistoryService.addFile({
        uri,
        title,
        type: 'markdown',
        fileName: title,
        noteId,
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
          const realm = await realmService.getRealm();
          const item = realm.objects('StorageItem').filtered(`key = "${savedKey}"`);
          loadedContent = item.length > 0 ? item[0].value : null;

          // 如果主要位置没有，尝试备份位置
          if (!loadedContent) {
            const backupItem = realm.objects('StorageItem').filtered(`key = "${backupKey}"`);
            loadedContent = backupItem.length > 0 ? backupItem[0].value : null;
          }

          if (loadedContent) {
            console.log('MarkdownViewer: 找到保存的内容，长度:', loadedContent.length);
            setContent(loadedContent);
            setLastSavedContent(loadedContent); // 设置上次保存的内容
            return; // 成功加载保存的内容，直接返回
          }
        } catch (savedError) {
          console.warn('MarkdownViewer: 加载保存内容失败:', savedError);
        }

        // 2. 如果没有保存的内容，加载原始文件
        console.log('MarkdownViewer: 没有保存的内容，加载原始文件...');
        let path = uri;
        if (!path) {throw new Error('无效的Markdown路径');}

        try {
          // 检查是否有noteId，尝试从笔记元数据中获取本地缓存路径
          if (noteId) {
            try {
              const realm = await realmService.getRealm();
              const note = realm.objectForPrimaryKey('Note', noteId);
              if (note && note.metadata) {
                const metadata = typeof note.metadata === 'string'
                  ? JSON.parse(note.metadata)
                  : (note.metadata || {});

                console.log('MarkdownViewer: 笔记元数据:', metadata);

                // 优先使用持久化的本地路径
                if (metadata.localCachedPath) {
                  const exists = await RNFS.exists(metadata.localCachedPath);
                  if (exists) {
                    console.log('MarkdownViewer: 使用持久化的本地路径:', metadata.localCachedPath);
                    const txt = await RNFS.readFile(metadata.localCachedPath, 'utf8');
                    setContent(txt);
                    setLastSavedContent(txt);
                    return;
                  }
                }
              }
            } catch (metadataError) {
              console.error('读取笔记元数据失败:', metadataError);
            }
          }

          // 处理不同类型的URI
          if (path.startsWith('http://') || path.startsWith('https://')) {
            // 网络URI，直接读取
            const response = await fetch(path);
            const txt = await response.text();
            setContent(txt);
            setLastSavedContent(txt);
          } else if (path.startsWith('content://') || path.startsWith('file://')) {
            // 内容URI或文件URI，需要复制到应用缓存目录
            const fileName = `md_${Date.now()}.md`;
            const destPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

            try {
              if (path.startsWith('content://')) {
                console.log('处理content URI:', path);
                await RNFS.copyFile(path, destPath);
                console.log('文件复制成功:', destPath);
                path = destPath;
              } else {
                // 对于file URI，先检查是否可访问
                await RNFS.stat(path.replace('file://', ''));
                // 如果可访问，复制到缓存目录
                await RNFS.copyFile(path, destPath);
                path = destPath;
              }

              const txt = await RNFS.readFile(path, 'utf8');
              console.log('MarkdownViewer: 原始文件读取成功，长度:', txt.length);
              setContent(txt);
              setLastSavedContent(txt);

              // 保存文件路径到笔记元数据中，以便下次打开
              if (noteId) {
                try {
                  const realm = await realmService.getRealm();
                  const note = realm.objectForPrimaryKey('Note', noteId);
                  if (note) {
                    let metadata = note.metadata
                      ? (typeof note.metadata === 'string'
                          ? JSON.parse(note.metadata)
                          : note.metadata)
                      : {};
                    metadata.localCachedPath = path;

                    // 更新笔记元数据
                    realm.write(() => {
                      const note = realm.objectForPrimaryKey('Note', noteId);
                      if (note) {
                        Object.assign(note, {
                          metadata: JSON.stringify(metadata),
                        });
                        console.log('已更新笔记元数据，保存本地缓存路径');
                      }
                    });
                  }
                } catch (metadataError) {
                  console.error('更新笔记元数据失败:', metadataError);
                }
              }

              // 立即保存到本地存储
              try {
                const savedKey = `markdown_content_${docId}`;
                const realm = await realmService.getRealm();
                realm.write(() => {
                  const existingItem = realm.objects('StorageItem').filtered(`key = "${savedKey}"`);
                  if (existingItem.length > 0) {
                    existingItem[0].value = txt;
                    existingItem[0].updated_at = new Date();
                  } else {
                    realm.create('StorageItem', {
                      key: savedKey,
                      value: txt,
                      createdAt: new Date(),
                      updated_at: new Date(),
                    });
                  }
                });
                console.log('MarkdownViewer: 内容已保存到本地存储');
              } catch (saveError) {
                console.warn('MarkdownViewer: 保存到本地存储失败:', saveError);
              }

            } catch (copyError) {
              console.error('复制文件失败:', copyError);
              // 如果复制失败，尝试直接读取原始文件
              const txt = await RNFS.readFile(path, 'utf8');
              setContent(txt);
              setLastSavedContent(txt);
            }
          } else {
            // 其他情况，直接读取
            const txt = await RNFS.readFile(path, 'utf8');
            setContent(txt);
            setLastSavedContent(txt);
          }

        } catch (fileError) {
          console.error('MarkdownViewer: 读取原始文件失败:', fileError);

          // 如果是权限错误，提供更详细的错误信息
          if (fileError.message && fileError.message.includes('Permission')) {
            setError('文件访问权限不足。文件已被复制到应用缓存目录，下次打开时将不会出现此问题。');
          } else {
            setError(fileError.message || '读取文件失败');
          }
        }

      } catch (e) {
        console.error('MarkdownViewer: 读取Markdown失败', e);
        setError(e.message || '读取失败');
      } finally {
        setIsLoading(false);
      }
    })();

    return () => {
      console.log('MarkdownViewer: 组件卸载（内部清理）');
      // 清理定时器
      if (debouncedAutoSave.current) {
        clearTimeout(debouncedAutoSave.current);
      }
      // 内容保存已由外部useEffect处理
    };
  }, [uri, docId]);

  // 渲染引擎
  // 已有 MarkdownPreview（react-native-markdown-display），无需 markdown-it 依赖
  // 确保内容是有效的 Markdown 格式，如果是纯文本，则包装为 Markdown
  const html = useMemo(() => {
    if (!content) {return '';}
    // 检查内容是否已经包含 Markdown 格式
    const hasMarkdownSyntax = /[#*_`>-]/.test(content);
    return hasMarkdownSyntax ? content : `${content}`;
  }, [content]);

  // 保存到本地
  const saveToLocal = async () => {
    try {
      if (!content || !docId) {
        throw new Error('内容或文档ID无效');
      }

      // 先保存到本地存储
      await SaveUtils.saveMarkdownContent(docId, content, realmService);

      // 如果有noteId，也更新笔记元数据
      if (noteId) {
        const realm = await realmService.getRealm();
        realm.write(() => {
          const note = realm.objectForPrimaryKey('Note', noteId);
          if (note) {
            Object.assign(note, {
              content: content,
              updated_at: new Date().toISOString(),
            });
          }
        });
      }

      setLastSavedContent(content); // 更新上次保存的内容
      console.log('MarkdownViewer: 内容已手动保存');

      return { success: true };
    } catch (error) {
      console.error('MarkdownViewer: 手动保存失败:', error);
      throw error;
    }
  };

  // 自动保存功能
  const autoSave = async (newContent) => {
    try {
      // 如果内容没有变化，不保存
      if (newContent === lastSavedContent) {
        return;
      }

      const savedKey = `markdown_content_${docId}`;
      const realm = await realmService.getRealm();
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "${savedKey}"`);
        if (existingItem.length > 0) {
          existingItem[0].value = newContent;
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: savedKey,
            value: newContent,
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });
      setLastSavedContent(newContent);
      console.log('MarkdownViewer: 内容已自动保存');
    } catch (error) {
      console.warn('MarkdownViewer: 自动保存失败:', error);
    }
  };

  // 防抖自动保存
  const debouncedAutoSave = useRef(null);
  const handleContentChange = (newContent) => {
    setContent(newContent);

    // 清除之前的定时器
    if (debouncedAutoSave.current) {
      clearTimeout(debouncedAutoSave.current);
    }

    // 设置新的定时器，2秒后自动保存
    debouncedAutoSave.current = setTimeout(() => {
      autoSave(newContent);
    }, 2000);
  };

  // 页码（Markdown 默认1页，保留控件统一样式）
  useEffect(() => { setTotalPages(1); setCurrentPage(1); }, [content]);

  // 图片拖拽持久化
  const handleMoveImage = async (id, pos) => {
    try {
      const key = `md_images_${docId}`;
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered(`key = "${key}"`);
      const raw = item.length > 0 ? item[0].value : '[]';
      const list = JSON.parse(raw);
      const idx = list.findIndex(x => x.id === id);
      if (idx >= 0) {list[idx] = { ...list[idx], ...pos };} else {list.push({ id, uri: images.find(x=>x.id === id)?.uri, ...pos });}
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "${key}"`);
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(list);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: key,
            value: JSON.stringify(list),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });
    } catch (e) { console.warn('保存图片位置失败', e); }
  };

  useEffect(() => { (async () => {
    try {
      const key = `md_images_${docId}`;
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered(`key = "${key}"`);
      const raw = item.length > 0 ? item[0].value : '[]';
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {setImages(list);}
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
      height: imageHeight,
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
        showExternalToolbar={true}
        toolbarProps={{
          onToolChange: () => {},
          onColorChange: setStrokeColor,
          onStrokeWidthChange: setStrokeWidth,
          onImageUpload: addImage,
          onAIToolSelect: () => {},
          onBookmarkAdd: handleAddBookmark,
          onBookmarkList: () => setBookmarkVisible(true),
        }}
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
            extraActions={[
              {
                title: '重新选择文件',
                onPress: () => {
                  // 这里可以添加重新选择文件的逻辑
                  Alert.alert(
                    '重新选择文件',
                    '请返回主页，重新选择Markdown文件。',
                    [
                      { text: '取消', style: 'cancel' },
                      {
                        text: '返回主页',
                        onPress: () => navigation.navigate('Home'),
                      },
                    ]
                  );
                },
              },
            ]}
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
              onChangeText={handleContentChange}
              placeholder="在此编辑 Markdown 内容..."
              placeholderTextColor={colors.textLight}
              textAlignVertical="top"
              autoCorrect={false}
              spellCheck={false}
            />

            {/* 浮动拖拽图片 */}
            <View onStartShouldSetResponder={()=>{ setDeselectTick(t=>t + 1); return false; }}>
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
                  onResize={async (id, data)=>{
                    const next = images.map(it=>it.id === id ? {...it, scale:data.scale} : it);
                    setImages(next);
                    const realm = await realmService.getRealm();
                    realm.write(() => {
                      const existingItem = realm.objects('StorageItem').filtered(`key = "md_images_${docId}"`);
                      if (existingItem.length > 0) {
                        existingItem[0].value = JSON.stringify(next);
                        existingItem[0].updated_at = new Date();
                      } else {
                        realm.create('StorageItem', {
                          key: `md_images_${docId}`,
                          value: JSON.stringify(next),
                          createdAt: new Date(),
                          updated_at: new Date(),
                        });
                      }
                    });
                  }}
                  onRemove={async (id)=>{
                    const next = images.filter(it=>it.id !== id);
                    setImages(next);
                    const realm = await realmService.getRealm();
                    realm.write(() => {
                      const existingItem = realm.objects('StorageItem').filtered(`key = "md_images_${docId}"`);
                      if (existingItem.length > 0) {
                        existingItem[0].value = JSON.stringify(next);
                        existingItem[0].updated_at = new Date();
                      } else {
                        realm.create('StorageItem', {
                          key: `md_images_${docId}`,
                          value: JSON.stringify(next),
                          createdAt: new Date(),
                          updated_at: new Date(),
                        });
                      }
                    });
                  }}
                />
              ))}
            </View>


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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewer: {
    flex: 1,
  },
  input: {
    minHeight: 400,
    textAlignVertical: 'top',
    fontSize: 16,
    lineHeight: 24,
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
    flex: 1,
  },
  previewScroll: {
    flex: 1,
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

