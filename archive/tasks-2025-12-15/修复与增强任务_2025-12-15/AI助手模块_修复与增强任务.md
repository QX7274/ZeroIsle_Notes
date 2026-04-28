# AI助手模块 — 修复与增强任务（P0）

依据：
- 功能完整性分析报告/AI助手模块
- 模块功能核查与优化记录下 AI 相关条目
- 代码核查：backend/ai_assistant/services/*, ai_assistant/tools.py, ai_assistant/models/*

关键问题与修复方向：
1) 会话链路与OpenAI返回结构不一致（致命）
- 现状：ConversationService 期待 provider.chat_completion 返回包含 top-level `usage`、`tool_calls`、`content` 字段；
  - openai_service.chat_completion 在有工具调用时直接返回 `response.model_dump()`（OpenAI v1原始结构），顶层并无 `tool_calls`；
  - ConversationService 使用 `response.get('tool_calls')` 将拿不到值，导致工具执行分支不触发。
- 修复：
  - 统一 provider 返回结构：
    - 无流式：返回 { content, usage, tool_calls? }；从 v1 响应提取 choices[0].message.tool_calls 并展平。
  - ConversationService 保留现有访问方式。

2) 缺少 json 导入导致工具调用解析失败（致命）
- 位置：backend/ai_assistant/services/conversation_service.py 使用 `json.loads`，顶部未 `import json`。
- 修复：补充 `import json`；并加 try/except 记录工具调用参数解析错误。

3) WhisperService 混用旧SDK接口（高）
- 现状：transcribe 使用 get_openai_client()（正确），但 translate/detect_language 使用 `openai.Audio.translate/transcribe`（未导入且旧式）。
- 修复：改为 v1 客户端：
  - translate: client.audio.transcriptions.create(model="whisper-1", file=..., language=src, translate=true/target_language?) — 或统一只提供 transcribe 并注明翻译由对话模型完成。
  - detect_language: 不直接调用旧接口，提供基于 transcribe 的语言字段或用第三方识别；最少保证不抛错。

4) Token 计数与模型兼容性（中）
- 确认 TokenCounter 对 gpt-4o/gpt-4.1 等新模型兼容性，必要时降级或使用估算策略。

5) 工具注册与错误隔离（中）
- ConversationService 工具执行异常时仅追加错误字符串；建议：
  - 工具执行超时与异常分类记录到 UsageRecord 扩展字段；
  - 工具结果过长时裁剪。

主要代码改动点：
- backend/ai_assistant/services/openai_service.py
  - 在工具调用场景下，返回：
    ```python
    tool_calls = response.choices[0].message.tool_calls or []
    usage = {'prompt_tokens': response.usage.prompt_tokens, 'completion_tokens': response.usage.completion_tokens}
    return { 'content': response.choices[0].message.content, 'tool_calls': [tc.model_dump() for tc in tool_calls], 'usage': usage }
    ```
- backend/ai_assistant/services/conversation_service.py
  - 顶部增加 `import json`；
  - 严格处理 `response.get('tool_calls')` 为 list；
  - 执行工具后再次请求时，仍通过 provider.chat_completion 获取 {content, usage}。
- backend/ai_assistant/services/whisper_service.py
  - translate/detect_language 改用 v1 客户端或暂时返回 NotImplemented 明确错误码。

API/数据结构：
- 不改动对外API，只规范内部 provider 返回。

验收标准：
- 用工具调用的对话能正确执行：tools→tool result→二次回复；
- 无工具对话能返回 content 与 usage；
- Whisper 转写成功路径可用，translate/detect_language 不抛异常；
- 单测新增：
  - provider返回结构单测（工具/非工具）；
  - conversation_service 工具分支集成测试（mock tool_registry）。

风险与回滚：
- 如新版返回结构影响其他 provider，先为 openai_service 单独适配；保留旧逻辑 behind flag。

工期与优先级：
- 工期：0.5–1 天；优先级：P0。

依赖：
- 无外部依赖；需确保 OPENAI_API_KEY 配置。


## 2025-12-15 批次任务清单（P0/P1/P2）

— P0（立即）—

任务A1：【对话链路】OpenAI v1 返回结构与工具调用一致性修复（P0）
- 描述：统一 provider 返回结构为 {content, usage, tool_calls?}；ConversationService 工具调用分支稳定处理，补 import json，异常隔离与记录。
- 工期：10h；依赖：无
- 输入/输出：
  - 输入：messages, model, tools, response_format
  - 输出：标准化响应；工具执行与二次回复
- 相关文件：
  - d:\ZeroIsle_Notes\backend\ai_assistant\services\openai_service.py（28–90 行）
  - d:\ZeroIsle_Notes\backend\ai_assistant\services\conversation_service.py（1–260 行）
- 验收标准：
  - 无工具：返回 content/usage；有工具：返回 tool_calls 并触发工具执行
  - 错误分类日志（auth/rate_limit/timeout/network/other）
- 测试计划：
  - 单测：无工具/有工具/错误分类 10 例；
  - 集成：对话→工具→二次回复
- 风险与回滚：如兼容问题，增加 feature flag 保留旧逻辑。
- 子任务：
  1) provider 统一结构实现（3h）修改 openai_service.py；校验：返回含 tool_calls
  2) ConversationService 补 import 与工具异常隔离（2h）conversation_service.py；校验：工具报错不影响流程
  3) UsageRecord 记录校对（2h）；校验：cost/token 正确
  4) 单测与日志（3h）；校验：pytest 通过

任务A2：【Whisper】v1 客户端统一与 translate/detect_language 修复（P0）
- 描述：AI 模块 whisper_service 使用 v1 客户端，translate 通过 transcriptions + translate；detect_language 容错。
- 工期：8h
- 相关：
  - d:\ZeroIsle_Notes\backend\ai_assistant\services\whisper_service.py（1–120 行）
- 验收：转写成功；翻译英文可用；detect_language 不抛错
- 子任务：API 调整（3h）；错误分类（2h）；单测（3h）

任务A3：【前端 AI 工具调用】工具注册与结果裁剪（P0）
- 描述：前端工具调用结果过长时裁剪；错误分级提示
- 工期：6h；依赖：后端返回结构稳定
- 相关：src/services/ai/EnhancedAIService.js
- 验收：>10KB 结果自动折叠；错误 toast 文案统一
- 子任务：实现裁剪（2h）；错误处理（2h）；单测（2h）

— P1（本周）—

任务A4：【多提供商路由】Baidu/讯飞 模型前缀路由与兜底（P1）
- 描述：根据模型前缀路由至 provider；无匹配时报错建议
- 工期：8h
- 相关：conversation_service.py _get_provider
- 验收：gpt-/ernie-/spark- 分流正确
- 子任务：前缀配置（2h）；单测（3h）；文档（3h）

任务A5：【Token 计数兼容】新模型估算策略（P1）
- 描述：对 4o/4.1 等模型使用估算或回退策略
- 工期：8h
- 相关：token_counter.py
- 验收：误差 < 10%
- 子任务：估算实现（4h）；测试（4h）

任务A6：【会话管理】上下文裁剪与阈值策略（P1）
- 描述：按 token_limit 裁剪对话历史滚动窗口；
- 工期：10h；相关：conversation_service._get_conversation_messages

— P2（下周）—

任务A7：【提示词与工具治理】统一注册与权限（P2）
- 描述：tools registry 权限与白名单；
- 工期：12h

任务A8：【成本与用量报表】（P2）
- 描述：UsageRecord 聚合报表接口与前端卡片
- 工期：12h；依赖：分析与报表模块

任务A9：【文档】AI 模块开发说明更新（P0）
- 描述：接口、错误分类、工具调用示例；
- 工期：6h；输出：docs/ai-*

### （细化）P0 子任务清单
- 任务A1【对话链路】子任务：
  1) provider 返回结构统一：backend/ai_assistant/services/openai_service.py；对无/有工具路径分别断言（3h）
  2) ConversationService 工具异常隔离与 json 导入：backend/ai_assistant/services/conversation_service.py；模拟工具抛错（2h）
  3) UsageRecord 计费校对：模型配置缺失与异常分支（2h）
  4) 单测与日志分类：auth/rate_limit/timeout/network/other（3h）
- 任务A2【Whisper v1】子任务：
  1) translate 基于 transcriptions.create(translate=true) 调整；detect_language 容错返回 unknown（3h）
  2) 错误分类与日志：classify_openai_error 集成（2h）
  3) 单测：正常/网络失败/授权失败（3h）
- 任务A3【前端 AI 工具】子任务：
  1) 结果裁剪器（>10KB 折叠）与展开按钮：src/services/ai/EnhancedAIService.js（2h）
  2) 错误分级提示（toast + fallback 文案）：同文件（2h）
  3) 单测与示例（mock）（2h）

### （细化）P1 子任务清单
- 任务A4【多提供商路由】子任务：
  1) 路由前缀配置化与缺省提示（3h）
  2) 单测覆盖 ernie-/spark-/未知模型（3h）
  3) 文档更新（2h）
- 任务A5【Token 估算】子任务：
  1) 新模型估算因子与回退策略（4h）
  2) 单测：误差统计（4h）
- 任务A6【上下文裁剪】子任务：
  1) token_limit 读取与滚动窗口策略实现（4h）
  2) 单测：长对话裁剪正确（4h）

### （细化）P2 子任务清单
- 任务A7【工具治理】子任务：
  1) tools registry 权限白名单（4h）
  2) 动态开关与审计（4h）
- 任务A8【用量报表】子任务：
  1) 后端聚合接口（6h）
  2) 前端卡片接入（6h）
- 任务A9【文档更新】子任务：
  1) 接口说明与错误分类（3h）
  2) 工具调用示例与故障处理（3h）

### （补充）接口与错误码规范（P0）
- Chat Completion（统一返回）
  - POST /ai/chat
  - 请求：{ model:string, messages:[{role,content}], tools?:[], response_format?:{}, temperature?:number, max_tokens?:number }
  - 响应（无流式）：{ content?:string, usage:{prompt_tokens:int, completion_tokens:int}, tool_calls?:[{id,function:{name,arguments}}] }
  - 错误码：
    - 401 AUTH：未配置/密钥无效（OPENAI_API_KEY 缺失/无效）
    - 429 RATE_LIMIT：请求速率超限
    - 408 TIMEOUT：上游超时
    - 5xx OTHER：网络/未知
- Whisper 转写
  - POST /ai/whisper/transcribe { file, language? }
  - 响应：{ text, segments?:[], language, duration, mode:'online'|'offline' }
  - 错误码：ASR_AUTH/ASR_NETWORK/ASR_DEP_MISSING/ASR_OTHER
- 测试用例清单（节选）
  1) 无工具：提问→content/usage 返回；
  2) 有工具：返回 tool_calls→执行工具→二次回复；
  3) 429/401/timeout 分支日志分类；
  4) Whisper 在线→离线回退；多语言；
