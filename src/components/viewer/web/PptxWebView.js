import React, { useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// 在 WebView 内使用 JSZip + fast-xml-parser 基本解析 pptx，提供分页导航
// props: { base64Pptx, onMeta({ totalSlides }), onPage(current), onError }
const Inner = ({ base64Pptx, onMeta, onPage, onError, style }, ref) => {
  const webRef = useRef(null);
  useImperativeHandle(ref, () => ({
    goto: (index) => {
      if (webRef.current) webRef.current.postMessage(JSON.stringify({ type:'goto', index }));
    }
  }));

  const html = useMemo(() => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/fast-xml-parser@4.3.2/dist/fxparser.min.js"></script>
  <style>
    html,body{margin:0;padding:0;background:#fff;}
    #slide{padding:12px; font-family: -apple-system, Roboto, sans-serif;}
    .shape{margin:6px 0;}
    .title{font-weight:600; font-size:18px}
  </style>
</head>
<body>
  <div id="slide">加载中...</div>
  <script>
    let zip, total=1, current=1;
    const parseText = async (xml) => {
      const parser = new XMLParser({ ignoreAttributes:false });
      const obj = parser.parse(xml);
      const runs = [];
      const pList = obj['p:sld']?.['p:cSld']?.['p:spTree']?.['p:sp'] || [];
      const arr = Array.isArray(pList)? pList : [pList];
      arr.forEach(sp => {
        const txBody = sp?.['p:txBody'];
        const paras = txBody?.['a:p'];
        const list = Array.isArray(paras)? paras : (paras? [paras] : []);
        list.forEach(p => {
          const r = p?.['a:r'];
          const rs = Array.isArray(r)? r : (r? [r]: []);
          const line = rs.map(x=> x?.['a:t'] || '').join('');
          if (line) runs.push(line);
        });
      });
      return runs;
    };

    const render = async () => {
      if (!zip) return;
      const div = document.getElementById('slide');
      const file = await zip.file('ppt/slides/slide' + current + '.xml').async('string');
      const lines = await parseText(file);
      div.innerHTML = '';
      lines.forEach((t,i)=>{ const el=document.createElement('div'); el.className='shape'; el.textContent=t; if(i===0) el.className+=' title'; div.appendChild(el); });
      if (lines.length===0) { div.innerHTML='<div>空白幻灯片（当前为简易渲染）</div>'; }
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type:'page', current }));
    };

    // 添加重试加载 JSZip 的函数
    const loadJSZipIfNeeded = () => {
      return new Promise((resolve, reject) => {
        if (typeof JSZip !== 'undefined') {
          resolve();
          return;
        }
        
        // 尝试重新加载 JSZip
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('无法加载 JSZip 库，请检查网络连接'));
        document.head.appendChild(script);
      });
    };

    document.addEventListener('message', async (e) => {
      try {
        const data = JSON.parse(e.data || '{}');
        console.log('PptxWebView: 收到消息:', data.type);

        if (data.type === 'load' && data.base64) {
          try {
            console.log('PptxWebView: 开始处理PPT数据，base64长度:', data.base64.length);

            // 显示加载状态
            document.getElementById('slide').innerHTML = '<div style="text-align:center;padding:40px;color:#666;">正在解析PPT文档...</div>';

            // 设置超时机制
            const timeout = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('PPT解析超时(20秒)')), 20000)
            );

            // 确保JSZip已加载
            await Promise.race([loadJSZipIfNeeded(), timeout]);
            console.log('PptxWebView: JSZip库加载成功');

            // 解码base64数据 - 优化内存使用
            let buf;
            try {
              console.log('PptxWebView: 开始解码base64数据，长度:', data.base64.length);

              // 对于大文件，分块解码以减少内存压力
              if (data.base64.length > 50 * 1024 * 1024) { // 50MB
                console.log('PptxWebView: 大文件检测，使用分块解码');
                const chunkSize = 1024 * 1024; // 1MB chunks
                const chunks = [];

                for (let i = 0; i < data.base64.length; i += chunkSize) {
                  const chunk = data.base64.slice(i, i + chunkSize);
                  const decodedChunk = Uint8Array.from(atob(chunk), c => c.charCodeAt(0));
                  chunks.push(decodedChunk);

                  // 给浏览器一些时间处理
                  if (i % (chunkSize * 10) === 0) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                  }
                }

                // 合并所有块
                const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
                buf = new Uint8Array(totalLength);
                let offset = 0;
                for (const chunk of chunks) {
                  buf.set(chunk, offset);
                  offset += chunk.length;
                }

                console.log('PptxWebView: 分块解码完成，总长度:', buf.length);
              } else {
                // 小文件直接解码
                buf = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
                console.log('PptxWebView: base64解码成功，数据长度:', buf.length);
              }
            } catch (decodeError) {
              throw new Error('base64数据解码失败：' + decodeError.message);
            }

            if (typeof JSZip === 'undefined') {
              throw new Error('JSZip库未正确加载，请检查网络连接');
            }

            // 解析ZIP文件
            document.getElementById('slide').innerHTML = '<div style="text-align:center;padding:40px;color:#666;">正在解析PPT结构...</div>';

            zip = new JSZip();
            await Promise.race([zip.loadAsync(buf), timeout]);
            console.log('PptxWebView: ZIP文件解析成功');

            // 统计页数
            const files = Object.keys(zip.files).filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k));
            total = files.length || 1;
            current = 1;

            console.log('PptxWebView: PPT页数统计完成，总页数:', total);

            // 通知React Native组件
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'meta',
              total: total
            }));

            // 渲染第一页
            document.getElementById('slide').innerHTML = '<div style="text-align:center;padding:40px;color:#666;">正在渲染PPT内容...</div>';
            await Promise.race([render(), timeout]);

            console.log('PptxWebView: PPT渲染完成');

            // 通知加载完成
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'loaded',
              message: 'PPT加载成功'
            }));

          } catch (err) {
            console.error('PptxWebView: PPT处理错误:', err);

            const errorMsg = String(err);
            let detailedError = errorMsg;

            // 详细错误分析
            if (errorMsg.includes('JSZip') || errorMsg.includes('loadAsync')) {
              detailedError = 'PPT文件解析失败，可能是文件格式不正确或已损坏';
            } else if (errorMsg.includes('base64')) {
              detailedError = 'PPT数据解码失败，文件可能已损坏';
            } else if (errorMsg.includes('超时')) {
              detailedError = 'PPT文件过大或网络较慢，解析超时';
            } else if (errorMsg.includes('网络')) {
              detailedError = '网络连接问题，无法加载必要的库文件';
            }

            // 通知React Native
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              message: detailedError,
              errorType: 'PPT',
              originalError: errorMsg
            }));

            // 在页面上显示错误信息
            document.getElementById('slide').innerHTML =
              '<div style="color:#d32f2f;padding:20px;text-align:center;background:#ffebee;border-radius:8px;margin:20px;">' +
              '<h3>PPT文档加载失败</h3>' +
              '<p>' + detailedError + '</p>' +
              '<button onclick="location.reload()" style="background:#1976d2;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;margin-top:10px;">重试</button>' +
              '</div>';
          }
        } else if (data.type === 'goto') {
          const newPage = Math.min(total, Math.max(1, parseInt(data.index || 1)));
          if (newPage !== current) {
            current = newPage;
            console.log('PptxWebView: 切换到第', current, '页');
            await render();
          }
        }
      } catch (parseErr) {
        console.error('PptxWebView: 消息解析错误:', parseErr);
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error',
          message: '消息解析失败：' + String(parseErr)
        }));
      }
    });
  </script>
</body>
</html>`, []);

  useEffect(() => {
    if (webRef.current && base64Pptx) {
      console.log('Component mount/unmount:', { component: 'PptxWebView', state: 'postMessage(load)' });
      setTimeout(() => {
        webRef.current.postMessage(JSON.stringify({ type: 'load', base64: base64Pptx }));
      }, 50);
    }
  }, [base64Pptx]);

  return (
    <View style={[styles.wrap, style]}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        onLoadStart={() => console.log('WebView loading start (PptxWebView)')}
        onLoadEnd={() => console.log('WebView loading end (PptxWebView)')}
        onError={(e)=> console.log('WebView error (PptxWebView):', e.nativeEvent)}
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data||'{}');
            if (msg.type==='meta') {
              onMeta && onMeta({ totalSlides: msg.total });
              // 通知父组件加载完成
              setTimeout(() => {
                window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loaded' }));
              }, 100);
            }
            if (msg.type==='page') onPage && onPage(msg.current);
            if (msg.type==='error') onError && onError(msg.message);
          } catch (err) {
            console.log('PptxWebView onMessage parse error:', err);
          }
        }}
      />
    </View>
  );
};

const PptxWebView = forwardRef(Inner);
export default PptxWebView;

const styles = StyleSheet.create({ wrap: { flex: 1, backgroundColor: '#fff' } });

