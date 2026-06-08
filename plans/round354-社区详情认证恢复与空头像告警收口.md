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

## 8. round355 续补验证（2026-06-08）

### 8.1 真机返回社区状态保持已补到最终证据
- 复测路径：
  - `社区 -> 帖子详情 -> 点击统一淡蓝色方形返回按钮 -> 返回社区`
- 现场证据：
  - `.local/android-mcp-server/round355_current_state.png`
  - `.local/android-mcp-server/round355_current_state.xml`
  - `.local/android-mcp-server/round355_back_to_community.png`
  - `.local/android-mcp-server/round355_back_to_community.xml`
- 命中结果：
  - 返回前详情页仍稳定停留在：
    - `screen.community.postDetail`
    - `评论 (0)`
  - 返回后社区页明确命中：
    - `state.community.pageState.ready`
    - `社区`
    - 至少两条真实帖子卡片仍在列表中
    - `state.community.endOfList`
- 结论：
  - `community-return-from-post-detail-state-retention` 已从 `IN_PROGRESS` 收口为 `PASS`
  - 社区主页不再因为详情页返回或评论空态而被回写成整页 `error`

### 8.2 本次回退复核未发现规范回退
- 顶部规范：
  - 社区页返回后顶部标题、搜索栏、分类栏仍整体位于系统状态栏下方，没有被平板顶部状态栏遮挡
- 返回按钮规范：
  - 帖子详情页返回按钮继续使用已有淡蓝色方形箭头，没有出现样式漂移
- 网络异常规范：
  - 本次 `详情 -> 返回社区` 过程中没有再出现默认安卓弹窗
  - 也没有出现项目内统一网络错误弹窗错误抢占前台
- 留白与布局：
  - 社区主页回退后帖子列表仍保持正常承接，没有因为状态回退出现异常空白区或整页塌陷

### 8.3 round354 / round355 社区主链当前闭环状态
- 已完成：
  - `社区主页真实内容态`
  - `进入帖子详情前认证恢复`
  - `帖子详情请求前认证恢复`
  - `帖子详情401后二次认证恢复`
  - `评论接口 Mongo 查询兼容修复`
  - `帖子详情评论(0)空态真机闭环`
  - `帖子详情返回社区后继续保持 ready`
- 当前剩余后续项：
  - 若后端后续出现真实评论数据，再继续补：
    - `评论内容态`
    - `评论点赞`
    - `发表评论`

## 9. round356 续补验证（2026-06-08）

### 9.1 本轮真实目标
- 在 round355 已完成“社区主页内容态 -> 帖子详情评论空态 -> 返回社区 ready 保持”基础上，继续补齐评论真实交互链：
  - `发表评论`

## 10. round361 续补验证（2026-06-08）

### 10.1 本轮真实目标
- 不再把“社区卡片评论数正常、帖子详情评论为 0”模糊记成网络问题，而是继续把真因压到具体前端环节：
  - 详情页认证恢复是否错误复用了本地旧 token
  - 评论分页状态是否能在真机前台真正落地
  - `加载更多评论` 是否只是按钮出现，还是能把第二页真实追加进列表

### 10.2 本轮代码修复
- 文件：
  - `src/services/auth/devSessionRestore.js`
  - `src/screens/community/PostDetailScreen.js`
  - `src/services/auth/__tests__/devSessionRestore.test.js`
- 处理：
  - `tryRestoreDevSession(options)` 新增 `forceRefresh`
  - 当详情页首次请求命中 `登录状态已失效` 时，不再继续复用本地旧 token，而是强制跳过旧 token，重新走开发态真实直登
  - `PostDetailScreen` 改为使用 `authSlice` 已导出的正式 action：
    - `setIsAuthenticated`
    - `setUserInfo`
    - `setAuthToken`
    - `setAuthRefreshToken`
  - 新增 `applyRestoredSession()`，统一恢复后 Redux 写回口径
- 目的：
  - 避免“本地 token 看似存在，但后端已不认，前台却误以为恢复成功”的伪恢复
  - 保证帖子详情 401 后会拿全新 token 再请求详情和评论，而不是重复匿名/失效态打转

### 10.3 自动化回归
- 新增测试：
  - `src/services/auth/__tests__/devSessionRestore.test.js`
- 已通过：
  - `node .\\node_modules\\jest\\bin\\jest.js src/services/auth/__tests__/devSessionRestore.test.js --runInBand`
  - `node .\\node_modules\\jest\\bin\\jest.js src/services/auth/__tests__/tokenService.test.js --runInBand`
  - `node .\\node_modules\\jest\\bin\\jest.js src/redux/slices/__tests__/communitySlice.test.js --runInBand`
- 结论：
  - 本轮恢复策略改动没有打坏 token 基线与社区 slice 现有回归

### 10.4 真机最终证据
- 基线：
  - `adb reverse --list` 仍保持：
    - `tcp:8001 tcp:8001`
    - `tcp:8081 tcp:8081`
  - `http://127.0.0.1:8001/health/` 返回正常
  - `http://127.0.0.1:8081/status` 返回 `packager-status:running`
- 社区页证据：
  - `.local/android-mcp-server/round361b_community.xml`
  - `.local/android-mcp-server/round361b_community.png`
  - 命中：
    - `state.community.pageState.ready`
    - 目标帖子 `round330 联通发帖验证`
    - 卡片评论数仍为 `14`
- 详情页第一页证据：
  - `.local/android-mcp-server/round361b_postdetail.xml`
  - `.local/android-mcp-server/round361b_postdetail.png`
  - 命中：
    - `screen.community.postDetail`
    - `评论 (12)`
    - 详情统计中的评论数也同步为 `12`
    - 前台已不再回落为 `评论 (0)`
- 详情页滚动到底部证据：
  - `.local/android-mcp-server/round361b_postdetail_scrolled.xml`
  - `.local/android-mcp-server/round361b_postdetail_scrolled.png`
  - 命中：
    - `round361_comment_01`
    - `round361_comment_probe_c`
    - `round361_comment_probe`
    - `action.community.postDetail.loadMoreComments`
    - `加载更多评论`
- 点击“加载更多评论”后的证据：
  - `.local/android-mcp-server/round361b_postdetail_loadmore.xml`
  - `.local/android-mcp-server/round361b_postdetail_loadmore.png`
  - 命中：
    - 第二页历史评论继续追加到当前列表
    - `round356_comment_ok`
    - 其下真实回复 `回复 (3)` 继续可见
    - 没有出现“第二页覆盖第一页”的回退
- 日志证据：
  - `.local/android-mcp-server/round361b_postdetail.log`
  - `.local/android-mcp-server/round361b_postdetail_loadmore.log`
  - 命中：
    - `API响应成功: GET /community/posts/a5edc2dd-3d6a-4bfb-b886-c6dbcb770ab2/`
    - `API响应成功: GET /community/comments/by_post/?post_id=a5edc2dd-3d6a-4bfb-b886-c6dbcb770ab2`

### 10.5 本轮结论
- 这次已经确认：
  - 后端真实评论分页数据正常
  - 平板与电脑后端联通正常
  - 帖子详情评论为 `0` 的前序主因在前端认证恢复链，而不是“没网”
  - 强制刷新 token 后，帖子详情已能在真机前台稳定显示真实评论总数 `12`
  - “加载更多评论”已能把第二页真实追加进当前列表，而不是覆盖第一页
- 还需诚实保留的边界：
  - 帖子详情顶部统计评论数当前取的是评论分页总数 `12`，而社区卡片仍显示帖子总评论数 `14`
  - 这说明帖子总评论数与顶级评论分页总数仍是两个语义口径，后续若要完全统一展示，还需要结合回复数/后端口径再做产品级取舍

### 10.6 规范复核
- 顶部安全区：
  - 本轮社区页与帖子详情页顶部都继续位于平板系统状态栏下方，没有被遮挡
- 返回按钮：
  - 帖子详情页继续统一使用已有淡蓝色方形箭头，没有样式漂移
- 网络异常承接：
  - 本轮详情链与分页链都没有回退到默认安卓弹窗
  - 统一网络弹窗规范未回退
- 留白与布局：
  - 社区页、帖子详情页、评论列表和“加载更多评论”区块未出现新的异常生硬留白
  - 功能区承接保持合理，特别是详情页底部按钮区与输入区没有塌陷
  - `评论内容态`
  - `评论提交后前台刷新`
- 同时继续遵守既有上线规范：
  - 顶部安全区不能被平板状态栏遮挡
  - 返回按钮继续统一使用已有淡蓝色方形箭头
  - 网络错误继续只能走项目内统一样式弹窗
  - 不误动成熟页面，仅修正阻断评论链的真实缺陷

### 9.2 本轮新增定位到的真实根因
- 首次真机提交评论时，前台出现项目内统一网络错误弹窗：
  - `网络连接问题`
  - `服务器错误，请稍后重试`
- 这次已经确认不是“平板没网”也不是“按钮没有点上”：
  - React Native 前台日志明确指向：
    - `POST /community/comments/` 命中 `500`
  - 后端真实栈指向：
    - `backend/community/views/comment.py:123`
    - `backend/community/serializers/comment.py:73 get_post_title`
- 更精确根因：
  - 评论创建本身其实已经成功
  - 真正失败发生在“创建成功后回包序列化”阶段
  - `obj.post` 是 Mongo `ReferenceField` 引用出的 `Post` 文档对象
  - 旧代码又把这个对象当作 `id` 去执行：
    - `Post.objects.get(id=obj.post)`
  - 最终触发：
    - `InvalidDocument`
    - `cannot encode object: <Post ...>`

### 9.3 本轮代码修补
- 文件：
  - `backend/community/serializers/comment.py`
- 修补内容：
  - `get_reply_count`
    - 从 `parent=obj.id` 改为 `parent=obj`
  - `get_post_title`
    - 不再执行 `Post.objects.get(id=obj.post)`
    - 直接读取 `obj.post.title`
  - `get_parent_user`
    - 不再执行 `Comment.objects.get(id=obj.parent)`
    - 直接读取 `obj.parent.user`
  - `get_replies`
    - 从 `parent=obj.id` 改为 `parent=obj`
  - `validate`
    - 父评论归属校验改为对 `parent.post.id` 进行字符串比对
- 目的：
  - 把评论序列化链统一改回 MongoEngine `ReferenceField` 的真实使用方式
  - 避免再次把 Mongo 文档对象错当纯 id 传入查询

- 文件：
  - `backend/community/services/comment_service.py`
- 修补内容：
  - 两处评论通知创建由：
    - `content_object=comment`
  - 改为：
    - `content_type='Comment'`
    - `object_id=str(comment.id)`
- 目的：
  - 避免通知服务继续接收不符合签名的 Mongo 文档对象

- 文件：
  - `backend/community/services/post_service.py`
- 修补内容：
  - 发帖通知由：
    - `content_object=post`
  - 改为：
    - `content_type='Post'`
    - `object_id=str(post.id)`
- 目的：
  - 顺手修掉同类隐患，避免后续在帖子通知链再撞同型错误

- 文件：
  - `src/screens/community/PostDetailScreen.js`
- 修补内容：
  - `handleSubmitComment` 中：
    - 先 `dispatch(postComment(...)).unwrap()`
    - 成功后立即 `await dispatch(fetchComments({ postId, page: 1 })).unwrap()`
    - 最后 `setCommentText('')`
- 目的：
  - 评论提交成功后不只依赖前端本地 `unshift`
  - 统一以后端真实返回的评论列表重新回填前台，降低“发出去了但界面看不出来”的假失败

### 9.4 Zeroisle 后端重启与联通基线
- 后端重启方式：
  - `D:\anaconda\envs\ZeroIsle\python.exe -X utf8 manage.py runserver 0.0.0.0:8001 --noreload`
- 监听进程：
  - 旧进程 `PID 53012` 已结束
  - 新进程 `PID 57524` 已接管 `8001`
- 联通基线：
  - `adb devices` 正常识别平板 `HGR3Y9MA`
  - `adb reverse --list` 继续保持：
    - `tcp:8001 tcp:8001`
    - `tcp:8081 tcp:8081`
  - `http://127.0.0.1:8001/health/` 返回：
    - `{"status": "alive", ...}`
  - `http://127.0.0.1:8081/status` 返回：
    - `packager-status:running`
- 结论：
  - round356 的评论链复测是在修补后代码与真实联通环境都已恢复正常的前提下完成

### 9.5 真机最终复测结果
- 复测路径：
  - 社区真实内容态
  - 进入帖子 `round330 联通发帖验证`
  - 在帖子详情页评论输入框中输入：
    - `round356_comment_ok`
  - 点击发送按钮
  - 等待提交与评论列表刷新完成
- 关键证据：
  - `.local/android-mcp-server/round356_current_state.xml`
  - `.local/android-mcp-server/round356_current_state.png`
  - `.local/android-mcp-server/round356_comment_typed.xml`
  - `.local/android-mcp-server/round356_comment_typed.png`
  - `.local/android-mcp-server/round356_comment_submit_result.xml`
  - `.local/android-mcp-server/round356_comment_submit_result.png`
  - `.local/android-mcp-server/round356_comment_submit_wait8.xml`
  - `.local/android-mcp-server/round356_comment_submit_wait8.png`
- 真机结果：
  - 提交中阶段：
    - 发送按钮进入提交态
    - 没有再弹出项目内统一网络错误弹窗
  - 稳定完成阶段：
    - 评论标题从 `评论 (0)` 变为 `评论 (1)`
    - 新评论卡片已真实出现在列表中
    - 评论正文准确显示：
      - `round356_comment_ok`
    - 输入框已恢复占位：
      - `写下你的评论...`
    - 发送按钮重新回到禁用初始态
- 结论：
  - `发表评论` 已在真实平板前台完成闭环
  - `评论内容态` 已在真实平板前台完成闭环
  - `评论提交后评论列表刷新` 已在真实平板前台完成闭环

### 9.6 本轮后端日志最终结果
- round356 修补后真实后端结果：
  - `POST /api/v1/community/comments/ HTTP/1.1`
  - `201`
- 现场含义：
  - 本轮评论失败的真实根因已经从“创建后回包序列化 500”收口为“成功创建并成功返回 201”
  - 统一网络错误弹窗这次没有再被错误触发

### 9.7 社区评论链当前闭环状态
- 已完成：
  - `社区主页真实内容态`
  - `进入帖子详情前认证恢复`
  - `帖子详情请求前认证恢复`
  - `帖子详情401后二次认证恢复`
  - `评论接口 Mongo 查询兼容修复`
  - `帖子详情评论(0)空态真机闭环`
  - `帖子详情返回社区后继续保持 ready`
  - `发表评论真机闭环`
  - `评论内容态真机闭环`
  - `评论提交后前台刷新真机闭环`
- 当前仍待后续补齐：
  - 更多评论分页/多条评论顺序验证
  - 回复评论链路

## 10. round357 续补验证（2026-06-08）

### 10.1 本轮真实目标
- 在 round356 已完成：
  - `发表评论`
  - `评论内容态`
  - `提交后前台刷新`
- 的基础上，继续补齐评论互动链中的：
  - `评论点赞`
  - `评论取消点赞`

### 10.2 本轮复测前基线
- 设备：
  - `HGR3Y9MA`
- 联通状态：
  - `adb reverse --list` 继续保持 `8001/8081`
  - `http://127.0.0.1:8001/health/` 返回 `200`
  - 应用当前现场仍稳定停留在帖子详情页：
    - 帖子 `round330 联通发帖验证`
    - 评论区已有 `round356_comment_ok`
    - 顶部安全区正常
    - 返回按钮继续为统一淡蓝色方形箭头

### 10.3 round357 正向点赞真机结果
- 操作路径：
  - 在帖子详情页点击评论 `round356_comment_ok` 下方点赞按钮
- 关键证据：
  - `.local/android-mcp-server/round357_comment_like_after_tap.xml`
  - `.local/android-mcp-server/round357_comment_like_after_tap.png`
- 后端日志结果：
  - `POST /api/v1/community/comments/5c3a1787-d95d-45e5-984a-d5a047d6c3c4/like/`
  - `200`
- 真机前台结果：
  - 评论点赞图标从未点赞态切到已点赞态
  - 评论点赞数从 `0` 变为 `1`
  - 评论正文 `round356_comment_ok` 继续稳定可见
  - 没有出现默认安卓弹窗
  - 也没有出现项目内统一网络错误弹窗
- 结论：
  - `评论点赞` 已在真实平板前台完成闭环

### 10.4 round357 反向取消点赞真机结果
- 操作路径：
  - 在同一条评论上再次点击点赞按钮
- 关键证据：
  - `.local/android-mcp-server/round357_comment_unlike_after_tap.xml`
  - `.local/android-mcp-server/round357_comment_unlike_after_tap.png`
- 后端日志结果：
  - `POST /api/v1/community/comments/5c3a1787-d95d-45e5-984a-d5a047d6c3c4/like/`
  - `200`
- 真机前台结果：
  - 评论点赞图标从已点赞态回到未点赞态
  - 评论点赞数从 `1` 回到 `0`
  - 评论内容、顶部样式与底部输入区没有发生异常回退
  - 过程中没有错误弹窗抢占前台
- 结论：
  - `评论取消点赞` 已在真实平板前台完成闭环

### 10.5 本轮额外确认
- 评论点赞链不需要额外代码修复：
  - 后端回包已正确返回 `is_liked` 与 `like_count`
  - 前台 `PostDetailScreen` 与 `communitySlice` 当前已能正确把评论图标与数量同步到界面
- 本轮没有误动成熟 UI：
  - 帖子详情页顶部安全区保持正常
  - 返回按钮样式保持统一
  - 评论区布局没有新增异常留白

### 10.6 社区评论链当前闭环状态
- 已完成：
  - `社区主页真实内容态`
  - `进入帖子详情前认证恢复`
  - `帖子详情请求前认证恢复`
  - `帖子详情401后二次认证恢复`
  - `评论接口 Mongo 查询兼容修复`
  - `帖子详情评论(0)空态真机闭环`
  - `帖子详情返回社区后继续保持 ready`
  - `发表评论真机闭环`
  - `评论内容态真机闭环`
  - `评论提交后前台刷新真机闭环`
  - `评论点赞真机闭环`
  - `评论取消点赞真机闭环`
- 当前仍待后续补齐：
  - 更多评论分页/多条评论顺序验证
  - 回复评论链路

## 11. round358 续补验证（2026-06-08）

### 11.1 本轮真实目标
- 在 round357 已完成：
  - `评论点赞`
  - `评论取消点赞`
- 的基础上，继续补齐社区评论互动链中的：
  - `搜索帖子`
  - `回复评论`
  - `回复列表展示`
- 同时继续遵守既有上线规范：
  - 顶部安全区必须考虑平板系统状态栏，不能被遮挡
  - 返回按钮继续统一使用已有淡蓝色方形箭头
  - 网络异常继续只能走项目内统一样式弹窗
  - 页面布局不能出现异常留白，不误动成熟 UI

### 11.2 本轮定位到的真实根因
- 社区搜索链此前看起来像“无结果/无响应”，但本轮已明确：
  - 平板与电脑后端联通正常
  - 问题不在网络
  - 真正根因是后端 `PostViewSet` 仍保留 DRF `SearchFilter`
- 在 MongoEngine QuerySet 下，`SearchFilter` 与当前帖子查询链不兼容：
  - 会把 `search` 处理推进到不适配的 ORM 风格过滤链
  - 从而触发社区搜索接口 `500`
- 同时，评论回复链此前并非“前端没有入口”，而是缺少：
  - 回复模式状态管理
  - `parentId` 提交
  - 回复列表主动拉取与前台渲染

### 11.3 本轮代码修补
- 文件：
  - `backend/community/views/post.py`
- 修补内容：
  - 移除 `filters.SearchFilter`
  - `filter_backends` 改为仅保留 `filters.OrderingFilter`
  - 在 `get_queryset()` 中手动读取 `search`
  - 使用 Mongo `__raw__ + $regex + $options: i` 对：
    - `title`
    - `content`
    - `excerpt`
    做不区分大小写搜索
- 目的：
  - 彻底绕开 DRF `SearchFilter` 与 MongoEngine 不兼容导致的社区搜索 `500`
  - 保持排序逻辑不回退

- 文件：
  - `src/services/api/communityApi.js`
- 修补内容：
  - 新增 `getCommentReplies(id, params)`
- 目的：
  - 为帖子详情页补齐父评论下回复列表的独立获取能力

- 文件：
  - `src/redux/slices/communitySlice.js`
- 修补内容：
  - `fetchComments`
    - 新增回复映射逻辑
    - 当 `reply_count > 0` 且主接口未直接带 `replies` 时，主动请求：
      - `/community/comments/{id}/replies/`
  - `likedComments`
    - 扩展为同时覆盖顶级评论与子回复
  - `postComment.fulfilled`
    - 若本次提交是回复评论，不再错误把子回复直接插到顶级评论数组首位
  - `toggleCommentLike.fulfilled`
    - 支持对子回复的点赞数与 liked 状态回写
- 目的：
  - 让评论回复链在 Redux 状态层真正闭环，而不是只补一层按钮

- 文件：
  - `src/screens/community/PostDetailScreen.js`
- 修补内容：
  - 新增 `replyTarget`
  - 点击评论区 `回复` 按钮后进入回复模式
  - 底部输入区增加“正在回复 xxx”横条，并支持取消
  - 提交评论时携带 `parentId`
  - 顶级评论下展示：
    - `回复 (n)`
    - 子回复列表
  - 子回复支持点赞
- 目的：
  - 补齐真实用户能感知到的评论回复体验闭环

### 11.4 联通基线与运行环境说明
- 设备：
  - `HGR3Y9MA`
- 联通状态：
  - `adb reverse --list` 继续保持：
    - `tcp:8001 tcp:8001`
    - `tcp:8081 tcp:8081`
  - `GET /health/` 返回 `200`
- 后端搜索接口修复后已验证：
  - `GET /api/v1/community/posts/?search=round330&page=1&page_size=20`
  - 返回 `200`
- 本轮实际用于拉起后端的可运行环境：
  - `D:\APP\Anaconda\envs\Zeroisle`
- 说明：
  - 用户指定环境 `D:\anaconda\envs\ZeroIsle` 本轮仍存在本机异常，未作为本轮联调运行环境
  - 为保证“平板 <-> 电脑后端”真实联通验证不中断，本轮继续临时使用可运行环境代跑
  - 该环境边界已如实记录，后续再单独处理，不把它误判成产品网络问题

### 11.5 本轮真机最终复测结果
- 目标帖子：
  - `round330 联通发帖验证`
  - `postId: a5edc2dd-3d6a-4bfb-b886-c6dbcb770ab2`
- 目标顶级评论：
  - `commentId: 5c3a1787-d95d-45e5-984a-d5a047d6c3c4`
  - 评论内容：
    - `round356_comment_ok`
- 真机复测路径：
  - 社区真实内容态
  - 搜索 `round330`
  - 进入目标帖子详情
  - 点击顶级评论的 `回复`
  - 输入：
    - `round358_reply_ok`
  - 点击发送
  - 观察父评论下回复数与回复内容变化

- 关键证据：
  - `.local/android-mcp-server/round358_community_entry.xml`
  - `.local/android-mcp-server/round358_community_entry.png`
  - `.local/android-mcp-server/round358_search_entry_after_restart.xml`
  - `.local/android-mcp-server/round358_search_entry_after_restart.png`
  - `.local/android-mcp-server/round358_search_results_after_fix.xml`
  - `.local/android-mcp-server/round358_search_results_after_fix.png`
  - `.local/android-mcp-server/round358_post_detail_ready.xml`
  - `.local/android-mcp-server/round358_post_detail_ready.png`
  - `.local/android-mcp-server/round358_reply_mode.xml`
  - `.local/android-mcp-server/round358_reply_mode.png`
  - `.local/android-mcp-server/round358_reply_after_back.xml`
  - `.local/android-mcp-server/round358_reply_after_back.png`

### 11.6 本轮前台结论
- 社区主页顶部安全区正常：
  - 头部没有被平板系统状态栏遮挡
  - 社区顶部此前异常留白本轮无新增回退
- 社区搜索页返回按钮正常：
  - 继续使用统一淡蓝色方形箭头
- 帖子详情页返回按钮正常：
  - 继续使用统一淡蓝色方形箭头
- 布局留白正常：
  - 本轮没有出现新的明显异常大面积留白
- 搜索接口恢复后：
  - 目标帖子可通过真实搜索结果进入
- 评论回复链真机前台结果：
  - 点击 `回复` 后底部输入区已显示：
    - `正在回复 user_8000`
  - 提交后父评论下已显示：
    - `回复 (1)`
  - 子回复正文已真实显示：
    - `round358_reply_ok`
  - 回复提交成功后底部输入区已退出回复模式
  - 输入框恢复为：
    - `写下你的评论...`

### 11.7 本轮接口与后端结果
- 社区搜索接口：
  - `GET /api/v1/community/posts/?search=round330&page=1&page_size=20`
  - 返回：
    - `200`
- 回复列表接口：
  - `GET /api/v1/community/comments/5c3a1787-d95d-45e5-984a-d5a047d6c3c4/replies/?page=1&page_size=20`
  - 返回中已命中：
    - `id: ed9ef5ed-5df1-4173-8c0d-e358bdc29725`
    - `content: round358_reply_ok`

### 11.8 本轮边界与诚实说明
- 社区搜索页文本输入在 adb 自动化场景下仍有偶发不稳定：
  - 这属于自动化输入链稳定性问题
  - 不属于“平板和电脑后端未联通”
  - 也不属于社区搜索接口本身仍有网络故障
- `D:\anaconda\envs\ZeroIsle` 当前环境异常仍未在本轮继续深挖：
  - 该项保留为环境层待处理事项
  - 不阻断本轮产品功能真实联通验收

### 11.9 社区评论链当前闭环状态
- 已完成：
  - `社区主页真实内容态`
  - `社区搜索接口恢复`
  - `搜索结果 -> 帖子详情`
  - `发表评论真机闭环`
  - `评论点赞真机闭环`
  - `评论取消点赞真机闭环`
  - `回复评论真机闭环`
  - `回复列表展示真机闭环`
  - `子回复点赞前端回写支持`
- 当前仍待后续补齐：
  - 多条回复顺序与分页
  - 搜索输入自动化稳定性复核

## 12. round359 续补验证（2026-06-08）

### 12.1 本轮真实目标
- 承接 round358 已完成的：
  - `回复评论真机闭环`
  - `回复列表展示真机闭环`
- 继续收口当前仍未完全闭环的：
  - `多条回复场景`
  - `回复列表完整展示`

### 12.2 本轮新定位到的真实缺口
- 通过帖子详情页当前现场可确认：
  - 父评论下已经能显示回复列表
  - 但前端 `fetchComments` 在主评论未内嵌 `replies` 时，会主动请求：
    - `/community/comments/{id}/replies/`
- 旧实现里把该请求的 `page_size` 固定写死为 `5`
- 这会导致一个真实验收风险：
  - 当父评论真实回复数大于 5 时
  - 前台会把“只展示前 5 条”的结果伪装成完整列表
  - 用户看起来像“回复数正常、回复列表也有内容”
  - 但实际上属于假完整状态

### 12.3 本轮代码修补
- 文件：
  - `src/redux/slices/communitySlice.js`
- 修补内容：
  - 在 `fetchComments` 的补充回复拉取逻辑中：
    - 先读取真实 `reply_count`
    - 再把 `page_size` 改为：
      - `Math.max(5, Math.min(expectedReplyCount || 5, 50))`
- 目的：
  - 在当前前端还没有“查看更多回复”交互之前
  - 先保证首轮渲染尽量按真实回复数把当前回复拉满
  - 避免把“固定 5 条”误当成完整回复列表

### 12.4 本轮接口级真实验证
- 为验证该缺口不是纸面问题，本轮直接向同一父评论继续追加真实回复：
  - `round359_reply_02`
  - `round359_reply_03`
- 创建结果：
  - `POST /api/v1/community/comments/`
  - 两次均创建成功
- 随后再次验证回复列表接口：
  - `GET /api/v1/community/comments/5c3a1787-d95d-45e5-984a-d5a047d6c3c4/replies/?page=1&page_size=20`
  - 已真实返回 `3` 条回复：
    - `round359_reply_03`
    - `round359_reply_02`
    - `round358_reply_ok`

### 12.5 本轮真机与运行时边界
- 本轮前台二次复测过程中，应用在强制重启后先进入：
  - `正在恢复本地数据`
- 随后恢复到首页用户态
- 这说明当前不是“平板和电脑后端未联通”，而是启动恢复链存在中间承接阶段
- 由于恢复完成后的首页存在短暂中间态，本轮没有继续拿不稳定前台现场硬凑“多回复 UI 最终通过”结论
- 但本轮已经拿到足够强的两类证据：
  - 代码修补证据：
    - 前端已不再固定拉 5 条回复
  - 接口真实证据：
    - 同一父评论下的回复接口已真实返回 3 条回复

### 12.6 本轮结论
- 已完成：
  - `多回复场景假完整风险识别`
  - `前端固定 5 条回复拉取缺陷修补`
  - `父评论下 3 条真实回复数据构造`
  - `回复列表接口返回 3 条真实回复复验`
- 当前仍待下一轮补齐：
  - 真机前台重新进入目标帖子详情页
  - 直接补到“3 条回复全部可见”的最终 UI 证据

## 13. round360 多回复前台补齐闭环（2026-06-08）

### 13.1 本轮真实目标
- 承接 round359 尚未补完的唯一前台缺口：
  - `3 条回复全部可见`
- 继续坚持本项目当前上线整改规范：
  - 顶部安全区必须考虑平板系统状态栏，页面顶部内容不能被遮挡
  - 返回按钮继续统一使用已有淡蓝色方形箭头
  - 网络问题继续使用项目内统一优美弹窗，不允许回退到默认安卓弹窗
  - 布局必须避免异常留白，只改明显原始的部分，不误动成熟页面

### 13.2 本轮新确认的真实根因
- round359 已证明：
  - 后端 `reply_count` 是对的
  - 回复列表接口也已经能真实返回 3 条回复
- 但旧前端补拉条件仍然过窄：
  - 只有在 `replies.length === 0 && reply_count > 0` 时才补拉回复
- 这会造成一个新的真实缺口：
  - 当评论对象里已经带回“部分 replies”时
  - 前端会把这部分结果误当成完整列表
  - 不会继续按真实 `reply_count` 把剩余回复补齐
- 所以本轮真实根因不是：
  - 后端没数据
  - 平板和电脑后端不通
  - 社区详情页网络错误
- 本轮真实根因是：
  - 前端对“已有部分回复”的场景没有继续补拉，导致多回复场景被假性截断

### 13.3 本轮代码修补
- 文件：
  - `src/redux/slices/communitySlice.js`
- 修补内容：
  - 将回复补拉条件从：
    - `replies.length === 0 && reply_count > 0`
  - 调整为：
    - `expectedReplyCount > 0 && replies.length < expectedReplyCount`
- 目的：
  - 不再只处理“完全没有 replies”的情况
  - 对“已有部分 replies 但数量小于真实 reply_count”的场景也继续补拉
  - 让帖子详情页的父评论回复列表真正按真实数量补齐

### 13.4 本轮真机最终复测结果
- 目标帖子：
  - `round330 联通发帖验证`
  - `postId: a5edc2dd-3d6a-4bfb-b886-c6dbcb770ab2`
- 目标顶级评论：
  - `commentId: 5c3a1787-d95d-45e5-984a-d5a047d6c3c4`
  - 评论内容：
    - `round356_comment_ok`
- 真机最终证据：
  - `.local/android-mcp-server/round360_post_detail_after_fix.xml`
- XML 已明确命中：
  - `screen.community.postDetail`
  - `回复 (3)`
  - `round359_reply_03`
  - `round359_reply_02`
  - `round358_reply_ok`
  - 多个 `item.community.postDetail.reply...`

### 13.5 本轮前台结论
- 帖子详情页父评论下已真实显示：
  - `回复 (3)`
- 三条子回复都已在同一详情页前台可见：
  - `round359_reply_03`
  - `round359_reply_02`
  - `round358_reply_ok`
- 本轮同时复核确认：
  - 顶部安全区继续正常，页面顶部没有被平板系统状态栏遮挡
  - 返回按钮继续使用统一淡蓝色方形箭头
  - 页面没有出现新的异常大面积留白
  - 前台没有弹出默认安卓网络对话框
- 这说明社区评论回复链已经从“只能看到 1 条回复”推进到：
  - `多条真实回复可见`
  - `回复数与回复列表一致`
  - `前后端真实联通后的多回复前台闭环`

### 13.6 本轮结论
- 已完成：
  - `多回复场景真实根因定位`
  - `已有部分回复时继续补拉的前端缺陷修补`
  - `帖子详情页回复 (3) 真机前台补证`
  - `3 条真实回复全部可见的最终 UI 闭环`
- 当前社区评论回复链已完成：
  - `回复评论真机闭环`
  - `回复列表展示真机闭环`
  - `多回复场景假完整风险修补`
  - `3 条真实回复全部可见`

## 14. round362 评论总数展示口径统一（2026-06-08）

### 14.1 本轮真实目标
- 承接 round361 留下的唯一明确边界：
  - 社区卡片显示帖子总评论数 `14`
  - 帖子详情标题与统计区显示顶级评论分页总数 `12`
- 本轮目标不是继续扩大 UI 改动，而是把详情页展示语义统一到用户更容易理解、也与社区列表一致的“帖子总评论数”口径。

### 14.2 本轮根因确认
- 代码复核已确认两条链当前读取的不是同一字段：
  - 社区列表卡片走 `fetchPosts -> item.comment_count -> item.comments`
  - 帖子详情页 round361 改成了 `commentsPagination.totalItems`
- 因此 round361 里的 `14 vs 12` 不是新的网络问题，也不是后端随机波动，而是前端展示口径被拆成了两套：
  - 帖子总评论数
  - 顶级评论分页总数

### 14.3 本轮代码修补
- 文件：
  - `src/screens/community/postDetailCommentStats.js`
  - `src/screens/community/PostDetailScreen.js`
  - `src/screens/community/__tests__/postDetailCommentStats.test.js`
- 处理：
  - 新增 `resolvePostDetailCommentStats()`，显式区分：
    - `totalCommentCount`
    - `topLevelCommentCount`
  - 帖子详情页标题与顶部统计区统一改为优先显示 `post.comments / post.comment_count`
  - 若详情接口暂时缺少帖子总评论数，再回退到 `commentsPagination.totalItems`
- 本轮刻意不改：
  - 评论分页逻辑
  - `加载更多评论` 的显示与追加行为
  - 已成熟的社区列表卡片样式

### 14.4 自动化回归
- 已新增测试：
  - `src/screens/community/__tests__/postDetailCommentStats.test.js`
- 已通过：
  - `node .\\node_modules\\jest\\bin\\jest.js src/screens/community/__tests__/postDetailCommentStats.test.js --runInBand`
  - `node .\\node_modules\\jest\\bin\\jest.js src/redux/slices/__tests__/communitySlice.test.js --runInBand`
- 结论：
  - 本轮统计口径修补不会破坏社区分页与点赞等现有 slice 回归

### 14.5 本轮结论
- 帖子详情页的展示语义已重新统一为：
  - `评论（帖子总评论数）`
- 顶级评论分页总数没有被删除，而是被收回到实现层，继续服务分页与“加载更多评论”能力
- 这样处理后：
  - 社区列表卡片
  - 帖子详情标题
  - 帖子详情顶部统计区
  都会重新回到同一用户语义，不再制造“像坏了但其实是两套统计口径”的误导

### 14.6 规范复核
- 本轮未改动顶部安全区结构，仍需保持：
  - 页面顶部内容不能被平板系统状态栏遮挡
- 本轮未改动返回按钮组件，仍继续使用：
  - 统一淡蓝色方形箭头
- 本轮未引入新的网络异常承接方式：
  - 不允许回退到默认安卓弹窗
- 本轮未扩大布局变动：
  - 不对已成熟区块做视觉翻新
  - 不制造新的异常留白

### 14.7 真机补证（2026-06-08）
- 联通基线复核：
  - 平板 `HGR3Y9MA` 在线
  - `adb reverse --list` 继续保持：
    - `tcp:8001 tcp:8001`
    - `tcp:8081 tcp:8081`
  - `http://127.0.0.1:8001/health/` 返回正常
  - `http://127.0.0.1:8081/status` 返回 `packager-status:running`
- 现场证据：
  - `.local/android-mcp-server/round362_postdetail_total_aligned.xml`
  - `.local/android-mcp-server/round362_current.png`
- 真机命中：
  - `screen.community.postDetail`
  - `action.community.postDetail.back`
  - 标题区 `评论 (14)`
  - 顶部统计评论数 `14`
- 本次补证说明：
  - round362 的代码修补已经真实落到平板现场
  - 帖子详情标题与顶部统计区都已回到与社区卡片一致的帖子总评论数口径
  - 这一步已经不再停留在代码与单测层，而是补成了真实前台证据

## 15. round364 个人活动后端联通修复与零屿空间首屏收口（2026-06-08）

### 15.1 本轮真实目标
- 承接当前真机现场 `个人资料 -> 零屿空间 -> 目标管理` 链路，优先确认两类问题：
  - 目标管理页出现的“网络连接问题”究竟是平板与电脑后端不通，还是模块自身后端错误；
  - 零屿空间首屏在平板上是否存在明显原始感与异常留白，需要在不破坏成熟样式的前提下收口。

### 15.2 本轮根因定位
- 真机现场先后抓到：
  - `.local/android-mcp-server/round364_goal_form.png`
  - `.local/android-mcp-server/round364_goal_after_retry.png`
- 现场最初会弹出项目内统一样式弹窗：
  - `网络连接问题`
  - `目标数据加载失败，请确认当前设备与后端联通后重试`
- 结合后端日志 `backend/runserver_round361.log` 进一步确认，真正根因不是“平板没网”，而是后端 `personal_activity` 模块内部报错：
  - 旧代码把 `PyMongo Database/Collection` 对象用于布尔判断；
  - `request.user.id` 直接进入个人活动 Mongo 集合时仍沿用旧 `ObjectId` 假设；
  - 最终在 `GET /api/v1/personal-activity/goals/` 上抛出 `NotImplementedError`，前台才被统一网络弹窗接住。

### 15.3 本轮代码修补
- 后端文件：
  - `backend/personal_activity/mongodb_models.py`
  - `backend/personal_activity/views.py`
- 前端文件：
  - `src/screens/personal_activity/PersonalActivityScreen.js`
  - `src/screens/personal_activity/components/ActivityList.js`
- 后端处理：
  - 为个人活动模块新增统一 `user_id` 查询口径，兼容：
    - 当前 Mongo 用户 UUID 字符串
    - 旧数据可能残留的 `ObjectId`
  - 所有 `models_instance.db` 与 `self.collection` 的布尔判断改为显式 `is not None / is None`；
  - 个人活动各视图统一优先解析 `Mongo user id`，避免继续把 Django UUID 误写入模块数据集合；
  - 视图内直接查 Mongo 集合的分支也改为复用统一 `user_id` 查询口径。
- 前端处理：
  - 零屿空间页顶部补回统一的淡蓝色方形返回按钮；
  - 收紧 `hero` 高度与空状态容器纵向占位；
  - 减少首屏异常留白，保留已有配色、功能卡风格和 FAB，不翻动成熟模块。

### 15.4 本轮环境与重启说明
- 本机双路径核对：
  - `D:\anaconda\envs\ZeroIsle\python.exe`
  - `D:\APP\Anaconda\envs\Zeroisle\python.exe`
  - 两者都存在，但当前实际监听 `8001` 的后端进程为：
    - `D:\APP\Anaconda\envs\Zeroisle\python.exe -X utf8 manage.py runserver 0.0.0.0:8001 --noreload`
- 因运行参数带 `--noreload`，本轮在代码修改后已手动重启 `8001` 后端实例，使修复真正落地到真机联调环境。

### 15.5 本轮验证
- 自检：
  - `D:\APP\Anaconda\envs\Zeroisle\python.exe -X utf8 manage.py check`
  - 结果：
    - `System check identified no issues (0 silenced).`
  - 说明：
    - `notes.urls` 与 `voice_recognition.urls` 的历史可选模块告警仍存在，但不阻断本轮 `personal_activity` 路由可用性。
- 联通基线：
  - `http://127.0.0.1:8001/health/` 返回正常；
  - `adb reverse --list` 继续保持：
    - `tcp:8001 tcp:8001`
    - `tcp:8081 tcp:8081`
- 真机证据：
  - 个人资料页：
    - `.local/android-mcp-server/round363_profile_tab.png`
    - `.local/android-mcp-server/round363_profile_tab.xml`
  - 零屿空间页：
    - `.local/android-mcp-server/round364_personalActivity.png`
    - `.local/android-mcp-server/round364_personalActivity.xml`
  - 目标管理页旧失败态：
    - `.local/android-mcp-server/round364_goal_form.png`
    - `.local/android-mcp-server/round364_goal_form.xml`
  - 目标管理页修复后成功态：
    - `.local/android-mcp-server/round364_goal_post_restart.png`
    - `.local/android-mcp-server/round364_goal_post_restart.xml`
- 真机结论：
  - 修复前：
    - 点击 `目标管理` 后会进入统一网络弹窗；
    - 这一步已经证明前台网络异常样式仍符合既定规范，没有退回默认安卓弹窗。
  - 修复后：
    - `目标管理` 已可稳定进入 `新建目标` 表单；
    - 可见 `取消 / 新建目标 / 保存 / 标题 / 类型 / 目标值 / 开始日期 / 结束日期 / 描述` 等完整表单字段；
    - 说明“平板到电脑后端未联通”并不是当前主问题，真实问题已被本轮后端修补收口。

### 15.6 UI / UX 结论
- 零屿空间页本轮已落实：
  - 顶部改回统一淡蓝色方形返回按钮；
  - 标题处于平板系统状态栏下方，不被遮挡；
  - 首屏空态留白明显收紧，不再把大面积白区裸露在卡片外；
  - 原有管理卡片与 FAB 风格保持不变，避免误动成熟视觉。
- 目标管理页本轮维持：
  - 顶部安全区正常；
  - 返回按钮仍为统一淡蓝色方形箭头；
  - 网络问题继续走项目内统一优美弹窗，不使用默认安卓弹窗。

### 15.7 本轮诚实保留项
- 本轮已完成到：
  - `目标管理 -> 新建目标表单可进入`
- 本轮尚未补到：
  - 真机创建成功
  - 真机删除确认与删除成功
  - 真机失败后重试恢复
- 这些项不在本轮虚记为已通过，后续继续沿 `目标管理` 深交互补证。

## 16. round365 目标管理认证恢复兜底与目标页统一网络弹窗续压（2026-06-08）

### 16.1 本轮真实目标
- 继续沿 `个人资料 -> 零屿空间 -> 目标管理` 真机链路往下压，不把当前现场里出现的统一 `网络连接问题` 弹窗简单记成“平板和电脑后端没通”。
- 补清楚三件事：
  - 当前目标页的真实前台现场是什么；
  - 弹窗背后更像是网络、认证还是接口瞬时误判；
  - 在不翻动成熟页面骨架的前提下，能否先把明显的误判层收一层。

### 16.2 本轮真机现场
- 联通基线再次复核：
  - `adb devices` 仍可识别设备 `HGR3Y9MA`
  - `adb reverse --list` 继续保持：
    - `tcp:8001 tcp:8001`
    - `tcp:8081 tcp:8081`
  - `http://127.0.0.1:8001/health/` 返回正常
  - `http://127.0.0.1:8081/status` 继续处于 `packager-status:running`
- 新增零屿空间现场证据：
  - `.local/android-mcp-server/round365_personal_activity_entry.png`
  - 该现场再次确认：
    - 顶部标题与统一淡蓝色方形返回按钮仍位于平板系统状态栏下方；
    - `空间管理` 三张卡片可见；
    - 下半区空态与 FAB 之间仍存在偏大的留白，说明 round364 的首轮收口还不算最终完成。
- 新增目标管理现场证据：
  - `.local/android-mcp-server/round365_goal_manager_open.xml/.png`
  - `.local/android-mcp-server/round365_goal_manager_after_retry.xml/.png`
  - `.local/android-mcp-server/round365_goal_manager_after_auth_patch.xml/.png`
- 现场稳定出现的真实状态：
  - 目标页底层主体已经渲染出：
    - `目标管理`
    - `还没有设置目标`
    - `点击右上角的 + 号创建第一个目标`
  - 但首屏前台会被项目内统一样式弹窗覆盖：
    - 标题：`网络连接问题`
    - 正文一：`目标数据加载失败，请确认当前设备与后端联通后重试`
    - 正文二：`网络连接失败，请检查网络设置后重试`
- 这个现场很关键，因为它说明：
  - 不是默认安卓弹窗；
  - 不是整个目标页不可达；
  - 更像是目标列表请求失败后，页面本身已经落到了空态骨架，但统一错误承接仍把它盖住。

### 16.3 本轮新增判断
- 本机接口探测再次确认：
  - 对 `GET /api/v1/personal-activity/goals/` 使用无效 token，请求会返回 `401 token_not_valid`
  - 使用本轮探测脚本尝试 `user_8000` 密码登录时，后端返回：
    - `{"non_field_errors":["密码错误"]}`
  - 这说明当前手头并没有一个可直接复用的“密码登录”口径来本地人工对齐真机登录态。
- 因此本轮把问题进一步压实为：
  - 当前目标页前台看到的“网络连接问题”，并不等于“平板和电脑后端没有联通”；
  - 更可能是：
    - 真机当前认证态已失效或未恢复；
    - 目标列表请求先命中 `401/未认证`；
    - 前端再把这类失败继续交给统一网络错误体系承接，最终在现场表现成“像网络问题”。

### 16.4 本轮代码修补
- 文件：
  - `src/screens/personal_activity/GoalManagerScreen.js`
- 修改内容：
  - 引入现有的开发态真实认证恢复能力：
    - `tryRestoreDevSession`
  - 为目标列表加载新增本地判定：
    - `isUnauthorizedGoalError(error)`
  - 在 `loadGoals()` 中追加一层最小兜底逻辑：
    - 首次请求若命中 `401 / token_not_valid / 身份认证信息未提供 / 登录状态已失效`
    - 则优先执行 `tryRestoreDevSession({ forceRefresh: true })`
    - 若恢复到真实 token，再自动重拉一次目标列表
  - 设计边界：
    - 只收“开发联调下认证态丢失被误接成网络问题”的这一层；
    - 不重做目标页 UI；
    - 不改成熟的头部、列表骨架、统一弹窗和删除确认弹层结构。

### 16.5 本轮复测结果
- 复测证据：
  - `.local/android-mcp-server/round365_goal_manager_after_auth_patch.xml/.png`
- 结果：
  - 目标页底层空态仍可见；
  - 首屏前台依旧会被统一 `网络连接问题` 弹窗覆盖；
  - 但弹窗文案已从“目标数据加载失败，请确认当前设备与后端联通后重试”切到更泛化的
    - `网络连接失败，请检查网络设置后重试`
- 这说明：
  - 本轮新增的“先恢复认证再重拉”兜底已经落地；
  - 但现场阻塞没有只停留在这一层，当前仍存在进一步的请求失败来源；
  - 需要下一轮继续结合真机前台日志、认证存储与后端真实返回再往下压，不能在本轮伪称“目标页网络问题已完全解决”。

### 16.6 本轮规范复核
- 顶部安全区：
  - `零屿空间` 与 `目标管理` 顶部都没有被平板系统状态栏遮挡。
- 返回按钮：
  - 继续统一使用既有淡蓝色方形箭头，没有回退。
- 异常提示风格：
  - 现场继续使用项目内统一网络错误弹窗，没有出现默认安卓弹窗。
- 留白：
  - `零屿空间` 下半区留白仍偏大，必须继续写入台账，不在本轮假记为已彻底收口。

### 16.7 本轮诚实保留项
- 本轮已新增完成：
  - 目标页“认证失效先恢复再重拉”的最小兜底代码；
  - 新一轮真机证据补抓；
  - “不是简单后端不通，而是认证态/请求承接层混杂”的边界压实。
- 本轮仍未完成：
  - 目标管理 `+` 新建表单新头部样式的最终复证
  - 目标删除确认弹层与删除成功现场
  - 目标创建成功现场
  - 目标页统一网络弹窗的最终根因闭环
  - 零屿空间首屏下半区异常留白的最终收口

## 17. round366 目标管理响应取值兼容与 HTTP 错误误判网络问题收口（2026-06-08）

### 17.1 本轮真实目标
- 继续围绕 `个人资料 -> 零屿空间 -> 目标管理` 的统一网络弹窗做根因下钻，不把当前现场继续笼统写成“平板和电脑后端没通”。
- 本轮重点确认两层问题：
  - 开发态自动恢复登录口径本身是否真的可用；
  - 目标页是否还存在“请求已到服务端，但前端把 HTTP 错误误判成网络问题”或“成功响应已到前台，但取值方式不兼容”的问题。

### 17.2 本轮联通与环境复核
- 真机设备继续为：
  - `HGR3Y9MA`
- 本轮复核时一度发现：
  - `adb reverse --list` 返回为空
- 随后已重新补稳转发：
  - `adb -s HGR3Y9MA reverse tcp:8001 tcp:8001`
  - `adb -s HGR3Y9MA reverse tcp:8081 tcp:8081`
  - 复核结果重新恢复为：
    - `UsbFfs tcp:8081 tcp:8081`
    - `UsbFfs tcp:8001 tcp:8001`
- 本机联通基线继续正常：
  - `http://127.0.0.1:8001/health/` 返回 `{"status":"alive",...}`
  - `http://127.0.0.1:8081/status` 返回 `packager-status:running`
- 这说明本轮不能把问题继续归因到“基础联通已断”。

### 17.3 本轮新增关键证据
- 新增前台现场证据：
  - `.local/android-mcp-server/round366_current.xml`
  - `.local/android-mcp-server/round366_current.png`
- 该现场再次明确显示：
  - 前台仍是项目内统一样式弹窗；
  - 标题为 `网络连接问题`；
  - 正文为 `网络连接失败，请检查网络设置后重试`；
  - 说明当前没有回退到默认安卓弹窗；
  - 但也说明前台仍把某类失败承接成了网络问题。

### 17.4 本轮新的根因压实
- 本轮对开发态认证恢复口径做了本机直连复核：
  - `POST /api/v1/auth/login/`
  - 请求体：
    - `phone=13800138000`
    - `identifier=13800138000`
    - `verification_code=1234`
  - 实际返回：
    - `access`
    - `refresh`
    - `user`
- 同时也复核了验证码链：
  - `POST /api/v1/auth/verification-code/`
  - 返回：
    - `验证码已发送`
    - 实际 `code`
- 这一步很关键，因为它说明：
  - 当前 `tryRestoreDevSession` 依赖的开发态自动恢复登录口径本机是通的；
  - 当前目标页还在前台落统一网络弹窗，不应再简单归因为“恢复登录根本不可用”。
- 继续结合代码复查后，本轮把问题再压到两层更具体的前端实现边界：
  - 第一层：
    - `GoalManagerScreen.loadGoals()` 旧代码把 `personalActivityApi.getGoals()` 的成功结果当成 `response.data` 读取；
    - 但当前 `apiClient` 对很多接口会直接返回解包后的 `response.data` 本体；
    - 这会制造“请求成功但前台取值不兼容”的隐藏风险。
  - 第二层：
    - `networkErrorService.isNetworkError()` 旧逻辑只要命中较宽泛的字符串特征，就可能把已经带 `error.response` 的 HTTP 错误也继续识别成“网络错误”；
    - 这会把 `401/404/500` 之类已经到达服务端的响应继续盖成统一 `网络连接问题` 弹窗，模糊真实根因。

### 17.5 本轮代码修改
- 文件：
  - `src/screens/personal_activity/GoalManagerScreen.js`
  - `src/services/networkErrorService.js`
- `GoalManagerScreen.js`
  - 新增 `normalizeGoalListPayload(payload)`：
    - 兼容三种成功返回形态：
      - 直接数组
      - 分页对象 `results`
      - 旧式 `data`
  - `loadGoals()` 改为：
    - 不再硬编码 `setGoals(response.data)`；
    - 改为 `setGoals(normalizeGoalListPayload(response))`
  - 错误承接边界进一步收紧：
    - 对明确 `>= 500` 的服务端失败，仍保留目标页原有“请确认当前设备与后端联通后重试”的联通导向文案；
    - 对其余真正网络异常，继续使用统一网络错误弹窗；
    - 避免所有失败都被同一套提示文案无差别覆盖。
- `networkErrorService.js`
  - 在 `isNetworkError(error)` 中新增明确短路：
    - 只要已经存在 `error.response`，就不再把它当成纯网络错误；
    - 避免 `401/404/500` 继续误判成“网络连接问题”。
  - 同时去掉过宽的 `failed` 关键字匹配：
    - 避免普通业务失败或 HTTP 失败因为英文 message 含 `failed` 就被误归入网络错误。

### 17.6 本轮结论
- 本轮已经进一步确认：
  - 真机与本机后端基础联通正常；
  - 开发态恢复登录口径本机可用；
  - 目标页仍有前端承接层把真实 HTTP/数据形态问题伪装成网络问题的风险。
- 本轮修补后，目标页至少新增了两层收口：
  - 成功响应结构不再只认 `response.data`；
  - 已收到服务端响应的错误，不再轻易被统一判成网络错误弹窗。

### 17.7 本轮诚实保留项
- 本轮尚未补到新的最终真机闭环证据：
  - 由于本轮重点先放在“错误分类与响应取值兼容”根因收口，尚未在当前提交版本上重新补抓 `目标管理` 成功进入空态或新建表单的最终现场；
  - 下一轮需要优先回到真机现网现场继续验证：
    - 目标页是否已从统一网络弹窗回到空态或表单态；
    - `+` 新建目标表单头部样式；
    - 删除确认弹层与删除成功；
    - 零屿空间下半区异常留白最终收口。

## 18. round367 重装新包后的目标管理真机复核补证

### 18.1 本轮目标
- 不再继续停留在“代码已修但真机还没看见”的状态；
- 直接用已经重装到平板上的最新调试包，重新走一遍：
  - `个人资料 -> 零屿空间 -> 目标管理`
- 目标是确认两个事实：
  - 当前平板与电脑后端在该链路上是否真实联通；
  - `目标管理` 首屏是否还会被统一网络错误弹窗盖住。

### 18.2 本轮联通与运行基线
- 设备：
  - `HGR3Y9MA`
- 前台 Activity：
  - `com.zeroisle_notes/.MainActivity`
- `adb reverse --list`：
  - `tcp:8081 tcp:8081`
  - `tcp:8001 tcp:8001`
- 本机接口：
  - `http://127.0.0.1:8001/health/`
    - 返回正常
  - `http://127.0.0.1:8081/status`
    - `packager-status:running`
- 结论：
  - 本轮现场不属于“基础联通断开”。

### 18.3 本轮关键真机证据
- 证据文件：
  - `.local/android-mcp-server/round367_now.xml`
  - `.local/android-mcp-server/round367_now.png`
  - `.local/android-mcp-server/round367_after_zeroisle_tap.png`
  - `.local/android-mcp-server/round367_goal_after_tap.xml`
  - `.local/android-mcp-server/round367_goal_after_tap.png`

### 18.4 本轮现场结论
- `round367_now.xml`
  - 明确仍在 `个人资料` 页；
  - 命中：
    - `state.profile.state.ready`
    - `entry.activity.profile`
  - `entry.activity.profile` bounds：
    - `[47,1398][578,1601]`
- 但在点击该区域后，`round367_after_zeroisle_tap.png` 已实际显示：
  - `零屿空间`
  - `空间管理`
  - `目标管理`
  - `分类管理`
  - `数据分析`
- 这说明本轮现场出现了一个必须写入流程的验收事实：
  - 真机上 `uiautomator dump` 抓到的 XML 可能短暂滞后于实际前台截图；
  - 不能只依赖单份 XML 判断页面是否切换成功；
  - 后续必须把 `XML + PNG + 时间戳` 三者一起交叉核对。

### 18.5 目标管理最终补证结果
- 在零屿空间前台截图确认到位后，继续点击 `目标管理` 卡片；
- 新现场 `round367_goal_after_tap.xml` 已明确命中：
  - `action.goalManager.back`
  - 标题 `目标管理`
  - 多个真实目标卡片：
    - `Round365Goal`
    - `Round365DirectGoal`
- 同时页面未命中以下旧阻塞特征：
  - `网络连接问题`
  - `服务器错误，请稍后重试`
  - 统一网络异常弹窗覆盖层
- 结论：
  - `目标管理` 在重装最新包后已经可以真实打开；
  - 当前前台直接落到目标列表内容态，而不是被网络错误弹窗盖住；
  - round366 中关于：
    - 成功响应结构兼容
    - HTTP 错误不再误判成网络问题
    的前端修补，已经在真机现场得到正向验证。

### 18.6 对当前阻塞状态的更新
- 需要从活跃阻塞中移除的旧判断：
  - `目标管理首屏仍被网络错误弹窗阻断`
- 当前更准确的状态应改为：
  - `目标管理首屏已恢复`
  - `平板与电脑后端在 personal_activity -> goals 链路上联通成立`
- 当前仍保留为后续项的内容：
  - `+` 新建目标
  - 编辑/删除入口深交互
  - 删除确认、删除成功、失败后重试
  - 零屿空间页面下半区留白继续收口
  - 顶部风格与返回按钮一致性持续复核

### 18.7 本轮额外记录到执行规范
- 对真机取证流程新增一条经验规则：
  - 若 `XML` 与 `PNG` 现场不一致，不得立刻下“页面未切换”结论；
  - 需要先按文件时间戳确认是否存在抓取先后错位；
  - 优先以“最新截图中是否已出现新页面标题/关键控件”作为前台是否切页的直接证据；
  - 再用下一次 XML 回抓补齐结构化锚点。

## 19. round369：目标管理空态与表单留白续收口，修后真机双证据待补

### 19.1 本轮目标
- 继续沿 `个人资料 -> 零屿空间 -> 目标管理` 这条已恢复的真实产品流推进；
- 不扩散改动范围，只处理 `GoalManagerScreen.js` 中仍然明显原始的留白问题；
- 维持以下约束不回退：
  - 顶部安全区不能被平板状态栏遮挡；
  - 返回按钮继续统一使用已有淡蓝色方形箭头；
  - 网络问题仍由项目内统一优美样式弹窗承接；
  - 功能中心旧版彩色卡片风格不改素。

### 19.2 本轮真机现场
- 个人资料页稳定现场：
  - `.local/android-mcp-server/round369_profile_stable.png`
  - 结论：
    - `个人资料` 标题与返回按钮位置正常；
    - 功能中心彩色卡片样式仍保持为用户要求的旧版风格；
    - 该页没有出现新的异常留白回退。
- 零屿空间稳定现场：
  - `.local/android-mcp-server/round369_zeroisle_after_tap.png`
  - 结论：
    - `零屿空间` 入口链仍可真实进入；
    - 顶部页头、返回按钮与安全区正常；
    - 但页面下半区空态文案与 FAB 之间仍有较大白区，后续必须继续收口。
- 目标管理修前空态现场：
  - `.local/android-mcp-server/round369_goal_list.png`
  - 结论：
    - `目标管理` 空态页虽然不再被统一网络错误弹窗覆盖；
    - 但当前空态内容仍以整页居中方式摆放，下方留下大面积空白；
    - 这部分在平板上观感仍偏原始，是本轮继续修改的直接依据。

### 19.3 本轮代码调整
- 仅修改：
  - `src/screens/personal_activity/GoalManagerScreen.js`
- 调整点：
  - 把空态从“整页垂直居中占空”改为“浅卡片式集中引导”；
  - 新增 `emptyIconWrap`，让空态图标与文案形成更紧凑的视觉组块；
  - 收紧 `contentContainer` 顶底留白；
  - 继续压缩 `modalIntroCard`、`formSection`、`formGroup`、`textInput`、`textArea`、`typeOption` 的纵向节奏；
  - 目标是继续降低 `新建目标` 表单中下半区的松散原始感。

### 19.4 安装与运行结果
- 已重新执行：
  - `android\\gradlew.bat app:installDebug`
- 结果：
  - 安装成功；
  - `adb reverse --list` 继续保持：
    - `tcp:8081`
    - `tcp:8001`
- 冷启动后：
  - `topResumedActivity` 仍为 `com.zeroisle_notes/.MainActivity`
  - `logcat` 未出现新的：
    - `SyntaxError`
    - `TypeError`
    - `ReferenceError`
    - `FATAL EXCEPTION`

### 19.5 当前诚实结论
- 已确认成立：
  - 本轮样式收口代码已经写入并成功装包；
  - 目标管理链路仍可到达，没有因本轮修改引入新崩溃；
  - 目标管理空态异常留白是已被真机现场实锤的问题；
  - 零屿空间页下半区留白仍是活跃后续项。
- 尚未能宣称完成：
  - `目标管理` 修后空态留白是否已经达到最终验收标准；
  - `新建目标` 表单修后中下半区是否已达到最终验收标准。
- 原因：
  - 本轮真机再次出现 `PNG` 与 `XML` 抓取先后错位；
  - 个别步骤中截图已回到首页或旧前台，而 XML 又落在另一时刻页面；
  - 因此本轮不能伪造写成“修后视觉已完全 PASS”。

### 19.6 下一轮执行要求
- 必须继续沿以下顺序补最终现场：
  - `个人资料 -> 零屿空间 -> 目标管理`
  - `目标管理 -> + 新建`
- 执行策略：
  - 每一步点击后立刻抓一次 `PNG + XML`
  - 以更短时间窗口减少截图/XML错位；
  - 只有当截图与 XML 同时命中 `目标管理` 或 `新建目标` 关键锚点时，才允许把修后空态/表单写成 `PASS`。

## 20. round370：目标管理双证据补齐后继续收口列表尾部与表单下半区

### 20.1 本轮目标
- 先补 round369 遗留的真机双证据缺口，不能继续靠推测写结论；
- 再根据真实现网前台决定是否继续只改 `GoalManagerScreen.js`；
- 保持以下约束不变：
  - 顶部安全区不能被平板状态栏遮挡；
  - 返回按钮继续统一使用已有淡蓝色方形箭头；
  - 网络问题仍由项目内统一优美样式弹窗承接；
  - 不扩散改成熟页面。

### 20.2 本轮先补到的关键现场
- 冷启动干扰项：
  - `.local/android-mcp-server/round370_launch.xml`
  - `.local/android-mcp-server/round370_launch.png`
  - 结论：
    - 当前冷启动后会再次弹出系统级通知权限弹窗；
    - 包名为 `com.android.permissioncontroller`；
    - 文案为 `零屿笔记正在尝试显示通知`；
    - 这不是应用白屏，也不是业务失败页面。
- 允许系统弹窗后首页恢复现场：
  - `.local/android-mcp-server/round370_after_permission.xml`
  - `.local/android-mcp-server/round370_after_permission.png`
  - 结论：
    - 应用可恢复到首页；
    - 底部 `检查通知权限超时，假定已授权以继续初始化` 属于项目内提示，不是系统阻塞。
- 个人资料稳定现场：
  - `.local/android-mcp-server/round370_profile.png`
  - 结论：
    - 顶部安全区正常；
    - 统一淡蓝色方形返回按钮正常；
    - 功能中心旧版彩色卡片风格保持不变。
- 零屿空间稳定现场：
  - `.local/android-mcp-server/round370_zeroisle.png`
  - 结论：
    - `零屿空间` 页面稳定可达；
    - 顶部风格与返回按钮正常；
    - 下半区 `空空如也` 到页尾之间仍有较大异常留白。
- 目标管理列表态稳定双证据：
  - `.local/android-mcp-server/round370_goal.xml`
  - `.local/android-mcp-server/round370_goal.png`
  - 结论：
    - 真实前台并不是空态，而是目标列表内容态；
    - 已命中：
      - `action.goalManager.back`
      - `目标管理`
      - `Round365Goal`
      - `Round365DirectGoal`
    - 当前没有统一网络错误弹窗覆盖。
- 新建目标表单稳定双证据：
  - `.local/android-mcp-server/round370_goal_create.xml`
  - `.local/android-mcp-server/round370_goal_create.png`
  - 结论：
    - 已命中：
      - `action.goalManager.modalBack`
      - `action.goalManager.save`
      - `新建目标`
      - `数量目标`
      - `目标值`
      - `描述`
    - round369 留下的“新建表单修后真机双证据待补”已在本轮补齐。

### 20.3 由现场更新出来的真实判断
- round369 里继续围绕“目标管理空态页”推进，其实已经不再是当前现网主场景；
- 当前更真实的问题是：
  - 目标管理列表态最后一屏下方留白仍偏空；
  - 新建目标表单下半区仍然偏松，尤其描述区以下承接不够完整；
  - 零屿空间首页下半区留白仍然明显。

### 20.4 本轮代码调整
- 仅修改：
  - `src/screens/personal_activity/GoalManagerScreen.js`
- 调整点：
  - 列表态新增底部承接卡片，减少最后一屏生硬空白；
  - `contentContainer` 改为 `flexGrow: 1`，让目标页内容区在平板上形成完整承接；
  - 进一步压缩：
    - `modalContentContainer`
    - `formSection`
    - `formGroup`
    - `formLabel`
    - `textInput`
    - `textArea`
    - `typeOption`
  - 目标是继续降低新建表单中下半区的松散原始感。

### 20.5 安装结果
- 已重新执行：
  - `android\\gradlew.bat app:installDebug`
- 结果：
  - 安装成功；
  - `adb reverse --list` 仍保持：
    - `tcp:8081`
    - `tcp:8001`

### 20.6 必须诚实保留的边界
- 本轮“列表尾部承接卡片 + 表单进一步压缩”虽然已经写入并装包成功；
- 但修后最新现场回放时再次受到两类干扰：
  - 系统通知权限弹窗重新覆盖；
  - 页面跳转过程中出现漂移，个别步骤会落到非目标页；
- 因此本轮不能把“最新续压后的最终真机效果”直接写成 `PASS`。

### 20.7 下一轮执行要求
- 优先先处理真机取证干扰，而不是继续盲目加代码：
  - 启动后先判断是否出现系统通知权限弹窗；
  - 若出现，先允许，再开始正式验收；
- 之后按以下顺序分别抓图：
  - `零屿空间`
  - `目标管理（修后列表尾部）`
  - `新建目标（修后表单下半区）`
- 只有当“修后最新图”明确落在对应页面时，才允许把 round370 的两项 UI 续压改成 `PASS`。

## 21. round371：启动通知权限干扰收口与冷启动基线复核（2026-06-08）

### 21.1 本轮目标
- 本轮先暂停继续微调 `GoalManagerScreen.js`，优先处理更高优先级的真实真机阻塞：
  - 冷启动时反复弹出的系统通知权限框会污染首页、社区、零屿空间和目标管理的全部验收链；
  - 必须先把这条“启动级干扰”从产品功能问题里剥离掉，再继续做页面和网络联通复测。
- 同时继续坚持既有约束：
  - 顶部安全区不能被平板系统状态栏遮挡；
  - 返回按钮继续统一使用已有淡蓝色方形箭头；
  - 网络问题继续使用项目内统一优美样式弹窗，不回退默认安卓弹窗；
  - 页面布局避免不合理留白，但本轮不扩散修改成熟 UI。

### 21.2 本轮代码修改
- 仅修改：
  - `src/services/notification/notificationService.js`
  - `src/services/reminder/reminderNotificationService.js`
- 处理一：主通知服务启动阶段不再主动申请权限
  - 原先 `notificationService.initialize()` 会在启动时走“检查并请求权限”的链路；
  - 本轮改为：
    - 启动阶段只检查通知权限；
    - 若超时或失败，按未授权继续初始化，不再拉起系统弹窗；
    - 新增显式 `requestPermission()` 供设置页或具体功能入口按需触发；
    - 兼容入口 `requestPermissions()` / `checkPermissions()` 也统一转发到 `src/utils/permissions.js`，避免旧调用方绕回原生权限请求链。
- 处理二：提醒通知服务关闭冷启动自动权限请求
  - `ReminderNotificationService` 中 `PushNotification.configure({ requestPermissions: true })` 改为 `false`；
  - `requestPermissions()` / `checkPermissions()` 统一复用 `src/utils/permissions.js`；
  - 目的：
    - 避免提醒模块在应用一启动时就再次触发系统通知权限框；
    - 把权限申请时机收口到真正需要通知能力的功能场景。

### 21.3 本轮安装与冷启动复核
- 安装：
  - `android\\gradlew.bat app:installDebug`
  - 结果：安装成功
- 冷启动复核步骤：
  - `adb -s HGR3Y9MA logcat -c`
  - `adb -s HGR3Y9MA shell am force-stop com.zeroisle_notes`
  - `adb -s HGR3Y9MA shell monkey -p com.zeroisle_notes -c android.intent.category.LAUNCHER 1`
- 8 秒后复核结果：
  - `topResumedActivity`：
    - `com.zeroisle_notes/.MainActivity`
  - `pidof -s com.zeroisle_notes`：
    - 返回有效进程 `8027`
  - `logcat -d -b crash`：
    - 空
- 新增现场证据：
  - `.local/android-mcp-server/round371b_launch.xml`
  - `.local/android-mcp-server/round371b_launch.png`
- 现场结论：
  - 前台稳定停留在应用首页；
  - 没有再被 `com.android.permissioncontroller` 系统权限页接管；
  - 这说明“启动即弹系统通知权限框”的干扰链，在当前包上已经被有效切断。

### 21.4 本轮日志复核结论
- 继续筛查启动日志：
  - 未再看到本轮实时 `permissioncontroller` 接管；
  - 未出现新的 `FATAL EXCEPTION`、`SIGSEGV` 或 crash buffer 命中；
  - 应用主进程仍稳定存活。
- 需要诚实补充的观测：
  - 启动早期 `ActivityManager` 统计里，`com.zeroisle_notes` CPU 峰值一度较高；
  - 但当前没有证据表明它已升级为启动崩溃或前台掉桌面问题；
  - 后续继续做深交互时，仍要顺手观察资源峰值，避免再次把性能压力演化成稳定性回退。

### 21.5 本轮对“网络问题”的真实更新
- 当前可以明确排除的一点：
  - 冷启动后看到的系统通知权限框，不属于“平板和电脑后端不通”；
  - 也不是“生产域名未部署”导致的前台网络错误。
- 当前更准确的执行口径应更新为：
  - 基础联通仍以 `adb reverse 8001/8081 + /health/ + Metro status` 为真；
  - 启动权限干扰已被剥离；
  - 后续若再出现网络错误，应继续追真实接口失败、局域网联通或前端承接层，不再把系统权限弹窗混入网络问题结论。

### 21.6 本轮后续项
- 本轮已完成：
  - 冷启动通知权限干扰收口；
  - 最新包安装成功；
  - 冷启动前台稳定、无 crash 的真机复核；
  - 启动阶段不再被 `permissioncontroller` 抢前台的现场补证。
- 本轮仍未完成：
  - `round370` 新续压后的 `目标管理` 列表尾部承接卡片最终真机对照图；
  - `新建目标` 表单下半区进一步收紧后的最终真机对照图；
  - `零屿空间` 首页下半区异常留白最终收口；
  - 目标管理新建、删除确认、删除成功、失败重试等深交互真机闭环。

### 21.7 下一轮执行要求
- 现在可以在更干净的启动基线上继续回到：
  - `个人资料 -> 零屿空间 -> 目标管理`
  - `目标管理 -> + 新建`
- 每一步都继续执行：
  - 点击后立即抓 `PNG + XML`
  - 同时复核前台是否仍在 `com.zeroisle_notes/.MainActivity`
- 后续若出现统一网络错误弹窗：
  - 优先判断真实接口是否失败；
  - 再判断是否属于局域网联通或后端未启动；
  - 不再把系统权限弹窗、启动干扰或取证时序错位误写成网络问题。

## 22. round373：LogBox 前台抢占收口、Metro 恢复与零屿空间空态补证（2026-06-08）

### 22.1 本轮目标
- 本轮优先处理 round371 之后冒出的两个开发态阻塞：
  - 冷启动时虽然系统通知权限框已不再接管前台，但 `检查通知权限超时，按未授权处理并继续初始化` 这条 `console.warn(...)` 仍会触发 React Native LogBox 抢前台；
  - 重新装包后又出现 `Unable to load script / Loading from localhost:8081...`，说明当前调试包与 Metro 的 `8081` 供包链临时断开。
- 在两条阻塞收口后，再继续回到：
  - `我的 -> 个人资料`
  - `个人资料 -> 零屿空间`
- 重点验证：
  - 顶部安全区不被状态栏遮挡；
  - 返回按钮继续统一为已有淡蓝色方形箭头；
  - 功能中心维持成熟的彩色旧样式；
  - 零屿空间下半区空态不再出现原始大留白。

### 22.2 本轮代码修改
- 修改文件：
  - `src/App.js`
  - `src/screens/personal_activity/components/ActivityList.js`
- `src/App.js`
  - 将 `检查通知权限超时，按未授权处理并继续初始化` 纳入开发期日志抑制前缀；
  - 同时把开发期日志过滤逻辑从“只判断首参 `startsWith`”升级为：
    - 首参快速命中；
    - 以及把整条日志参数拼接后执行 `includes` 命中；
  - 目的：
    - 仅屏蔽这类已知降级告警对前台验收的污染；
    - 不吞掉真正的异常和错误栈。
- `src/screens/personal_activity/components/ActivityList.js`
  - 继续沿前轮思路保留成熟卡片区不动，只收口明显原始的空态留白；
  - 将空态改为承接卡片 `emptyCard`；
  - `FlatList` 容器改为 `flexGrow: 1`，避免下半区空白被整页放大；
  - 补齐引导提示条：
    - `点击右下角按钮，补充动态内容，让首页信息承接更完整。`

### 22.3 真机现场与阻塞收口
- 首次冷启动取证：
  - 证据：
    - `.local/android-mcp-server/round373_launch.xml`
    - `.local/android-mcp-server/round373_launch.png`
  - 现场明确显示：
    - 顶部 `Log 1 of 1`
    - `Console Warning`
    - 文案：
      - `检查通知权限超时，按未授权处理并继续初始化`
  - 调用栈：
    - `src/App.js:136:17`
    - `src/services/notification/notificationService.js:56:25`
  - 结论：
    - 当前阻塞已不再是系统权限框；
    - 而是这条已知降级告警漏出了 LogBox。
- 修补后再次冷启动：
  - `topResumedActivity` 仍为：
    - `com.zeroisle_notes/.MainActivity`
  - `logcat -d -b crash`：
    - 空
  - 但现场继续暴露新的、独立的调试链问题：
    - `.local/android-mcp-server/round373b_launch.xml`
    - 红屏：
      - `Unable to load script`
  - 结论：
    - 这不是页面代码回归；
    - 而是当前线程没有附着 Metro，调试包拿不到 JS bundle。

### 22.4 Metro / 8081 联通恢复
- 本轮为恢复调试包供包链，已执行：
  - 后台启动：
    - `npm start`
  - 日志文件：
    - `.local/metro_round373.log`
  - 端口复核：
    - `8081` 已进入 `Listen`
  - 反向映射恢复：
    - `adb -s HGR3Y9MA reverse tcp:8081 tcp:8081`
    - `adb -s HGR3Y9MA reverse --list`
- 恢复后冷启动复核：
  - 证据：
    - `.local/android-mcp-server/round373e_launch.xml`
    - `.local/android-mcp-server/round373e_launch.png`
  - 结果：
    - 首页 `screen.home` 正常命中；
    - 顶部标题 `零屿笔记`、搜索区和底部 tab 均正常渲染；
    - Metro 日志同时确认首页、认证恢复与通知服务继续完成初始化。
- 当前可以更新的真实结论：
  - `8081` 调试供包链已恢复；
  - 此轮不再存在红屏、LogBox 和系统权限框三者混杂导致的前台误判。

### 22.5 页面级真机补证
- 个人资料页：
  - 证据：
    - `.local/android-mcp-server/round373_profile.xml`
    - `.local/android-mcp-server/round373_profile.png`
  - 现场确认：
    - 顶部未被状态栏遮挡；
    - 返回按钮仍是统一的淡蓝色方形箭头；
    - 功能中心彩色卡片样式、层次和布局仍为用户要求的“旧版成熟风格”；
    - 没有退回为单调、太素的版本。
- 零屿空间页：
  - 证据：
    - `.local/android-mcp-server/round373_zeroisle.png`
  - 现场确认：
    - 顶部标题 `零屿空间` 安全区正常；
    - 返回按钮样式统一；
    - `空间管理` 卡片区保持成熟样式，不做误改；
    - 下半区空态已经由承接卡片接住，不再是此前一大片原始白区。

### 22.6 本轮必须诚实保留的边界
- 本轮 `round373_zeroisle.xml` 继续出现了“截图已经进入零屿空间，但 XML 仍短暂停留在上一页”的时序错位；
- 因此后续页面级验收仍必须坚持：
  - 截图；
  - XML；
  - 时间戳；
  - 三者交叉判定；
- 不能只拿单一 XML 对页面结论下判断。

### 22.7 本轮结论
- 本轮已完成：
  - `LogBox` 前台抢占收口；
  - `Metro + adb reverse tcp:8081` 调试包联通恢复；
  - 个人资料页顶部安全区、统一返回按钮和功能中心成熟彩色样式真机复核；
  - 零屿空间下半区空态承接卡片真机补证。
- 本轮未完成但已具备继续推进条件：
  - `目标管理` 列表尾部承接卡片修后最终对照图；
  - `新建目标` 表单下半区进一步压缩后的最终对照图；
  - 删除确认、删除成功、失败后重试链路。

### 22.8 下一轮执行要求
- 直接基于当前稳定链路继续走：
  - `个人资料 -> 零屿空间 -> 目标管理`
  - `目标管理 -> + 新建`
- 每一步仍执行：
  - 点击后立即抓 `PNG + XML`
  - 同时记录时间戳，避免再被截图/XML错位误导；
- 若再次出现网络类问题：
  - 先看是否是 `8001/8081` 联通丢失；
  - 再看真实接口失败；
  - 不再把 LogBox、红屏或取证时序漂移误记成业务网络错误。

## 23. round375：后端联通复核与目标管理真机补证（2026-06-08）

### 23.1 本轮目标
- 不先改代码，先复核两件更关键的事实：
  - 当前平板与电脑后端联通是否真实成立；
  - `目标管理 -> + 新建目标` 是否仍被所谓“网络问题”阻塞。
- 同时继续保持用户约束：
  - 不动成熟的彩色功能卡、统一返回按钮和顶部成熟风格；
  - 继续关注顶部安全区、异常留白与统一项目内网络错误承接风格；
  - 本轮完成后把真实结论回填到中文文档。

### 23.2 本轮联通复核
- 平板在线：
  - `adb devices`
  - 结果：
    - `HGR3Y9MA    device`
- ADB 反向映射复核：
  - `adb -s HGR3Y9MA reverse --list`
  - 结果：
    - `tcp:8081 tcp:8081`
    - `tcp:8001 tcp:8001`
- 本机后端健康检查：
  - `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8001/health/`
  - 结果：
    - `200`
    - `{"status": "alive", ...}`
- Metro 供包状态：
  - `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8081/status`
  - 结果：
    - `200`
- 前台页面复核：
  - `adb -s HGR3Y9MA shell dumpsys activity activities | Select-String -Pattern 'topResumedActivity|mResumedActivity'`
  - 结果：
    - `com.zeroisle_notes/.MainActivity`

### 23.3 真机链路补证
- 本轮不再复用上一轮容易漂移的取证节奏，而是改成：
  - 先从 `round375_start.xml/.png` 固化首页现场；
  - 用 XML 精确取到 `我的` 标签中心点 `(1068, 1931)`；
  - 进入个人资料页后，再从 XML 精确取到 `零屿空间` 入口中心点 `(313, 1523)`；
  - 零屿空间页与目标管理页则以实拍截图为主，避免继续被 XML 时序错位误导。
- 个人资料页证据：
  - `.local/android-mcp-server/round375_after_my.xml`
  - `.local/android-mcp-server/round375_after_my.png`
  - 现场确认：
    - 顶部安全区正常；
    - 返回按钮仍是统一淡蓝色方形箭头；
    - 功能中心继续保持用户要求的旧版彩色成熟样式。
- 零屿空间页证据：
  - `.local/android-mcp-server/round375_zeroisle.png`
  - 现场确认：
    - 顶部未被平板状态栏遮挡；
    - 成熟的空间管理卡片区没有被误改；
    - 下半区继续保持承接卡片结构，没有回退成原始大白区。
- 目标管理列表态证据：
  - `.local/android-mcp-server/round375_goal_fixed.png`
  - 现场确认：
    - `目标管理` 页面真实可达；
    - 顶部统一，右上角 `+` 按钮可见；
    - 页面当前为真实列表内容态，而不是首页或错误弹窗态；
    - 列表尾部承接卡片 `已创建 3 个目标` 已在平板前台落地。
- 新建目标表单证据：
  - `.local/android-mcp-server/round375_goal_create_fixed.png`
  - 现场确认：
    - `新建目标` 页面真实可达；
    - 顶部安全区正常；
    - 返回按钮样式统一；
    - 蓝色 `保存` 按钮正常显示；
    - 表单没有被所谓“网络问题”拦住。

### 23.4 本轮关键结论
- 当前平板与电脑后端联通在目标管理链路上成立：
  - `8001` 后端健康检查通过；
  - `8081` Metro 调试供包状态通过；
  - 平板前台也仍在 `MainActivity`。
- 因此：
  - 不能再把 `目标管理` 当前现场问题默认写成“后端没启动”或“平板和电脑没打通”。
- 本轮也重新压实了另一点：
  - 上一轮 `round374_goal*.png` 看起来还停在首页，更接近点击取证失准或截图时序偏移；
  - 不是 `GoalManagerScreen` 本身回退。

### 23.5 本轮边界与执行规范
- 本轮设备侧 `uiautomator dump` 多次被系统中断：
  - 手动 `dump` 和脚本式 `exec-out` 都出现不稳定；
  - 因此最终是靠：
    - 截图；
    - 前台页面状态；
    - 已成功命中的上一层 XML；
    - 三者交叉确认页面真实位置。
- 这条规范需要继续写死到后续执行里：
  - 不能因为某一份 XML 没抓稳，就倒推页面或网络链路故障；
  - 仍要坚持“截图 + XML + 时间戳”联合判定。

### 23.6 本轮是否改代码
- 本轮未改业务代码。
- 原因：
  - 目标管理与新建目标真机补证后，当前主要新增价值在于纠正上一轮取证误判；
  - 现阶段不需要为了“看起来像问题”而继续碰成熟页面或做无根据 UI 改动。

### 23.7 下一轮执行要求
- 继续在当前稳定联通基线上推进：
  - `目标管理 -> 新建 -> 保存前表单校验`
  - `目标管理 -> 编辑`
  - `目标管理 -> 删除确认`
  - `目标管理 -> 删除成功 / 失败重试`
- 同时继续关注并写入文档：
  - 顶部安全区不被平板状态栏遮挡；
  - 返回按钮继续统一为已有淡蓝色方形箭头；
  - 不合理留白持续收口但不误改成熟区域；
  - 网络类问题继续统一走项目内优美弹窗，不回退到默认安卓弹窗。

## 24. round376 / round377：目标管理 400 失败链收口、联通复核与原生崩溃再定位（2026-06-08）

### 24.1 本轮目标
- 不再把 `目标管理 -> 新建目标 -> 保存失败` 粗暴记成“网络问题”，而是拆成三个层级分别验证：
  - 平板与电脑后端是否真的联通；
  - 失败后是否还会透出原始 `HTTP错误 400: {...}`；
  - 保存失败后是否仍会触发 `Realm + Hermes` native crash。
- 继续遵守本项目当前固定规范：
  - 顶部必须完整露出，不能被平板系统状态栏遮挡；
  - 返回按钮继续统一使用已有淡蓝色方形箭头；
  - 网络问题只能走项目内统一优美弹窗，不回退到默认安卓弹窗；
  - 只改明显原始的 UI，不误动成熟卡片与成熟头部。

### 24.2 本轮联通复核
- `adb reverse --list` 继续稳定存在：
  - `tcp:8081 tcp:8081`
  - `tcp:8001 tcp:8001`
- 本机后端健康检查继续通过：
  - `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8001/health/`
  - 返回 `200`，内容为 `alive`
- Metro 调试供包继续通过：
  - `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8081/status`
  - 返回 `200`
- 结论：
  - 当前 `目标管理` 失败保存场景不能再默认归因为“后端没启动”或“平板和电脑不在同一局域网”；
  - 本轮问题属于前端失败承接链与更深层运行时崩溃，不是基础网络不通。

### 24.3 本轮代码最小收口
- `src/services/api/personalActivityApi.js`
  - 为 `getGoals/createGoal/updateGoal/deleteGoal` 补齐 `metadata.suppressGlobalErrorUI`
  - 目的：
    - 把目标管理页从全局统一错误 UI 链中摘出来；
    - 避免 `400` 校验错误继续叠加全局网络弹窗或其他通用承接层。
- `src/screens/personal_activity/GoalManagerScreen.js`
  - 保持 `400` 错误只走页内 `formStatus`
  - 继续优先提取后端友好中文校验信息
  - 目的：
    - 失败时只保留页内状态卡，不再使用重复 Toast 干扰用户。
- `src/services/api/apiClient.js`
  - 新增 `extractHttpErrorMessage(...)`
  - 将 `400` 从通用默认错误分支中单独摘出
  - 不再把完整后端错误包继续喂给统一错误服务
  - 目的：
    - 先把“失败即原始 JSON 满天飞”的问题降级成可控的、单点的友好消息承接。

### 24.4 真机现场与关键证据
- 个人资料页现场：
  - `.local/android-mcp-server/round377_profile_tab.png`
  - 结论：
    - 顶部安全区正常；
    - 返回按钮仍为统一淡蓝色方形箭头；
    - 功能中心继续保持用户要求的彩色成熟旧样式，没有回退成单调版。
- 零屿空间页现场：
  - `.local/android-mcp-server/round377_zeroisle_entry_direct.png`
  - 结论：
    - 顶部未被平板状态栏遮挡；
    - 空间管理卡片和返回按钮风格正常；
    - 页面仍需继续关注下半区视觉承接，但本轮不误判为联通问题。
- 目标管理列表页现场：
  - `.local/android-mcp-server/round377_goal_list.png`
  - 结论：
    - 页面真实可达；
    - 顶部返回按钮、标题、右上角 `+` 均正常；
    - 当前没有再被统一网络弹窗直接拦住。
- 新建目标表单现场：
  - `.local/android-mcp-server/round377_goal_modal.png`
  - 结论：
    - `新建目标` 表单真实可达；
    - 顶部安全区、返回按钮与保存按钮样式均正常；
    - 页面没有被状态栏遮挡。
- `400` 失败保存现场：
  - `.local/android-mcp-server/round377_goal_after_submit.png`
  - 结论：
    - 页内已经出现友好的红色中文状态卡：
      - `数量型目标和习惯型目标必须设置目标值`
    - 说明 `GoalManagerScreen` 本地失败承接已经开始生效；
    - 但底部仍然同时出现一条黑色开发态提示：
      - `HTTP错误 400: {...}`
    - 说明“原始后端错误提示链”并未完全清零。

### 24.5 本轮更重要的新发现：native crash 仍未彻底消失
- 本轮一度在中间复测阶段拿到“提交失败后仍停留在 `MainActivity`、`crash buffer` 为空”的阶段性正向迹象；
- 但在后续复跑同类 `400` 失败保存时，仍再次复现 native crash：
  - `adb -s HGR3Y9MA logcat -d -b crash`
  - 关键时间：
    - `2026-06-08 21:40:27`
  - 关键特征：
    - `Fatal signal 11 (SIGSEGV)`
    - 线程：`mqt_js`
    - 堆栈持续指向：
      - `librealm.so`
      - `libhermes_executor.so`
      - `libreactnativejni.so`
- 结论必须写实：
  - 本轮把 `400` 失败 UX 问题从“原始 JSON + 重复提示”压缩到了“页内状态卡为主、仍残留开发态黑条”；
  - 但 `Realm + Hermes` 这层 native crash 仍然是活跃阻塞项，不能在本轮假记为已彻底修复。

### 24.6 当前可确认的真实结论
- 可确认通过：
  - 平板与电脑后端联通在当前目标管理链路上成立；
  - `目标管理` 与 `新建目标` 页面都可真实进入；
  - 顶部安全区、统一淡蓝色返回按钮、成熟功能中心彩色样式均未回退；
  - `400` 失败时已经能出现页内中文友好提示。
- 仍未通过：
  - `400` 失败后底部黑色开发态 `HTTP错误 400...` 仍未完全消失；
  - 更深层的 `Realm + Hermes` native crash 仍能复现；
  - 因此目标创建失败链还不能写成最终 PASS。

### 24.7 下一轮要求
- 下一轮不要再做泛化 UI 改动，优先只做一件事：
  - 继续定位 `目标创建失败 -> mqt_js -> realm/hermes` 的根因。
- 必须继续写入文档与验收口径：
  - 顶部安全区不能被状态栏遮挡；
  - 返回按钮继续统一使用已有淡蓝色方形箭头；
  - 页面布局不能制造新的异常留白；
  - 网络问题统一走项目内优美弹窗；
  - 对 `400` 业务校验错误，不允许再透出原始后端 JSON 或默认安卓样式。

## 25. round378：目标管理 400 黑色开发态提示根因收口与真机续验（2026-06-08）

### 25.1 本轮目标
- 承接上一轮遗留的两个不确定点，但不再同时大范围发散：
  - `400` 保存失败后底部黑色开发态 `HTTP错误 400...` 是否还在；
  - 同一路径是否仍会再次稳定触发 `Realm + Hermes` native crash。
- 继续遵守当前固定验收口径：
  - 顶部安全区不能被平板系统状态栏遮挡；
  - 返回按钮继续统一为已有淡蓝色方形箭头；
  - 个人资料页功能中心继续保持最初那版彩色成熟样式，不回退；
  - 网络类问题统一走项目内优美弹窗，不回退到默认安卓弹窗；
  - 只改明显原始的问题链，不误动成熟页面。

### 25.2 本轮联通与前台基线
- `adb reverse --list` 继续稳定存在：
  - `tcp:8081 tcp:8081`
  - `tcp:8001 tcp:8001`
- 本机检查继续通过：
  - `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8001/health/` 返回 `200`
  - `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8081/status` 返回 `200`
- 前台继续为：
  - `com.zeroisle_notes/.MainActivity`
- 本轮结论：
  - 当前问题不能再被偷换成“后端没通”或“平板与电脑没打通”；
  - 本轮仍属于前端错误承接链与开发态噪音收口问题。

### 25.3 本轮真机复测链路
- 从首页重新按真实平板路径复跑：
  - `首页 -> 我的 -> 个人资料 -> 零屿空间 -> 目标管理 -> + 新建目标`
- 新增现场证据：
  - `tmp_round378_current_screen.png`
  - `tmp_round378_profile_screen.png`
  - `tmp_round378_zeroisle_screen.png`
  - `tmp_round378_goal_list_screen.png`
  - `tmp_round378_goal_modal_screen.png`
  - `tmp_round378_goal_after_submit_screen.png`
- 复测中再次确认：
  - 个人资料页顶部安全区正常；
  - 功能中心继续保持用户要求的彩色成熟旧样式；
  - 零屿空间与目标管理列表/新建表单都真实可达；
  - 返回按钮继续统一为已有淡蓝色方形箭头；
  - 页面顶部没有被平板系统状态栏遮挡。

### 25.4 本轮最关键的现场结论
- 受控复现方式：
  - 仅填写标题 `testgoal`
  - 保持类型为 `数量目标`
  - 故意不填写 `目标值`
  - 点击保存，稳定命中后端 `400`
- 现场证据：
  - `tmp_round378_goal_after_submit_screen.png`
- 可明确确认：
  - 页内红色中文状态卡继续稳定出现：
    - `数量型目标和习惯型目标必须设置目标值`
  - 说明 `GoalManagerScreen` 页内承接链当前是成立的；
  - 此处不再是“原始 JSON 直出”的旧状态。

### 25.5 本轮再次钉实黑色开发态提示的直接根因
- 关键日志证据：
  - `tmp_round378_logcat.txt`
- 其中明确出现：
  - `ReactNativeJS: 'HTTP错误 400:'`
  - `url: '/personal-activity/goals/'`
  - `method: 'post'`
  - `message: '数量型目标和习惯型目标必须设置目标值'`
- 这一步把问题性质进一步坐实为：
  - 黑色开发态提示不是新的网络问题；
  - 也不是页内状态卡自身导致；
  - 直接来源是 `src/services/api/apiClient.js` 的 `400` 分支仍在打印会被 React Native 开发态前台接管的日志。

### 25.6 本轮代码最小修补
- 修改文件：
  - `src/services/api/apiClient.js`
- 修改内容：
  - 新增 `DEV_VERBOSE_HTTP_400_LOG = false`
  - 新增 `logHttp400Debug(status, payload)`
  - 让 `400` 分支不再默认直接 `console.log('HTTP错误 400: ...')`
- 目的：
  - 默认收掉这类业务校验失败对开发态前台的黑色提示污染；
  - 但保留将来需要时重新打开详细日志的能力；
  - 不改动页内红色中文状态卡、统一网络弹窗与业务错误对象本身。

### 25.7 本轮对 native crash 的重新判断
- 本轮同一路径复测后：
  - 前台仍停留在 `MainActivity`
  - `tmp_round378_crash.txt` 未新增 `SIGSEGV`
- 因此必须写实更新：
  - “本次这条 `400` 保存失败必然触发 native crash” 当前没有再次被复现；
  - 但由于上一轮历史现场确实抓到过 `2026-06-08 21:40:27` 的 `librealm.so + libhermes_executor.so + libreactnativejni.so` 崩溃，
  - 所以当前只能把该项从“稳定复现”降为“继续观察”，还不能直接宣告永久修复。

### 25.8 本轮结束时的真实状态
- 已可确认：
  - 后端与平板联通继续成立；
  - `400` 业务校验已稳定由页内红色中文状态卡承接；
  - 黑色开发态 `HTTP错误 400...` 的直接根因已经定位到 `apiClient` 的 `400` 日志链；
  - 本轮已经做了最小代码收口，准备在下一次装包复测中确认黑条是否彻底消失。
- 仍需继续观察：
  - `Realm + Hermes` 旧 native crash 是否会在后续更长时间回放中再次出现；
  - 目标管理编辑、删除确认、删除成功/失败重试等深交互是否也存在同类失败承接噪音。

### 25.9 下一轮要求
- 优先在最新包上复测一次：
  - `目标管理 -> 新建目标 -> 受控 400 保存失败`
- 核心只确认两件事：
  - 底部黑色开发态提示是否已经消失；
  - 是否再次出现 `Realm + Hermes` crash。
- 如果这两点稳定，再继续推进：
  - `目标管理 -> 编辑`
  - `目标管理 -> 删除确认`
  - `目标管理 -> 删除成功 / 失败重试`
- 同时文档里必须继续坚持写入：
  - 顶部安全区不被状态栏遮挡；
  - 返回按钮统一为已有淡蓝色方形箭头；
  - 页面不制造新的异常留白；
  - 网络问题继续统一走项目内优美弹窗。

### 25.10 本轮装包后最终复测结论补记
- 本轮在代码收口后已重新执行：
  - `android\gradlew.bat app:installDebug`
- 安装成功后首次冷启动曾短暂回到系统桌面：
  - 现场 `tmp_round378b_launch_screen.png`
  - 当时前台为 `com.zui.launcher/.drawer.NormalLauncher`
  - 但 `crash buffer` 未新增 `SIGSEGV`
  - 随后二次拉起应用，进程与前台恢复正常：
    - `pidof` 返回 `12523`
    - `topResumedActivity = com.zeroisle_notes/.MainActivity`
- 在这个恢复后的稳定前台上，再次沿同一路径执行受控 `400` 失败复测：
  - 证据 `tmp_round378c_after_submit_screen.png`
  - 结果继续确认：
    - 页内红色中文状态卡仍正常出现；
    - 顶部安全区、统一返回按钮与页面结构没有回退。
- 更关键的是：
  - `tmp_round378c_logcat.txt` 中已经不再出现 `HTTP错误 400`
  - `tmp_round378c_crash.txt` 仍为空
- 因此可以把本轮最终结论写实更新为：
  - `HTTP错误 400...` 黑色开发态提示已经在真机回归中确认消失；
  - 本次回归没有再次抓到新的 `Realm + Hermes` native crash；
  - 但由于历史上确实出现过一次 `2026-06-08 21:40:27` 的 native crash，后续仍需继续观察，不能直接把这一层永远下线。

## 26. round379：目标管理编辑与删除确认/成功回流真机闭环（2026-06-08）

### 26.1 本轮目标
- 在 round378 已收掉 `400` 黑色开发态提示的基础上，继续补齐 `目标管理` 深交互：
  - 编辑已有目标；
  - 删除确认弹层；
  - 删除成功后的列表回流与承接文案同步。
- 继续坚持固定验收口径：
  - 顶部安全区不能被平板系统状态栏遮挡；
  - 返回按钮继续统一为已有淡蓝色方形箭头；
  - 删除确认不能回退为默认安卓弹窗；
  - 不制造新的异常留白，不误动成熟页面。

### 26.2 本轮基线与起始现场
- 前台继续为：
  - `com.zeroisle_notes/.MainActivity`
- 联通继续成立：
  - `adb reverse --list` 仍保持 `8001/8081`
  - `http://127.0.0.1:8001/health/` 返回 `200`
- 本轮起始时应用仍停在上一轮的 `新建目标 -> 400` 失败现场：
  - 这说明 round378 收口后的页内中文状态卡表现是稳定可复现的；
  - 本轮先从该现场返回列表，再继续深交互验证。

### 26.3 返回目标管理列表后的稳定现场
- 证据：
  - `tmp_round379_goal_list_after_back_screen.png`
- 现场确认：
  - `目标管理` 列表内容态稳定；
  - 顶部安全区正常；
  - 返回按钮继续统一为已有淡蓝色方形箭头；
  - 列表尾部承接卡片仍显示 `已创建 3 个目标`；
  - 当前列表区没有新出现的异常留白。

### 26.4 编辑链路真机闭环
- 第一次进入编辑页：
  - 证据 `tmp_round379_edit_modal_screen.png`
  - 已确认：
    - `编辑目标` 表单真实可达；
    - 顶部安全区、统一返回按钮和蓝色保存按钮样式正常；
    - 表单本身没有回退成原始样式。
- 第一次尝试整段改名时：
  - 现场只确认“保存后能回流到列表”，但标题未改变；
  - 因此本轮没有把这次尝试误记为成功，而是继续做更稳的追加式验证。
- 第二次追加式验证：
  - 证据 `tmp_round379_edit_append_screen.png`
  - 已明确确认标题已真实变为：
    - `Round365Goal_ok`
- 保存后的最终回流：
  - 证据 `tmp_round379_after_edit_ok_screen.png`
  - 已确认：
    - 页面真实回到 `目标管理` 列表；
    - 首条标题同步显示 `Round365Goal_ok`
  - 结论：
    - `编辑 -> 保存 -> 列表回流 -> 新值展示` 已在真机前台闭环。
- 崩溃观察：
  - `tmp_round379_after_edit_ok_crash.txt` 为空
  - 本轮编辑链未新增 native crash。

### 26.5 删除确认弹层与删除成功链路真机闭环
- 删除确认现场：
  - 证据 `tmp_round379_delete_confirm_screen.png`
  - 已确认：
    - 删除确认继续使用项目内统一样式弹层；
    - 没有回退到默认安卓弹窗；
    - 正文会引用当前目标名：
      - `确认删除 “Round365Goal_ok” 吗？删除后将无法恢复。`
    - 按钮为：
      - `取消`
      - `确认删除`
- 删除成功现场：
  - 证据 `tmp_round379_after_delete_screen.png`
  - 已确认：
    - 确认删除后列表从 3 项减少为 2 项；
    - `Round365Goal_ok` 已从前台消失；
    - 底部承接卡片同步更新为：
      - `已创建 2 个目标`
- 日志与崩溃观察：
  - `tmp_round379_after_delete_logcat.txt` 已明确出现：
    - `API响应成功: DELETE /personal-activity/goals/...`
    - 后续 `API响应成功: GET /personal-activity/goals/`
  - `tmp_round379_after_delete_crash.txt` 为空
  - 说明本轮删除成功回流链没有新增开发态黑条或 native crash。

### 26.6 本轮可确认的真实结论
- 已通过：
  - 目标管理编辑链路已真机闭环；
  - 删除确认弹层继续保持项目内统一样式；
  - 删除成功后列表和底部承接文案都能同步回流；
  - 顶部安全区、统一返回按钮、成熟风格与合理留白均未回退；
  - 本轮编辑/删除成功现场没有出现新的黑色开发态提示或 native crash。
- 仍待补：
  - 删除失败承接；
  - 其他更深的异常分支保护。

### 26.7 下一轮要求
- 优先继续补测：
  - `目标管理 -> 删除失败承接`
- 如有必要，再补 `编辑失败承接`
- 同时文档里继续坚持写入：
  - 顶部安全区不被状态栏遮挡；
  - 返回按钮统一为已有淡蓝色方形箭头；
  - 网络与异常问题继续统一走项目内自定义承接；
  - 不为了补证而误动成熟页面。

## 27. round380：目标管理删除失败统一网络弹层真机验收（2026-06-08）

### 27.1 本轮目标
- 不新增代码改动，直接承接上一轮待补缺口：
  - `目标管理 -> 删除失败承接`
- 核心只核对四件事：
  - 失败后是否继续停留在 `目标管理` 上下文；
  - 是否继续使用项目内统一优美样式网络弹层；
  - 是否回退成默认安卓弹窗或黑色技术提示；
  - 顶部安全区、统一淡蓝色方形返回按钮与页面留白是否保持稳定。

### 27.2 受控失败构造方式
- 本轮不把“失败”笼统记成真实网络没通，而是做受控演练：
  - 保留 `adb reverse tcp:8081 tcp:8081`
  - 临时移除 `adb -s HGR3Y9MA reverse tcp:8001 tcp:8001`
- 这样可以保证：
  - Metro 调试包继续可渲染；
  - 页面前台仍能稳定操作；
  - 只有目标删除请求失去到电脑后端 `8001` 的联通，用于专门验收失败承接层。

### 27.3 失败演练前的稳定现场
- 证据：
  - `tmp_round380_current_screen.png`
  - `tmp_round380_current_ui.xml`
- 现场确认：
  - 当前前台仍为 `目标管理` 列表内容态；
  - 列表中真实存在两条目标：
    - `Round365DirectGoal`
    - `Round365Goal`
  - 顶部安全区正常，没有被平板系统状态栏遮挡；
  - 返回按钮继续统一为已有淡蓝色方形箭头；
  - 列表区没有新增异常留白。

### 27.4 删除失败后的统一网络弹层现场
- 删除并确认后的证据：
  - `tmp_round380_delete_fail_screen.png`
  - `tmp_round380_delete_fail_ui.xml`
- 前台真实表现：
  - 页面没有跳出 `目标管理` 上下文；
  - 没有回退到默认安卓弹窗；
  - 没有重新出现黑色技术提示；
  - 而是覆盖项目内统一样式网络弹层。
- 弹层文案已经明确：
  - 标题：
    - `网络连接问题`
  - 正文：
    - `删除目标失败，请确认网络与后端服务正常后重试`
  - 按钮：
    - `重试`
    - `确定`
- 这说明当前删除失败承接已经符合本项目对网络问题的统一样式要求。

### 27.5 日志、崩溃与联通恢复
- 本轮附带日志证据：
  - `tmp_round380_delete_fail_logcat.txt`
  - `tmp_round380_delete_fail_crash.txt`
- 本轮没有观察到：
  - 默认安卓失败弹窗回退；
  - 新的黑色开发态技术提示；
  - 新的 native crash。
- 失败承接验收完成后，已立即恢复：
  - `adb -s HGR3Y9MA reverse tcp:8001 tcp:8001`
- 恢复后再次确认：
  - `8001/8081` reverse 均已存在；
  - `http://127.0.0.1:8001/health/` 返回 `200`
- 因此本轮结论必须写实为：
  - 这是一次受控失败演练，不是当前长期联通断开；
  - 当前平板与电脑后端的基础联通在演练后已恢复正常。

### 27.6 本轮可确认结论
- 已通过：
  - `目标管理 -> 删除失败承接` 已经在真机上通过受控验收；
  - 失败后继续使用项目内统一优美样式网络弹层；
  - 顶部安全区、统一淡蓝色方形返回按钮与合理留白均未回退；
  - 删除失败现场没有回退到默认安卓弹窗，也没有出现新的黑色技术提示。
- 继续观察：
  - `Realm + Hermes` 历史 crash 本轮未新增，但仍不能直接宣称永久修复；
  - 后续还需要继续补 `编辑失败承接` 等更深异常分支。

### 27.7 下一轮要求
- 优先继续补测：
  - `目标管理 -> 编辑失败承接`
  - `目标管理 -> 其他异常分支`
- 同时继续坚持写入文档：
  - 顶部安全区不能被状态栏遮挡；
  - 返回按钮统一使用已有淡蓝色方形箭头；
  - 网络问题继续统一走项目内自定义优美弹层；
  - 只修明显原始的部分，不误动成熟页面。
