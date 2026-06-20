# round398 社区帖子详情键盘态系统窗口策略收口与真机阻塞记录

## 1. 本轮目标
- 承接 `round397`，继续解决社区 `PostDetail` 在安卓平板上“评论输入时头部被顶到系统状态栏”的问题；
- 不再局限于页面内部 `padding`，上探 Android 窗口策略与页面骨架；
- 同步把真实过程、阻塞和下一步写入中文文档。

## 2. 本轮代码调整

### 2.1 Android 系统窗口策略修正
- 文件：
  - `android/app/src/main/AndroidManifest.xml`
- 修改：
  - 将 `MainActivity` 的 `android:windowSoftInputMode` 从 `adjustPan` 改为 `adjustResize`。
- 原因：
  - `adjustPan` 会在键盘弹起时直接把整页窗口向上平移；
  - 这与现场表现“头部在输入评论后整体贴到 `y=0`”完全一致；
  - 当前社区深层页已经采用自绘顶部和内容区分离的结构，更适合让系统重算可视高度，而不是平移整页。

### 2.2 Android 端取消二次键盘高度压缩
- 文件：
  - `src/screens/community/PostDetailScreen.js`
- 修改：
  - 保留 iOS 的 `KeyboardAvoidingView behavior="padding"`；
  - Android 端不再显式使用 `height` 行为。
- 原因：
  - 在系统层已经切换到 `adjustResize` 后，再叠加 RN 端 `height` 压缩，容易产生二次收缩；
  - 当前目标是让固定头部稳定留在顶部安全区内，只让正文和评论输入区跟随可视区域变化。

## 3. 本轮判断依据
- 结合 `round397` 现场证据可确认：
  - 主 Tab 隐藏问题已经基本收口；
  - `hideTabBar setParams` 告警已经消失；
  - 剩余问题集中在键盘弹起时头部被整体顶到状态栏。
- 因此本轮把根因正式上探到：
  - Android 系统窗口策略；
  - 页面根容器与可视窗口的关系；
  - 而不是继续在详情页里盲加 `paddingTop`。

## 4. 本轮真机验证阻塞
- 本轮已尝试：
  - 重新跑社区相关 Jest 单测；
  - 执行 `:app:installDebug`；
  - 用 ADB 与现有抓证脚本重新采集平板前台证据。
- 现场真实结果是：
  - Jest 进程本轮异常退出，未形成可作为通过依据的干净结果；
  - `:app:installDebug` 在给定时限内未正常返回，不能诚实写成“已完成重装”；
  - ADB 会话随后出现明显抖动，`shell echo`、`dumpsys`、抓证脚本都出现超时；
  - 中途已执行最小 ADB 通道恢复并重新建立 `tcp:8001 / tcp:8081` 反向端口，但重新抓证仍未在当前轮次内稳定成功。

## 5. 本轮诚实结论
- 已完成且可确认：
  - 键盘态头部贴顶问题的更上层根因已经进一步收口到 Android `adjustPan`；
  - 代码已切换到更符合当前页面骨架的 `adjustResize` 方向；
  - Android 端详情页已取消多余的 `KeyboardAvoidingView height` 二次压缩。
- 尚未形成通过结论：
  - 由于本轮 ADB 取证链路不稳定，暂时没有拿到新的平板终态正证据；
  - 因此不能把“帖子详情键盘态头部已恢复到安全区内”写成 `PASS`。

## 6. 已写入并继续生效的规范
- 页面尺寸不能按整块平板物理高度粗暴计算，必须考虑：
  - 系统顶部状态栏；
  - 安全区；
  - 当前可视窗口；
  - 键盘弹起后的有效显示区域。
- 顶部内容不得被系统状态栏遮挡；
- 返回按钮继续统一使用已有淡蓝色方形带箭头样式；
- 网络问题继续使用项目内统一优美弹层，不回退到默认安卓弹窗；
- 布局需继续控制异常留白，不改成熟部分，只修明显原始或存在结构缺陷的页面。

## 7. 下一步
- 先以稳定 ADB 会话为前提重新执行：
  - 安装/确认当前包；
  - 进入 `社区 -> 帖子详情 -> 评论输入`；
  - 抓取键盘弹起后的 XML/PNG；
  - 核对头部返回按钮锚点是否回到 `y=36` 左右且不再贴顶。
- 若真机证据确认通过，再继续推进：
  - `replyAuthor -> UserProfile`
  - 关注状态联动
  - 社区其他深层页回归

## 8. round399 现场补记

### 8.1 已恢复并确认的现场事实
- 本轮先恢复了 ADB daemon、重新枚举设备，并重新建立：
  - `adb reverse tcp:8001 tcp:8001`
  - `adb reverse tcp:8081 tcp:8081`
- 恢复后可确认：
  - `adb shell echo ok` 正常返回；
  - 输入法仍为 `com.github.uiautomator/.AdbKeyboard`；
  - 设备 `HGR3Y9MA` 已重新稳定出现在 `adb devices -l` 中。

### 8.2 当前前台页面并未丢失
- 通过原生命令绕过慢抓证脚本后，已重新拿到：
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round399_recovery_probe.xml`
- 该证据明确显示：
  - 前台仍命中 `screen.community.postDetail`；
  - 头部 `action.community.postDetail.back` 仍位于 `y=48` 左右；
  - 页面根内容区仍从 `y=36` 起始；
  - 说明这时应用并没有退回首页、没有跳到其他模块，也没有出现新的顶部遮挡回退。

### 8.3 当前继续阻塞真机键盘态复测的真实原因
- 本轮证据同时抓到：
  - 页面底部存在 `Cannot connect to Metro` 的开发提示条；
  - 文案明确指向 `localhost:8081` 的 Metro 供包链断开。
- 结合本机探针可确认：
  - 当前 `127.0.0.1:8081/status` 连接被拒绝；
  - 本机确有 `node node_modules/react-native/cli.js start --reset-cache` 进程，但 8081 并未真正进入监听；
  - 因此当前不能继续把“评论输入后键盘态头部是否贴顶”的阻塞归因于业务页面本身。

### 8.4 当前结论更新
- `adjustResize + Android 端取消二次 height 避让` 的代码已经落地；
- 非键盘态下，`PostDetail` 顶部安全区没有回退；
- 但在 Metro 供包链恢复前，本轮还不能拿到新的评论输入终态证据，所以不能把“键盘态头部问题已通过”写成 PASS。

## 9. round399 键盘态复测结果与后续补丁

### 9.1 本轮终于拿到的关键真机证据
- 证据：
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round399_after_focus_input.xml`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round399_after_text_input.xml`
- 现场结果：
  - 评论输入框已经真实进入 `focused="true"`；
  - 页面根高度从非键盘态的 `1977` 左右收缩到 `1893`；
  - 但头部 `action.community.postDetail.back` 的坐标也从非键盘态 `y=48` 掉到了键盘态 `y=0`。
- 这说明：
  - `adjustResize` 已经让系统窗口开始收缩；
  - 但当前头部在键盘态仍会吃到“被重算后的零顶部 inset”；
  - 因此问题没有完全消失，只是从“整页被平移”进一步收敛为“头部使用的顶部 inset 在键盘态被清零”。

### 9.2 本轮新增代码补丁
- 文件：
  - `src/screens/community/PostDetailScreen.js`
- 修改：
  - 新增 `stableTopInsetRef`；
  - Android 端记录非键盘态下出现过的最大 `insets.top`；
  - 头部 `paddingTop` 与 `state.community.postDetail.topInset.*` 改为使用该稳定值，而不是直接使用键盘态瞬时 `insets.top`。
- 目的：
  - 非键盘态已经拿到的真实安全区值不应在评论输入时被清零；
  - 统一淡蓝返回按钮、标题与右上角操作区都应继续固定在状态栏下方，而不是跟随键盘态顶部 inset 抖动。

### 9.3 当前边界
- 本轮已经拿到“问题仍存在”的新证据，也已经继续落了一次方向正确的最小补丁；
- 但补丁后的再次真机复测仍未完成，所以当前不能把问题写成已通过；
- 下一步必须继续抓补丁后键盘态 XML，确认头部是否恢复到 `y=36` 左右。
