# 【AI助手-讯飞服务】核查详情与优化方案

## 1. 基础信息
- 模块/功能名称：AI 助手 - 讯飞星火服务（XunfeiService）
- 核查日期：2025-11-18
- 核心代码路径：/backend/ai_assistant/services/xunfei_service.py

## 2. 核查结果
### 2.1 功能实现
- 结论：部分实现（存在“模型导入错误 + 网络健壮性不足 + 计费记录接口错误”的关键问题）
- 已实现：
  - chat_completion(messages, model, temperature, max_tokens)：构造签名、Authorization头，POST调用讯飞星火chat接口，基础错误码检查；
  - 消息格式适配：将system消息降级为user；
  - 简易用量估算（以字符数/4估算tokens）。
- 未实现/缺陷：
  1) 模型来源错误（高风险）：
     - from ai_assistant.models import UsageRecord 实际项目采用MongoEngine（ai_assistant/mongodb_models.py）；导入错误，后续 UsageRecord.create_record 会报错。
  2) 不存在的记录接口：
     - 调用 UsageRecord.create_record(...)，MongoEngine版无该classmethod；需改为实例化保存或新增类方法。
  3) 网络健壮性不足：
     - requests.post 无超时/重试；未处理429/5xx退避；
     - 未捕获连接异常细分（Timeout/ConnectionError），统一抛 ValueError，诊断困难。
  4) 模型与域映射简化：
     - 将 spark-* 简单替换为 general 域（"domain": model.replace("spark-", "general")），未核对官方模型与domain映射规范，可能导致调用与计费不匹配。
  5) 消息角色处理：
     - 统一将system映射为user，可能影响提示词权重；需根据星火API支持的角色进行更精细映射。
  6) 计费与用量：
     - 使用字符数/4估算tokens，偏差可能较大；成本计算缺失；
  7) 安全与配置：
     - 仅依赖settings读取APP_ID/API_KEY/API_SECRET；缺少多Key/区域路由与健康检查；
     - 请求与日志未脱敏（Authorization/签名可能泄露）。
  8) 返回结构未标准化：
     - 直接返回provider原始结构，ConversationService需适配多套字段；建议输出统一结构（content、usage、finish_reason、raw）。

### 2.2 代码质量
- 问题清单：
  1) 导入与接口错误：使用ai_assistant.models与不存在的create_record；
  2) 无超时与重试策略；
  3) 错误分类不足：未区分HTTP错误、业务错误（code!=0）、网络错误；
  4) 角色与模型映射未经严格校验；
  5) 令牌估算粗糙；
  6) 日志缺少request_id/耗时/脱敏；

- 改进方向：
  - 统一模型导入：from ai_assistant.mongodb_models import UsageRecord，并实现记录保存（含cost）；
  - 请求健壮性：设置timeout（10-30s），对429/5xx指数退避（1s/2s/4s）与最大重试次数；
  - 错误映射：
    - HTTP层（status_code）、业务层（result.code/message）与网络层分别记录与抛出；
  - 标准化返回：content（文本）、usage（prompt_tokens、completion_tokens、total）、finish_reason、raw；
  - 角色/域映射：引入明确的model→domain映射表，禁止简单字符串替换；
  - 用量与计费：引入TokenCounter或基于句子长度的更稳健估算，结合ModelConfig计费；
  - 安全日志：脱敏Authorization/签名、记录request_id与耗时。

### 2.3 可维护性
- 问题：多供应商并行适配需要统一接口；当前返回结构不统一、计费散落；
- 建议：抽象BaseLLMService（请求/重试/标准化返回/计费记录），XunfeiService仅实现provider差异；增加单测覆盖签名生成、错误码与重试。

### 2.4 集成情况（直接关联模块）
- 与ConversationService：应消费统一结构；
- 与UsageRecord/ModelConfig：需改为MongoEngine模型并实现成本计算；

## 3. 具体优化建议（可落地）
1) 修复导入与保存：
   - 改用ai_assistant.mongodb_models.UsageRecord；增加create_record类方法或在服务内直接实例化保存；
2) 请求层增强：
   - 增加timeout与重试（针对429/5xx）；
   - 捕获Timeout/ConnectionError并返回结构化错误；
3) 标准化返回：
   - {'content','usage':{'prompt_tokens','completion_tokens','total_tokens'},'finish_reason','raw'}；
4) 模型/域映射配置：
   - 建立字典：{'spark-3.5':'generalv3.5', ...}（示例，需依据官方文档确认）；
5) 计费与日志：
   - 通过ModelConfig计算成本；日志脱敏、记录request_id与耗时；

## 4. 建议的改动点清单（代码级）
- services/xunfei_service.py：
  - 修复导入；新增timeout/重试；标准化返回；映射配置；用量与计费；
- mongodb_models.py（UsageRecord/ModelConfig）：
  - 如需便捷，新增create_record类方法；
- ConversationService：
  - 消费统一返回结构，移除provider特异性解析逻辑。

## 5. 预期影响与回滚
- 影响：与多供应商统一接口，稳定性/可观测性提升，计费记录可用；
- 回滚：改动集中在服务层，发布风险可控，先测试后上线。
