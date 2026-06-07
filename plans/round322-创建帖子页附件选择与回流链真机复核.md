# round322 - 创建帖子页附件选择与回流链真机复核

## 1. 本轮目标
- 在安卓平板真机上继续验证 `社区 -> 创建帖子` 页的附件入口。
- 实测附件选择器拉起、文件回流、取消返回三段链路。
- 仅在存在真实问题时做最小修复；若链路正常，则只回填文档，不扩大代码改动面。

## 2. 真机环境
- 设备：`HGR3Y9MA`
- 页面：`CreatePostScreen`
- 日期：`2026-06-07`

## 3. 实测路径
1. 从社区首页点击右下角 `发布`，重新进入 `创建帖子`。
2. 点击 `添加附件`，确认系统文件选择器正常拉起。
3. 选择小文件 `高质量C++编程指南.pdf`。
4. 确认页面回到 `创建帖子`，并展示附件卡片。
5. 再次进入文件选择器后按返回取消，确认仍停留在 `创建帖子` 页。

## 4. 证据文件
- `.local/android-mcp-server/round322_repro_create_post_reenter.xml/.png`
- `.local/android-mcp-server/round322_repro_attachment_picker_open.xml/.png`
- `.local/android-mcp-server/round322_repro_attachment_file_selected.xml/.png`
- `.local/android-mcp-server/round322_repro_attachment_cancel_after_success.xml/.png`

## 5. 现场结论
- `添加附件` 可稳定拉起系统 `DocumentsUI` 文件选择器。
- 选择 `高质量C++编程指南.pdf` 后，可稳定回流到 `创建帖子` 页。
- 页面已展示：
  - `附件（1）`
  - 文件名 `高质量C++编程指南.pdf`
  - 文件大小 `326.1 KB`
  - 删除按钮 `action.community.removeAttachment.0`
- 再次打开文件选择器后按返回取消，页面仍停留在 `创建帖子` 页，已选附件不会丢失。

## 6. 代码变更结论
- 本轮不做代码修改。
- 原因：真机最终复核确认链路正常，继续改代码会扩大风险，不符合“只修真实问题”的约束。

## 7. 后续建议
- 下一轮继续补测：
  - 多附件连续添加；
  - 超过 10MB 文件过滤提示；
  - 删除附件按钮回流；
  - 联网条件下真实发布成功/失败链路。
