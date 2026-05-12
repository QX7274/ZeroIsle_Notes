const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const WEB_ROOT = path.join(ROOT, 'web');
const PORT = Number(process.env.ZEROISLE_LOCAL_WEB_PORT || 8081);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const DIAGNOSTIC_PAGE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ZeroIsle 本地共享链联调页</title>
  <style>
    :root {
      --bg: #f3f8f8;
      --card: #ffffff;
      --line: #d9e6e8;
      --ink: #102a43;
      --muted: #5c6f7b;
      --accent: #0f766e;
      --accent-soft: #d7f3ee;
      --warn: #c2410c;
      --danger: #dc2626;
      --ok: #166534;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif;
      background:
        radial-gradient(circle at top right, rgba(15,118,110,0.12), transparent 28%),
        linear-gradient(180deg, #f7fbfb 0%, var(--bg) 100%);
      color: var(--ink);
    }
    .wrap {
      max-width: 1120px;
      margin: 0 auto;
      padding: 32px 20px 56px;
    }
    .hero {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 24px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 24px;
      box-shadow: 0 20px 60px rgba(16,42,67,0.06);
    }
    h1 {
      margin: 0 0 12px;
      font-size: 34px;
      line-height: 1.15;
    }
    h2 {
      margin: 0 0 12px;
      font-size: 20px;
    }
    p {
      margin: 0;
      color: var(--muted);
      line-height: 1.75;
    }
    .pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }
    .pill {
      padding: 8px 12px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--ink);
      font-size: 13px;
      font-weight: 700;
    }
    .pill.warn {
      background: #fef3c7;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px;
    }
    .stack {
      display: grid;
      gap: 20px;
    }
    .field-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      margin-top: 18px;
    }
    label {
      display: grid;
      gap: 6px;
      font-size: 13px;
      color: var(--muted);
    }
    input, textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 12px 14px;
      font: inherit;
      color: var(--ink);
      background: #fbfefe;
    }
    textarea {
      min-height: 140px;
      resize: vertical;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 16px;
    }
    button, .ghost-link {
      appearance: none;
      border: none;
      border-radius: 14px;
      padding: 12px 16px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
    }
    button.primary {
      background: var(--accent);
      color: #fff;
    }
    button.secondary, .ghost-link {
      background: #eef6f6;
      color: var(--ink);
      border: 1px solid var(--line);
    }
    .kv {
      display: grid;
      gap: 10px;
      margin-top: 16px;
    }
    .kv-item {
      padding: 12px 14px;
      border-radius: 16px;
      background: #f8fcfc;
      border: 1px solid #e6f0f1;
    }
    .kv-item strong {
      display: block;
      margin-bottom: 4px;
      font-size: 13px;
    }
    .kv-item span {
      color: var(--muted);
      line-height: 1.6;
      word-break: break-all;
    }
    .timeline {
      display: grid;
      gap: 10px;
      margin-top: 18px;
    }
    .timeline-item {
      display: grid;
      grid-template-columns: 88px 1fr;
      gap: 12px;
      align-items: start;
      padding-top: 10px;
      border-top: 1px solid #edf3f4;
    }
    .timeline-item:first-child {
      border-top: none;
      padding-top: 0;
    }
    .time {
      font-size: 12px;
      color: #8ea0aa;
      padding-top: 2px;
    }
    .event-title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .event-detail {
      color: var(--muted);
      line-height: 1.6;
      font-size: 13px;
      word-break: break-word;
    }
    .status {
      margin-top: 16px;
      padding: 14px 16px;
      border-radius: 16px;
      background: #eff8f7;
      color: var(--ok);
      border: 1px solid #cfe8e3;
      line-height: 1.7;
    }
    .status.error {
      background: #fef2f2;
      color: var(--danger);
      border-color: #fecaca;
    }
    code {
      background: #eef6f6;
      border-radius: 8px;
      padding: 2px 6px;
      font-family: Consolas, monospace;
      font-size: 12px;
    }
    @media (max-width: 960px) {
      .hero, .grid, .field-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <div class="card">
        <h1>共享链本地联调页</h1>
        <p>这不是 React Native Web 主应用替代品，而是为批次05补的本地双端联调壳。当前目标是先把 <code>localhost:8081</code> 收成一个稳定可打开、可复制证据、可辅助排障的入口，减少 WebRTC 共享链后续真机验证前的反复试错。</p>
        <div class="pill-row">
          <span class="pill">本地入口已闭环</span>
          <span class="pill">共享链证据优先</span>
          <span class="pill warn">不等同于真机验证完成</span>
        </div>
      </div>
      <div class="card">
        <h2>当前定位</h2>
        <div class="kv">
          <div class="kv-item"><strong>服务地址</strong><span id="kv-origin"></span></div>
          <div class="kv-item"><strong>建议用途</strong><span>浏览器或 Electron 打开本页，记录共享会话、房间号、后端 API、信令地址和复现步骤。</span></div>
          <div class="kv-item"><strong>当前限制</strong><span>本页不直接持有 App 内登录态，也不替代 Android 专用 MCP 真机可视化验证。</span></div>
        </div>
      </div>
    </section>

    <section class="grid">
      <div class="card">
        <h2>联调配置</h2>
        <p>把当前共享页、后端、信令和观察结果统一汇总到一个地方，便于复制进总控文档或转给协作智能体。</p>
        <div class="field-grid">
          <label>群组 ID
            <input id="groupId" placeholder="例如：group-001" />
          </label>
          <label>共享会话 ID
            <input id="shareId" placeholder="例如：6657f..." />
          </label>
          <label>WebRTC 房间
            <input id="roomId" placeholder="例如：screen_a1b2c3d4" />
          </label>
          <label>当前角色
            <input id="role" placeholder="共享端 / 观看端 / 观察者" value="观看端" />
          </label>
          <label>后端 API
            <input id="apiUrl" placeholder="例如：http://127.0.0.1:8000" value="http://127.0.0.1:8000" />
          </label>
          <label>信令地址
            <input id="wsUrl" placeholder="例如：ws://127.0.0.1:8000/ws/webrtc/..." />
          </label>
        </div>
        <label style="margin-top:14px;">当前现象 / 错误
          <textarea id="detail" placeholder="例如：已显示连接成功，但超过12秒仍未收到远端画面。"></textarea>
        </label>
        <div class="actions">
          <button class="primary" id="copySummary">复制联调摘要</button>
          <button class="secondary" id="recordEvent">记录一条时间线事件</button>
          <a class="ghost-link" href="/index.html" target="_blank" rel="noreferrer">打开静态官网页</a>
        </div>
        <div class="status" id="statusBox">当前本地入口已可用。下一步建议：先启动 <code>yarn local:web</code>，再让 Electron 或浏览器访问本页。</div>
      </div>

      <div class="stack">
        <div class="card">
          <h2>摘要预览</h2>
          <div class="kv">
            <div class="kv-item"><strong>本地启动命令</strong><span><code>yarn local:web</code></span></div>
            <div class="kv-item"><strong>Android 主链</strong><span><code>yarn android</code> + <code>adb reverse tcp:8081 tcp:8081</code></span></div>
            <div class="kv-item"><strong>说明</strong><span>本页只解决“本地双端联调入口缺失”的问题，不替代 Android 真机插件验证。</span></div>
          </div>
          <label style="margin-top:16px;">联调摘要文本
            <textarea id="summaryPreview" readonly></textarea>
          </label>
        </div>

        <div class="card">
          <h2>最近关键事件</h2>
          <p>建议把“进入共享页”“加入观看”“显示连接成功”“超时未出流”等关键节点逐条记录，便于与 App 内联调摘要互相对照。</p>
          <div class="timeline" id="timeline"></div>
        </div>
      </div>
    </section>
  </div>

  <script>
    const state = {
      events: [],
    };

    const elements = {
      groupId: document.getElementById('groupId'),
      shareId: document.getElementById('shareId'),
      roomId: document.getElementById('roomId'),
      role: document.getElementById('role'),
      apiUrl: document.getElementById('apiUrl'),
      wsUrl: document.getElementById('wsUrl'),
      detail: document.getElementById('detail'),
      summaryPreview: document.getElementById('summaryPreview'),
      timeline: document.getElementById('timeline'),
      statusBox: document.getElementById('statusBox'),
      kvOrigin: document.getElementById('kv-origin'),
      copySummary: document.getElementById('copySummary'),
      recordEvent: document.getElementById('recordEvent'),
    };

    elements.kvOrigin.textContent = window.location.origin;

    function nowLabel() {
      return new Date().toLocaleTimeString('zh-CN', { hour12: false });
    }

    function buildSummary() {
      const lines = [
        '【ZeroIsle 本地共享链联调摘要】',
        '生成时间：' + new Date().toLocaleString('zh-CN', { hour12: false }),
        '页面入口：' + window.location.href,
        '群组 ID：' + (elements.groupId.value || '未填写'),
        '共享会话 ID：' + (elements.shareId.value || '未填写'),
        'WebRTC 房间：' + (elements.roomId.value || '未填写'),
        '当前角色：' + (elements.role.value || '未填写'),
        '后端 API：' + (elements.apiUrl.value || '未填写'),
        '信令地址：' + (elements.wsUrl.value || '未填写'),
        '当前现象：' + (elements.detail.value || '未填写'),
        '',
        '最近关键事件：',
        ...(state.events.length > 0
          ? state.events.map((event) => '- [' + event.time + '] ' + event.title + (event.detail ? '：' + event.detail : ''))
          : ['- 暂无事件记录']),
        '',
        '备注：该摘要仅用于本地双端联调排障，不等同于 Android 专用 MCP 真机验证完成。',
      ];

      return lines.join('\\n');
    }

    function refreshSummary() {
      elements.summaryPreview.value = buildSummary();
    }

    function renderTimeline() {
      if (!state.events.length) {
        elements.timeline.innerHTML = '<div class="event-detail">当前还没有事件记录。</div>';
        return;
      }

      elements.timeline.innerHTML = state.events.map((event) => (
        '<div class="timeline-item">' +
          '<div class="time">' + event.time + '</div>' +
          '<div>' +
            '<div class="event-title">' + event.title + '</div>' +
            '<div class="event-detail">' + (event.detail || '无补充说明') + '</div>' +
          '</div>' +
        '</div>'
      )).join('');
    }

    function setStatus(message, isError) {
      elements.statusBox.className = isError ? 'status error' : 'status';
      elements.statusBox.innerHTML = message;
    }

    function addEvent(title, detail) {
      state.events.unshift({ time: nowLabel(), title, detail });
      state.events = state.events.slice(0, 12);
      renderTimeline();
      refreshSummary();
    }

    ['groupId', 'shareId', 'roomId', 'role', 'apiUrl', 'wsUrl', 'detail'].forEach((key) => {
      elements[key].addEventListener('input', refreshSummary);
    });

    elements.copySummary.addEventListener('click', async () => {
      refreshSummary();
      try {
        await navigator.clipboard.writeText(elements.summaryPreview.value);
        addEvent('复制联调摘要', '已复制当前本地联调摘要，可直接回填总控文档或发给协作智能体');
        setStatus('联调摘要已复制到剪贴板。该摘要可直接作为本地双端联调证据的一部分，但仍不能替代真机可视化验证。', false);
      } catch (error) {
        setStatus('复制失败：' + (error && error.message ? error.message : '当前浏览器未授予剪贴板权限'), true);
      }
    });

    elements.recordEvent.addEventListener('click', () => {
      const title = window.prompt('请输入事件标题', '手动记录');
      if (!title) {
        return;
      }
      const detail = window.prompt('请输入事件详情', '');
      addEvent(title, detail || '');
      setStatus('已追加一条关键事件。建议同步把 App 内联调摘要与本页事件时间线对应起来。', false);
    });

    addEvent('本地联调页已启动', 'localhost:8081 已有可访问入口，可用于浏览器或 Electron 承载共享链排障信息');
    refreshSummary();
    renderTimeline();
  </script>
</body>
</html>
`;

function safeResolve(filePath) {
  const resolved = path.resolve(WEB_ROOT, filePath);
  if (!resolved.startsWith(WEB_ROOT)) {
    return null;
  }
  return resolved;
}

function sendFile(res, targetPath) {
  const ext = path.extname(targetPath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
  fs.readFile(targetPath, (error, buffer) => {
    if (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(error.code === 'ENOENT' ? '未找到本地资源' : '读取本地资源失败');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
    res.end(buffer);
  });
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname === '/' || pathname === '/shared-screen-lab' || pathname === '/shared-screen-lab/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(DIAGNOSTIC_PAGE);
    return;
  }

  const normalized = pathname === '/' ? '/index.html' : pathname;
  const targetPath = safeResolve(normalized.replace(/^\/+/, ''));
  if (!targetPath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('禁止访问工作区外路径');
    return;
  }

  sendFile(res, targetPath);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[local-web] 已启动本地联调入口: http://127.0.0.1:${PORT}/shared-screen-lab/`);
  console.log('[local-web] 静态官网仍可通过 /index.html 访问。');
});

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.error(`[local-web] 端口 ${PORT} 已被占用，请先释放当前占用服务，或通过 ZEROISLE_LOCAL_WEB_PORT 指定其他端口。`);
    process.exit(1);
    return;
  }

  console.error('[local-web] 启动失败：', error);
  process.exit(1);
});
