# round390 社区深层页 Activity 与 PostDetail 真机补证闭环

## 1. 本轮背景
- 承接 `round389`。
- 上轮已经完成以下事实：
  - 社区首页顶部留白已收口；
  - 通知页深层头部重复安全区问题已拿到稳定真机修后证据；
  - `ActivityScreen` 与 `PostDetailScreen` 代码已完成同源修正；
  - 但两页还缺少“修后终态截图 + XML”的稳定双证据。

## 2. 本轮目标
- 从真实平板前台继续补齐以下两页的真机终态证据：
  - `活动动态`
  - `帖子详情`
- 继续核对：
  - 顶部不会被系统状态栏遮挡；
  - 不存在异常顶部留白；
  - 深层页返回按钮继续统一为已有淡蓝色方形箭头；
  - 不误把取证过程中的前台切换噪声当成页面真实故障。

## 3. 本轮执行过程

### 3.1 当前前台与社区首页基线复核
- 初始抓取证据：
  - `D:\ZeroIsle_Notes\.codex-tmp\round390_current.xml`
  - `D:\ZeroIsle_Notes\.codex-tmp\round390_current.png`
- 结论：
  - 当前前台起始停留在 `通知消息`；
  - 头部卡片已在 `y=36` 起始，说明 `round389` 通知页收口仍成立。

- 退回社区首页并复核基线：
  - `D:\ZeroIsle_Notes\.codex-tmp\round390_community_from_notifications.xml`
  - `D:\ZeroIsle_Notes\.codex-tmp\round390_community_from_notifications.png`
- 结论：
  - 社区首页标题区仍从 `y=36` 起始；
  - 说明 `round388` 的首页顶部收口没有回退；
  - 本轮深层页验证可以继续以这个基线作为参照。

### 3.2 Activity 页真机补证
- 从社区首页右上角真实入口进入 `活动动态`：
  - `D:\ZeroIsle_Notes\.codex-tmp\round390_activity_after_fix.xml`
  - `D:\ZeroIsle_Notes\.codex-tmp\round390_activity_after_fix.png`
- 现场结论：
  - `panel.community.activity.header` 起始于 `y=36`；
  - 顶部卡片不再比社区首页额外下沉；
  - `action.community.activity.back` 继续是统一淡蓝色方形返回按钮；
  - `action.community.activity.refresh` 已是同节奏的淡蓝按钮，不再是原型态圆白按钮；
  - 空态卡片承接位置自然，没有出现“头部下面多空一层”的异常留白。

### 3.3 PostDetail 页第一次补证误判的澄清
- 本轮第一次尝试抓取 `帖子详情` 时，曾出现两份非目标证据：
  - `D:\ZeroIsle_Notes\.codex-tmp\round390_postdetail_after_fix.xml`
  - `D:\ZeroIsle_Notes\.codex-tmp\round390_postdetail_after_fix_retry.xml`
- 这两次抓取到的前台分别落在首页链路上，不是 `PostDetail` 真正终态。
- 这一步必须写实记录：
  - 问题不是“帖子详情打不开”；
  - 而是抓证据过程中前台状态被其他页面链路打断，导致截到了错误页面。

### 3.4 PostDetail 页接口成功证据
- 为了区分“页面真的坏了”与“抓证据时前台跑偏”，本轮先补做运行日志：
  - 点击社区帖子后抓取 logcat；
  - 关键结果如下：
    - `API响应成功: GET /community/posts/33b31e0e-0c38-45c4-882d-d13064f90f94/`
    - `API响应成功: GET /community/comments/by_post/?post_id=33b31e0e-0c38-45c4-882d-d13064f90f94`
- 结论：
  - 帖子详情接口和评论接口都真实成功返回；
  - 因此前面的误抓不能被写成“详情页仍有业务故障”。

### 3.5 PostDetail 页终态真机补证
- 在确认详情接口已经成功返回后，立即抓取当前前台终态：
  - `D:\ZeroIsle_Notes\.codex-tmp\round390_postdetail_live_probe.xml`
  - `D:\ZeroIsle_Notes\.codex-tmp\round390_postdetail_live_probe.png`
- 现场结论：
  - 页面已明确命中 `screen.community.postDetail`；
  - 头部从 `y=36` 起始；
  - `action.community.postDetail.back` 继续为统一淡蓝色方形箭头；
  - 右侧书签与分享按钮布局正常；
  - 帖子标题、正文、统计区与评论输入区都在安全可视范围内；
  - 没有顶部遮挡，也没有额外异常留白。

## 4. 本轮结论
- `ActivityScreen`：
  - 真机补证完成；
  - 可正式从 `FOLLOW_UP` 转为 `PASS`。
- `PostDetailScreen`：
  - 真机补证完成；
  - `round389` 的顶部重复安全区修正确认已真实生效；
  - 可正式从 `FOLLOW_UP` 转为 `PASS`。

## 5. 本轮风险与边界
- 本轮没有新增社区页面代码修改；
- 主要工作是补齐真机实证与澄清误判来源；
- 风险较低；
- 但后续仍要继续沿社区更深链路复核：
  - `个人主页`
  - 真实数据内容态
  - 真实失败态下的统一网络异常弹层
  - 页面顶部安全区与按钮风格是否始终一致

## 6. 下一轮建议重点
- 从社区首页继续进入 `个人主页` 及其内部链路；
- 在真实失败场景下继续验证：
  - 不出现默认安卓弹窗；
  - 继续保持项目内统一优雅网络异常弹层；
  - 顶部安全区、统一淡蓝返回按钮和留白节奏不回退。
