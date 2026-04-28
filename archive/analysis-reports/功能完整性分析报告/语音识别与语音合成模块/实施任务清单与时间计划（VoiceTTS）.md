# 语音识别与语音合成模块 - 实施任务清单与时间计划（执行级）

## 0. 目标与里程碑
- 目标：修复 ASR 字段不一致、统一 Whisper SDK、新增 TTS UI 与参数面板、完善权限与错误处理。
- 里程碑：
  - A（第1周）：ASR 字段一致 + Whisper 新SDK + 权限拦截与错误码
  - B（第2周）：TTS UI 接入 + 设置面板 + 分段朗读

## 1) ASR 字段一致与 SDK 统一（前端+后端）
- 前端：`AIAssistantScreen.js` 将 `formData.append('audio', ...)` 改为 `file`；增加上传进度与失败重试。
- 后端：`whisper_service.py` 迁移至新SDK `client.audio.transcriptions.create(...)`；统一返回 `{text, language}`；`legacy_views.transcribe_audio` 兼容 `audio|file`。
- 验收：转写成功率≥99%，字段一致性100%。
- 工期：后端0.5–1人日；前端0.5人日。

## 2) 权限与错误处理（前端+后端）
- 前端：权限拦截器（录音/通知）、统一错误提示组件、重试与“前往设置”。
- 后端：错误码表（ASR_*），429/503 `Retry-After`。
- 工期：前端0.5–1人日；后端0.5人日。

## 3) TTS UI 与参数面板（前端）
- ChatMessage/笔记阅读加入“朗读/停止”；设置面板（语言/语速/音调/声音），持久化到 Realm。
- 修正 `ttsService`：去除将 `setDefaultVoice` 当作“音量”的用法；修复中文注释编码；加入分段朗读（句子切分）。
- 验收：设置生效；长文本流畅；错误提示清晰。
- 工期：1–2人日。

## 4) 可选：Android 离线 ASR（试点）
- ML Kit 语音或第三方离线包；
- 工期：调研1人日，试点2人日。

## 风险与回退
- Whisper 服务端超时：前端降级到本地 ASR 或提示重试；
- TTS 设备不支持某 voice：提供回退 voice 与提示。