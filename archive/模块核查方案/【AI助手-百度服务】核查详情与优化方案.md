# 【AI助手-百度服务】核查详情与优化方案

## 1. 基础信息
- 模块/功能名称：AI 助手 - 百度文心服务（BaiduService）
- 核查日期：2025-11-18
- 核心代码路径：/backend/ai_assistant/services/baidu_service.py

## 2. 核查结果
### 2.1 功能实现
- 结论：部分实现（存在“模型导入错误 + 网络健壮性不足 + 计费记录接口错误”的关键问题）
- 已实现：
  - 访问令牌获取：_get_access_token 使用API Key/Secret换取access_token并做简单缓存（29天过期）
  - chat_completion(messages, model, temperature, max_tokens)：选择对应端点（ernie-bot/ernie-bot-4/ernie-bot-turbo），POST请求返回结果；
  - 基础错误码检查（error_code / error_msg）。
- 未实现/缺陷：
  1) 模型来源错误（高风险）：
     - from ai_assistant.models import UsageRecord 实际项目采用MongoEngine（ai_assistant/mongodb_models.py）；导入错误，后续 UsageRecord.create_record 会报错。
  2) 不存在的记录接口：
     - 调用 UsageRecord.create_record(...)，MongoEngine版无该classmethod；需改为实例化保存或新增类方法。
  3) 网络健壮性不足：
     - requests.post 无超时/重试；未处理429/5xx退避；
     - 未分类处理Timeout/ConnectionError等异常，诊断困难。
  4) 消息与模型适配：
     - 直接把messages传给百度接口，未做系统/用户/助手角色映射确认；
     - 模型端点映射以字典硬编码，缺少配置化且未覆盖新模型（如ERNIE-Speed/ERNIE-Lite等）。
  5) 用量和计费：
     - 以字符数/4估算tokens，存在较大偏差；成本计算缺失；
  6) 安全与日志：
     - 日志缺少request_id/耗时；无脱敏处理；
  7) 返回结构未标准化：
     - 返回provider原始结构，ConversationService需适配多套字段；建议输出统一结构（content、usage、finish_reason、raw）。

### 2.2 代码质量
- 问题清单：
  1) 导入与接口错误：使用ai_assistant.models与不存在的create_record；
  2) 无超时与重试策略；
  3) 错误分类不足：HTTP错误/业务错误/网络错误未区分；
  4) 模型端点硬编码、缺配置；
  5) 令牌估算粗糙；
  6) 日志缺少request_id/耗时/脱敏；

- 改进方向：
  - 统一模型导入：from ai_assistant.mongodb_models import UsageRecord；并实现记录保存（含cost）；
  - 请求健壮性：timeout（10-30s）与指数退避（1s/2s/4s）对429/5xx；
  - 错误映射：分别处理HTTP层与业务层错误；
  - 标准化返回：content（文本）、usage（prompt_tokens、completion_tokens、total）、finish_reason、raw；
  - 模型配置：端点映射配置化（settings/ModelConfig），便于新增模型；
  - 用量与计费：引入更稳健估算或官方usage（若支持），结合ModelConfig计算成本；
  - 安全日志：脱敏、request_id与耗时记录。

### 2.3 可维护性
- 问题：多供应商并行适配需要统一接口；当前返回结构与计费分散在各服务中；
- 建议：抽象BaseLLMService统一请求/重试/返回与计费记录，BaiduService仅实现差异；单测覆盖token获取失败/过期重取/接口错误等。

### 2.4 集成情况（直接关联模块）
- 与ConversationService：应消费统一返回结构；
- 与UsageRecord/ModelConfig：需改为MongoEngine并实现成本计算；

## 3. 具体优化建议（可落地）
1) 修复导入与保存：
   - 改用ai_assistant.mongodb_models.UsageRecord；增加create_record类方法或在服务内直接实例化保存；
2) 请求层增强：
   - 增加timeout与重试（针对429/5xx）；
   - 捕获Timeout/ConnectionError并返回结构化错误；
3) 标准化返回：
   - {'content','usage':{'prompt_tokens','completion_tokens','total_tokens'},'finish_reason','raw'}；
4) 模型与端点配置：
   - 将模型→端点映射抽取为配置，便于扩展新模型；
5) 计费与日志：
   - 通过ModelConfig计算成本；日志脱敏、记录request_id与耗时；

## 4. 建议的改动点清单（代码级）
- services/baidu_service.py：
  - 修复导入；新增timeout/重试；标准化返回；端点配置；用量与计费；
- mongodb_models.py（UsageRecord/ModelConfig）：
  - 如需便捷，新增create_record类方法；
- ConversationService：
  - 消费统一返回结构，移除provider特异性解析逻辑。

## 5. 预期影响与回滚
- 影响：与多供应商统一接口，稳定性/可观测性提升，计费记录可用；
- 回滚：改动集中在服务层，风险可控，先测试后上线。
