# round397 社区帖子详情键盘态头部位移复核与结构性收口

## 1. 本轮背景
- 承接 `round396`。
- 上轮已经拿到两条关键结论：
  - `PostDetail` 深层页主 Tab 隐藏链路已形成真机正证据；
  - 评论输入区不再立刻误触主导航回到 `Profile`；
  - 但键盘弹起后，帖子详情头部会重新贴近系统状态栏，顶部安全区仍未闭环。
- 用户同时要求：
  - 顶部风格、返回按钮、合理留白与状态栏避让必须持续统一；
  - 每轮都要把真实结论详细写入中文文档；
  - 每轮完成后直接提交并推送到 `main`。

## 2. 本轮目标
- 复核删除 `hideTabBar setParams` 后，返回社区时是否还会出现 React Navigation 开发态告警；
- 在真机上继续验证 `PostDetail` 键盘态头部是否仍会贴到状态栏；
- 若问题仍在，优先做最小结构性收口，不改成熟视觉语言，只修真实布局缺陷；
- 将本轮结论诚实写入文档，不把仍未闭环的问题提前写成通过。

## 3. 本轮代码变更

### 3.1 `src/screens/community/useHideMainTabBar.js`
- 本轮未再追加逻辑，只继续沿用上一轮已删除 `navigation.setParams({ hideTabBar })` 的版本；
- 目的：
  - 先用真机回归确认“只保留父级 `tabBarStyle` 隐藏控制”是否已经足够稳定；
  - 避免再次混入无效导航参数，污染真机证据。

### 3.2 `src/screens/community/PostDetailScreen.js`
- 先尝试过一版最小数值补丁：
  - 记录并复用历史最大 `top inset`；
  - 新增 `state.community.postDetail.topInset.*` 锚点用于抓证。
- 真机验证后确认：
  - 单纯锁定 `insets.top` 数值并不能阻止头部整体上移；
  - 真正把头部顶上去的，是 Android 键盘弹起时整个 `KeyboardAvoidingView` 容器跟着被压缩/平移。
- 因此本轮继续做了更小但更准的结构收口：
  - 将固定头部 `renderHeader()` 移出 `KeyboardAvoidingView`；
  - 仅让正文滚动区与底部评论输入区位于 `KeyboardAvoidingView` 内；
  - 保留统一淡蓝方形返回按钮、标题区、右上角收藏/分享与原有毛玻璃视觉，不改变成熟 UI 风格。
- 这次调整的设计意图：
  - 头部属于固定导航区，不应该随键盘避让整体上移；
  - 键盘联动应该只影响内容区与输入区，而不是把顶部导航再次压到系统状态栏下面。

## 4. 本轮真机证据

### 4.1 社区内容态作为本轮稳定起点
- 证据：
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round397_start_probe.xml`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round397_start_probe.png`
- 结论：
  - 当前前台稳定命中 `state.community.pageState.ready`；
  - 顶部从 `y=36` 起始；
  - `panel.community.devQa` 联调入口在内容态下可见，可继续稳定进入帖子详情。

### 4.2 删除 `setParams` 后重新进入帖子详情，主 Tab 继续隐藏
- 证据：
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round397_postdetail_open.xml`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round397_postdetail_open.png`
- 结论：
  - 前台明确命中 `screen.community.postDetail`；
  - 顶部 `action.community.postDetail.back` 继续使用统一淡蓝方形箭头；
  - 头部仍从 `y=48` 左右的安全区内开始可见；
  - 本轮抓证中未出现底部 `nav.tab.*`，说明主 Tab 隐藏链路没有回退。

### 4.3 键盘弹起后，问题从“主 Tab 误触”收敛为“头部整体被顶到 y=0”
- 证据：
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round397_after_comment_input.xml`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round397_after_comment_input.png`
- 结论：
  - 输入评论后，前台仍停留在 `screen.community.postDetail`；
  - 主 Tab 没有重新露出，说明上一轮关于主 Tab 隐藏稳定性的正结论仍成立；
  - 但头部返回按钮与标题重新贴到 `y=0`，仍然被平板顶部状态栏区域压住；
  - 这证明问题的根因不是 `insets.bottom` 或评论区误触，而是键盘态下整个顶部区域一起被避让容器挤上去了。

### 4.4 删除 `setParams` 后，返回链路开发态告警已消失
- 证据：
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round397_back_to_community_after_patch.xml`
  - `adb logcat` 抽查结果
- 结论：
  - 返回后没有再抓到：
    - `The action 'SET_PARAMS' with payload {"params":{"hideTabBar":false}} was not handled by any navigator`
  - 说明 `useHideMainTabBar.js` 中移除 `setParams` 的动作已经真实生效；
  - 这一条可以正式从“怀疑需要验证”收口为“已通过，后续只需防回归”。

### 4.5 第一版“锁定 top inset”补丁未真正解决键盘态位移
- 证据：
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round397_after_comment_input_fixed.xml`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round397_after_comment_input_fixed.png`
- 结论：
  - 尽管头部安全区锚点逻辑已做补丁；
  - 但在键盘态下，返回按钮和标题仍然回到 `y=0`；
  - 说明只锁 `insets.top` 数值不够，真正问题在于容器结构，而不是单个 padding 数值。

### 4.6 第二版结构性收口后，问题边界更明确，但仍未完全闭环
- 证据：
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round397_postdetail_before_final_keyboard_check.xml`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round397_after_comment_input_final.xml`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round397_after_comment_input_final.png`
- 结论：
  - 结构性调整后，内容区与输入区的键盘联动更清晰，主 Tab 继续保持隐藏；
  - 但最终抓证仍显示头部节点处于 `y=0` 起点；
  - 这说明当前 Android 平板上，键盘弹起时页面根窗口本身发生了更上层级的可视区域重排；
  - 换句话说，问题已不再是社区详情页内部单个组件 padding 写错，而更接近“当前页根布局与系统键盘/窗口尺寸策略之间仍有设计缺陷”。

## 5. 本轮诚实结论
- 已确认通过：
  - `PostDetail` 深层页主 Tab 隐藏稳定性没有回退；
  - 评论输入区仍不会把前台立刻误带回主导航；
  - 旧的 `hideTabBar setParams` 开发态告警已消失；
  - 统一淡蓝方形返回按钮、非键盘态顶部安全区与基础留白仍保持稳定。
- 已明确但尚未闭环：
  - 键盘态下，帖子详情头部仍会被整体顶到 `y=0`；
  - 当前问题根因已经从“局部 padding 数值不对”收敛为“根窗口/键盘避让结构仍需继续设计收口”；
  - 因此本轮不能把“帖子详情键盘态顶部安全区”写成 `PASS`。

## 6. 下一轮建议
- 优先继续核对：
  - `PostDetail` 所在上层容器是否还存在页面级 `KeyboardAvoidingView`、根容器高度按整屏而非可视窗口计算的问题；
  - 社区深层页是否需要统一抽出“固定头部 + 可避让内容区”的页面骨架组件。
- 若继续修补，建议顺序：
  - 先定位 `AppNavigator / Container / Screen 容器` 的页面级尺寸策略；
  - 再继续补 `PostDetail` 键盘态；
  - 最后再回到 `replyAuthor -> UserProfile` 与关注联动后续验收。

## 7. round398 继续修补记录

### 7.1 新发现的更上层根因
- 在继续上探页面骨架和 Android 入口后，发现 `android/app/src/main/AndroidManifest.xml` 中 `MainActivity` 仍全局使用：
  - `android:windowSoftInputMode="adjustPan"`
- 这意味着 Android 键盘弹起时，系统会优先把整页窗口向上平移，而不是把可视区域重新收缩给当前页面。
- 这与真机现场现象完全一致：
  - 评论输入时主 Tab 已经不再误触；
  - 但头部返回按钮会被整体顶到 `y=0`；
  - 说明问题并不只是 `PostDetailScreen` 内部某个 `paddingTop` 写错，而是系统键盘策略本身在推整页。

### 7.2 本轮代码修补
- `android/app/src/main/AndroidManifest.xml`
  - 将 `windowSoftInputMode` 从 `adjustPan` 改为 `adjustResize`；
  - 目的：
    - 让 Android 键盘弹起时优先重算可视高度，而不是平移整个页面；
    - 这更符合当前项目“顶部自绘头部 + 内容区/输入区自行避让”的页面结构。
- `src/screens/community/PostDetailScreen.js`
  - 将 Android 端 `KeyboardAvoidingView` 的 `behavior` 从 `height` 改为 `undefined`，仅保留 iOS 的 `padding`；
  - 目的：
    - 避免在 Android 已切到 `adjustResize` 后，又叠加一层 RN 端 `height` 压缩，导致页面再次双重收缩；
    - 继续保持“固定头部不参与键盘避让，正文与评论区跟随可视区域变化”的结构意图。

### 7.3 设计口径补充（写入文档，后续轮次必须持续遵守）
- 顶部不得被平板系统状态栏遮挡，不允许依赖“整屏高度”粗暴计算页面尺寸；
- 页面大小必须以系统状态栏、安全区、当前可视窗口为边界来布局；
- 统一淡蓝色方形返回按钮继续作为社区深层页返回入口，不另起一套样式；
- 键盘相关问题优先从系统窗口策略、根容器可视区和页面骨架查因，不再只靠局部加 `padding` 反复试错。
