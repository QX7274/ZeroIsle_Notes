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

## 10. round402 启动链补记：Metro 已恢复，但当前真机仍被前台承接链阻塞

### 10.1 本轮先确认的真实根因
- 起始现场证据：
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round402_current.xml/.png`
- 起始现象：
  - 平板前台仍是 `com.zeroisle_notes/.MainActivity`；
  - 但 `android:id/content` 下只有空 `FrameLayout`，页面为白色空根容器；
  - 这说明当前不能把阻塞误写成“社区详情页又坏了”或“后端不通”。
- 同时抓到的关键日志：
  - `ReactNative: Unable to load script. Make sure you're either running Metro...`
  - 这一步把本轮首要阻塞正式确认成：`debug` 包供包链失效，而不是业务代码直接崩回桌面。

### 10.2 本轮对 Metro/ADB 链路的恢复动作
- 已重新确认：
  - `adb -s HGR3Y9MA shell echo ok` 正常；
  - 安装时间仍为 `lastUpdateTime=2026-06-20 19:57:22`，说明平板上仍是本轮新包；
  - `adb reverse tcp:8001 tcp:8001` 与 `adb reverse tcp:8081 tcp:8081` 已重建。
- Metro 侧真实过程：
  - 先抓到一个“端口被占但服务不健康”的假活状态：
    - `8081` 被旧 `node` 进程占用；
    - `http://127.0.0.1:8081/status` 在 5 秒和 10 秒窗口均超时，不是健康 Metro。
  - 清掉僵住进程并带 `--reset-cache` 重启后：
    - `http://127.0.0.1:8081/status` 已返回 `packager-status:running`；
    - Metro 日志已进入 `Welcome to Metro v0.80.12`。

### 10.3 本轮继续收口到的更细边界
- 即便 `/status` 已恢复：
  - 平板冷启动后先出现 `Loading from localhost:8081...`；
  - 电脑端直接请求 `index.bundle?...` 在 40 秒窗口内仍可超时；
  - 说明阻塞点一度继续落在 bundle 产出阶段，而不是“8081 根本没起”。
- 进一步读取 Metro 前台构建输出后又确认：
  - Metro 实际已经成功执行过多轮 `BUNDLE ./index.js`；
  - JS 日志已出现：
    - `ZeroIsle_Notes 应用已成功注册`
    - `Running "ZeroIsle_Notes" with {"rootTag":11}`
    - `应用准备就绪，显示主界面`
    - `API响应成功: GET /community/posts/`
    - `API响应成功: GET /community/posts/<postId>/`
    - `API响应成功: GET /community/comments/by_post/?post_id=<postId>`
  - 这说明当前又不能再把问题继续简化成“bundle 从未成功执行”。

### 10.4 当前最诚实的现场判断
- 最新证据：
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round402_after_metro_recover.xml/.png`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round402_cold_start_after_healthy_metro.xml/.png`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round402_post_bundle_live.xml/.png`
- 现场结论：
  - 平板前台始终仍在 `com.zeroisle_notes/.MainActivity`；
  - 画面一度从“纯白空根容器”变成了 `Loading from localhost:8081...`；
  - 但在 Metro 已真实跑过 JS 和社区接口请求后，最新 UI dump 仍只有空 `FrameLayout`，没有稳定落到业务页面。
- 因此本轮必须如实记为：
  - `PostDetail` 键盘态头部修补代码仍保留；
  - 但这一轮没有资格继续宣称“已在真机上复测到社区详情终态”；
  - 当前新的主阻塞已经上移为：
    - `Metro / bundle / JS 运行已部分恢复`
    - 但 `React 视图未稳定挂上平板前台`
    - 属于启动承接链问题，不是社区详情页本身回退。

### 10.5 下一步顺序
- 下一轮必须按以下顺序继续：
  1. 继续用前台 Metro 日志确认 `bundle -> JS 注册 -> AppNavigator -> 当前路由` 的完整链路；
  2. 优先解释“JS 已运行但平板仍显示空根容器/Loading”的原因；
  3. 只有业务前台真正恢复后，才重新进入：
     - `社区 -> 帖子详情 -> 评论输入`
     - 再验证 `action.community.postDetail.back` 是否仍掉到 `y=0`；
  4. 在此之前，不能把社区详情键盘态问题写成已复测通过。

## 11. round403 / round404 启动链续查：Metro 工作区缓存绕开旧权限表象，但前台仍未恢复到业务页

### 11.1 本轮先确认的旧 Metro 假活根因
- 历史日志再次核对到：
  - `D:\ZeroIsle_Notes\tmp_round399_metro_stdout.log`
  - `D:\ZeroIsle_Notes\tmp_round399_metro_stderr.log`
- 其中已明确出现：
  - `EPERM: operation not permitted, unlink 'C:\Users\QX\AppData\Local\Temp\metro-cache\...'`
- 这说明此前反复出现的：
  - `8081` 端口被占但 `/status` 超时；
  - 平板长期停在 `Loading from localhost:8081...`
  - Metro `reset-cache` 后状态反复异常
  与系统临时目录下的 Metro 缓存清理失败存在直接关联。

### 11.2 本轮做的环境级最小试探
- 本轮没有改业务代码，只做了运行环境试探：
  - 先清理旧 `node` / Metro / bundle 残留进程，避免继续占 CPU/内存；
  - 在工作区内创建：
    - `D:\ZeroIsle_Notes\.codex-tmp\metro-temp`
    - `D:\ZeroIsle_Notes\.codex-tmp\metro-cache-workspace`
  - 以工作区内 `TEMP/TMP/TMPDIR/METRO_CACHE` 重启 Metro。

### 11.3 这次环境试探的真实结果
- 正向收获：
  - 在工作区缓存环境下，Metro 能重新回到 `/status = packager-status:running`；
  - 真机冷启动后，`Loading from localhost:8081...` 的黑条已消失；
  - 这说明“系统临时目录 Metro 缓存链不稳”这一层并不是误判。
- 仍未闭环的事实：
  - 最新证据：
    - `D:\ZeroIsle_Notes\.local\android-mcp-server\round403_after_workspace_cache_metro.xml/.png`
  - 前台依然只有空白根容器；
  - `android:id/content` 下仍只剩空 `FrameLayout`；
  - 说明当前启动链虽然摆脱了 `Loading from localhost:8081...` 表象，但业务视图依然没有真正挂上平板前台。

### 11.4 对离线 bundle 路径的补充判断
- 本轮继续试了“工作区缓存环境下直接离线构建 Android bundle”：
  - 目标产物：
    - `D:\ZeroIsle_Notes\tmp\round404_bundle_probe.js`
  - 结果：
    - 进程在 2 分钟窗口内仍长期运行；
    - 没有即时产出 bundle 文件；
    - 也没有吐出新的明确错误文本。
- 为避免继续占用资源，本轮已主动结束残留 bundle 进程。
- 因此当前对离线装包路径的最诚实判断是：
  - 它相比旧 Metro 缓存路径少了 `EPERM unlink metro-cache` 明错；
  - 但还没有形成“可在当前机器上稳定快速产出 bundle”的通过证据。

### 11.5 当前结论再更新
- `PostDetailScreen.js` 的键盘态顶部 inset 修补本轮依旧没有新的业务终态复测证据；
- 当前阻塞继续上移并收窄为：
  - Metro 默认缓存路径存在历史权限/清理不稳问题；
  - 工作区缓存已能改善 `Loading from localhost:8081...`；
  - 但 `React` 视图仍未稳定挂上真机前台；
  - 离线 bundle 路径也还未形成可直接替代的稳定产物。
- 所以本轮仍然不能把：
  - 社区详情键盘态头部修补
  - 统一顶部安全区
  - 统一淡蓝返回按钮
  - 社区顶部留白
  - 统一网络异常弹层
  写成新的真机 PASS。

## 12. round406 启动链工程化补记：已形成可复用 `pwsh` 真机会话脚本，但前台仍停在 Reloading 空根容器

### 12.1 本轮新增工程化脚本
- 新增文件：
  - `D:\ZeroIsle_Notes\scripts\android\start_android_debug_session.ps1`
- 目标：
  - 将后续每轮都要重复做的启动链动作收口为一条可复用脚本，而不是继续手工散打。
- 当前脚本已内置的动作：
  - 校验目标平板 `HGR3Y9MA` 是否在线；
  - 校验电脑端后端 `http://127.0.0.1:8001/health/`；
  - 建立并记录 `adb reverse tcp:8001 tcp:8001` 与 `tcp:8081 tcp:8081`；
  - 在设备侧再次实测 `http://127.0.0.1:8001/health/`，避免把 ADB reverse 丢失误判为前端网络故障；
  - 使用工作区目录 `D:\ZeroIsle_Notes\.codex-tmp\metro-temp` 与 `D:\ZeroIsle_Notes\.codex-tmp\metro-cache-workspace` 重启 Metro；
  - 轮询 `http://127.0.0.1:8081/status`；
  - 清空并采集当轮 `logcat`；
  - 冷启动 `com.zeroisle_notes/.MainActivity`；
  - 调用现有 `capture_android_round.py` 落盘 XML/PNG；
  - 将当轮摘要、Metro stdout/stderr、logcat、reverse 列表统一落到：
    - `D:\ZeroIsle_Notes\.codex-tmp\android-debug-sessions\<round>\`

### 12.2 本轮真实执行结果
- 实际执行命令：
  - `D:\ZeroIsle_Notes\scripts\android\start_android_debug_session.ps1 -Round round406_startup_session`
- 当轮关键产物：
  - `D:\ZeroIsle_Notes\.codex-tmp\android-debug-sessions\round406_startup_session\summary.txt`
  - `D:\ZeroIsle_Notes\.codex-tmp\android-debug-sessions\round406_startup_session\metro.stdout.log`
  - `D:\ZeroIsle_Notes\.codex-tmp\android-debug-sessions\round406_startup_session\metro.stderr.log`
  - `D:\ZeroIsle_Notes\.codex-tmp\android-debug-sessions\round406_startup_session\logcat.txt`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round406_startup_session.xml`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round406_startup_session.png`
- 当轮可确认的正向结果：
  - 电脑端后端 `/health/` 通过；
  - 设备侧 `/health/` 通过；
  - Metro `/status` 通过；
  - ADB reverse 与截图/XML 落盘链路通过；
  - 说明后续每轮至少可以先用这一条脚本稳定判断“阻塞是在启动链，还是在业务页本身”。

### 12.3 本轮最关键的现场结论
- 证据：
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round406_startup_session.xml`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round406_startup_session.png`
- 现场真实表现：
  - 前台并未进入任何业务页面；
  - 页面截图仍为顶部 `Reloading...` 黑条 + 大面积白色空白；
  - UI XML 继续显示 `android:id/content` 下仅有空 `FrameLayout`；
  - 同时系统状态栏高度仍稳定为 `36`，底部导航背景仍落在 `1977-2000` 区间。
- 因此本轮必须如实记为：
  - 新脚本已经把“调试启动链”工程化；
  - 但业务前台仍没有恢复；
  - 当前还不能重新进入：
    - `社区 -> 帖子详情 -> 评论输入`
  - 更不能把：
    - 顶部安全区
    - 统一淡蓝返回按钮
    - 不合理留白
    - 统一网络异常弹层
    - 功能中心风格回退
    这些页面级验收状态写成新增通过。

### 12.4 本轮补充修正
- 在脚本首轮运行后，已继续修正两处实现细节：
  - Metro `/status` 响应原先被按字节数组保存为数字串，现已统一按 UTF-8 文本解码；
  - `adb reverse --list` 已改为携带设备序列号，避免多设备场景再次出现歧义。

### 12.5 对页面规范的持续约束
- 即使当前主阻塞在启动链，页面规范仍继续保持不变并写实生效：
  - 顶部内容不得被平板系统状态栏遮挡；
  - 页面布局必须以可视窗口与安全区为准，不能按整块平板物理高度粗暴拉满；
  - 异常留白必须持续清理，尤其是社区顶部与深层页头部；
  - 深层页返回按钮继续统一使用已有淡蓝色方形带箭头样式；
  - 网络问题继续使用项目内统一优美弹层，不回退默认安卓弹窗；
  - 成熟 UI 不随意重做，只修明显原始或有结构缺陷的页面。

## 13. round407 启动链续查：确认卡点已收口到 bundle 产出层，开始试探 debug 内置 bundle 路径

### 13.1 本轮先进一步排除的误判
- 本轮继续基于 `round406_startup_session` 现场复核：
  - `D:\ZeroIsle_Notes\.codex-tmp\android-debug-sessions\round406_startup_session\logcat.txt`
  - `D:\ZeroIsle_Notes\.codex-tmp\android-debug-sessions\round406_startup_session\metro.stdout.log`
- 当前能明确排除：
  - 不是 `MainActivity`/`MainApplication` 根本没起来；
  - 不是平板与电脑后端 REST 链路不通；
  - 不是单纯 `Reloading...` 文案噪声。
- 判断依据：
  - logcat 已明确出现：
    - `ZeroIsleMainApplication: onCreate`
    - `ZeroIsleMainActivity: getMainComponentName -> ZeroIsle_Notes`
    - `ZeroIsleMainApplication: getJSMainModuleName -> index`
  - 说明原生壳层已经正常启动并指向正确入口组件。

### 13.2 本轮进一步确认的真实卡点
- 本轮直接请求：
  - `http://127.0.0.1:8081/index.bundle?platform=android&dev=true&minify=false&app=com.zeroisle_notes&modulesOnly=false&runModule=true`
- 结果：
  - 60 秒窗口内超时；
  - 这比单看 `/status = packager-status:running` 更能说明问题。
- 同时进程侧已看到：
  - Metro 主进程：
    - `node node_modules/react-native/cli.js start --port 8081 --reset-cache`
  - 额外 `jest-worker` 子进程被拉起。
- 因此当前阻塞必须继续收口为：
  - Metro 服务“活着”不等于 bundle 能产出；
  - 当前更核心的阻塞已经落在：
    - `Metro / bundle build / worker 扫描与构建阶段`
  - 不是页面导航或顶部布局本身导致空根容器。

### 13.3 对离线 bundle 路径的再次验证
- 本轮重新执行工作区缓存环境下的离线 bundle：
  - `node node_modules/react-native/cli.js bundle --platform android --dev true --entry-file index.js --bundle-output tmp\\round407_bundle.js --assets-dest tmp\\round407_assets --reset-cache --max-workers 1 --verbose`
- 结果：
  - 3 分钟窗口仍超时；
  - `D:\ZeroIsle_Notes\tmp\round407_bundle.js` 未生成；
  - 说明“直接 bundle”路径与“设备实时取包”路径当前卡在同一层，而不是两条完全独立的问题。

### 13.4 debug 内置 bundle 路径的当前试探
- 为尽快恢复真机业务前台，本轮先做了一个最小且方向明确的 Android 构建策略试探：
  - 文件：
    - `D:\ZeroIsle_Notes\android\app\build.gradle`
  - 修改：
    - 在顶层 `react {}` 中将 `debuggableVariants` 改为 `[]`
- 目的：
  - 让 `debug` 也参与 `createBundleDebugJsAndAssets`；
  - 尽量绕开“前台依赖 Metro 即时供包”的实时链路，转为“安装时内置 JS bundle”的调试包路径。
- 当前试探结果：
  - `:app:tasks --all` 已确认 `createBundleDebugJsAndAssets` 任务出现；
  - 但实际执行 `:app:createBundleDebugJsAndAssets` 在 4 分钟窗口内仍未产出：
    - `D:\ZeroIsle_Notes\android\app\build\generated\assets\react\debug\index.android.bundle`
- 这说明：
  - 构建策略方向是对的；
  - 但真正卡住的仍然是 bundle 生成本身，而不是“debug 默认不打包”这一层。

### 13.5 当前最诚实结论
- 本轮没有恢复业务前台；
- 但进一步把问题从“启动链泛化异常”收口成了：
  - 原生壳层正常；
  - 后端联通正常；
  - `/status` 正常；
  - 真实卡点落在 bundle 产出层；
  - debug 内置 bundle 路径已打开，但产物生成仍卡住。
- 因此下一步不应回头盲改：
  - 社区顶部留白
  - 功能中心样式
  - 统一返回按钮
  - 网络弹层
  这些页面层代码；
- 而应继续围绕“如何让 bundle 真正产出”推进。

## 14. round408 / round409 启动链补记：已抓到 Metro 缓存互踩明错，并确认 ADB reverse 仍存在“显示存在但实转不稳”的独立波动

### 14.1 round408：首次拿到 createBundleDebugJsAndAssets 的直接失败根因
- 本轮不再只看“超时没产物”，而是把 `:app:createBundleDebugJsAndAssets --info --stacktrace` 的完整输出落盘到：
  - `D:\ZeroIsle_Notes\.codex-tmp\round408_createBundleDebug_full.log`
- 从该日志中已明确拿到当前第一层直接失败根因：
  - `ENOTEMPTY: directory not empty, rmdir 'D:\ZeroIsle_Notes\.codex-tmp\metro-temp\metro-cache\4a'`
- 这说明此前的 bundle 阻塞里至少有一部分不是“单纯构建太慢”，而是：
  - 多个 Metro / bundle / Gradle 任务共用同一组 `TEMP/TMP/METRO_CACHE`；
  - 在 `--reset-cache` 清缓存时互相踩踏；
  - 导致 `createBundleDebugJsAndAssets` 在 Metro FileStore 清理阶段直接失败。

### 14.2 round408：由此确认的更细边界
- 当前已经能更准确地区分两类问题：
  1. `bundle` 生成层真实卡点；
  2. 共享缓存目录导致的缓存清理互踩。
- 因此本轮后的方向不再是笼统地“继续试 bundle”，而是必须先把：
  - Metro 运行时目录
  - bundle 构建临时目录
  - 调试会话目录
  彻底隔离开。

### 14.3 round409：调试脚本已改为每轮独立缓存目录
- 文件：
  - `D:\ZeroIsle_Notes\scripts\android\start_android_debug_session.ps1`
- 本轮已继续做最小工程化修补：
  - 每一轮调试会话改为使用：
    - `D:\ZeroIsle_Notes\.codex-tmp\android-debug-sessions\<round>\runtime\metro-temp`
    - `D:\ZeroIsle_Notes\.codex-tmp\android-debug-sessions\<round>\runtime\metro-cache`
  - 不再与其它轮次共享 `metro-temp/metro-cache-workspace`；
  - 增加 `-SkipMetroResetCache` 选项；
  - 启动前同时清理旧的 `node` 与相关 `java` 残留进程，尽量减少缓存目录被并发占用的概率。
- 目的：
  - 先切断“缓存互踩”这一层伪阻塞；
  - 让后续看到的失败更接近真实主因。

### 14.4 round409：独立缓存后出现的另一层独立波动
- 使用新脚本执行：
  - `D:\ZeroIsle_Notes\scripts\android\start_android_debug_session.ps1 -Round round409_isolated_cache_session -SkipMetroResetCache`
- 当前结果：
  - 脚本没有再先死在 Metro 缓存目录清理；
  - 但设备侧后端联通验证再次超时：
    - `curl: (28) Operation timed out after 10001 milliseconds with 0 bytes received`
- 随后单独复核又确认：
  - `adb devices -l` 正常；
  - `adb -s HGR3Y9MA shell echo ok` 正常；
  - `adb -s HGR3Y9MA reverse --list` 仍显示：
    - `tcp:8081 tcp:8081`
    - `tcp:8001 tcp:8001`
  - 但设备侧 `curl http://127.0.0.1:8001/health/` 依旧可能超时。

### 14.5 当前最诚实更新
- 本轮之后，阻塞链已进一步拆分清楚：
  - `bundle` 构建层存在真实问题；
  - 共享缓存目录互踩已被抓到明错，并已开始工程化隔离；
  - ADB reverse 仍存在“列表显示存在，但设备侧实际转发不稳定”的独立波动。
- 因此后续继续推进时，必须分开判断：
  - 若是 `ENOTEMPTY ... metro-cache`，属于缓存互踩；
  - 若是设备侧 `curl 127.0.0.1:8001/health/` 超时，属于 reverse 波动；
  - 这两类问题都不能再误写成“社区页网络异常”或“某个页面布局回退”。

## 15. round410 联网链补记：已确认电脑与平板处于同网段，但直连电脑 IP 仍未打通

### 15.1 本轮网络基线复核
- 电脑端当前 IPv4 现场：
  - `WLAN = 192.168.10.12/24`
- 平板端当前 IPv4 现场：
  - `wlan0 = 192.168.10.18/24`
- 这说明：
  - 当前电脑与平板已经处于同一 `192.168.10.0/24` 网段；
  - 至少从地址层面看，已经具备“绕开 ADB reverse，直接走电脑 IP 联调”的前提。

### 15.2 本轮对直连电脑 IP 的真实测试
- 电脑端后端仍监听：
  - `0.0.0.0:8001`
- 电脑端本机访问：
  - `http://0.0.0.0:8001/health/` 正常返回 `alive`
- 设备侧实际测试：
  - `curl http://192.168.10.12:8001/health/`
  - `curl http://192.168.10.12:8081/status`
- 结果：
  - 两者都在超时窗口内无响应。

### 15.3 本轮由此得出的更准确结论
- 当前不能把问题简单归因于：
  - 只有 `adb reverse` 不稳定；
  - 只要电脑和平板在同网段就一定能直连成功。
- 因为现在现场已经明确显示：
  - 同网段成立；
  - Windows 防火墙处于关闭状态；
  - ICS 服务运行中；
  - 后端监听 `0.0.0.0:8001`；
  - 但平板直连电脑 `192.168.10.12` 仍超时。
- 所以当前这条链更像是：
  - 电脑热点/共享链路本身未形成真实可达转发；
  - 或平板到电脑无线链路还有系统层/共享层限制；
  - 而不是应用 API 地址写错。

### 15.4 本轮工程化补充
- `D:\ZeroIsle_Notes\scripts\android\start_android_debug_session.ps1`
  - 已新增：
    - `-DirectApiHost`
  - 作用：
    - 后续可以直接用脚本验证设备侧访问：
    - `127.0.0.1:<port>`（ADB reverse）
    - 或 `电脑IP:<port>`（直连）
    - 避免后续每轮再临时手工拼探测命令。

## 16. round411 联网链补记：平板到电脑后端已恢复真实联通，当前主阻塞正式收敛到 Metro / bundle 供包链

### 16.1 本轮先收口 ADB 会话层，避免假网络超时误判
- 本轮先没有直接继续追页面或 Metro，而是先复核 ADB 现场；
- 复核中发现：
  - 工作区里累计残留了多条挂住的 `adb.exe` 进程；
  - 其中包含：
    - `adb -s HGR3Y9MA shell echo ok`
    - `adb -s HGR3Y9MA logcat`
    - `adb kill-server`
    - `adb start-server`
  - 这些残留会把后续新的 ADB 命令一起拖住，形成“设备像是没网/没响应”的假象。
- 因此本轮先做了最小现场清理：
  - 仅停止残留 `adb.exe`；
  - 重新启动 ADB server；
  - 改回“单线程、串行”的 ADB 探测节奏；
  - 不再对同一台平板并发发多条 `adb shell` / `reverse` / `logcat`。
- 清理后立即复核：
  - `adb devices -l` 正常；
  - `adb -s HGR3Y9MA shell echo ok` 已恢复稳定返回 `ok`。

### 16.2 本轮拿到两条关键正证据：reverse 与电脑 IP 直连都已命中后端 `/health/`
- 电脑端本机后端仍正常：
  - `http://127.0.0.1:8001/health/` 返回 `{"status":"alive"}`
- 平板侧先重建：
  - `adb -s HGR3Y9MA reverse tcp:8001 tcp:8001`
- 随后做设备侧真实探测，结果如下：
  - `curl http://127.0.0.1:8001/health/`
    - 返回 `{"status":"alive"}`
  - `curl http://192.168.10.12:8001/health/`
    - 也返回 `{"status":"alive"}`
- 这意味着：
  - 先前“同网段但直连电脑 IP 超时”的状态，本轮现场已不再成立；
  - 当前平板到电脑后端的 REST 联通已经恢复为真实可用状态；
  - 不能再把当前真机前台阻塞写成“平板没网”或“电脑和平板还没打通”。

### 16.3 本轮新的主阻塞定位：不是后端没通，而是 Metro `8081` / bundle 供包链仍未恢复
- 在后端联通恢复后，本轮继续执行：
  - `D:\ZeroIsle_Notes\scripts\android\start_android_debug_session.ps1 -Round round411_network_restored -DirectApiHost 192.168.10.12`
- 本轮脚本执行到：
  - 设备在线检查：通过；
  - 本机后端健康检查：通过；
  - 设备侧后端健康检查：通过；
  - 之后在 `检查 Metro 状态` 阶段失败：
    - `Metro /status 未恢复`
- 同轮日志补抓结果也进一步说明：
  - `round411_network_restored\device_api_health.txt` 已存在，说明设备侧后端联通确实已成功；
  - `round411_network_restored\metro.stderr.log` 只有 Metro 启动期警告；
  - `round411_network_restored` 目录下没有产出最终业务前台截图/XML；
  - 当前失败点已明确上移到：
    - Metro `8081` 未恢复稳定 `/status`
    - 或 Metro 虽启动但未稳定进入可供包状态
    - 进而导致 bundle 供包链继续阻塞。

### 16.4 本轮对阻塞链的诚实更新
- 截止 round411，当前最准确的现场判断应更新为：
  1. 平板与电脑后端 `8001` 联通已恢复；
  2. `ADB reverse` 与 `电脑IP直连` 两条后端健康探测都已经命中成功；
  3. 当前主阻塞不再是“网络问题”；
  4. 当前主阻塞已经收敛为：
     - Metro `8081` 启动/供包不稳
     - bundle 生成层仍未真正恢复
  5. 因此前台未恢复业务页面时，不能误把问题归到：
     - 社区顶部状态栏留白
     - 功能中心样式
     - 个人主页按钮
     - 统一返回按钮
     - 统一网络异常弹层
     这些页面层模块本身。

### 16.5 本轮工程化补充：调试脚本失败也必须落摘要，避免下一轮再丢关键现场
- `D:\ZeroIsle_Notes\scripts\android\start_android_debug_session.ps1`
  - 本轮继续增强：
    - 增加 `try / catch / finally`
    - 即便中途失败，也会强制写出 `summary.txt`
    - 在摘要中额外记录：
      - `session_failed`
      - `failure_message`
      - 已成功拿到的 `api_health`
      - 已成功拿到的 `device_api_health`
      - 已使用的 `device_api_probe_url`
      - 已成功或未成功拿到的 `metro_status`
- 目的：
  - 避免后续再出现“脚本中途失败，但没有 summary，导致现场信息断层”的问题；
  - 让每轮都能更稳定地区分：
    - 后端联通失败
    - 还是 Metro / bundle 失败。

## 17. round412 / round414 启动链补记：后端、ADB reverse、Metro `/status` 已同时正常，但前台仍停在 `Reloading...` 空根容器；并开始收缩启动期依赖图

### 17.1 round412：首次拿到“后端健康 + Metro `/status` 健康 + 前台仍空白”的同轮完整正反证据
- 本轮先不再重启 Metro，而是直接复用当前已恢复的 Metro 现场执行：
  - `D:\ZeroIsle_Notes\scripts\android\start_android_debug_session.ps1 -Round round412_status_ok_bundle_timeout -SkipMetroRestart -DirectApiHost 192.168.10.12`
- 这一次脚本完整通过：
  - 设备在线检查；
  - 本机后端健康检查；
  - 设备侧后端健康检查；
  - Metro `/status` 检查；
  - 冷启动；
  - 截图/XML 抓证；
  - `summary.txt` 落盘。
- `round412_status_ok_bundle_timeout\summary.txt` 已明确记录：
  - `api_health={"status":"alive"...}`
  - `device_api_health={"status":"alive"...}`
  - `device_api_probe_url=http://192.168.10.12:8001/health/`
  - `metro_status=packager-status:running`
  - `session_failed=False`
- 这说明本轮已拿到同一轮内的三条关键正证据同时成立：
  1. 后端 `8001` 正常；
  2. 平板到电脑后端联通正常；
  3. Metro `/status` 正常。

### 17.2 round412：但前台终态依旧不是业务页面，而是 `Reloading...` + 空 `FrameLayout`
- 尽管 `round412` 的健康检查全部通过，前台证据：
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round412_status_ok_bundle_timeout.png`
  - `D:\ZeroIsle_Notes\.local\android-mcp-server\round412_status_ok_bundle_timeout.xml`
  仍明确显示：
  - 页面顶部存在 `Reloading...` 黑条；
  - `android:id/content` 下依旧只有空 `FrameLayout`；
  - 没有进入任何业务页面，也没有落到根组件兜底错误页。
- 因此当前主阻塞又进一步收紧为：
  - 不是“后端不通”；
  - 不是“ADB reverse 不稳”；
  - 也不是“Metro `/status` 根本没起来”；
  - 而是更接近：
    - bundle 长时间无法真正产出或送达；
    - 或 JS runtime 未完成从 packager 到根组件执行的承接。

### 17.3 round412：本机直接请求 `index.bundle` 仍在 45 秒窗口内超时
- 在 `round412` 同期，电脑端本机直接请求：
  - `http://127.0.0.1:8081/index.bundle?platform=android&dev=true&minify=false&app=com.zeroisle_notes&modulesOnly=false&runModule=true`
- 结果：
  - 45 秒超时；
  - 没有拿到 bundle 内容长度。
- 这进一步说明：
  - 即使 `/status = packager-status:running`，
  - Metro 也依旧没有恢复到“能及时产出 bundle”的可用状态。

### 17.4 round414：离线 bundle 在独立缓存目录下仍连续 3 分钟无产物，卡点更像依赖图扫描/转换阶段
- 为避免把问题继续归咎到设备取包，本轮继续在独立 `TEMP/TMP/METRO_CACHE` 目录下直接执行：
  - `node node_modules/react-native/cli.js bundle --platform android --dev true --entry-file index.js --bundle-output .codex-tmp/round414_bundle.js --assets-dest .codex-tmp/round414-assets --reset-cache --max-workers 1 --verbose`
- 结果：
  - 3 分钟窗口内仍未产出 `round414_bundle.js`；
  - 日志 `D:\ZeroIsle_Notes\.codex-tmp\round414_bundle_full.log` 依旧只到：
    - `warning: the transform cache was reset.`
    - `Welcome to Metro v0.80.12`
  - 没有进入可见的 `BUNDLE ./index.js` 或具体模块解析输出。
- 同时进程侧已确认：
  - `bundle` 主进程持续高 CPU 运行；
  - 没有生成目标 bundle 文件。
- 因此本轮更倾向于判断：
  - 当前卡点并不是“设备连不上 bundle”；
  - 而是 Metro / bundle 在依赖图扫描或转换阶段就已极慢甚至卡死。

### 17.5 本轮最小试探：移除 `fileService` 顶层未使用的 `xlsx` 大包引用，开始收缩启动期依赖图
- 本轮在代码侧只做了一个很小、风险可控的试探：
  - 文件：
    - `D:\ZeroIsle_Notes\src\services\files\fileService.js`
  - 调整：
    - 删除顶层 `import XLSX from 'xlsx';`
- 原因：
  - `fileService` 会被 `HomeScreen` 启动链间接引用；
  - `xlsx` 属于纯 JS 大包；
  - 而当前该文件中并没有实际使用 `XLSX`；
  - 因此这个顶层引用只会白白放大启动期依赖图与 bundle 压力。
- 本轮这一步还不能宣称“已修复 bundle 阻塞”，但它是一个对主阻塞方向一致、且风险很低的缩图试探。

### 17.6 截止本轮的最准确判断
- 当前启动链真实状态应更新为：
  1. 后端 `8001` 联通已恢复；
  2. 设备侧 `adb reverse` 与电脑 IP 直连健康探测都正常；
  3. Metro `/status` 已恢复；
  4. 但 `index.bundle` 仍超时；
  5. 离线 `react-native bundle` 也仍在 3 分钟窗口内无产物；
  6. 真机前台仍停在 `Reloading...` + 空 `FrameLayout`。
- 因此下一步仍应继续围绕：
  - 启动期依赖图缩减；
  - Metro / bundle 扫描与转换层
  推进，而不是回头盲改页面 UI。

## 18. round415 启动链补记：继续缩减 `App.js` 启动期依赖图后，离线 bundle 仍未穿透 Metro 欢迎阶段

### 18.1 本轮继续下钻启动入口，而不是回头动页面层
- 基于 round412/414 已确认：
  - 后端正常；
  - ADB reverse 正常；
  - Metro `/status` 正常；
  - 但 bundle 与前台仍卡住；
- 本轮继续把注意力集中在：
  - `App.js`
  - `HomeScreen`
  - `services/index`
  - `services/offline`
  这些真正可能放大启动期依赖图的入口，不回头盲改 UI。

### 18.2 本轮发现的第二组可疑启动期放大点
- 代码复核中确认：
  - `App.js` 顶层仍直接导入：
    - `import { dataService } from './services/database';`
    - `import { infiniteCanvasStorage } from './services/offline';`
- 其中：
  - `dataService` 在 `App.js` 中并未实际使用；
  - `infiniteCanvasStorage` 只在初始化函数 `initializeApp()` 中被使用；
  - 因此这两个顶层导入都会让 bundle 在根入口阶段提前进入更大的依赖图。

### 18.3 本轮代码试探：继续把根入口依赖改为更小、更晚加载
- 文件：
  - `D:\ZeroIsle_Notes\src\App.js`
- 本轮只做两项最小改动：
  1. 删除顶层未使用的：
     - `import { dataService } from './services/database';`
  2. 将：
     - `import { infiniteCanvasStorage } from './services/offline';`
     改为：
     - 在 `initializeApp()` 内部按需 `require('./services/offline/infiniteCanvasStorage').default`
- 目的：
  - 避免应用根入口在真正进入初始化逻辑前，就把数据库聚合入口和离线画布存储整条链一起拉进 bundle；
  - 继续缩减启动期依赖图。

### 18.4 round415 结果：方向正确，但还没穿透主卡点
- 在上述改动后，本轮继续执行新的离线 bundle 试探：
  - `node node_modules/react-native/cli.js bundle --platform android --dev true --entry-file index.js --bundle-output .codex-tmp/round415_bundle.js --assets-dest .codex-tmp/round415-assets --reset-cache --max-workers 1 --verbose`
- 结果：
  - 3 分钟窗口内仍未生成 `round415_bundle.js`；
  - `D:\ZeroIsle_Notes\.codex-tmp\round415_bundle_full.log` 仍只停留在：
    - `warning: the transform cache was reset.`
    - `Welcome to Metro v0.80.12`
  - 没有继续进入 `BUNDLE ./index.js`。
- 因此当前可以诚实确认：
  - `App.js` 这两处顶层依赖确实属于应当收缩的启动期噪音；
  - 但它们还不是当前 Metro / bundle 卡死的唯一根因。

### 18.5 截止 round415 的收口结论
- 当前已连续完成两轮方向一致的缩图试探：
  1. `fileService` 删除顶层未使用 `xlsx`
  2. `App.js` 删除未使用 `dataService` 并将 `infiniteCanvasStorage` 改为按需加载
- 但 bundle 仍未真正产出，因此下一步仍需继续沿：
  - `HomeScreen`
  - `documentPickerService`
  - `services/index`
  - 其它启动期被提前拉入的大模块
  继续缩图，而不是误写成页面层回退或网络问题。

## 19. round416 启动链补记：`HomeScreen` 顶层文档/文件服务已改为按需加载，但离线 bundle 仍未穿透

### 19.1 本轮继续沿 `HomeScreen` 首屏链路收缩依赖图
- 基于前几轮结论：
  - `App.js` 启动期依赖已做过一轮收缩；
  - 但 bundle 仍卡在 Metro 欢迎阶段；
- 本轮继续下钻 `HomeScreen`，重点检查其顶层是否提前拉入了只在交互时才需要的重服务。

### 19.2 本轮确认的 `HomeScreen` 启动期可收缩点
- 代码复核确认 `HomeScreen` 顶层此前直接导入了：
  - `documentPickerService`
  - `fileService`
  - `preloadService`
  - `nonBlockingPPTProcessor`
- 这些服务的共同特点是：
  - 并不参与首页首屏静态渲染；
  - 只在以下时机才真正需要：
    - 用户点击导入 Word/PPT/PDF；
    - 后台启动最近文档智能预加载；
    - 处理 PPT 转换；
    - 持久化导入文件。
- 因此它们都属于“可以从首页首包里移出去”的启动期依赖噪音。

### 19.3 本轮代码试探：将 `HomeScreen` 内相关重服务改为函数内按需 `require`
- 文件：
  - `D:\ZeroIsle_Notes\src\screens\common\HomeScreen.js`
- 本轮只做最小行为等价调整：
  1. 删除顶层导入：
     - `documentPickerService`
     - `fileService`
     - `preloadService`
     - `nonBlockingPPTProcessor`
  2. 将这些服务改为在真正使用时按需 `require`：
     - 智能预加载时再加载 `preloadService`
     - 导入 PDF 时再加载 `fileService`
     - 导入 Word/PPT 时再加载 `documentPickerService`
     - 处理 PPT 时再加载 `nonBlockingPPTProcessor`
- 目的：
  - 继续缩小首页首包的启动期依赖图；
  - 避免文档/文件处理链在用户尚未触发任何导入操作前就进入 bundle。

### 19.4 round416 结果：方向继续正确，但 Metro / bundle 主卡点仍未被穿透
- 在上述改动后，本轮继续执行新的离线 bundle 试探：
  - `node node_modules/react-native/cli.js bundle --platform android --dev true --entry-file index.js --bundle-output .codex-tmp/round416_bundle.js --assets-dest .codex-tmp/round416-assets --reset-cache --max-workers 1 --verbose`
- 结果：
  - 3 分钟窗口内仍未生成 `round416_bundle.js`；
  - `D:\ZeroIsle_Notes\.codex-tmp\round416_bundle_full.log` 仍只停留在：
    - `warning: the transform cache was reset.`
    - `Welcome to Metro v0.80.12`
  - 没有进入 `BUNDLE ./index.js`。
- 这说明：
  - `HomeScreen` 顶层这几条文档/文件服务链确实也属于应当收缩的启动期噪音；
  - 但它们仍不是当前 bundle 阻塞的唯一根因。

### 19.5 截止 round416 的连续收口结论
- 当前已经连续完成三轮方向一致的启动期缩图试探：
  1. `fileService` 删除顶层未使用 `xlsx`
  2. `App.js` 删除未使用 `dataService` 并将 `infiniteCanvasStorage` 改为按需加载
  3. `HomeScreen` 将文档/文件处理服务改为按需加载
- 但离线 bundle 依旧没有真正产出，因此下一步仍需继续下钻：
  - `services/index`
  - `documentPickerService` 自身依赖图
  - `preloadService` 与缓存链
  - 以及其它首页间接引用的大模块。

## 20. round417/418 启动链补记：继续去除聚合出口误引用，并确认存在高 CPU 残留 bundle 进程

### 20.1 本轮新增确认：知识图谱组件链上存在“总聚合出口误引用”
- 继续沿“首页未恢复前，优先缩小依赖图而非盲改 UI”的原则排查启动链。
- 本轮在知识图谱组件链复核到一个非常典型的误引用：
  - `src/components/knowledge/index.js` 会聚合导出 `TagGenerator`
  - `TagGenerator` 顶层此前使用：
    - `import { knowledgeGraphApi } from '../../services';`
- 问题在于：
  - `src/services/index.js` 是超重总聚合入口；
  - 它会一次性顶层导入数据库、网络、离线、AI、通知、音频、群组、翻译、WebRTC 等大批服务；
  - 因此只要任意知识图谱页面通过 `../../components/knowledge` 引入该 barrel，`TagGenerator` 就可能把整棵服务树一起拉入 bundle。
- 该模式与当前“Metro 长时间卡在依赖图扫描/转换前段”的症状高度一致，因此属于应优先收缩的启动期噪音。

### 20.2 round417 本轮代码试探一：将 `TagGenerator` 从 `../../services` 改为直连具体 API 模块
- 文件：
  - `D:\ZeroIsle_Notes\src\components\knowledge\TagGenerator.js`
- 本轮调整：
  - 将：
    - `import { knowledgeGraphApi } from '../../services';`
  - 改为：
    - `import knowledgeGraphApi from '../../services/api/knowledgeGraphApi';`
- 目的：
  - 切断知识图谱组件链对 `src/services/index.js` 总聚合入口的误引用；
  - 避免因为一个标签生成组件，把整组无关服务提前带入启动期依赖图。

### 20.3 round418 本轮代码试探二：继续删除首页与通用弹层上未使用的 API 聚合入口
- 本轮继续在“只删噪音、不改行为”的前提下检查更靠近启动入口的模块。
- 新确认两处未使用但会放大依赖图的引用：
  1. `src/screens/common/HomeScreen.js`
     - 未使用的：
       - `import { apiWrapper } from '../../services/api';`
  2. `src/components/common/CreateContentModal.js`
     - 未使用的：
       - `import api from '../../services/api';`
- 这两处共同问题是：
  - `src/services/api/index.js` 本身也是一个 API 聚合出口；
  - 它会顶层导入整组 `authApi / notesApi / knowledgeGraphApi / communityApi / reminderApi / codeApi / userApi ...`
  - 即使当前文件并未真正使用，也会在启动或弹层加载时无端扩大 bundle 依赖图。
- 因此本轮已删除上述两处未使用导入。

### 20.4 round417/418 离线 bundle 复测结果：仍停留在 Metro 欢迎阶段，没有进入 `BUNDLE ./index.js`
- round417 复测命令：
  - `node node_modules/react-native/cli.js bundle --platform android --dev true --entry-file index.js --bundle-output .codex-tmp/round417_bundle.js --assets-dest .codex-tmp/round417-assets --reset-cache --max-workers 1 --verbose`
- round418 复测命令：
  - `node node_modules/react-native/cli.js bundle --platform android --dev true --entry-file index.js --bundle-output .codex-tmp/round418_bundle.js --assets-dest .codex-tmp/round418-assets --reset-cache --max-workers 1 --verbose`
- 两轮共同结果：
  - 3 分钟窗口内都未产生 bundle 成品；
  - 日志 `round417_bundle_full.log`、`round418_bundle_full.log` 仍只停留在：
    - `warning: the transform cache was reset.`
    - `Welcome to Metro v0.80.12`
  - 仍没有进入：
    - `BUNDLE ./index.js`
- 这说明：
  - `TagGenerator` 对总服务聚合入口的误引用、以及首页/通用弹层里未使用的 API 聚合入口，确实都属于应当收缩的启动期噪音；
  - 但这些噪音被剪掉后，Metro / bundle 主卡点仍未被真正打穿；
  - 当前根因依旧更像是依赖图扫描层面存在更深的重链，或 Metro 在 Windows 当前工程体量下仍在前段被拖住。

### 20.5 本轮新增环境证据：存在高 CPU 的残留 bundle 进程，必须纳入后续资源治理
- 本轮使用进程级检查进一步确认：
  - 存在历史残留的离线 bundle 进程：
    - `round417` 对应 `node ... cli.js bundle ... round417_bundle.js`
    - `round418` 对应 `node ... cli.js bundle ... round418_bundle.js`
  - 这些进程在超时后仍未自动退出，并持续占用高 CPU/大内存。
- 同期还确认：
  - `.codex-tmp` 下文件条目规模仍然非常大；
  - 即使 `metro.config.js` 已对 `.codex-tmp`、`docs`、`plans`、`backend`、根目录截图/XML/日志等做了 blockList 收口，工程现场仍非常臃肿。
- 因此本轮将该点明确记为：
  - 不仅要继续缩依赖图；
  - 还必须在每轮结束后及时清理残留 bundle / Metro 试探进程，避免高 CPU 残留持续拖慢机器并污染后续判断。

### 20.6 截止 round418 的阶段性结论
- 本轮进一步排除了三类明显不合理的启动链噪音：
  1. 知识图谱组件链对 `src/services/index.js` 总聚合出口的误引用
  2. 首页 `HomeScreen` 上未使用的 API 聚合入口
  3. 通用创建弹层 `CreateContentModal` 上未使用的 API 聚合入口
- 但离线 bundle 仍未进入真正打包阶段，因此下一步仍需继续下钻：
  - `services/api/index.js` 在其它近入口页面/切片上的聚合引用
  - `services/index.js` 是否仍被其它链路间接带入
  - Metro 在当前工程规模下的扫描面与残留进程治理
  - 以及其它首页/主导航链附近的大模块误引用。

## 21. round419 启动链补记：Redux `reminderSlice` 已脱离 API 聚合出口，但离线 bundle 仍卡在 Metro 欢迎阶段

### 21.1 本轮继续沿 store 启动主链收口，而非回头盲改页面层
- 由于 `App.js -> store/index.js -> redux/store.js` 会在应用启动时稳定进入，
  本轮继续沿 Redux 主链排查是否仍有通过 API 聚合出口放大依赖图的情况。
- 复核确认：
  - `src/redux/slices/reminderSlice.js` 顶层此前使用：
    - `import api from '../../services/api';`
  - 而该 slice 本身作为根 reducer 一部分，会在 store 创建时被直接加载。
- 这意味着：
  - 即使提醒功能当前用户并未打开，
  - `reminderSlice` 也会把 `src/services/api/index.js` 聚合出口提前拉入 store 启动链，
  - 从而一并把整组 API 模块一起带进 bundle。

### 21.2 本轮代码试探：将 `reminderSlice` 改为直连 `reminderApi`
- 文件：
  - `D:\ZeroIsle_Notes\src\redux\slices\reminderSlice.js`
- 本轮调整：
  1. 将：
     - `import api from '../../services/api';`
     改为：
     - `import reminderApi from '../../services/api/reminderApi';`
  2. 将以下调用逐一改为直连提醒 API：
     - `api.get('/reminders/')` -> `reminderApi.getAllReminders()`
     - `api.post('/reminders/', reminderData)` -> `reminderApi.createReminder(reminderData)`
     - `api.put(`/reminders/${id}/`, reminderData)` -> `reminderApi.updateReminder(id, reminderData)`
     - `api.delete(`/reminders/${id}/`)` -> `reminderApi.deleteReminder(id)`
- 本轮保持行为等价，不扩展功能，只做“切断聚合出口误引用”的最小收口。

### 21.3 本轮保守未动的点：`authSlice` 虽也经由 API 聚合出口取 `userApi`，但当前方法映射存在风险
- 同轮复核还发现：
  - `src/redux/slices/authSlice.js` 通过 `../../services/api/index` 获取 `userApi`
- 但进一步核对 `authSlice` 当前调用的方法名与 `userApi.js` 现有导出时发现：
  - `authSlice` 中存在若干调用名与 `userApi.js` 当前实现并不完全一致；
  - 其真实适配关系与 `authApi.js`、现有运行链可能存在历史混用。
- 因此本轮没有贸然直接替换 `authSlice` 的 API 引用路径，
  避免在未补齐行为验证前引入认证链回归。
- 这一点在后续仍值得继续专项清理，但需要更谨慎的逐项核对，而不是这轮顺手硬改。

### 21.4 round419 离线 bundle 复测结果：仍未进入 `BUNDLE ./index.js`
- 本轮继续使用独立缓存目录执行离线打包：
  - `node node_modules/react-native/cli.js bundle --platform android --dev true --entry-file index.js --bundle-output .codex-tmp/round419_bundle.js --assets-dest .codex-tmp/round419-assets --reset-cache --max-workers 1 --verbose`
- 结果：
  - 3 分钟窗口内仍未生成 `round419_bundle.js`
  - `D:\ZeroIsle_Notes\.codex-tmp\round419_bundle_full.log` 仍只停留在：
    - `warning: the transform cache was reset.`
    - `Welcome to Metro v0.80.12`
  - 没有进入：
    - `BUNDLE ./index.js`
- 这说明：
  - `reminderSlice` 对 API 聚合出口的依赖也确实属于启动期噪音；
  - 但剪掉这一条后，Metro / bundle 主卡点依然没有被打穿。

### 21.5 本轮资源治理补记：`round419` 残留 bundle 进程已清理
- 本轮复测后确认超时残留：
  - `node ... cli.js bundle ... round419_bundle.js`
- 为避免其继续占用 CPU 并污染后续判断，
  本轮已显式停止该残留进程。

### 21.6 截止 round419 的新增阶段性结论
- 当前又进一步排除了一个稳定位于 store 启动主链上的聚合出口误引用：
  - `redux/reminderSlice -> services/api/index`
- 但 bundle 仍完全停留在 Metro 欢迎阶段，
  因此下一步仍需继续围绕以下方向下钻：
  1. 继续排查其它 store 主链 slice 是否仍经由 API 聚合出口加载
  2. 更谨慎地梳理 `authSlice` 与 `userApi/authApi` 的真实映射关系
  3. 继续压缩 Metro 在当前工程体量下的扫描面与调试产物残留

## 22. round420 功能完善补记：目标管理已从静态目标列表推进为可直接更新状态与进度的规划执行页

### 22.1 本轮主动调整优先级：不再让启动链深挖拖慢“功能实现和完善”主线
- 基于当前目标和用户最新强调：
  - 要尽快进入功能完善部分；
  - 不要继续被 Metro / bundle 排查无限拖慢；
- 因此本轮主动切换到“规划功能正确实现”的主线推进，
  选择当前文件现场干净、且确实是规划功能核心的 `目标管理` 模块先做实质增强。

### 22.2 本轮确认的实际功能缺口：目标管理此前更像“能建目标的表单页”，而不是“能推进目标的执行页”
- 代码与页面结构复核确认：
  - `GoalManagerScreen` 此前已有：
    - 新建目标
    - 编辑目标
    - 删除目标
    - 展示完成率 / 状态 / 周期
- 但仍缺少用户在日常使用中最常用的两条执行链：
  1. 列表内直接切换目标状态
  2. 列表内快速更新当前完成值 / 当前进度
- 这导致目标管理在真实使用时仍偏“静态资料维护”，
  不符合“规划功能正确实现”和“重点放在功能实现和完善”的要求。

### 22.3 本轮前端增强：列表级快捷状态切换 + 进度更新弹层
- 文件：
  - `D:\ZeroIsle_Notes\src\screens\personal_activity\GoalManagerScreen.js`
- 本轮新增能力：
  1. 为每个目标卡片补充状态徽标
  2. 为每个目标卡片补充快捷状态切换 chips：
     - `进行中`
     - `已暂停`
     - `已完成`
     - `已取消`
  3. 为每个目标卡片补充 `更新进度 / 更新状态` 快捷入口
  4. 新增统一风格的进度更新弹层：
     - 数量型 / 习惯型目标可直接填写 `current_value`
     - 所有目标都可在弹层内直接调整状态
  5. 为目标级异步操作增加局部 loading，避免列表级操作期间缺乏反馈
- 本轮保持：
  - 顶部统一风格不变
  - 深层页返回按钮仍沿用既有淡蓝方形返回按钮体系
  - 只增强功能闭环，不回头大改成熟区域视觉

### 22.4 本轮接口层增强：补齐目标状态与进度快捷更新方法
- 文件：
  - `D:\ZeroIsle_Notes\src\services\api\personalActivityApi.js`
- 新增：
  - `updateGoalStatus(id, status, requestOptions)`
  - `updateGoalProgress(id, currentValue, requestOptions)`
- 目的：
  - 让目标管理页不再重复拼接底层 `updateGoal` 参数；
  - 为后续个人记录链其它页面复用目标状态 / 进度更新能力打基础。

### 22.5 本轮后端一致性增强：更新目标时同步重算完成率，并自动收口完成状态
- 文件：
  - `D:\ZeroIsle_Notes\backend\personal_activity\mongodb_models.py`
- 本轮在 `ActivityGoal.update()` 中补齐：
  1. 更新目标前先读取现有目标
  2. 当 `current_value` 或 `target_value` 被更新时：
     - 同步重算 `completion_rate`
  3. 当完成率达到 `100%` 时：
     - 若本轮未显式指定状态，则自动收口为 `completed`
  4. 若用户直接将状态改为 `completed`：
     - 自动把 `completion_rate` 写为 `100`
- 这样可避免以下不一致：
  - 状态已完成，但完成率仍停留在旧值
  - 当前值已超过目标值，但状态仍停留进行中

### 22.6 截止 round420 的阶段性结论
- 本轮已把 `目标管理` 从“静态目标表单管理”推进为“可直接更新状态与进度的规划执行页”
- 这属于直接面向用户目标的功能完善进展，而不是继续在启动链上空转
- 下一步在个人记录链上仍值得继续补齐：
  1. 目标与活动的关联回流
  2. 目标完成后对统计 / 分析页的联动展示
  3. 分类管理与目标管理之间的使用闭环

## 23. round421 功能完善补记：目标管理已补齐“目标-分类”关联闭环，并进一步压缩目标页无信息留白

### 23.1 本轮继续遵守“功能优先、风格克制”的推进策略
- 结合当前代码现场与用户要求，
  本轮继续不回头大改已经成熟的区域，
  而是选择目标管理这一条已经在推进中的功能主线继续深挖。
- 判断依据是：
  - 后端目标模型其实早已支持 `related_categories`
  - 前端目标管理页却一直没有把这项能力做出来
  - 这会让“目标管理”和“分类管理”两块能力彼此孤立
  - 从真实使用角度看，这会直接削弱规划功能的可整理性与可回顾性

### 23.2 本轮确认的真实功能缺口：目标可以存在，但无法归类，导致规划链仍然断裂
- 复核确认：
  - `backend/personal_activity/serializers.py` 中 `ActivityGoalSerializer` 已支持：
    - `related_categories`
    - `related_activities`
  - `backend/personal_activity/mongodb_models.py` 中 `ActivityGoal.create/update/get_by_id/get_user_goals` 也都已保留这两个字段
- 但前端 `GoalManagerScreen` 之前只有：
  - 标题
  - 描述
  - 类型
  - 数值
  - 周期
- 缺少：
  1. 目标编辑时的分类关联入口
  2. 目标列表中的分类可视化摘要
  3. 页面顶部对目标总体状态的快速总览
- 这意味着：
  - 目标虽然能建、能改、能更新进度，
  - 但仍然没有完成“规划数据可归类、可整理、可复盘”的基本闭环。

### 23.3 本轮前端增强一：目标表单补齐关联分类选择 chips
- 文件：
  - `D:\ZeroIsle_Notes\src\screens\personal_activity\GoalManagerScreen.js`
- 本轮新增：
  1. 分类数据加载：
     - 页面进入时同步拉取 `categories`
  2. 表单模型补齐：
     - `formData.related_categories`
  3. 编辑既有目标时：
     - 会把已有 `related_categories` 回填到表单
  4. 表单 UI：
     - 新增分类选择 chips 区域
     - 点击即可切换是否关联该分类
- 这样用户在建立目标时，终于能直接把目标挂到明确分类下，
  不再需要脑内记忆或等待后续统计页猜测归属。

### 23.4 本轮前端增强二：目标卡片展示关联分类摘要，避免列表回看时信息断裂
- 本轮在目标列表卡片中新增：
  - 已关联分类的 chips 摘要展示
  - 若未关联分类，则给出轻量提示文案
- 这样做的收益是：
  - 用户一眼就能判断该目标属于学习、健身、生活、工作等哪条分类线
  - 目标列表不再只是“标题 + 进度条 + 日期”的孤立卡片
  - 真实复盘时的信息密度更合理，也更符合平板使用场景

### 23.5 本轮前端增强三：目标列表顶部新增摘要卡，减少平板页顶部以下的大块无信息留白
- 本轮还在目标列表顶部增加了四个紧凑摘要卡：
  1. 总目标
  2. 已完成
  3. 进行中
  4. 平均进度
- 这样处理有两个直接价值：
  - 页面进入后不会马上陷入大片平铺列表或空白衔接，信息承接更自然
  - 目标页在平板上更像“管理页”，而不再像仅有表单和卡片的原始堆叠页

### 23.6 本轮样式控制结论：只补原始区域，不回退成熟区域，不破坏顶部与返回按钮统一
- 本轮继续保持不变的纪律：
  - 顶部仍沿用现有统一头部体系
  - 返回按钮仍沿用既有淡蓝色方形箭头按钮
  - 不新增突兀的新视觉语言
  - 不回退已成熟区域样式
- 新增内容的视觉处理只做了轻量一致化：
  - 继续使用圆角卡片
  - 浅色描边
  - 轻量彩色 chips
  - 紧凑统计卡
- 这符合用户持续强调的要求：
  - 不要不合理留白
  - 只改看起来原始的地方
  - 整体风格要一致

### 23.7 截止 round421 的阶段性结论
- 截止当前，
  `目标管理` 已具备：
  1. 创建 / 编辑 / 删除目标
  2. 快捷切换目标状态
  3. 快捷更新目标进度
  4. 后端自动维护完成率与完成状态一致性
  5. 关联分类选择
  6. 列表级分类摘要显示
  7. 顶部摘要卡信息总览
- 这意味着个人记录链中的目标管理，已经明显从“能录目标”推进到“能按分类组织、能跟踪进度、能快速回看”的更完整形态。
- 后续最值得继续接上的两条线：
  1. 目标与活动完成之间的联动回流
  2. 数据分析页对目标维度统计的承接展示
