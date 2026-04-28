# 通知模块（Notification）功能完整性分析报告导航

本目录存放“通知模块”的逐功能完整性分析文档，覆盖：推送与偏好（本地/远端、渠道与订阅）、既读与清理（一致性/归档），并给出模块总结与实施任务清单。

## 文档结构
- 00_模块概览.md
- 01_推送与偏好/
  - 通知完整性分析.md
- 02_既读与清理/
  - 一致性完整性分析.md
- 模块总结与改进建议.md
- 实施任务清单与时间计划.md

## 参考路径
- 前端：`src/services/notification/*`, `src/native/NotificationChannelModule.js`, `src/screens/*`（各模块触达入口）
- 后端：`backend/notification/*`（mongodb_models/serializers/services/views/urls/signals）
- 文档：`backend/ENHANCED_FEATURES_SUMMARY.md`