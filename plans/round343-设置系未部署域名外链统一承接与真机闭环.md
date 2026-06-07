## round343 设置系未部署域名外链统一承接与真机闭环（2026-06-08）

### 1. 本轮目标
- 继续沿 `我的 -> 个人资料 -> 应用设置` 深层页做真实平板验收。
- 处理一个已经影响真实使用判断的问题：
  - `帮助与反馈`、`关于` 中仍保留指向 `https://zeroislenotes.com...` 的网页入口；
  - 但当前生产域名尚未部署，用户点击后只会进入失败链路；
  - 这既不诚实，也会制造“软件没网/功能坏了”的误判。
- 本轮要求不是简单吞掉错误，而是统一改为项目内自定义说明弹层承接，同时保持设置系已有顶部、安全区、返回按钮与深层页结构规范不回退。

### 2. 真实问题与现场依据
- 现场入口链：
  - `我的 -> 个人资料 -> 应用设置 -> 帮助与反馈`
  - `我的 -> 个人资料 -> 应用设置 -> 关于`
- 已确认事实：
  - `https://zeroislenotes.com`
  - `https://zeroislenotes.com/help`
  - `https://zeroislenotes.com/privacy`
  - `https://zeroislenotes.com/terms`
  - 当前都不应被当成可用正式网页入口。
- 问题性质：
  - 这不是“平板和电脑后端不通”的问题；
  - 而是“前端还在暴露一个尚未部署完成的生产域名入口”的问题；
  - 如果继续直接调用系统打开链接，用户只会得到失败结果，体验很原始，也容易误判成全局网络异常。

### 3. 本轮代码处理

#### 3.1 `src/screens/settings/HelpScreen.js`
- 新增本地 `dialogState`，统一承接未部署帮助网页入口。
- 修改 `openLink(url)`：
  - 若目标是 `https://zeroislenotes.com...`
  - 不再尝试直接 `Linking.openURL`
  - 改为弹出项目内自定义圆角说明弹层。
- 弹层口径：
  - 标题：`帮助中心暂未上线`
  - 文案：`当前生产域名尚未部署，帮助中心网页暂时无法访问。你可以先使用本页反馈表单，或通过支持邮箱联系我们。`
- 保留可用入口：
  - `mailto:support@zeroislenotes.com` 仍沿用原可点击逻辑，不做无意义拦截。
- 新增测试锚点：
  - `state.settings.help.linkDialog.visibility.visible|hidden`
  - `action.settings.help.linkDialog.close`

#### 3.2 `src/screens/settings/AboutScreen.js`
- 新增本地 `dialogState`，统一承接官网类外链。
- 修改 `openLink(url)`：
  - 若目标属于 `https://zeroislenotes.com...`
  - 不再尝试直接打开网页
  - 改为弹出项目内自定义圆角说明弹层。
- 弹层口径：
  - 标题：`官网内容暂未上线`
  - 文案：`当前生产域名尚未部署，官网、帮助中心、隐私政策与用户协议网页暂时无法访问。后续域名部署完成后，这些入口会恢复可用。`
- 新增测试锚点：
  - `state.settings.about.linkDialog.visibility.visible|hidden`
  - `action.settings.about.linkDialog.close`

### 4. 视觉与交互约束
- 本轮继续遵守既定设置系规范：
  - 顶部内容必须位于平板系统状态栏下方，不能被遮挡；
  - 返回按钮继续统一使用已有淡蓝色方形箭头；
  - 深层设置页不能露出主底部 Tab；
  - 布局留白保持合理，不因为补弹层而引入新的原始白板感；
  - 网络或链接异常必须使用项目内统一优美样式承接，不再依赖默认安卓弹窗。
- 本轮没有重做成熟页面骨架：
  - 不改设置系成熟头部框架；
  - 不改已稳定的表单、FAQ、说明区整体节奏；
  - 只对“仍然误导点击到未部署网页”的真实问题做最小必要修复。

### 5. 真机验证路径
- 设备：`HGR3Y9MA`
- 联调前提：
  - `adb reverse tcp:8081 tcp:8081`
  - `adb reverse tcp:8001 tcp:8001`
- 验证路径一：
  - `我的 -> 个人资料 -> 应用设置 -> 帮助与反馈 -> 帮助中心`
- 验证路径二：
  - `我的 -> 个人资料 -> 应用设置 -> 关于 -> 官方网站`
  - `我的 -> 个人资料 -> 应用设置 -> 关于 -> 帮助中心`
  - `我的 -> 个人资料 -> 应用设置 -> 关于 -> 隐私政策`
  - `我的 -> 个人资料 -> 应用设置 -> 关于 -> 用户协议`

### 6. 本轮真机有效证据
- 设置页定位证据：
  - `.local/android-mcp-server/round343_settings_scrolled.xml`
  - `.local/android-mcp-server/round343_settings_scrolled.png`
- 帮助页入口证据：
  - `.local/android-mcp-server/round343_help_entry.xml`
  - `.local/android-mcp-server/round343_help_entry.png`
- 帮助页未部署域名承接弹层证据：
  - `.local/android-mcp-server/round343_help_link_dialog.xml`
  - `.local/android-mcp-server/round343_help_link_dialog.png`
- 关于页入口证据：
  - `.local/android-mcp-server/round343_about_entry.xml`
  - `.local/android-mcp-server/round343_about_entry.png`
- 关于页四类未部署域名承接弹层证据：
  - `.local/android-mcp-server/round343_about_dialog_official.xml`
  - `.local/android-mcp-server/round343_about_dialog_official.png`
  - `.local/android-mcp-server/round343_about_dialog_help.xml`
  - `.local/android-mcp-server/round343_about_dialog_help.png`
  - `.local/android-mcp-server/round343_about_dialog_privacy.xml`
  - `.local/android-mcp-server/round343_about_dialog_privacy.png`
  - `.local/android-mcp-server/round343_about_dialog_terms.xml`
  - `.local/android-mcp-server/round343_about_dialog_terms.png`

### 7. 真机验证结论
- `帮助与反馈` 页验证通过：
  - 页面稳定命中 `action.settings.help.back`、`action.settings.help.openHelpCenter`；
  - 点击 `帮助中心` 后，不再尝试跳转失效网页；
  - 现场稳定出现项目内说明弹层，并命中 `state.settings.help.linkDialog.visibility.visible`；
  - 弹层正文明确说明“生产域名尚未部署”，没有再把问题伪装成笼统网络错误；
  - `support@zeroislenotes.com` 邮箱入口继续保留为真实可用联系渠道。
- `关于` 页验证通过：
  - 页面稳定命中 `action.settings.about.back`；
  - `官方网站 / 帮助中心 / 隐私政策 / 用户协议` 四个入口逐一点击后，都统一落到项目内说明弹层；
  - 每次都稳定命中 `action.settings.about.linkDialog.close`；
  - 没有再出现系统浏览器失败链、默认安卓弹窗或无意义空白跳转。
- 结构规范未回退：
  - 顶部安全区继续正常，页面头部没有被平板顶部状态栏遮挡；
  - 返回按钮继续统一使用已有淡蓝色方形箭头；
  - `帮助与反馈` 与 `关于` 两个深层页都没有露出主底部 Tab；
  - 页面留白与卡片承接保持合理，没有新增明显原始白区。

### 8. 本轮结论
- 当前真实问题已经从“用户点到未部署域名后收到失败结果”推进到“由项目内统一说明弹层诚实承接”。
- 这轮不把未部署域名伪装成可用功能，也不把问题错误归因为平板没网或后端未联通。
- 在后端联通已恢复、平板与电脑通信已打通的前提下，这种承接方式更符合真实生产前状态，也更符合整套设置系的统一 UI/UX 规范。

### 9. 后续建议
- 等生产域名真实部署完成后，再把这些说明弹层逐步恢复为真实网页跳转。
- 在此之前，设置系里所有依赖未上线外链的入口都应继续遵循本轮规则：
  - 不装作可用；
  - 不弹默认安卓对话框；
  - 使用项目内统一优雅样式诚实说明当前阶段状态。
