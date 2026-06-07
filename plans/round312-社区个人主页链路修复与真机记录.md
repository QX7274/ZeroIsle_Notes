# round312 社区个人主页链路修复与真机记录

## 目标
- 打通社区 `UserProfile` 深层页真实导航链，避免从粉丝列表、社区搜索等入口点击用户后出现隐藏断链。
- 仅重做“看着明显原始”的社区个人主页页面，保持成熟页面和既有淡蓝风格不被误伤。
- 真机重点校验顶部安全区、统一返回按钮、底部栏隐藏策略、页内反馈样式与回退链稳定性。

## 本轮问题拆解
- 问题1：`UserProfile` 路由未注册，导致 `FollowersScreen` 与 `CommunitySearchScreen` 的跳转为隐藏断链。
- 问题2：`FollowersScreen` 原先把 follow 记录 id 当作用户 id 传递，进入个人主页时对象可能错误。
- 问题3：旧版 `src/components/community/UserProfile.js` 视觉层级过于原始，和社区已统一的淡蓝卡片、方形返回按钮、安全区写法不一致。
- 问题4：首轮改造后真机实际出现资源引用错误，`default-avatar.png` 路径不存在，触发 RN 编译红屏。

## 本轮实施
- 新增 `src/screens/community/UserProfileScreen.js`
  - 承担真正可导航的社区个人主页页壳。
  - 顶部使用 `safe area` 顶部占位，保证不被系统状态栏遮挡。
  - 复用统一淡蓝返回按钮与刷新按钮，不使用原生头。
  - 对资料不全、能力未接通场景统一使用页内状态卡片，不走默认安卓弹窗。
- 重做 `src/components/community/UserProfile.js`
  - 保留统计、最近发布、关注/发消息等核心能力区块。
  - 收口为社区现有淡蓝卡片体系，避免旧版大色块和生硬硬切。
  - 默认头像改为仓库真实存在的 `default_avatar.png`。
- 修复导航与入口参数
  - `AppNavigator` 注册 `UserProfile`。
  - `src/screens/community/index.js` 导出 `UserProfileScreen`。
  - `FollowersScreen` 改为优先传 `item.userId`。
  - `CommunitySearchScreen` 补传 `initialUser`，提高资料首屏可用性。
  - `CommunityScreen` 的开发联调 QA 区补充 `个人主页` 入口，便于空社区场景下继续真机验收。

## 真机验证
- 设备：`HGR3Y9MA`
- Metro：`8081` 监听正常
- 关键证据：
  - 编译红屏复现：`.local/android-mcp-server/round312_launch_after_user_profile_changes.xml/.png`
  - 修复资源路径后恢复：`.local/android-mcp-server/round312_after_avatar_fix.xml/.png`
  - 从通知页返回社区：`.local/android-mcp-server/round312_back_from_notifications_to_community.xml/.png`
  - 社区 QA 入口进入个人主页：`.local/android-mcp-server/round312_user_profile_open.xml/.png`
  - 个人主页刷新后复核：`.local/android-mcp-server/round312_user_profile_after_refresh.xml/.png`
  - 个人主页返回社区：`.local/android-mcp-server/round312_back_from_user_profile.xml/.png`

## 本轮结论
- `UserProfile` 深层页已从“不可达隐藏断链”恢复为真机可达页面。
- 顶部未被系统状态栏压住，统一使用已有淡蓝色方形返回按钮。
- 进入个人主页后底部 tab 已正常隐藏，返回社区后底部 tab 正常恢复。
- 当前后端对开发联调用户资料返回不完整，因此页面展示为“基础资料 + 统计/最近发布部分降级提示”，但整个过程已改为页内卡片提示，没有出现默认安卓错误弹窗。
- 目前仍缺真实内容态数据，后续需要在后端具备真实粉丝、关注、帖子数据后继续核验：
  - 个人主页最近发布卡片点击帖子详情
  - 粉丝/关注列表进入目标用户主页后的对象正确性
  - 关注状态切换与统计联动

## 下一轮建议
- 优先在真实联网数据环境下继续复测 `Followers -> UserProfile -> PostDetail` 与 `CommunitySearch -> UserProfile` 两条链。
- 若后端仍长期不给完整资料，可考虑新增单独的用户详情接口，避免个人主页只能依赖列表残缺字段拼装。
