# round354 社区详情认证恢复与空头像告警收口

## 1. 本轮目标
- 延续 `round353` 之后的社区真机验收，优先拆清以下两个真实阻塞：
  - 进入帖子详情时为何仍会命中 `401` 并出现“登录已过期”
  - 社区页面与帖子详情中 `source.uri should not be an empty string` 为何持续污染真机现场
- 在不误动成熟页面的前提下，继续保持以下既定规范：
  - 顶部安全区不能被平板系统状态栏遮挡
  - 返回按钮继续统一使用已有淡蓝色方形箭头
  - 网络异常继续使用项目内统一样式弹窗，不允许回退到默认安卓弹窗
  - 只改明显原始或影响验收的页面承接层，不破坏成熟模块
  - 页面留白继续保持合理，不出现大屏下明显生硬白区

## 2. 本轮代码改动

### 2.1 开发态真实认证恢复能力抽离为独立服务
- 新增文件：
  - `src/services/auth/devSessionRestore.js`
- 处理：
  - 把开发联调模式下的“真实验证码登录恢复”逻辑从 `authSlice` 中抽离
  - 统一提供 `tryRestoreDevSession()` 给社区深层页与 Redux 鉴权恢复复用
- 目的：
  - 避免只有首页初始化时才会尝试恢复真实 token
  - 让帖子详情等受鉴权深层页在进入前也能主动补回真实登录态

### 2.2 Redux 认证恢复改为复用统一服务
- 文件：
  - `src/redux/slices/authSlice.js`
- 处理：
  - 删除内嵌的 `tryRestoreRealDevSession`
  - 改为调用 `src/services/auth/devSessionRestore.js`
- 目的：
  - 减少认证恢复逻辑分叉
  - 保证首页初始化与社区深层页的恢复口径一致

### 2.3 社区主页进入帖子详情前补认证恢复
- 文件：
  - `src/screens/community/CommunityScreen.js`
- 处理：
  - 新增 `ensureAuthenticatedForDetail()`
  - 在点击社区帖子卡片进入 `PostDetail` 前，若当前未认证则先尝试恢复真实开发态会话
  - 若仍无法恢复，则诚实弹出项目内说明弹层，而不是直接冲到后端 `401`
  - 将帖子作者头像改为“有 URI 才渲染 `Image`，否则渲染占位 `View`”
  - 调整 `pageState` 判定：当已有帖子内容时，不再因为其他异步错误把列表页整体误判成 `error`
- 目的：
  - 缩短“社区列表可见，但详情接口仍匿名”的窗口
  - 避免社区已有内容时被详情/评论错误反向污染成整页 `error`
  - 去掉社区帖子卡片的空头像 URI 警告

### 2.4 帖子详情页请求前与401后双重补认证恢复
- 文件：
  - `src/screens/community/PostDetailScreen.js`
- 处理：
  - 在 `loadPostData()` 前先检查并尝试恢复真实登录态
  - 若首次请求仍返回“登录状态已失效”，则二次恢复会话后立即重试详情与评论请求
  - 作者头像与评论头像改为“空 URI 不渲染 `Image`，改用占位 `View`”
- 目的：
  - 收口社区深层页真实鉴权恢复时机
  - 降低进入帖子详情时直接命中 `401` 的概率
  - 去掉帖子详情与评论区的空头像 URI 告警

## 3. 本轮现场验证

### 3.1 后端与平板联通仍然正常
- 设备：
  - `HGR3Y9MA`
- 联通基线：
  - `adb devices` 识别正常
  - `adb reverse --list`
    - `tcp:8001 tcp:8001`
    - `tcp:8081 tcp:8081`
  - `curl http://127.0.0.1:8001/health/`
    - 返回 `200`
- 后端进程：
  - `PID 8440`
  - Python：
    - `D:\APP\Anaconda\envs\Zeroisle\python.exe`
- 结论：
  - 本轮问题不属于“平板和电脑后端没通”

### 3.2 社区主页现场仍可恢复到真实内容态
- 证据：
  - `.local/android-mcp-server/round354_precheck.png`
  - `.local/android-mcp-server/round354_precheck.xml`
- 现场结论：
  - 社区主页能够稳定看到真实帖子内容
  - 顶部安全区仍正常，没有被系统状态栏遮挡
  - 统一淡蓝色方形返回按钮规范本轮未回退

### 3.3 本轮再次抓到帖子详情真实401根因
- 触发路径：
  - 社区主页 -> 点击首条帖子
- 日志关键信息：
  - `未认证请求URL: '/community/posts/<id>/'`
  - `收到401未授权响应`
  - `error: '登录已过期'`
- 结论：
  - 当前主阻塞已经从“comments/by_post 仍是500”转移为：
    - 进入帖子详情时真实 token 恢复不稳定
    - 导致详情接口先进入匿名态请求

### 3.4 空头像 URI 警告已定位到社区头像渲染
- 现场旧提示：
  - `source.uri should not be an empty string`
- 本轮修复点：
  - 社区列表作者头像
  - 帖子详情作者头像
  - 评论头像
- 结论：
  - 这类开发态底部警告已被纳入本轮代码收口范围

## 4. 本轮新增阻塞与后续化解

### 4.1 Metro 调试服务异常曾短暂阻断真机深层回归
- 现场表现：
  - 平板一度停在 `Loading from localhost:8081...`
  - 后续恢复到首页后，底部出现：
    - `Cannot connect to Metro...`
    - `认证检查失败: Error: 认证状态检查超时`
- 中途排查结论：
  - 电脑本机最初出现过 `8081` 端口有 `node` 进程监听，但 Android bundle 长时间无响应的状态
  - 这不是产品内“网络错误弹窗样式退化”，也不是电脑与平板后端不通
- 后续恢复结果：
  - `http://127.0.0.1:8081/status` 已恢复 `200`
  - `http://127.0.0.1:8081/index.bundle?...` 已恢复正常返回 bundle 内容
  - 平板后续真机回归得以继续推进
- 证据：
  - `.local/android-mcp-server/round354_after_restart.png`
  - `.local/android-mcp-server/round354_after_restart.xml`
  - `.local/android-mcp-server/round354_metro_wait.png`
  - `.local/android-mcp-server/round354_metro_wait.xml`
- 结论：
  - Metro 异常是本轮中途出现过的外层阻塞
  - 但已在本轮内恢复，不再是 round354 的最终未解项

### 4.2 真正的深层阻塞转移为评论接口 Mongo 查询不兼容
- 新抓到的接口级证据：
  - 真实登录态下请求：
    - `GET /api/v1/community/comments/by_post/?post_id=a5edc2dd-3d6a-4bfb-b886-c6dbcb770ab2`
  - 先后命中过两层后端异常：
    - `InvalidQueryError: Cannot perform join in mongoDB: parent__isnull`
    - `InvalidQueryError: Cannot resolve field "post_id"`
- 根因：
  - `backend/community/views/comment.py`
  - `backend/community/services/comment_service.py`
  - 仍残留 Django ORM 风格/MongoEngine 不兼容写法：
    - `parent__isnull=True`
    - `post_id=...`
    - `parent_id=...`
- 修复：
  - 顶级评论查询改为 `parent=None`
  - 评论按帖子过滤改为真实 `ReferenceField` 口径：
    - `post=post`
    - `parent=...`
  - 同时保留开发态真实认证恢复逻辑，避免再次被匿名态误导成 401
- 修复后接口结果：
  - 带真实登录态再次请求 `comments/by_post`
    - 返回 `200`
    - 返回体：`{"count":0,"next":null,"previous":null,"current_page":1,"total_pages":1,"results":[]}`
- 结论：
  - round354 真正的后端主阻塞不是“没网”
  - 而是评论接口 Mongo 查询写法与实际模型字段不兼容
  - 现已在本轮完成修复并通过接口层复验

## 5. 本轮真实完成项
- 已完成：
  - 抽离并统一开发态真实认证恢复服务
  - 社区主页进入帖子详情前补认证恢复
  - 帖子详情请求前与401后二次补认证恢复
  - 社区列表、详情页、评论区空头像 URI 告警代码收口
  - 社区已有内容时不再轻易被异步错误整体打回 `pageState.error`
  - 评论接口 `comments/by_post` 的 Mongo 查询兼容性修复
  - Zeroisle 后端 `8001` 服务重启并恢复健康检查
  - 帖子详情真机前台已恢复到“详情可见 + 评论(0) 空态 + 无统一网络弹窗占位”
- 已确认前台闭环：
  - 社区详情401真实根因已被前置认证恢复守卫收口
  - 评论接口500真实根因已被后端修复并经接口层复验
  - Metro 异常已在本轮内恢复，不再阻断后续真机回归

## 6. 本轮仍未完全闭环的项
- `community-return-from-post-detail-state-retention`
  - 状态：`IN_PROGRESS`
  - 原因：
    - 本轮已确认“进入详情 -> 评论区空态”可以稳定展示
    - 但还没有补到“从帖子详情返回社区后继续保持 ready”的最终新证据

- `community-post-detail-comment-empty-state-live-proof`
  - 状态：`PASS`
  - 说明：
    - 真机最终证据 `.local/android-mcp-server/round354_post_detail_final.png/.xml`
    - 已确认帖子详情页无统一网络弹窗占位，评论区以 `评论 (0)` 空态稳定展示

## 7. 下一轮最清晰顺序
1. 真机重新进入社区主页，复测：
   - 社区 -> 帖子详情
   - 帖子详情 -> 评论区
   - 帖子详情返回社区
2. 重点补齐：
   - 返回社区后是否仍保持 `state.community.pageState.ready`
3. 若社区返回后仍掉回 `error`：
   - 继续检查社区列表状态回写来源
   - 排查详情页离焦/清理动作是否污染主页状态
4. 若后端后续出现真实评论数据：
   - 继续补 `评论内容态`、`评论点赞`、`发表评论` 的真机链路
5. 继续更新矩阵与总控后推进下一轮提交推送
