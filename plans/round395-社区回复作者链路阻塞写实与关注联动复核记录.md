# round395 社区回复作者链路阻塞写实与关注联动复核记录

## 1. 本轮背景
- 承接 `round394`。
- 上轮已经完成：
  - `帖子详情 -> 作者 -> 个人主页`
  - `帖子详情 -> 评论作者 -> 个人主页`
  - `个人主页 -> 返回帖子详情`
- 本轮继续追两条仍未闭环的真实链路：
  - `回复作者 -> 个人主页`
  - 帖子详情关注状态与个人主页状态联动

## 2. 本轮目标
- 不盲改代码，先在真机上确认：
  - 当前是否存在可直接点击的 `replyAuthor` 回复作者入口；
  - 若需现场生成回复，阻塞点究竟是业务故障还是系统层输入法问题；
  - 关注按钮是否真的发生了状态切换，而不是点按未命中；
  - 社区深层页顶部安全区、统一淡蓝返回按钮、合理留白是否保持稳定。

## 3. 本轮真机证据

### 3.1 起点与帖子详情恢复
- 证据：
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round395_back_to_postdetail_start.xml`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round395_back_to_postdetail_start.png`
- 现场结论：
  - 前台已回到 `screen.community.postDetail`；
  - `action.community.postDetail.back` 仍是统一淡蓝色方形带箭头返回按钮；
  - 帖子详情顶部继续从 `y=36` 起始，没有被平板顶部状态栏遮挡；
  - 页面没有新增异常顶部留白。

### 3.2 主动生成回复时命中系统输入法弹窗
- 证据：
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round395_after_reply_submit.xml`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round395_after_reply_submit.png`
- 现场结论：
  - 在评论区尝试提交回复后，前台弹出的不是业务错误，也不是默认安卓网络异常弹窗；
  - 当前实际弹出的是系统层 `选择输入法` 弹窗；
  - 因此本轮不能把“回复作者链路未闭环”误写成前端回复功能故障。

### 3.3 关闭输入法弹窗后，回复上下文仍保留在帖子详情
- 证据：
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round395_after_ime_dialog_dismiss.xml`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round395_after_ime_dialog_dismiss.png`
- 现场结论：
  - 关闭系统输入法弹窗后，前台仍明确停留在 `screen.community.postDetail`；
  - 回复上下文仍在：
    - `正在回复 user_8000`
    - 输入框内容 `round395_reply`
  - 这说明本轮至少可以确认：
    - 回复 UI 没有崩；
    - 页面没有异常跳转；
    - 当前主阻塞是系统输入法接管，而不是前端界面失效。

### 3.4 关注状态联动复核尚未形成有效切换证据
- 证据：
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round395_follow_toggle_from_postdetail.xml`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round395_follow_toggle_from_postdetail.png`
- 现场结论：
  - 本轮执行点按后，`action.community.postDetail.follow` 抓到的仍是 `已关注`；
  - 当前没有形成“切换前 -> 切换后”的有效双证据；
  - 因此本轮不能诚实宣称“关注状态联动已通过”。

### 3.5 再次进入个人主页后，顶部规范与头部语言继续稳定
- 证据：
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round395_userprofile_after_follow_toggle.xml`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round395_userprofile_after_follow_toggle.png`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round395_current_reentry.xml`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round395_current_reentry.png`
- 现场结论：
  - 前台可再次稳定命中 `screen.community.userProfile`；
  - `panel.community.userProfile.header` 继续从 `y=36` 起始；
  - `action.community.userProfile.back` 与 `action.community.userProfile.refresh` 仍保持统一淡蓝方形头部语言；
  - 个人主页顶部与主体之间没有新增异常留白；
  - 当前统计仍为 `帖子 2 / 粉丝 1 / 关注 1`，只能作为当前稳定态记录，不能写成“关注联动已验证成功”。

## 4. 本轮诚实结论
- 可以确认：
  - `回复作者 -> 个人主页` 本轮仍未闭环；
  - 当前主阻塞点是系统 `选择输入法` 弹窗，不是已知前端回复业务崩坏；
  - 关闭输入法弹窗后，帖子详情回复态与上下文仍然保留；
  - 社区帖子详情与个人主页的顶部安全区、统一淡蓝返回按钮、合理留白均未回退。
- 不能确认：
  - `回复作者 -> 个人主页` 已通过；
  - 关注状态联动已通过。

## 5. 本轮代码改动
- 无新增业务代码改动。
- 本轮仅新增真机证据并补文档写实记录。

## 6. 下一轮建议
- 优先继续补：
  - 真实回复内容态出现后的 `replyAuthor -> UserProfile` 终态证据；
  - 关注按钮切换前后双证据；
  - 个人主页与帖子详情之间的关注状态联动。
- 继续保持：
  - 顶部安全区从 `y=36` 起始；
  - 深层页统一淡蓝方形返回按钮；
  - 顶部不被平板状态栏遮挡；
  - 不把系统输入法弹窗、ADB 噪声或取证漂移误记成前端业务故障。
