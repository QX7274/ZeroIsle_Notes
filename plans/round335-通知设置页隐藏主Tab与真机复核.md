# round335 通知设置页隐藏主Tab与真机复核

## 本轮目标
- 继续沿 `我的 -> 应用设置 -> 通知设置` 做平板真机复核。
- 解决设置深层页仍露出主底部 Tab 的层级问题，避免详情页像还嵌在主页壳子里。
- 保持顶部安全区、统一淡蓝色方形返回按钮和既有设置页视觉风格不被破坏。

## 问题背景
- 上一轮继续筛查设置深层页时，真机在 `通知设置` 页复现了一个结构性问题：
  - 页面已经进入深层设置详情；
  - 顶部使用了统一的自定义头和返回按钮；
  - 但底部主 Tab 仍然可见，导致页面层级错误，也让整个详情页看起来像没有真正脱离主页。
- 该问题不是单个卡片留白，而是导航承接不完整，属于平板真机上必须优先收口的真实使用问题。

## 根因定位
- 相关文件：
  - `src/navigation/AppNavigator.js`
  - `src/screens/settings/NotificationSettingsScreen.js`
- 现场确认：
  - `SettingsNavigator` 虽然给深层页普遍传了 `initialParams={{ hideTabBar: true }}`；
  - 但实际真机复现表明，仅靠这条隐式参数链并不稳定；
  - `通知设置` 页进入后，主底部 Tab 仍可能保留在视图树里。
- 说明：
  - 这不是顶部安全区问题；
  - 也不是按钮样式问题；
  - 而是“设置深层页隐藏主 Tab”的判定链不够稳。

## 实施范围
- 修改文件：
  - `src/navigation/AppNavigator.js`
  - `src/screens/settings/NotificationSettingsScreen.js`
- 不改动内容：
  - `通知设置` 页现有卡片、开关、权限提示、时间段与优先级布局；
  - 顶部标题样式与统一淡蓝色返回按钮；
  - 设置主页的成熟结构；
  - 其他成熟页面的视觉语言。

## 代码调整
- 第一层兜底：
  - 在 `NotificationSettingsScreen` 接入已有通用 Hook：
    - `useHideMainTabBar`
  - 让该页在聚焦时主动向上隐藏主 Tab。
- 第二层统一收口：
  - 在 `AppNavigator.getTabBarStyle()` 的 `nestedFlowScreens` 中，显式补齐设置深层页名单：
    - `Settings`
    - `ThemeSettings`
    - `FontSettings`
    - `OfflineData`
    - `SyncSettings`
    - `NotificationSettings`
    - `About`
    - `Help`
    - `AIAssistantSettings`
    - 以及个人中心下其他实际属于深层详情流的设置/功能页
  - 目的：
    - 不再只依赖某一层 route params 透传是否成功；
    - 而是从主导航统一把这类深层页判定为“应隐藏主 Tab”。

## 真机复核
- 设备：
  - `HGR3Y9MA`
- 安装与联通：
  - `android/gradlew.bat :app:installDebug --console=plain`
  - `adb -s HGR3Y9MA reverse tcp:8081 tcp:8081`
  - `adb -s HGR3Y9MA reverse tcp:8001 tcp:8001`

## 复核过程中的无效现场
- 本轮中途出现过几类无效现场，均不作为最终业务结论：
  - 调试包脚本加载异常页：
    - `tmp_round335_after_forcestop_restart.png`
  - 历史性瞬时白屏容器态：
    - `tmp_round335_notification_after_navfix.png`
    - `tmp_round335_after_reverse_restart.png`
  - 错误抓到系统桌面或非目标页面的中间态文件：
    - `tmp_round335_recover_front.xml`
    - 以及本轮若干中间 `tmp_round335_*` 调试取证文件
- 说明：
  - 这些都是联调时序或抓取时点噪声；
  - 不能混入“通知设置页最终布局是否正确”的结论。

## 最终有效现场
- 目标页最终有效截图与 UI 树：
  - `tmp_round335_settings_entry_retry.png`
  - `tmp_round335_notification_final.png`
  - `tmp_round335_notification_final.xml`

## 有效结论
- 设置主页已稳定进入：
  - UI 树命中 `state.settings.main.state.ready`
  - 顶部返回按钮命中 `action.settings.main.back`
- 通知设置页已稳定进入：
  - UI 树命中 `state.settings.notification.state.ready`
  - 顶部返回按钮命中 `action.settings.notification.back`
  - 列表容器命中 `list.settings.notification.sections`
- 顶部安全区结论：
  - `通知设置` 标题区位于系统状态栏之下；
  - 统一淡蓝色方形返回按钮仍保持既有样式，没有被本轮带偏。
- 底部主 Tab 结论：
  - 最终 `tmp_round335_notification_final.xml` 中：
    - `nav.tab.profile` 未命中；
  - 说明 `通知设置` 作为设置深层页时，主底部 Tab 已被正确移除；
  - 截图中底部仅剩系统手势条，不再是应用主 Tab。

## 与既有规范的关系
- 本轮继续符合以下规则：
  - 顶部不得被平板系统状态栏遮挡；
  - 返回按钮继续统一使用已有淡蓝色方形箭头；
  - 进入深层详情页后，应合理去除应用主底部栏，不能让详情页继续挂着主页壳；
  - 只改明显存在问题的承接层，不重做成熟页面视觉；
  - 调试黑框或联调噪声不误记为业务页面故障。

## 风险与后续
- 当前已确认 `通知设置` 深层页主 Tab 隐藏生效；
- 但用户此前已经明确指出“很多页面底部状态栏还能看见”，因此后续仍需继续沿以下页面做同类复核：
  - `帮助与反馈`
  - `关于`
  - `AI 助手设置`
  - `主题`
  - `字体大小`
- 若这些设置深层页里仍有页面漏出主 Tab，应继续复用本轮统一判定方式，而不是逐页临时补丁。
