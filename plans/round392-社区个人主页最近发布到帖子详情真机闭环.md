# round392 社区个人主页最近发布到帖子详情真机闭环

## 1. 本轮背景
- 承接 `round391`。
- 上轮已经完成：
  - 社区内容态下联调入口稳定露出；
  - 社区 `个人主页` 顶部安全区与淡蓝方形头部按钮完成收口；
  - `个人主页` 页本身已经拿到真机终态证据。
- 当前需要继续补齐的是真机内部链路：
  - `个人主页 -> 最近发布 -> 帖子详情 -> 返回个人主页`

## 2. 本轮目标
- 从真实平板前台继续验证社区个人主页内部链路；
- 确认最近发布卡片可直接打开帖子详情；
- 继续复查帖子详情页顶部安全区、统一返回按钮与异常留白是否回退；
- 确认返回后仍能稳定回到个人主页，而不是误回社区首页或其他页面。

## 3. 本轮执行过程

### 3.1 个人主页当前前台复核
- 起始证据：
  - `D:\ZeroIsle_Notes\.codex-tmp\round392_current.xml`
  - `D:\ZeroIsle_Notes\.codex-tmp\round392_current.png`
- 现场结论：
  - 当前前台已稳定停留在 `screen.community.userProfile`；
  - `panel.community.userProfile.header` 继续从 `y=36` 起始；
  - `action.community.userProfile.back` 与 `action.community.userProfile.refresh` 仍保持统一淡蓝方形头部按钮；
  - `最近发布` 区块中两条帖子卡片都已露出，真机可直接点按。

### 3.2 最近发布第一条卡片到帖子详情
- 点击 `action.community.userProfile.openPost.a5edc2dd-3d6a-4bfb-b886-c6dbcb770ab2` 后，抓到：
  - `D:\ZeroIsle_Notes\.codex-tmp\round392_postdetail_from_profile.xml`
  - `D:\ZeroIsle_Notes\.codex-tmp\round392_postdetail_from_profile.png`
- 现场结论：
  - 页面已明确命中 `screen.community.postDetail`；
  - 标题、正文、统计区、评论区输入框都正常出现；
  - `action.community.postDetail.back` 仍是统一淡蓝方形箭头按钮；
  - 帖子详情头部继续从 `y=36` 起始；
  - 顶部没有被平板状态栏遮挡，也没有回到 round389 之前那种额外下沉留白。

### 3.3 从帖子详情返回个人主页
- 在帖子详情页点击返回后，抓到：
  - `D:\ZeroIsle_Notes\.codex-tmp\round392_back_to_profile.xml`
  - `D:\ZeroIsle_Notes\.codex-tmp\round392_back_to_profile.png`
- 现场结论：
  - 前台稳定回到 `screen.community.userProfile`；
  - 没有误回社区首页、帖子列表或其他中间页；
  - 个人主页头部、安全区、统计区与最近发布列表状态都保持正常；
  - 因此这条链路已经形成完整闭环。

## 4. 本轮结论
- `UserProfile -> PostDetail`：
  - 真机点击链路已通过；
  - 最近发布卡片不再只是展示，能够真实打开帖子详情。

- `PostDetail -> UserProfile`：
  - 返回链路已通过；
  - 返回后能稳定回到个人主页当前现场。

- 顶部规范复核：
  - 个人主页与帖子详情页的头部继续都从 `y=36` 起始；
  - 统一淡蓝方形返回按钮没有回退；
  - 异常顶部留白没有回退。

## 5. 本轮风险与边界
- 本轮没有新增代码修改；
- 主要是沿上轮修后状态继续补真机闭环证据；
- 风险较低。

- 仍需保留的后续边界：
  - 关注/取消关注成功态尚未补齐稳定真机证据；
  - 真实失败态下统一网络异常弹层还要继续做专门场景复核；
  - 社区其他更深层内容态链路仍要继续逐页推进。

## 6. 下一轮建议重点
- 继续从个人主页补测：
  - 关注 / 取消关注成功态
  - 真实失败态统一网络异常弹层
  - 可能的粉丝/关注计数联动
- 继续保持：
  - 顶部安全区统一
  - 深层页返回按钮统一使用既有淡蓝方形箭头
  - 不出现异常留白
  - 不把开发态瞬时噪声误记为业务页面回退
