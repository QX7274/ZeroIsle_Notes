# 社区与协作模块（Community/Groups）功能完整性分析报告导航

本目录存放“社区与协作模块”的逐功能完整性分析文档，覆盖：内容与互动（帖子/评论/点赞/收藏）、群组与权限（加入/角色/协作）、治理与审计（举报/审核/审计日志），并给出模块总结与实施任务清单。

## 文档结构
- 00_模块概览.md
- 01_内容与互动/
  - 帖子评论完整性分析.md
- 02_群组与权限/
  - 协作控制完整性分析.md
- 03_治理与审计/
  - 举报与审计完整性分析.md
- 模块总结与改进建议.md
- 实施任务清单与时间计划.md

## 参考路径
- 前端：`src/components/community/*`, `src/screens/community/*`, `src/components/groups/*`
- 后端：`backend/community/*`, `backend/groups/*`（`models|mongodb_models|serializers|services|views|urls|consumers`）
- 文档：`Info/知识库与社区功能总结.md`