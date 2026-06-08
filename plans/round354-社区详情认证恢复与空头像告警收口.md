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
