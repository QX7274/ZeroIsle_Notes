# NoteEditor 版本功能接入 — 前端实施计划（JS）

目标
- 在 NoteEditorScreen 集成“历史版本浏览/对比/回滚/自动保存”全链路，使用现有后端接口。
- 以 JS 实现，尽量少依赖新三方库，优先复用项目现有样式与组件规范。

范围
- 仅笔记文本版本（title/content）；画布快照另立任务。
- UI：历史版本抽屉、对比视图、恢复确认与脏检查、loading/空态/错误提示。

后端接口摘要（已就绪）
- GET  /notes/versions?note_id=NOTE_UUID（分页）
- GET  /notes/versions/compare?from_id=VID&to_id=VID → { title_diff[], content_diff[] }
- POST /notes/versions/{version_id}/restore/
- GET  /notes/versions/auto_save?note_id=NOTE_UUID
- POST /notes/versions/create_auto_save { note, title, content }

目录与文件（建议）
- src/services/notes/versionApi.js
- src/screens/note/components/VersionHistoryDrawer.js
- src/screens/note/components/DiffView.js
- src/screens/note/NoteEditorScreen.js（集成入口、按钮、脏检查、回滚）

一、服务层（versionApi.js）
- export async function getVersions(noteId, {page=1, pageSize=20}={})
- export async function compareVersions(fromId, toId)
- export async function restoreVersion(versionId)
- export async function getLatestAutoSave(noteId)
- export async function createAutoSave({note, title, content})
- 要求：统一错误对象 { code, message }；支持 AbortController；分页返回 {items,total,page,pageSize}。
二、UI 交互与布局（优雅简洁）
- NoteEditorScreen 顶部工具栏：
  - 按钮“历史版本”（右侧抽屉）
  - 自动保存提示（最近一次自动保存时间）
- VersionHistoryDrawer（右侧 360–420px 宽）：
  - Header：标题、刷新按钮；
  - 列表：
    - 左：v{version_number} | {is_auto_save?标签}
    - 中：description（或占位）
    - 右：created_at（相对时间）与操作（选择对比/恢复）
  - 底部：分页器（上一页/下一页）
- DiffView：
  - Tabs：Title / Content
  - 每行统一 diff 渲染（+ 新增绿色、- 删除红色、上下文灰）
  - 折叠长段；复制按钮
- 回滚确认弹窗：说明将覆盖当前内容并生成新版本。

三、状态管理与数据流
- 局部状态（useState + useEffect）：
  - versions, loading, error, page, pageSize
  - selectedForCompare（最多 2 个版本ID）
  - diffData：{ title_diff:[], content_diff:[] }
- 脏检查：
  - NoteEditorScreen 维护 isDirty（编辑器内容 vs 上次保存内容）
  - 在 compare / restore 前执行守护：
    - 若 isDirty → 弹窗：放弃/先保存/取消
