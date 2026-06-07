## round345 字体设置成功提示原生弹窗收口与真机闭环（2026-06-08）

### 1. 本轮目标
- 继续沿设置系深层页做真实平板验收。
- 处理一个明显偏原始、但页面骨架本身已经成熟的真实问题：
  - `字体设置` 页面在保存成功后仍然弹出系统原生 `Alert`；
  - 这和当前设置系已经逐步统一的项目内圆角弹层风格不一致。
- 本轮只收口成功/失败提示层，不重做成熟页面结构。

### 2. 真实问题
- 页面：`FontSettings`
- 真实路径：
  - `我的 -> 个人资料 -> 应用设置 -> 字体大小`
- 修复前现象：
  - 选择新的字体尺寸后，页面弹出系统原生成功提示框；
  - 文案为：
    - `设置已更新`
    - `字体大小设置已保存并立即生效。`
- 这类系统弹窗在设置系里观感明显偏原始，也不符合当前“项目内统一承接”的规范。

### 3. 本轮代码处理
- 文件：`src/screens/settings/FontSettings.js`
- 处理内容：
  - 移除成功/失败路径上的原生 `Alert.alert(...)`；
  - 新增页面级 `dialogState`；
  - 新增：
    - `openDialog(...)`
    - `closeDialog()`
    - `handleDialogPrimaryPress()`
  - 保存成功：
    - 改为项目内圆角说明弹层；
    - 点击 `知道了` 后再返回上一页；
  - 保存失败：
    - 改为 `showToast.error('更新字体大小失败，请重试。')`
- 新增测试锚点：
  - `state.settings.font.dialog.visibility.visible|hidden`
  - `action.settings.font.dialog.primary`

### 4. 视觉与结构约束
- 本轮不改成熟结构：
  - 不动字体设置页的头部卡片；
  - 不动统一淡蓝色方形返回按钮；
  - 不动选项卡片、预览卡片和页面留白节奏；
  - 只替换最明显原始的系统提示层。
- 本轮继续保证：
  - 顶部不被平板系统状态栏遮挡；
  - 返回按钮风格保持一致；
  - 页面留白不回退；
  - 保存反馈风格与设置系其他圆角弹层一致。

### 5. 真机验证路径
- 设备：`HGR3Y9MA`
- 路径：
  - `我的 -> 个人资料 -> 应用设置 -> 字体大小`
  - 选择新的字体尺寸触发保存
- 现场说明：
  - 中途有一次“前台仍停在旧 bundle 的原生弹窗”现场，以及一次重启后空壳白屏中间态；
  - 这些都没有被拿来充当最终业务结论；
  - 最终只采用重新回到稳定首页、再走完整真实路径后的有效证据。

### 6. 本轮真机有效证据
- 修复前字体页入口：
  - `.local/android-mcp-server/round345_font_entry_before_fix.xml`
  - `.local/android-mcp-server/round345_font_entry_before_fix.png`
- 修复前原生成功弹窗：
  - `.local/android-mcp-server/round345_font_save_dialog_before_fix.xml`
  - `.local/android-mcp-server/round345_font_save_dialog_before_fix.png`
- 修复后设置主页与字体入口链：
  - `.local/android-mcp-server/round345_settings_home_after_font_patch_reenter.xml`
  - `.local/android-mcp-server/round345_settings_home_after_font_patch_reenter.png`
  - `.local/android-mcp-server/round345_font_entry_after_patch_reenter.xml`
  - `.local/android-mcp-server/round345_font_entry_after_patch_reenter.png`
- 修复后项目内成功弹层：
  - `.local/android-mcp-server/round345_font_save_dialog_after_patch_reenter.xml`
  - `.local/android-mcp-server/round345_font_save_dialog_after_patch_reenter.png`

### 7. 真机验证结论
- 修复前事实确认：
  - 字体设置页保存成功后，XML 明确命中：
    - `com.zeroisle_notes:id/alertTitle`
    - `android:id/message`
    - `android:id/button1`
  - 文案为：
    - `设置已更新`
    - `字体大小设置已保存并立即生效。`
  - 说明此前确实还是系统原生成功弹窗。
- 修复后通过：
  - 修复后稳定现场下，保存成功后命中：
    - `设置已更新`
    - `字体大小设置已保存并立即生效。`
    - `action.settings.font.dialog.primary`
  - 已不再出现系统 `alertTitle/button1` 结构。
- 页面结构未回退：
  - 字体设置页持续命中 `state.settings.font.state.ready`；
  - 返回按钮仍是统一淡蓝色方形箭头；
  - 顶部内容仍位于系统状态栏下方；
  - 选项区与预览卡片节奏没有被破坏。

### 8. 本轮结论
- `FontSettings` 已从“保存成功仍弹系统原生对话框”推进到“使用项目内统一圆角弹层承接成功反馈”。
- 这轮修复只处理明显原始的提示层，没有误伤成熟页面骨架，符合当前整套设置系的 UI/UX 收口策略。
