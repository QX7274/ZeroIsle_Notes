# round391 社区个人主页真机入口补稳与头部对齐

## 1. 本轮背景
- 承接 `round390`。
- 社区首页、通知页、活动动态页、帖子详情页的顶部安全区与统一淡蓝返回按钮已经形成连续闭环。
- 当前剩余重点转向社区 `个人主页`：
  - 需要继续在真实平板上验证顶部不会被状态栏遮挡；
  - 需要确认刷新按钮是否也回到统一淡蓝方形语言；
  - 需要避免再次把“没有真正进入目标页”的取证噪声误记成页面故障。

## 2. 本轮目标
- 稳定进入社区 `个人主页`；
- 修复阻碍真机验证的入口可达性问题；
- 收口 `UserProfileScreen` 的 Android 顶部重复安全区与刷新按钮风格；
- 继续保持“只改明显原始部分，不动成熟内容区”的原则；
- 将本轮真实边界、回归点与结论完整写入中文文档。

## 3. 本轮执行过程

### 3.1 先澄清一个误区：之前并没有真正进入个人主页
- 起始复核证据：
  - `D:\ZeroIsle_Notes\.codex-tmp\round391_start.xml`
  - `D:\ZeroIsle_Notes\.codex-tmp\round391_start.png`
- 从社区帖子作者区尝试进入个人主页后，抓到：
  - `D:\ZeroIsle_Notes\.codex-tmp\round391_userprofile_probe.xml`
  - `D:\ZeroIsle_Notes\.codex-tmp\round391_userprofile_probe.png`
- 写实结论：
  - 这次点击实际上仍进入了 `screen.community.postDetail`；
  - 因此不能把这份证据当成“个人主页修前状态”；
  - 也不能基于它直接修改 `UserProfileScreen`。

### 3.2 真正的问题不是个人主页坏，而是联调入口在内容态下被隐藏
- 进一步核对 `CommunityScreen` 源码后确认：
  - 社区页本来就有 `社区深层页验证入口`；
  - 其中已经包含 `个人主页` 快速入口；
  - 但此前该联调面板只在 `ListEmptyComponent` 内展示；
  - 当前社区已有真实帖子时，列表内容态不会显示这个联调入口。
- 这意味着：
  - 真机上虽然功能存在，但内容态下测试人员很难稳定命中 `个人主页`；
  - 前面反复点到帖子详情，不是 `UserProfileScreen` 自身坏，而是社区内容态缺少稳定调试入口。

### 3.3 本轮代码收口
- `D:\ZeroIsle_Notes\src\screens\community\CommunityScreen.js`
  - 将社区深层页联调面板补到列表 footer 区域；
  - 这样在有真实帖子内容时，滚动到底部也能继续看到：
    - `帖子详情`
    - `粉丝列表`
    - `关注列表`
    - `个人主页`
    - `搜索用户结果`
    - `搜索帖子结果`
  - 这次改动仅在 `__DEV__` 下生效，不影响正式业务展示。

- `D:\ZeroIsle_Notes\src\screens\community\UserProfileScreen.js`
  - 将根容器 Android 顶部额外补白从 `Math.max(insets.top, 12)` 收口为 `0`；
  - 保留 iOS 侧必要安全区承接；
  - 将刷新按钮从偏原型态的圆白按钮收口为与既有淡蓝返回按钮同语言的：
    - `40x40`
    - `12` 圆角
    - 淡蓝底
  - 没有改动个人简介、统计区、最近发布、编辑资料等成熟内容模块。

### 3.4 本轮中途真实回归点也必须写实记录
- 第一次把联调面板搬到 footer 后，真机前台出现 RedBox：
  - `renderDevQaPanel is not a function (it is undefined)`
  - 证据：
    - `D:\ZeroIsle_Notes\.codex-tmp\round391_after_patch_current.png`
- 根因：
  - `footer` 这个 `useMemo` 在代码里定义得早于 `renderDevQaPanel`；
  - 热更新后 footer 先执行，直接引用了尚未初始化的常量函数。
- 处理方式：
  - 将 `footer` 挪到 `renderDevQaPanel` 之后；
  - 再执行热更新并重新拉起真机前台。

- 热更新恢复过程中还出现了一次空白根容器过渡态：
  - `D:\ZeroIsle_Notes\.codex-tmp\round391_after_reload_applied.png`
- 这个空白页不能误写成“首页/社区/个人主页布局回退”；
  - 它属于开发态热更新/前台恢复过程中的短暂过渡；
  - 后续强制重启应用后，业务首页已经正常恢复：
    - `D:\ZeroIsle_Notes\.codex-tmp\round391_relaunch.xml`
    - `D:\ZeroIsle_Notes\.codex-tmp\round391_relaunch.png`

### 3.5 联调入口已在真实内容态下稳定露出
- 回到社区页并滚动到底部后，证据：
  - `D:\ZeroIsle_Notes\.codex-tmp\round391_community_reenter.xml`
  - `D:\ZeroIsle_Notes\.codex-tmp\round391_community_reenter.png`
- 现场结论：
  - `社区深层页验证入口` 已在真实帖子内容态下可见；
  - `个人主页` 按钮稳定可点；
  - 这轮的真机测试可达性修补已经生效。

### 3.6 个人主页修后真机终态证据
- 点击 `个人主页` 联调入口后，抓到：
  - `D:\ZeroIsle_Notes\.codex-tmp\round391_userprofile_after_fix.xml`
  - `D:\ZeroIsle_Notes\.codex-tmp\round391_userprofile_after_fix.png`
- 现场结论：
  - 页面已明确命中 `screen.community.userProfile`；
  - `panel.community.userProfile.header` 起始于 `y=36`；
  - `action.community.userProfile.back` 继续是统一淡蓝色方形箭头按钮；
  - `action.community.userProfile.refresh` 已与返回按钮回到同一按钮语言；
  - 标题、副标题、头像卡、统计区、编辑资料按钮与最近发布都处在安全可视区内；
  - 顶部没有再出现社区首页之外额外多空一层的问题。

## 4. 本轮结论
- `CommunityScreen`：
  - 真机联调入口在内容态下的可达性问题已收口；
  - 后续做社区深层页真机回归不再需要依赖误点帖子作者区。

- `UserProfileScreen`：
  - Android 顶部重复安全区问题已收口；
  - 统一淡蓝返回按钮与刷新按钮风格已对齐；
  - 真机终态确认头部从 `y=36` 起始；
  - 可正式记为 `PASS`。

## 5. 本轮风险与边界
- 本轮只对两处做了最小修补：
  - 社区联调入口可达性；
  - 个人主页头部安全区与刷新按钮风格。
- 中途出现过一次真实 RedBox 与一次热更新空白过渡态；
  - 都已定位与恢复；
  - 不能误记为业务页面本身回退。
- `CommunityScreen` 的联调面板仍然只在 `__DEV__` 可见；
  - 不会影响正式业务路径。

## 6. 下一轮建议重点
- 继续沿社区个人主页内部链路做真机复测：
  - `最近发布 -> PostDetail`
  - 关注/取消关注成功态
  - 真实失败态下的统一网络异常弹层
- 继续保持：
  - 顶部安全区统一
  - 深层页返回按钮统一使用既有淡蓝方形箭头
  - 不出现异常留白
  - 不误把开发态热更新噪声当成业务页面故障
