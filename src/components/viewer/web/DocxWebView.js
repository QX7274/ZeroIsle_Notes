import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// 以 WebView 在浏览器环境中使用 docx-preview 渲染并允许简单编辑
// props: { base64Docx, style, onReady(htmlString) }
export default function DocxWebView({ base64Docx, onReady, style }) {
  const webRef = useRef(null);

  const html = useMemo(() => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body { margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #root { padding: 8px; min-height: 100vh; }
    .docx { background:#fff; line-height: 1.6; }
    /* 移除自定义加载样式，使用统一的LoadingIndicator */
    .error {
      color: #d32f2f;
      padding: 20px;
      text-align: center;
      background: #ffebee;
      border-radius: 8px;
      margin: 20px;
    }
    .retry-btn {
      background: #1976d2;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 10px;
    }
    .retry-btn:hover { background: #1565c0; }
    .fallback-content {
      padding: 20px;
      background: #f5f5f5;
      border-radius: 8px;
      margin: 20px;
      line-height: 1.6;
    }
    /* 编辑模式样式 */
    .editable {
      outline: none;
      border: 1px dashed #ccc;
      padding: 10px;
      min-height: 200px;
    }
    .editable:focus {
      border-color: #1976d2;
      box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
    }
  </style>
  <!-- 多个CDN源，提高加载成功率 -->
  <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/docx-preview@0.3.6/dist/docx-preview.min.js"></script>
</head>
<body>
  <div id="root">
    <!-- 移除HTML加载UI，统一使用React Native的LoadingIndicator -->
    <div class="loading" id="loading" style="display: none;"></div>
    <div id="docx" style="display: none;"></div>
    <div id="error" style="display: none;"></div>
    <div id="fallback" style="display: none;"></div>
  </div>
  <script>
    console.log('DocxWebView HTML loaded');

    // 全局状态管理
    let isLibrariesLoaded = false;
    let loadAttempts = 0;
    const maxLoadAttempts = 3;

    // 显示加载状态 - 只通知React Native，不显示HTML加载UI
    function showLoading(message = '正在加载Word文档...', subMessage = '') {
      // 隐藏所有内容区域
      document.getElementById('loading').style.display = 'none';
      document.getElementById('docx').style.display = 'none';
      document.getElementById('error').style.display = 'none';
      document.getElementById('fallback').style.display = 'none';

      // 通知React Native当前加载状态，让React Native的LoadingIndicator显示
      window.postMessage(JSON.stringify({
        type: 'loading',
        message: message,
        subMessage: subMessage
      }), '*');
    }

    // 显示错误
    function showError(message, canRetry = true) {
      console.error('DocxWebView Error:', message);
      document.getElementById('loading').style.display = 'none';
      document.getElementById('docx').style.display = 'none';
      document.getElementById('fallback').style.display = 'none';

      const errorDiv = document.getElementById('error');
      errorDiv.style.display = 'block';
      errorDiv.innerHTML = '<div class="error">' +
        '<h3>Word文档加载失败</h3>' +
        '<p>' + message + '</p>' +
        (canRetry ? '<button class="retry-btn" onclick="retryLoad()">重试加载</button>' : '') +
        '<button class="retry-btn" onclick="showFallback()" style="margin-left: 10px;">显示文本内容</button>' +
        '</div>';

      // 通知React Native
      window.postMessage(JSON.stringify({
        type: 'error',
        message: message,
        canRetry: canRetry
      }), '*');
    }

    // 显示fallback内容
    function showFallback() {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('docx').style.display = 'none';
      document.getElementById('error').style.display = 'none';

      const fallbackDiv = document.getElementById('fallback');
      fallbackDiv.style.display = 'block';
      fallbackDiv.innerHTML = '<div class="fallback-content">' +
        '<h3>文档内容（文本模式）</h3>' +
        '<div id="text-content" class="editable" contenteditable="true">正在提取文档文本内容...</div>' +
        '<p style="color: #666; font-size: 14px; margin-top: 10px;">注：当前为文本模式，可进行基本编辑</p>' +
        '</div>';

      // 请求文本内容
      window.postMessage(JSON.stringify({ type: 'requestTextContent' }), '*');
    }

    // 重试加载
    function retryLoad() {
      if (loadAttempts < maxLoadAttempts) {
        loadAttempts++;
        showLoading('重试加载中... (第' + loadAttempts + '次)');
        setTimeout(() => {
          loadDocxPreviewLibraries();
        }, 1000);
      } else {
        showError('多次重试失败，请检查网络连接', false);
      }
    }

    // 加载必需的库
    async function loadDocxPreviewLibraries() {
      try {
        console.log('开始加载docx-preview库...');
        showLoading('正在加载渲染库...', '首次加载需要下载必要的组件');

        // 检查库是否已经加载
        if (window.JSZip && window.docx) {
          console.log('库已加载，跳过重复加载');
          showLoading('渲染库已就绪', '正在准备文档渲染');
          isLibrariesLoaded = true;
          return true;
        }

        // 多个CDN源备选
        const cdnSources = [
          {
            jszip: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
            docx: 'https://cdn.jsdelivr.net/npm/docx-preview@0.3.6/dist/docx-preview.min.js'
          },
          {
            jszip: 'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
            docx: 'https://unpkg.com/docx-preview@0.3.6/dist/docx-preview.min.js'
          },
          {
            jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
            docx: 'https://cdn.jsdelivr.net/npm/docx-preview@0.3.6/dist/docx-preview.min.js'
          }
        ];

        // 动态加载脚本 - 优化超时和错误处理
        const loadScript = (url, timeout = 8000) => {
          return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;

            const timer = setTimeout(() => {
              script.remove(); // 清理失败的脚本标签
              reject(new Error('脚本加载超时: ' + url));
            }, timeout);

            script.onload = () => {
              clearTimeout(timer);
              console.log('脚本加载成功:', url);
              resolve();
            };

            script.onerror = () => {
              clearTimeout(timer);
              script.remove(); // 清理失败的脚本标签
              reject(new Error('脚本加载失败: ' + url));
            };

            document.head.appendChild(script);
          });
        };

        // 尝试不同的CDN源 - 添加总体超时控制
        const totalTimeout = 25000; // 25秒总超时
        const startTime = Date.now();

        for (let i = 0; i < cdnSources.length; i++) {
          try {
            // 检查总体超时
            if (Date.now() - startTime > totalTimeout) {
              console.error('总体加载超时，直接显示文本模式');
              showFallback();
              return false;
            }

            console.log('尝试CDN源', i + 1, ':', cdnSources[i]);
            showLoading('正在加载渲染库... ',{i + 1}/{cdnSources.length}, '正在从CDN下载必要组件');

            // 先加载JSZip
            if (!window.JSZip) {
              console.log('加载JSZip...');
              await loadScript(cdnSources[i].jszip);
            }

            // 再加载docx-preview
            if (!window.docx) {
              console.log('加载docx-preview...');
              await loadScript(cdnSources[i].docx);
            }

            // 验证库是否正确加载
            if (window.JSZip && window.docx) {
              console.log('所有库加载成功');
              isLibrariesLoaded = true;
              return true;
            }
          } catch (error) {
            console.warn('CDN源', i + 1, '加载失败:', error.message);
            if (i === cdnSources.length - 1) {
              console.error('所有CDN源都加载失败，显示文本模式');
              showFallback();
              return false;
            }
          }
        }

        return false;
      } catch (error) {
        console.error('加载docx-preview库失败:', error);
        isLibrariesLoaded = false;
        throw error;
      }
    }

    // 消息处理
    document.addEventListener('message', async (e) => {
      try {
        const data = JSON.parse(e.data || '{}');
        console.log('收到消息:', data.type);

        if (data.type === 'load' && data.base64) {
          try {
            showLoading('正在解析Word文档...');

            // 确保库已加载
            if (!isLibrariesLoaded) {
              await loadDocxPreviewLibraries();
            }

            if (!window.docx || !window.JSZip) {
              throw new Error('必需的库未加载完成');
            }

            console.log('开始渲染Word文档...');
            showLoading('正在解析文档结构...', '正在处理Word文档内容');

            // 安全的base64解码
            function safeAtob(base64) {
              try {
                return atob(base64);
              } catch (err) {
                console.error('Base64解码错误:', err);
                // 尝试清理base64字符串
                const cleaned = base64.replace(/[^A-Za-z0-9+/=]/g, '');
                if (cleaned.length % 4 !== 0) {
                  // 补齐padding
                  const padding = 4 - (cleaned.length % 4);
                  return atob(cleaned + '='.repeat(padding));
                }
                return atob(cleaned);
              }
            }

            const buf = Uint8Array.from(safeAtob(data.base64), c => c.charCodeAt(0));
            const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

            // 渲染文档
            showLoading('正在渲染HTML内容...', '正在生成可编辑的文档视图');
            const container = document.getElementById('docx');
            container.innerHTML = '';

            // 使用docx-preview渲染
            await window.docx.renderAsync(blob, container, container, {
              inWrapper: true,
              ignoreWidth: false,
              ignoreHeight: false,
              ignoreFonts: false,
              breakPages: true,
              ignoreLastRenderedPageBreak: true,
              experimental: true,
              className: 'docx',
              trimXmlDeclaration: true
            });

            // 显示渲染结果
            document.getElementById('loading').style.display = 'none';
            document.getElementById('error').style.display = 'none';
            document.getElementById('fallback').style.display = 'none';
            container.style.display = 'block';

            // 启用编辑功能
            container.contentEditable = 'true';
            container.style.outline = 'none';

            // 添加编辑样式
            container.addEventListener('focus', () => {
              container.style.border = '1px dashed #1976d2';
            });

            container.addEventListener('blur', () => {
              container.style.border = 'none';
            });

            console.log('Word文档渲染成功');
            // 通知React Native文档加载完成，隐藏LoadingIndicator
            window.postMessage(JSON.stringify({
              type: 'ready',
              pages: 1,
              message: 'Word文档加载成功'
            }), '*');

          } catch (err) {
            console.error('Word文档渲染失败:', err);

            const errorMsg = String(err);
            let detailedError = '文档渲染失败';

            // 详细错误分析
            if (errorMsg.includes('JSZip') || errorMsg.includes('loadAsync')) {
              detailedError = 'JSZip库加载失败，无法解析Word文档压缩包';
            } else if (errorMsg.includes('renderAsync')) {
              detailedError = 'Word文档渲染引擎失败，可能是文档格式不兼容';
            } else if (errorMsg.includes('atob') || errorMsg.includes('base64')) {
              detailedError = 'Base64解码失败，文档数据可能已损坏';
            } else if (errorMsg.includes('Blob')) {
              detailedError = '文档数据转换失败';
            } else if (errorMsg.includes('必需的库未加载')) {
              detailedError = '依赖库加载失败，请检查网络连接';
            }

            showError(detailedError + '：' + errorMsg, loadAttempts < maxLoadAttempts);
          }

        } else if (data.type === 'getHtml') {
          const docxContainer = document.getElementById('docx');
          const content = docxContainer.style.display !== 'none' ? docxContainer.innerHTML : '';
          window.postMessage(JSON.stringify({
            type: 'html',
            html: content
          }), '*');

        } else if (data.type === 'setTextContent' && data.content) {
          // 设置fallback文本内容
          const textContent = document.getElementById('text-content');
          if (textContent) {
            textContent.innerHTML = data.content.replace(/\n/g, '<br>');
          }

        } else if (data.type === 'getTextContent') {
          // 获取编辑后的文本内容
          const textContent = document.getElementById('text-content');
          if (textContent) {
            const content = textContent.innerHTML.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '');
            window.postMessage(JSON.stringify({
              type: 'textContent',
              content: content
            }), '*');
          }
        }

      } catch (parseErr) {
        console.error('消息解析错误:', parseErr);
        showError('消息解析失败: ' + String(parseErr), false);
      }
    });

    // 页面加载完成后初始化
    document.addEventListener('DOMContentLoaded', () => {
      console.log('DocxWebView DOM加载完成');
      // 预加载库
      loadDocxPreviewLibraries().catch(err => {
        console.warn('预加载库失败:', err);
      });
    });

    // 如果DOM已经加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        loadDocxPreviewLibraries().catch(err => {
          console.warn('预加载库失败:', err);
        });
      });
    } else {
      loadDocxPreviewLibraries().catch(err => {
        console.warn('预加载库失败:', err);
      });
    }
  </script>
</body>
</html>`, []);

  useEffect(() => {
    if (base64Docx && webRef.current) {
      console.log('DocxWebView: 准备发送Word文档数据, base64长度:', base64Docx.length);

      // 延迟发送，确保WebView完全初始化
      const timer = setTimeout(() => {
        try {
          if (webRef.current) {
            console.log('DocxWebView: 发送load消息到WebView');
            webRef.current.postMessage(JSON.stringify({
              type: 'load',
              base64: base64Docx,
              timestamp: Date.now()
            }));
          } else {
            console.warn('DocxWebView: webRef.current为null，无法发送消息');
          }
        } catch (err) {
          console.error('DocxWebView: 发送消息失败:', err);
        }
      }, 800); // 增加延迟确保WebView完全加载

      return () => clearTimeout(timer);
    }
  }, [base64Docx]);

  return (
    <View style={[styles.wrap, style]}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={false}
        bounces={false}
        scrollEnabled={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={true}
        onLoadStart={() => {
          console.log('DocxWebView: WebView开始加载');
        }}
        onLoadEnd={() => {
          console.log('DocxWebView: WebView加载完成');
          // WebView加载完成后，如果有base64数据就发送
          if (webRef.current && base64Docx) {
            setTimeout(() => {
              try {
                console.log('DocxWebView: WebView加载完成后发送数据');
                webRef.current.postMessage(JSON.stringify({
                  type: 'load',
                  base64: base64Docx,
                  timestamp: Date.now()
                }));
              } catch (err) {
                console.error('DocxWebView: WebView加载完成后发送消息失败:', err);
              }
            }, 500);
          }
        }}
        onError={(e) => {
          console.error('DocxWebView: WebView加载错误:', e.nativeEvent);
        }}
        onHttpError={(e) => {
          console.error('DocxWebView: WebView HTTP错误:', e.nativeEvent);
        }}
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data || '{}');
            console.log('DocxWebView: 收到WebView消息:', msg.type);

            switch (msg.type) {
              case 'ready':
                console.log('DocxWebView: Word文档渲染完成');
                if (onReady) onReady(msg.message);
                break;

              case 'error':
                console.error('DocxWebView: 内部错误:', msg.message);
                if (msg.canRetry) {
                  console.log('DocxWebView: 错误可重试');
                }
                break;

              case 'requestTextContent':
                console.log('DocxWebView: 请求文本内容');
                // 这里可以尝试提取文档的纯文本内容
                // 暂时发送占位内容
                if (webRef.current) {
                  webRef.current.postMessage(JSON.stringify({
                    type: 'setTextContent',
                    content: '正在提取Word文档的文本内容...\n\n由于网络问题无法完整显示Word文档格式，但您可以在此进行文本编辑。'
                  }));
                }
                break;

              case 'textContent':
                console.log('DocxWebView: 收到编辑后的文本内容');
                // 可以在这里处理编辑后的文本内容
                break;

              default:
                console.log('DocxWebView: 未知消息类型:', msg.type);
            }
          } catch (err) {
            console.error('DocxWebView: 消息解析错误:', err);
          }
        }}
        onContentProcessDidTerminate={() => {
          console.warn('DocxWebView: WebView进程终止，尝试重新加载');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { flex: 1, backgroundColor: '#f6f7f9' } });

