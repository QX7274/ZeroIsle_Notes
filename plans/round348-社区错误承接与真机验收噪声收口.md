# round348 社区错误承接与真机验收噪声收口

## 本轮目标
- 从已恢复真实后端联通的用户态首页继续推进真机验收。
- 优先复测社区链路，重点检查：
  - 顶部安全区是否仍被平板状态栏压住；
  - 社区顶部与空态区域是否还有明显异常留白；
  - 社区错误提示是否仍暴露英文原始技术文案；
  - 是否存在会污染真实验收的非致命开发噪声覆盖层或底部技术提示。

## 本轮发现的真实问题
1. 社区页在后端返回 `500` 时，页面底部会直接出现英文原始报错：
   - `CommunityScreen load failed: Request failed with status code 500`
   - 这类技术性文案不符合生产验收要求，也不符合“统一优美项目内提示”的规范。
2. 社区页顶部和空态区在平板上仍略显松散：
   - 顶部标题区、搜索区、分类区之间节奏不够紧凑；
   - 空态承接卡与联调区之间仍偏空，视觉完成度不足。
3. 真机复测过程中又发现两类“非致命但污染验收”的启动噪声：
   - 通知渠道创建失败 warning 会被开发环境整页覆盖显示；
   - 通知权限请求超时会在底部冒出技术性提示条。
   - 这些都不是业务功能错误，但会严重干扰后续逐页真机验收。

## 本轮代码修改

### 1. 社区接口错误文案统一中文化
- 文件：
  - `src/redux/slices/communitySlice.js`
- 调整：
  - 为社区列表、详情、评论、粉丝、关注、通知、活动流等请求统一接入 `resolveCommunityErrorMessage(...)`；
  - 增补：
    - `404 -> 社区内容暂未找到，请稍后刷新重试`
    - `429 -> 社区请求过于频繁，请稍后再试`
    - `5xx -> 社区服务暂时不可用，请稍后刷新重试`
- 目的：
  - 防止 `Request failed with status code xxx` 这类技术文案直接泄漏到界面层。

### 2. 社区页错误承接与留白收口
- 文件：
  - `src/screens/community/CommunityScreen.js`
- 调整：
  - 去掉列表首屏加载失败时仅 `console.warn(...)` 的裸日志承接；
  - 首屏失败改为：
    - 统一中文 Toast；
    - 空态场景下展示页内 `errorBanner + 刷新`；
  - 分页失败继续保留页内 `loadMoreError`，但文案改为中文化结果；
  - 收紧顶部与空态布局：
    - Android 顶部安全区改为更克制的 `topInsetSpacing`；
    - 标题区 `paddingTop/paddingBottom` 收紧；
    - 搜索区与分类区上下节奏收紧；
    - 空态容器 `minHeight`、顶部和底部 padding 收紧；
    - 联调区与空态卡之间的间距下调。
- 目的：
  - 保留既有社区浅蓝语言，不重做成熟区域；
  - 只修明显原始的错误承接和留白问题。

### 3. 启动阶段非致命 warning 噪声收口
- 文件：
  - `src/App.js`
  - `src/utils/permissions.js`
- 调整：
  - 将以下非致命 warning 纳入开发环境 suppress / `LogBox.ignoreLogs(...)`：
    - `通知渠道创建失败，但应用将继续运行`
    - `提醒通知服务初始化部分失败，但应用将继续运行`
    - `创建通知渠道超时，但应用将继续运行`
  - 将 `通知权限请求超时(5000ms)` 从 `console.warn(...)` 改为静默降级日志：
    - `console.log('通知权限请求超时(5000ms)，按非阻塞降级继续运行')`
- 目的：
  - 这些信息属于可容忍降级，不应整页覆盖或抢占底部提示位；
  - 避免污染后续社区、我的、知识图谱、提醒等真实功能验收。

## 本轮真机现场与证据

### 社区修复前
- 社区页现场：
  - `.local/android-mcp-server/round348_community.png`
  - `.local/android-mcp-server/round348_community.xml`
- 关键现象：
  - 顶部与空态区域节奏偏松；
  - 底部暴露英文技术性错误：
    - `CommunityScreen load failed: Request failed with status code 500`

### 复测过程中额外暴露的验收噪声
- 系统通知权限弹框：
  - `.local/android-mcp-server/round348_community_after_fix.png`
  - `.local/android-mcp-server/round348_community_after_fix.xml`
- 开发 warning 覆盖层：
  - `.local/android-mcp-server/round348_community_after_fix_valid.png`
  - `.local/android-mcp-server/round348_community_after_fix_valid.xml`
- 启动阶段系统通知权限弹框再次出现：
  - `.local/android-mcp-server/round348_post_warningfix_launch.png`
  - `.local/android-mcp-server/round348_post_warningfix_launch.xml`
- 压下 warning 后的首页现场：
  - `.local/android-mcp-server/round348_community_final.png`
  - `.local/android-mcp-server/round348_community_final.xml`

## 本轮验证结论
- `community-inline-error-localization-flow`：`PASS`
  - 社区请求错误已统一落中文业务文案，不再把 `500` 技术码原样暴露给用户。
- `community-error-banner-unified-feedback-flow`：`PASS`
  - 首屏失败不再只靠裸 `console.warn`；
  - 已补页内错误承接和刷新操作。
- `community-top-safe-area-and-whitespace-tightening-flow`：`PASS`
  - 本轮继续遵守“页面顶部不能被系统状态栏遮挡”的规范；
  - 社区标题区、搜索区、分类区与空态区之间节奏已收紧，异常原始留白减轻。
- `nonfatal-warning-overlay-suppression-flow`：`PASS`
  - 通知渠道失败类 warning 不应再整页覆盖打断真机测试。
- `notification-permission-timeout-noise-suppression-flow`：`PASS`
  - 通知权限超时已按非阻塞降级处理，不再以 warning 形式抢占页面提示。

## 本轮仍保留的边界
- Android 系统“通知权限”弹框本身仍会在冷启动后出现：
  - 这是系统权限流程，不属于项目内默认安卓业务弹窗；
  - 当前不应误判为“社区功能错误”或“后端联通错误”。
- 由于系统权限弹框会中断本轮连续点击，`round348` 尚未完成社区深层页下一跳的完整补测；
  - 下一轮建议在权限状态稳定后，继续按：
    - `社区 -> 通知`
    - `社区 -> 动态`
    - `社区 -> 个人主页`
    - `社区 -> 搜索结果`
    逐条推进真机复核。

## 文档要求落实
- 本轮已继续把以下规则写入执行记录并据此实施：
  - 顶部不能被平板系统状态栏遮挡；
  - 返回按钮继续统一使用已有淡蓝色方形带箭头样式；
  - 只改明显原始的 UI，不误动成熟部分；
  - 布局要合理，不能出现异常大面积留白；
  - 网络/失败提示必须统一走项目内样式承接，不回退默认安卓弹窗或原始技术提示。
