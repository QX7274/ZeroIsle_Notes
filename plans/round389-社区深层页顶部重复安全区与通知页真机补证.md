# round389 社区深层页顶部重复安全区与通知页真机补证

## 1. 本轮背景
- 承接 `round388`，社区首页顶部异常留白已经完成收口。
- 下一步按用户要求继续从社区首页往深层页推进，重点复查：
  - 顶部不能被状态栏遮挡；
  - 返回按钮要统一；
  - 不能有异常留白；
  - 只改明显原始部分，不动成熟内容区。

## 2. 本轮目标
- 真机复测社区深层页：
  - `通知消息`
  - `活动动态`
  - `帖子详情`
- 找出是否还存在和社区首页相同的“顶部重复补白”问题。
- 若存在，则以最小共性修复方式收口，不做无关样式重写。

## 3. 现场排查过程

### 3.1 社区首页基线
- 文件：
  - `D:\ZeroIsle_Notes\.codex-tmp\round389_current.xml`
  - `D:\ZeroIsle_Notes\.codex-tmp\round389_current.png`
- 结论：
  - 当前社区首页已稳定从 `y=36` 起始；
  - 说明 `round388` 的首页顶部收口仍然成立。

### 3.2 通知页修复前
- 文件：
  - `D:\ZeroIsle_Notes\.codex-tmp\round389_notifications.xml`
  - `D:\ZeroIsle_Notes\.codex-tmp\round389_notifications.png`
- 现场现象：
  - 顶部卡片整体明显下沉；
  - XML 中头部卡片 `panel.community.notifications.header` 起始于 `y=54`；
  - 返回按钮虽然已经是统一淡蓝方形箭头，但整块头部仍被多推下去一截；
  - 右上角刷新按钮仍是偏原型态的圆白按钮。

### 3.3 动态页与帖子详情源码核对
- 相关文件：
  - `D:\ZeroIsle_Notes\src\screens\community\ActivityScreen.js`
  - `D:\ZeroIsle_Notes\src\screens\community\PostDetailScreen.js`
- 结论：
  - `ActivityScreen` 根容器也在 Android 上额外做了 `paddingTop: Math.max(insets.top, 12)`；
  - `PostDetailScreen` 头部也在 Android 上再次叠加了顶部安全区；
  - 这说明问题不是通知页独有，而是社区深层页的共性头部处理重复。

## 4. 根因
- 这轮问题与 round388 本质一致：
  - 页面已经处在安全区之内；
  - 深层页根容器或头部自身又重复加了一次 Android 顶部补白；
  - 导致头部整体较首页下沉，视觉上像“顶部又空了一层”。

## 5. 本轮代码修改

### 5.1 修改文件
- `D:\ZeroIsle_Notes\src\screens\community\NotificationsScreen.js`
- `D:\ZeroIsle_Notes\src\screens\community\ActivityScreen.js`
- `D:\ZeroIsle_Notes\src\screens\community\PostDetailScreen.js`

### 5.2 修改内容
- 通知页：
  - Android 根容器顶部额外补白从 `Math.max(insets.top, 12)` 改为 `0`
  - 仅保留头部自身安全区承接
  - 右上角刷新按钮从圆白按钮收口为：
    - `40x40`
    - `12` 圆角
    - 淡蓝背景
- 动态页：
  - Android 根容器顶部额外补白从 `Math.max(insets.top, 12)` 改为 `0`
  - 右上角刷新按钮同步收口为统一淡蓝按钮语言
- 帖子详情页：
  - 头部在 Android 上不再重复叠加安全区顶部补白

## 6. 真机复测

### 6.1 通知页修后证据
- 文件：
  - `D:\ZeroIsle_Notes\.codex-tmp\round389_notifications_after_fix.xml`
  - `D:\ZeroIsle_Notes\.codex-tmp\round389_notifications_after_fix.png`
- 结果：
  - 通知页头部卡片现在从 `y=36` 开始；
  - 顶部不再整体下沉；
  - 返回按钮与刷新按钮节奏统一；
  - 空态卡片承接位置更自然。

### 6.2 动态页与帖子详情的证据边界
- 这轮在连续 ADB 点按过程中，前台曾短暂回到桌面或首页；
- 因此：
  - `ActivityScreen`
  - `PostDetailScreen`
  - 虽然代码已经完成同源收口，但这一轮还没有拿到同样稳定的修后终态截图/XML双证据；
  - 不能伪写成“真机已全部通过”。

## 7. 本轮结论
- 已确认社区深层页存在与首页同源的“顶部重复安全区补白”问题。
- 本轮已完成第一轮共性代码收口。
- 通知页已经拿到稳定真机修后证据，确认通过。
- 动态页与帖子详情本轮进入 `FOLLOW_UP`，下一轮继续补足同刻修后证据。

## 8. 下一轮重点
- 继续从社区首页单线程进入：
  - `活动动态`
  - `帖子详情`
- 补修后终态证据，继续核对：
  - 顶部安全区
  - 统一淡蓝返回按钮
  - 异常留白
  - 项目内统一网络异常弹层
