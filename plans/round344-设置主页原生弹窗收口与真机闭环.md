## round344 设置主页原生弹窗收口与真机闭环（2026-06-08）

### 1. 本轮目标
- 继续沿 `我的 -> 个人资料 -> 应用设置` 做真实平板验收。
- 处理一个与既有规范直接冲突的真实问题：
  - 设置主页的多个关键动作仍在使用原生安卓 `Alert.alert(...)`；
  - 这与当前项目已经形成的“统一项目内圆角弹层/状态承接”风格不一致；
  - 也与前面已经明确要求的“异常、确认、网络问题不要用默认安卓弹窗”相冲突。
- 本轮只处理设置主页中明显原始的提示承接层，不重做成熟布局骨架。

### 2. 真实问题
- 页面：`SettingsScreen`
- 真实路径：
  - `我的 -> 个人资料 -> 应用设置 -> 清理缓存`
  - `我的 -> 个人资料 -> 应用设置 -> 检查更新`
  - 同页还包含 `重置所有设置`、`退出登录`
- 修复前代码问题：
  - `清理缓存` 使用原生确认框 + 原生结果框；
  - `检查更新` 使用原生说明框；
  - `重置设置` 使用原生确认框；
  - `退出登录` 使用原生确认框 + 原生结果框。
- 修复前真机问题：
  - `清理缓存` 点击后直接出现系统 `Alert`；
  - 弹层样式与设置系已收好的浅蓝卡片、统一圆角说明弹层不一致；
  - 在平板上观感明显偏原始。

### 3. 本轮代码处理
- 文件：`src/screens/settings/SettingsScreen.js`
- 处理方式：
  - 移除本页关键动作上的原生 `Alert.alert(...)`；
  - 新增页面级 `dialogState`；
  - 新增：
    - `openDialog(...)`
    - `closeDialog()`
    - `handleDialogPrimaryPress()`
    - `handleDialogSecondaryPress()`
  - 新增页面级项目内自定义弹层：
    - 半透明遮罩
    - 白色圆角卡片
    - 淡蓝信息 icon
    - 危险动作时切换为红色警示 icon 与红色主按钮
- 具体收口：
  - `清理缓存`
    - 改为项目内确认弹层；
    - 成功/失败改为 `showToast`；
  - `检查更新`
    - 无新版本时改为项目内说明弹层；
    - 有新版本时改为项目内确认弹层；
    - 如果更新链接打不开，改为 `showToast.error(...)`；
  - `重置所有设置`
    - 改为项目内危险确认弹层；
    - 完成后改为 `showToast.success(...)`；
  - `退出登录`
    - 改为项目内危险确认弹层；
    - 完成后改为 `showToast.info(...)`；
- 新增测试锚点：
  - `state.settings.main.dialog.visibility.visible|hidden`
  - `action.settings.main.dialog.primary`
  - `action.settings.main.dialog.secondary`

### 4. 视觉与结构约束
- 本轮不改成熟结构：
  - 不动设置主页的现有分组卡片骨架；
  - 不动统一顶部标题与布局节奏；
  - 不改现有返回按钮样式；
  - 不改分组留白和卡片层级。
- 本轮需要保证：
  - 顶部内容仍在平板系统状态栏下方；
  - 返回按钮继续统一使用已有淡蓝色方形箭头；
  - 页面留白不回退；
  - 只把原生安卓弹窗替换为项目内统一承接层。

### 5. 真机验证路径
- 设备：`HGR3Y9MA`
- 路径：
  - `我的 -> 个人资料 -> 应用设置 -> 清理缓存`
  - `我的 -> 个人资料 -> 应用设置 -> 检查更新`
- 说明：
  - 中途曾遇到一次历史性空壳白屏中间态与一次误点进入 `主题设置` 的无效现场；
  - 这些都没有被拿来充当业务结论；
  - 最终只采用重新回到稳定设置主页后的有效证据。

### 6. 本轮真机有效证据
- 修复前原生弹窗证据：
  - `.local/android-mcp-server/round344_settings_clear_cache_dialog_before_fix.xml`
  - `.local/android-mcp-server/round344_settings_clear_cache_dialog_before_fix.png`
- 修复后稳定设置主页证据：
  - `.local/android-mcp-server/round344_back_to_settings_home_from_theme.xml`
  - `.local/android-mcp-server/round344_back_to_settings_home_from_theme.png`
- 修复后 `清理缓存` 项目内弹层证据：
  - `.local/android-mcp-server/round344_settings_clear_cache_exact_after_patch.xml`
  - `.local/android-mcp-server/round344_settings_clear_cache_exact_after_patch.png`
- 修复后 `检查更新` 项目内弹层证据：
  - `.local/android-mcp-server/round344_settings_after_dialog_close_scroll_for_update.xml`
  - `.local/android-mcp-server/round344_settings_after_dialog_close_scroll_for_update.png`
  - `.local/android-mcp-server/round344_settings_check_update_after_patch.xml`
  - `.local/android-mcp-server/round344_settings_check_update_after_patch.png`

### 7. 真机验证结论
- 修复前事实确认：
  - `清理缓存` 入口此前会弹出系统原生 `Alert`；
  - XML 明确命中：
    - `com.zeroisle_notes:id/alertTitle`
    - `android:id/message`
    - `android:id/button1`
    - `android:id/button2`
  - 说明此前确实仍在使用原生安卓弹窗。
- 修复后 `清理缓存` 通过：
  - 现场稳定显示项目内弹层；
  - 命中：
    - `清理缓存`
    - `确定要清理应用缓存吗？不会影响笔记数据。`
    - `action.settings.main.dialog.secondary`
    - `action.settings.main.dialog.primary`
  - 不再出现系统 `alertTitle/button1/button2` 结构。
- 修复后 `检查更新` 通过：
  - 在当前“已是最新版本”的真实现场下，稳定显示项目内说明弹层；
  - 命中：
    - `检查更新`
    - `当前已是最新版本。`
    - `action.settings.main.dialog.primary`
- 结构规范继续通过：
  - 设置主页稳定命中 `state.settings.main.state.ready`；
  - 顶部标题与返回按钮未被平板状态栏遮挡；
  - 返回按钮仍维持统一淡蓝色方形箭头；
  - 本轮只收口提示层，没有破坏原有分组卡片与留白节奏。

### 8. 本轮结论
- `SettingsScreen` 已从“主页关键动作仍残留原生安卓弹窗”推进到“统一使用项目内圆角弹层与 Toast 承接”。
- 这轮修复直接提升了设置主页的成品感与一致性，也继续遵守了“只改明显原始部分，不动成熟骨架”的原则。
