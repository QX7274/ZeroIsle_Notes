# round318 通知页空态留白与承接卡片收口

## 目标
- 从社区首页头部真实入口继续验证 `通知消息` 页面。
- 不重复修改已经成熟的头部、安全区、返回按钮和顶部操作按钮，只处理平板上明显原始的空态留白问题。

## 真机现场
- 本轮从社区页头部右上角铃铛按钮实际进入 `通知消息`。
- 真机确认：
  - 页面可达；
  - 顶部未被系统状态栏遮挡；
  - 淡蓝方形返回按钮、刷新按钮和 `全部标记已读` 按钮样式都正常。
- 但进入空态后能明显看到一个问题：
  - 头部操作区下方到空态内容之间存在非常大的白区；
  - `暂无通知消息` 图标和按钮被硬性垂直居中在整页剩余空间里，平板上显得页面像被掏空，原始感很强。

## 原因分析
- `NotificationsScreen` 的 `FlatList` 在空态时使用 `emptyListContent`，其中包含 `justifyContent: 'center'`；
- 同时空态块本身只是简单的图标、文案和按钮，没有承担足够的页面结构；
- 两者叠加后，空态被整体悬空到页面中部，导致顶部以下出现过大的留白。

## 本轮修改
- `src/screens/community/NotificationsScreen.js`
  - 取消空态列表容器的垂直强制居中；
  - 为通知页空态块补齐更完整的卡片式承接；
  - 增加合理的最小高度、边框、背景和内部垂直居中，让空态内容由一张卡片承接，而不是直接悬空在页面中间。

## 真机证据
- 修复前：`.local/android-mcp-server/round318_notifications_open.png/.xml`
- 修复后：`.local/android-mcp-server/round318_notifications_empty_after_layout_fix.png/.xml`
- 从个人主页返回社区现场：`.local/android-mcp-server/round318_back_to_community.png/.xml`

## 校验
- 已执行：
  - `npx eslint src/screens/community/NotificationsScreen.js`
- 结果：
  - 无 error；
  - 仅保留既有 `react-native/no-inline-styles` warnings 3 条。

## 本轮结论
- 通知页空态当前已从“整页被掏空”的原始观感，收口为“头部下方接一张完整空态卡片”的更合理布局。
- 这轮没有改真实通知列表态逻辑，也没有改顶部成熟交互样式。

## 下一轮建议
- 继续从社区头部真实入口补测 `活动动态` 页面，确认它和通知页是否还存在同类大屏留白问题；
- 若后端后续返回真实通知数据，再继续补测列表项点击、已读状态和 `全部标记已读` 的成功态证据。
