# round342 自定义主题页亮暗联动口径统一与真机闭环

## 本轮目标
- 修复 `我的 -> 个人资料 -> 应用设置 -> 主题设置 -> 自定义主题` 中，亮色/暗色编辑模式与颜色输入框、预览区之间口径不一致的真实功能问题。
- 保持设置系既有成熟风格不变，只修复当前明显错误与会误导使用的交互。
- 持续满足既定结构规范：
  - 顶部内容不得被平板系统状态栏遮挡；
  - 返回按钮继续统一使用已有淡蓝色方形箭头；
  - 深层页面不露主底部 Tab；
  - 布局留白需要合理，不出现明显原始空板感。

## 问题复盘
- `ThemeCustomizationScreen` 已在上一轮打通真实入口，但继续真机使用后发现更深一层的功能错误：
  - 页面切到 `深色主题` 编辑模式后，颜色输入框仍可能读取当前全局主题色，而不是深色模式对应的真实值；
  - 预览区也仍可能沿用全局当前主题配色，造成“顶部切到 dark，但预览仍像 light”的假联动；
  - 点击重置后，如果仍停留在 `深色主题` 编辑态，页面字段与预览没有稳定按深色默认值回落，容易误导用户判断主题是否真的重置成功。
- 这不是单纯 UI 细节，而是会直接影响主题功能正确性的真实缺陷，因此本轮优先处理。

## 改动范围
- 主题上下文：
  - `src/context/ThemeContext.js`
- 颜色选择器：
  - `src/components/common/ThemeColorPicker.js`
- 自定义主题页：
  - `src/screens/theme/ThemeCustomizationScreen.js`

## 具体修改
### 1. 主题上下文补齐“按编辑模式取主题”的能力
- 在 `ThemeContext` 中新增：
  - `getThemeByMode(mode)`
  - `getModeColor(colorKey, mode, fallback)`
- 目的：
  - 把“当前正在编辑 light 还是 dark”从页面视觉层提升为上下文能力；
  - 让颜色读取不再依赖全局当前生效主题，而是显式读取指定模式下的真实主题值。
- 同时将这两个方法补入：
  - `createContext` 默认值；
  - `ThemeProvider` 的 `value`；
  - `useTheme()` 的兜底返回。

### 2. 颜色输入框改为读取当前编辑模式下的真实颜色
- `ThemeColorPicker` 内部不再通过当前全局 `getColor(...)` 取值，而是改为：
  - `getModeColor(colorKey, mode, '')`
- 新增同步逻辑：
  - 当 `mode` 切换，或该模式下该颜色的真实值变化时，自动刷新输入框和右侧色块。
- 结果：
  - 从浅色切到深色后，字段值会真实切到深色模式值；
  - 点击重置后，如果当前仍在深色编辑态，输入框也会回到深色默认值，而不是错误显示浅色值。

### 3. 预览区改为按当前编辑模式渲染
- `ThemeCustomizationScreen` 中新增：
  - `const previewTheme = getThemeByMode(editMode)`
  - `const previewColors = previewTheme.colors`
- 预览区中的以下元素统一改为使用 `previewColors.*`：
  - 预览卡背景
  - 边框
  - 标题
  - 次要文本
  - 分隔线
  - 主要按钮
  - 次要按钮
  - 成功 / 信息 / 警告 / 错误状态块
- 结果：
  - 编辑浅色主题时，预览区真实展示浅色；
  - 编辑深色主题时，预览区真实展示深底浅字；
  - 页面不再出现“模式切换了，但预览口径没切”的假联动。

## 真机测试
### 测试设备
- 平板设备：`HGR3Y9MA`

### 测试路径
- `我的 -> 个人资料 -> 应用设置 -> 主题设置 -> 自定义主题`

### 有效证据
- 设置入口链：
  - `tmp_round342_profile_entry.png`
  - `tmp_round342_profile_entry.xml`
  - `tmp_round342_settings_entry.png`
  - `tmp_round342_settings_entry.xml`
  - `tmp_round342_theme_page.png`
  - `tmp_round342_theme_page.xml`
- 浅色基线：
  - `tmp_round342_customization_baseline.png`
  - `tmp_round342_customization_baseline.xml`
- 深色字段态：
  - `tmp_round342_dark_top.png`
  - `tmp_round342_dark_top.xml`
- 深色预览态：
  - `tmp_round342_dark_preview.png`
  - `tmp_round342_dark_preview.xml`
- 深色重置态：
  - `tmp_round342_after_reset.png`
  - `tmp_round342_after_reset.xml`

## 真机结论
### 1. 设置链继续可达
- `主题设置` 页面稳定命中：
  - `entry.settings.theme.customization`
- `自定义主题` 入口保持正常，无回退。

### 2. 浅色编辑态字段值正常
- 页面命中：
  - `state.themeCustomization.state.editing-light`
- 现场可见浅色关键字段值：
  - `#2196F3`
  - `#F57C00`
  - `#FFFFFF`

### 3. 切换深色后字段值已真实切换
- 页面命中：
  - `state.themeCustomization.state.editing-dark`
- 现场可见深色关键字段值：
  - `#4A6FE3`
  - `#FF9800`
  - `#121212`
  - `#212121`
- 说明：
  - 输入框已不再错误读取全局当前主题；
  - 而是根据当前编辑模式，真实读取深色模式值。

### 4. 深色预览区已真实联动
- 页面命中：
  - `state.themeCustomization.preview`
- 预览区文本与按钮均可见：
  - `主题预览`
  - `主要按钮`
  - `次要按钮`
  - `成功`
  - `信息`
  - `警告`
  - `错误`
- 截图确认预览区已为深底浅字，不再是假联动。

### 5. 深色模式下点击重置后仍稳定
- 重置后页面仍命中：
  - `state.themeCustomization.state.editing-dark`
- 预览区仍存在，且深色默认状态色保持正确：
  - `#66BB6A`
  - `#29B6F6`
  - `#FFEE58`
  - `#EF5350`
- 说明重置没有把页面错误打回浅色口径，也没有破坏当前编辑模式。

### 6. 结构规范继续通过
- 顶部安全区通过：
  - 页头内容位于系统状态栏下方，没有被遮挡；
  - 页面高度没有粗暴按整个平板物理尺寸铺满，而是继续考虑了系统状态栏安全区。
- 返回按钮一致性通过：
  - 继续统一使用已有淡蓝色方形箭头；
  - 没有混入原生头部样式。
- 深层页底栏规范通过：
  - 自定义主题页未露出主底部 Tab。
- 布局留白复核通过：
  - 本轮只修真实联动缺陷，不重做成熟卡片结构；
  - 现有分组卡片与预览承接仍保持合理，没有新增明显异常白板。

## 本轮边界
- 本轮聚焦修复“亮暗编辑模式与字段、预览口径不一致”的真实功能缺陷，并完成真机闭环。
- 未额外重做成熟的主题设置外层页面，只在已有结构中做最小且必要的功能修正。
- 后续仍可继续补测：
  - 多个颜色字段连续修改后的持久化回读；
  - 退出页面再进入后的模式与颜色恢复；
  - 自定义主题与全局主题切换之间的联动边界。

## 本轮结论
- `自定义主题` 页当前已从“入口可达但亮暗编辑真实口径错位”推进到“字段值、预览区、重置行为全部按当前编辑模式真实联动”。
- 本轮继续遵守既定要求：
  - 只修真实问题；
  - 不动成熟页面；
  - 保持顶部安全区、返回按钮、深层页结构和整体风格一致。
