# round321 创建帖子页空分类与空标签弹层收口

## 目标
- 继续沿 `创建帖子` 页做真实交互验证，不停在静态页面美化层面。
- 重点检查分类选择、标签选择等弹层在“无数据”情况下是否存在原始空白感或交互异常。

## 真机现场
- 本轮从 `创建帖子` 页面依次实际点击：
  - `未选择分类`
  - `未选择标签`
- 真机确认：
  - 两个入口都可打开；
  - 没有原生系统弹窗或跳转异常；
  - 关闭按钮和完成按钮都能正常返回表单页。
- 但修复前两类空弹层都存在同一个明显问题：
  - 弹层虽然浮起了，但在当前无分类、无标签数据时，仍然保持大面积满屏白板；
  - 页面主体只在顶部出现一行 `暂无分类` / `暂无标签`；
  - 在平板上显得非常空、非常原始，和这几轮已统一的社区卡片承接风格不一致。

## 原因分析
- `CreatePostScreen` 的分类/标签选择层共用同一套 `pickerContainer`，默认固定占据很大高度；
- 即使当前没有可选项，也仍然使用同一套大容器；
- 空态只是简单文本，没有独立承接卡片与说明信息，导致大屏下空白被放大。

## 本轮修改
- `src/screens/community/CreatePostScreen.js`
  - 为分类和标签选择层增加“有数据 / 无数据”两套容器策略；
  - 无分类或无标签时，将弹层收口为更紧凑的高度，不再占满大半屏；
  - 为 `暂无分类`、`暂无标签` 补齐图标、标题、说明文案和完整空态卡片；
  - 保持现有分类/标签选择逻辑、关闭/完成按钮逻辑不变。

## 真机证据
- 修复前分类弹层：`.local/android-mcp-server/round321_category_picker_open.png/.xml`
- 修复前标签弹层：`.local/android-mcp-server/round321_tag_picker_open.png/.xml`
- 修复后分类弹层：`.local/android-mcp-server/round321_category_picker_after_empty_state_fix_v2.png/.xml`
- 修复后标签弹层：`.local/android-mcp-server/round321_tag_picker_after_empty_state_fix.png/.xml`

## 校验
- 已执行：
  - `npx eslint src/screens/community/CreatePostScreen.js`
- 结果：
  - 无 error；
  - 仅保留既有 `react-native/no-inline-styles` warnings 4 条。

## 本轮结论
- `创建帖子` 页在无分类、无标签数据时，分类/标签弹层已从“整块大白板 + 一行空文案”收口为紧凑的空态卡片。
- 这轮没有改接口和选择逻辑，只收口了当前最明显的原始空弹层观感问题。

## 下一轮建议
- 继续补测附件选择是否能稳定回流，以及真实发布失败态是否还有需要统一收口的提示文案；
- 若社区发帖链阶段性稳定，可转去下一个仍显原始的业务表单页继续真机排查。
