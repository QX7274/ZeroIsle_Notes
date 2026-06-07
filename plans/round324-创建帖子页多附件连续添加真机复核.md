# round324 - 创建帖子页多附件连续添加真机复核

## 1. 本轮目标
- 在安卓平板真机上继续验证 `社区 -> 创建帖子` 页附件链的“多附件连续添加”能力。
- 确认首次添加后再次进入文件选择器不会冲掉已选附件。
- 确认连续添加第二个附件后，计数、文件列表和删除按钮索引都能正确更新。
- 仅在出现真实故障时做最小修复；若链路正常，则只更新文档，不扩大代码改动面。

## 2. 真机环境
- 设备：`HGR3Y9MA`
- 页面：`CreatePostScreen`
- 日期：`2026-06-07`

## 3. 实测路径
1. 从当前 `创建帖子` 页的无附件态起步。
2. 点击 `添加附件`，拉起系统文件选择器。
3. 选择第一个小文件 `高质量C++编程指南.pdf`（`334 kB`），确认回流后出现 `附件（1）`。
4. 再次点击 `添加附件`，重新拉起系统文件选择器。
5. 选择第二个小文件 `Ai6.apk`（`2.06 MB`），确认回流后出现 `附件（2）`，且第一个附件仍保留。

## 4. 证据文件
- `.local/android-mcp-server/round324_start_state.xml/.png`
- `.local/android-mcp-server/round324_attachment_picker_open.xml/.png`
- `.local/android-mcp-server/round324_after_first_attachment.xml/.png`
- `.local/android-mcp-server/round324_picker_second_attachment_open.xml/.png`
- `.local/android-mcp-server/round324_after_second_attachment.xml/.png`

## 5. 现场结论
- 当前起始现场就在 `创建帖子` 页，附件区为空，适合作为多附件测试基线。
- 第一次选择 `高质量C++编程指南.pdf` 后，页面稳定回流到 `创建帖子`，并展示：
  - `附件（1）`
  - 文件名 `高质量C++编程指南.pdf`
  - 删除按钮 `action.community.removeAttachment.0`
- 第二次重新打开文件选择器并选择 `Ai6.apk` 后，页面再次稳定回流到 `创建帖子`，并展示：
  - `附件（2）`
  - 第一项 `高质量C++编程指南.pdf`
  - 第二项 `Ai6.apk`
  - 删除按钮 `action.community.removeAttachment.0`
  - 删除按钮 `action.community.removeAttachment.1`
- 说明当前“连续添加第二个附件”不会覆盖第一个附件，附件列表索引和数量也能正确增长。
- 证据底部仍可见 `Cannot connect to Metro` 调试提示条；该提示属于 React Native 开发环境与 Metro 连通性提示，不属于本轮社区业务附件链故障。

## 6. 代码变更结论
- 本轮不做代码修改。
- 原因：
  - 多附件连续添加链路当前真机正常；
  - 回流、列表展示和删除按钮索引都未发现真实故障。

## 7. 后续建议
- 下一轮继续补测：
  - 连续添加后删除其中一个附件，确认剩余附件索引是否正确重排；
  - 多附件状态下真实发布成功链；
  - 多附件状态下联网异常发布失败链；
  - 附件、分类、标签同时存在时的表单回流稳定性。
