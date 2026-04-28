# 分析与报表模块（Analytics/Dashboards）功能完整性分析报告导航

本目录存放“分析与报表模块”的逐功能完整性分析文档，覆盖：指标与可视化（报表）、性能与缓存（聚合优化），并给出模块总结与实施任务清单。

## 文档结构
- 00_模块概览.md
- 01_指标与可视化/
  - 报表完整性分析.md
- 02_性能与缓存/
  - 聚合优化完整性分析.md
- 模块总结与改进建议.md
- 实施任务清单与时间计划.md

## 参考路径
- 前端：`src/components/analytics/*`, `src/screens/analytics/*`, `src/components/charts/*`（如有），`src/services/analytics/*`
- 后端：`backend/personal_activity/*`（活动追踪）、`backend/common/*`（聚合工具、分页、缓存）、`backend/search/services/*`（聚合样例）
- 文档：`docs/personal-activity-tracking-technical-design.md`, `docs/personal-activity-tracking-implementation-plan.md`