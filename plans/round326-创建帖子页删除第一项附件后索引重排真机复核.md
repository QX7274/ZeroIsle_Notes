# round326 - 创建帖子页删除第一项附件后索引重排真机复核

## 1. 本轮目标
- 在安卓平板真机上继续验证 `社区 -> 创建帖子` 页附件链的“多附件状态下删除第一项附件”能力。
- 确认删除第一项附件后，第二项附件不会被误删。
- 确认删除后附件数量、剩余文件列表和删除按钮索引都能正确重排。
- 仅在出现真实故障时做最小修复；若链路正常，则只更新文档，不扩大代码改动面。

## 2. 真机环境
- 设备：`HGR3Y9MA`
- 页面：`CreatePostScreen`
- 日期：`2026-06-07`

## 3. 实测路径
1. 从 `round325` 结束后的单附件现场出发，先重新恢复双附件状态：
   - 现有附件：`高质量C++编程指南.pdf`
   - 重新添加：`Ai6.apk`
2. 停留在 `创建帖子` 页，确认当前展示 `附件（2）`。
3. 点击第一项附件 `高质量C++编程指南.pdf` 的删除按钮。
4. 确认页面仍停留在 `创建帖子`。
5. 确认附件区是否回到 `附件（1）`，并检查剩余附件删除按钮是否重排回 `action.community.removeAttachment.0`。

## 4. 证据文件
- `.local/android-mcp-server/round326_start_state.xml/.png`
- `.local/android-mcp-server/round326_picker_live.xml/.png`
- `.local/android-mcp-server/round326_after_restore.xml/.png`
- `.local/android-mcp-server/round326_after_remove_first_attachment.xml/.png`

## 5. 现场结论
- 起始现场为单附件状态，页面仍停留在 `创建帖子`，并展示：
  - `附件（1）`
  - `高质量C++编程指南.pdf`
  - `action.community.removeAttachment.0`
- 重新打开系统文件选择器并补加 `Ai6.apk` 后，页面成功恢复为双附件状态：
  - `附件（2）`
  - `高质量C++编程指南.pdf`
  - `Ai6.apk`
  - `action.community.removeAttachment.0`
  - `action.community.removeAttachment.1`
- 删除第一项 `高质量C++编程指南.pdf` 后，页面仍停留在 `创建帖子`，没有发生跳页或表单重置。
- 删除后附件区已正确重排为：
  - `附件（1）`
  - 仅保留 `Ai6.apk`
  - `高质量C++编程指南.pdf` 不再出现
  - 仅保留 `action.community.removeAttachment.0`
  - `action.community.removeAttachment.1` 不再出现
- 说明当前“删除第一项附件后的计数回退、剩余项保留、删除按钮索引重排”链路真机正常。
- 证据底部仍可见 `Cannot connect to Metro` 调试提示条；该提示属于 React Native 开发环境与 Metro 连通性提示，不属于本轮社区业务附件链故障。

## 6. 代码变更结论
- 本轮不做代码修改。
- 原因：
  - 多附件状态下删除第一项附件链路当前真机正常；
  - 附件计数、剩余列表与删除按钮索引都未发现真实故障。

## 7. 后续建议
- 下一轮继续补测：
  - 多附件状态下真实发布成功链；
  - 多附件状态下联网异常发布失败链；
  - 多附件与分类、标签并存时的表单回流稳定性；
  - 创建帖子页在真实联网后端条件下的完整发布闭环。
