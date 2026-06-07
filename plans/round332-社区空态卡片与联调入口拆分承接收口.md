# round332 社区空态卡片与联调入口拆分承接收口

## 本轮目标
- 继续处理社区页平板大屏下仍显原始的真实布局问题。
- 保持顶部安全区、统一淡蓝按钮体系、右下角 `发布` 按钮和成熟头部不变。
- 只收口社区空态页中“空态卡片与联调入口被塞进同一张超高白板”的异常观感。

## 问题来源
- `round331` 已经把社区空态从“卡片外部裸露大块白区”收回卡片内部。
- 但真机继续复核发现，`state.community.empty` 变成一张高度过大的超高空态卡片：
  - 空态提示本身只占上半段；
  - 下半段同时包着 `panel.community.devQa`；
  - 平板上看起来仍像一整块很原始的大白板。

## 根因定位
- 文件：`src/screens/community/CommunityScreen.js`
- 具体原因：
  - `renderEmpty()` 里把“真正的空态提示”和“开发联调入口”放在同一个 `emptyContainer` 中；
  - `emptyContainer` 又承接了较大的剩余可视高度，因此联调区被一并吸进同一张大卡片；
  - 结果不是页面外部留白，而是页面内部结构层次混乱、单卡片高度异常。

## 本轮代码处理
- 把开发联调入口从 `renderEmpty()` 的空态卡片内部拆出，抽为独立 `renderDevQaPanel()`。
- 保留空态卡片自身的完整承接，但把高度收口到更合理的卡片范围：
  - 移除 `emptyContainer` 的 `flexGrow`
  - 改为 `minHeight: 420`
- 保留列表整体的页面流式排布，不再让整个空态列表强行吃满剩余视区：
  - 移除 `emptyListContainer` 的 `flexGrow`
- 将 `panel.community.devQa` 改为独立卡片承接：
  - 增加圆角、边框、背景和内边距
  - 与空态卡片之间保持固定垂直间距

## 未触碰范围
- 未改社区顶部标题区、搜索区、分类区
- 未改右上角刷新/通知/活动入口
- 未改右下角 `发布` FAB 的位置与样式
- 未改项目内统一异常提示机制

## 真机复核
- 设备：`HGR3Y9MA`
- 安装命令：
  - `./gradlew.bat :app:installDebug --console=plain`
- 端口反向代理：
  - `adb -s HGR3Y9MA reverse tcp:8081 tcp:8081`
  - `adb -s HGR3Y9MA reverse tcp:8001 tcp:8001`

## 现场证据
- 安装后再次遇到历史性的瞬时白屏容器态，不作为布局结论依据：
  - `tmp_round332_community_after_split.png`
  - `tmp_round332_community_after_split.xml`
- 稳定首页恢复证据：
  - `tmp_round332_community_after_split_valid.png`
  - `tmp_round332_community_after_split_valid.xml`
- 社区页最终有效证据：
  - `tmp_round332_community_final_valid.png`
  - `tmp_round332_community_final_valid.xml`

## 最终验证结论
- 社区顶部标题、搜索区、分类区和右上角操作区仍未被系统状态栏遮挡。
- 右下角 `发布` 按钮仍位于独立悬浮位置，没有被本轮布局调整破坏。
- UI 树显示：
  - `state.community.empty`：`[24,413][1176,1043]`
  - `panel.community.devQa`：`[24,1079][1176,1317]`
  - `action.community.createPost`：`[990,1776][1164,1851]`
- 说明：
  - 空态卡片已经从“超高白板”收口成更合理的一张中段卡片；
  - 联调入口已经脱离空态卡片，以下方独立卡片承接；
  - 页面层级更清楚，平板观感明显比上一轮自然。

## 本轮结论
- 社区空态页的大屏原始观感本轮继续有效收口一轮。
- `round331` 解决的是“卡片外部裸露大块白区”；
- `round332` 解决的是“卡片内部结构过大、空态与联调区混成一张超高白板”。
- 安装后偶发瞬时白屏容器态继续单独记为联调时序问题，不覆盖本轮社区布局修复结论。
