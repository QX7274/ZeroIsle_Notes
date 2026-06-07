# round317 个人主页刷新时清理旧状态卡片

## 目标
- 继续沿社区个人主页做真机交互细节验证。
- 重点确认：当用户先点过 `关注` 或 `发消息` 等按钮后，再点击右上角刷新按钮，顶部旧状态卡片是否会在新一轮资料刷新期间继续残留，造成误导。

## 真机发现
- round316 已确认：
  - `关注` 写回失败时会在顶部显示红色错误卡片；
  - `发消息` 会显示蓝色信息卡片；
  - 点击刷新后最终会回到 `部分资料已降级展示` 的资料状态提示。
- 继续检查代码后发现，原逻辑在 `handleRefresh` 中只是触发 `loadProfile(true)`，但不会先清掉旧的 `statusCard`。
- 这意味着：
  - 用户如果刚经历了 `关注状态更新失败` 或 `已关注该用户` 这类按钮级状态，
  - 在新的刷新请求完成前，旧状态会继续挂在顶部，
  - 容易让人误以为“这还是当前最新状态”，而不是上一轮按钮操作残留。

## 本轮修改
- `src/screens/community/UserProfileScreen.js`
  - 在 `handleRefresh` 开始时先执行 `setStatusCard(null)`；
  - 让个人主页在进入新一轮资料刷新时，先清空旧的按钮级状态卡片，再等待新的资料状态结果回填。

## 真机证据
- 刷新后最终资料提示：`.local/android-mcp-server/round317_user_profile_after_refresh.png/.xml`
- 刷新期间旧状态不再残留：`.local/android-mcp-server/round317_user_profile_refresh_inflight.png/.xml`
- 再次触发旧状态后刷新，页面已先回到无旧状态的干净刷新态：`.local/android-mcp-server/round317_user_profile_follow_error_before_refresh_fix.png/.xml`

## 校验
- 已执行：
  - `npx eslint src/screens/community/UserProfileScreen.js src/components/community/UserProfile.js`
- 结果：
  - 无 error；
  - 仅保留 `UserProfile.js` 既有 `react-native/no-inline-styles` warnings 4 条。

## 本轮结论
- 个人主页现在在点击刷新时，不会再把上一轮 `关注失败`、`已关注` 或 `私信入口仍在联调` 这类按钮级状态继续悬挂到新请求期间。
- 新一轮资料刷新会先回到更干净的页面状态，随后再根据真实返回结果显示 `部分资料已降级展示` 或其他新的资料状态。

## 下一轮建议
- 若后端允许成功写回关注关系，继续补测：
  - `关注成功 -> 刷新 -> 状态卡是否正确切换`
  - `关注成功 -> 计数是否联动`
- 若社区仍缺真实帖子，继续沿其他页面查找类似“旧状态残留”或“刷新语义不清”的细节问题。
