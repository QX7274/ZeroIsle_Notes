# 【AI 助手链路】优化实施记录

## 1. 优化状态
- **状态**: ✅ 已完成 (P0 阶段)
- **完成日期**: 2025-11-19
- **主要贡献者**: AI Assistant (Cascade)

## 2. 核心问题与解决方案 (P0 阶段)

### 2.1 调用稳定性与现代化
- **问题**: 服务（`TextProcessingService`, `OpenAIService`）混用旧版 SDK 和原生 `requests`，缺少超时、重试和统一的错误处理。
- **解决方案**:
  - **统一 SDK**: 全面采用新版 `openai` SDK (`client.chat.completions.create`)，废弃旧版调用和原生 `requests`。
  - **增强稳健性**: 为 OpenAI 客户端统一配置了连接超时 (10s)、读取超时 (120s) 和自动重试 (最多3次)。为其他服务（百度、讯飞）的原生请求也增加了超时配置。
  - **错误处理**: 增加了对 `openai.APIError` 和 `openai.APITimeoutError` 的专门捕获，向用户提供更明确的错误信息。

### 2.2 Provider 抽象与能力对齐
- **问题**: 各 AI 服务提供方的实现方式不一，`ConversationService` 中存在大量 `if/elif` 硬编码逻辑，难以扩展。
- **解决方案**:
  - **定义抽象基类**: 创建了 `BaseProvider` 抽象类，定义了 `chat_completion`, `get_available_models`, `count_tokens` 等标准接口。
  - **统一服务实现**: 重构了 `OpenAIService`, `BaiduService`, `XunfeiService`，使其全部继承 `BaseProvider` 并实现其接口。
  - **服务注册与动态路由**: 在 `ConversationService` 中，用服务注册表和动态路由 (`_get_provider`) 替代了硬编码的 `if/elif` 逻辑，实现了提供者的解耦。
  - **统一响应格式**: 标准化了所有 `chat_completion` 方法的返回格式，简化了 `ConversationService` 中的响应处理逻辑。

### 2.3 限流与配额
- **问题**: 缺少对 AI 服务调用的速率限制，存在成本失控和滥用风险。
- **解决方案**:
  - **自定义节流阀**: 创建了 `UserMinuteRateThrottle` (20/min) 和 `UserDayRateThrottle` (100/day) 两个自定义节流类。
  - **应用速率限制**: 在 Django `settings/base.py` 中配置了节流速率，并通过在 `ConversationViewSet` 中重写 `get_throttles` 方法，将速率限制精确应用到 `send_message` 动作上。

### 2.4 上下文与成本控制
- **问题**: 对话历史无限增长，可能超出模型 token 限制并导致费用失控。
- **解决方案**:
  - **实现上下文裁剪**: 在 `ConversationService` 的 `_get_conversation_messages` 方法中，增加了基于 `ModelConfig.token_limit` 的滚动窗口裁剪逻辑。在将历史消息发送给模型前，会从最旧的消息开始移除，直到总 token 数在预算内。

### 2.5 审计与可观测性
- **问题**: 用量记录逻辑分散在各个服务中，且不完整（如百度、讯飞未记录成本）。
- **解决方案**:
  - **集中化审计**: 将用量记录和成本计算逻辑从各 Provider 服务中移除，统一集中到 `ConversationService` 的 `send_message` 方法中。确保每次成功的 AI 调用后，都会计算成本并创建一条 `UsageRecord` 记录，覆盖所有提供商。

## 3. 关键改进总结

- **架构**: 成功将 AI 助手链路从紧耦合的实现重构为基于抽象基类的、可插拔的模块化架构，极大提升了系统的可维护性和可扩展性。
- **稳定性**: 通过统一 SDK、超时、重试和错误处理，显著增强了 AI 服务调用的可靠性。
- **成本控制**: 实现了 API 速率限制和自动上下文裁剪，为成本控制和防止滥用提供了有力保障。
- **可观测性**: 集中化的审计日志确保了对所有 AI 服务调用的全面追踪，为后续的用量分析和成本监控奠定了基础。

## 4. 文件变更
- **新增**:
  - `backend/ai_assistant/services/base_provider.py`: 定义了 AI 服务提供者的抽象基类。
  - `backend/ai_assistant/throttling.py`: 定义了用户请求速率限制的节流类。
- **修改**:
  - `backend/ai_assistant/services/openai_service.py`: 全面重构，使用新版 SDK，实现 `BaseProvider` 接口。
  - `backend/ai_assistant/services/baidu_service.py`: 重构以实现 `BaseProvider` 接口，并增加超时。
  - `backend/ai_assistant/services/xunfei_service.py`: 重构以实现 `BaseProvider` 接口，并增加超时。
  - `backend/ai_assistant/services/text_processing_service.py`: 使用新版 OpenAI SDK 并增加超时和错误处理。
  - `backend/ai_assistant/services/conversation_service.py`: 重构为使用服务注册表和动态路由，并集中处理上下文裁剪和用量审计。
  - `backend/ai_assistant/views/conversation.py`: 应用了自定义的速率限制节流阀。
  - `backend/backend/settings/base.py`: 在 `REST_FRAMEWORK` 配置中增加了节流类和速率定义。



## 5. 增强功能：工具调用与JSON结构化输出 (2025-11-19)

### 5.1 功能概述
- **目标**: 为AI助手赋予调用外部工具（函数）和生成结构化JSON输出的能力。
- **核心流程**:
  1. 客户端在请求中定义可用工具的 schema。
  2. `ConversationService` 将工具定义传递给 AI 提供方。
  3. 模型决定调用哪个工具，并在响应中返回 `tool_calls`。
  4. `ConversationService` 捕获 `tool_calls`，查找并执行对应的本地函数。
  5. 将工具执行结果作为新的 `tool` 角色消息发回给模型。
  6. 模型基于工具结果生成最终的自然语言回复。

### 5.2 关键实现
- **扩展 `BaseProvider`**: `chat_completion` 接口增加了 `tools` 和 `response_format` 两个可选参数，为所有提供者建立了统一的能力入口。
- **更新 `OpenAIService`**: `chat_completion` 方法现在可以正确处理 `tools` 和 `response_format` 参数，并能解析包含 `tool_calls` 的响应。
- **增强 `Message` 模型**:
  - 增加了 `'tool'` 角色。
  - `content` 字段变为可选，以适应无文本内容的工具调用消息。
  - 新增 `tool_calls` (ListField) 和 `tool_call_id` (StringField) 字段，用于存储和关联工具调用信息。
- **实现工具调用循环**: `ConversationService` 的 `send_message` 方法被重构，以支持完整的工具调用流程，包括工具执行和结果回传。
- **创建工具注册表**: 在 `backend/ai_assistant/tools.py` 中建立了一个简单的工具注册表 (`tool_registry`)，用于映射工具名称、schema 和实现函数，实现了工具的模块化管理。

### 5.3 文件变更
- **新增**:
  - `backend/ai_assistant/tools.py`: 定义了工具的 schema、实现函数和注册表。
- **修改**:
  - `backend/ai_assistant/services/base_provider.py`: 扩展了 `chat_completion` 接口。
  - `backend/ai_assistant/services/openai_service.py`: 实现了对 `tools` 和 `response_format` 的支持。
  - `backend/ai_assistant/mongodb_models.py`: 增强了 `Message` 模型以支持工具调用。
  - `backend/ai_assistant/services/conversation_service.py`: 实现了完整的工具调用编排逻辑。
  - `backend/ai_assistant/views/conversation.py`: 允许客户端通过 API 传递 `tools` 和 `response_format` 参数。