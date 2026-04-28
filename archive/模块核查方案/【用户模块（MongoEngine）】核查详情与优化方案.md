# 【用户模块（MongoEngine）】核查详情与优化方案

## 1. 基础信息
- 模块/功能名称：用户模块（Users, MongoEngine）
- 核查日期：2025-11-17
- 核心代码路径：
  - 模型：/backend/users/mongodb_models.py（User、VerificationCode、UserProfile、UserSettings）
  - 相关：/backend/users/views/*、/backend/users/services/*、/backend/users/auth.py、/backend/users/jwt_auth.py

## 2. 核查结果
### 2.1 功能实现
- 结论：部分实现（“Django用户 vs Mongo用户”双体系映射不统一，已影响多模块权限与数据归属）
- 已实现：
  - User文档模型字段较全：用户名/邮箱/手机/加密密码/第三方登录ID（微信/QQ）/统计字段/Realm相关字段等；
  - VerificationCode 基础验证码模型（用途/过期/使用状态）；
  - UserProfile 扩展资料，含 django_user_id 字段与索引；
  - UserSettings 用户设置（AI助手默认模型、通知、语言等）。
- 未实现/缺陷：
  1) 用户双体系映射不一致（高风险）：
     - 多数业务视图/服务使用 request.user（Django用户）直接与MongoEngine文档比较或过滤（如 notes/realm_category、notification、reminder 等），与本模块User（MongoEngine）不相容；
     - UserProfile 虽提供 django_user_id 字段，但未在各模块统一使用；导致“查不到数据/权限错配/运行期错误”。
  2) 密码与认证链路不清晰：
     - User.password 作为哈希存储，check_password 使用Django hasher，需确保写入时统一用同一哈希方案；
     - 与 /backend/users/auth.py、jwt_auth.py 的集成与“Django User <-> Mongo User”创建/同步流程未在此处约束与落地；
  3) 唯一性与索引：
     - username 唯一；email/phone 可空且稀疏，但未设唯一约束（email稀疏但非unique），易产生重复邮箱；第三方ID wechat_unionid 非稀疏/非唯一；
  4) 个人信息安全：
     - 头像URL/社交链接等无需问题；但未见对敏感字段（phone、email）的访问控制策略；
  5) Realm字段使用一致性：
     - realm_id/realm_api_key/app_id/realm_sync_enabled 等字段未见一致使用点，易漂移；

### 2.2 代码质量
- 问题清单：
  1) 双体系用户映射缺统一入口：
     - 各模块自行查找MongoUser或直接用Django用户对比；建议统一“映射函数/中间件/辅助查询器”。
  2) 唯一性与数据一致性：
     - email/phone未唯一；第三方ID未唯一；可能导致登录/绑定冲突；
  3) 账户状态与安全：
     - is_active/is_verified存在，但未见统一校验入口（登录、敏感操作应检查）；
  4) 验证码：
     - VerificationCode用途字段为自由字符串；建议枚举（login/register/reset_password/bind_phone/bind_email）；
     - 缺少错误尝试与节流策略记录（login_attempts）；
  5) 统计字段更新策略：
     - note_count/login_count 等无统一更新路径；

- 改进方向：
  - 建立“用户映射统一层”：
    - 提供 get_mongo_user(request.user) 工具，在认证完成后可将 mongo_user 注入 request（如 request.mongo_user）；
    - 在UserProfile维护 django_user_id <-> mongo_user.id 的双向一致性；
  - 强化唯一性与约束：
    - email/phone/unionid 等根据业务需要设置 unique + sparse；
  - 安全校验集中：
    - 在auth/jwt_auth登录后校验 is_active/is_verified；敏感接口统一检查；
  - 验证码与风控：
    - 将 purpose 改为枚举；增加错误尝试次数、冷却时间、IP/UA审计；
  - 统计字段：
    - 通过信号/服务集中维护（如登录成功+1、创建笔记时+1等）。

### 2.3 可维护性
- 问题：用户映射分散、约束不统一、统计无来源、Realm支撑缺整合；
- 建议：抽象UserService（映射/校验/统计/第三方绑定），减少各模块直接操作User文档；补充单元测试覆盖认证、映射、唯一性冲突、验证码有效性等。

### 2.4 集成情况（直接关联模块）
- 与notes/reminder/notification/search等：均依赖正确的MongoUser归属；
- 与AI助手：UserSettings.ai_assistant_model 默认值在AI调用中应被读取并作为默认模型来源；
- 与同步/Realm：realm_*字段应由统一的Realm集成层读写。

## 3. 具体优化建议（可落地）
1) 统一映射与注入：
   - 在中间件/认证完成后注入 request.mongo_user；提供 get_mongo_user(django_user) 与 get_mongo_user_by_id(django_user_id)；
2) 唯一性与索引：
   - email/phone/unionid 视业务添加 unique+sparse 索引；
3) 安全：
   - 在认证/敏感接口检查 is_active/is_verified；
4) 验证码风控：
   - purpose 枚举；记录尝试次数、冷却时间；
5) 统计：
   - 通过信号/服务统一维护统计计数；

## 4. 建议的改动点清单（代码级）
- users/mongodb_models.py：
  - 视业务新增唯一索引（email/phone/unionid）；purpose枚举；
- users/auth.py、jwt_auth.py、middleware.py：
  - 注入 request.mongo_user；登录后同步/创建UserProfile映射；
- 各业务模块视图/服务：
  - 改为使用 request.mongo_user 进行过滤与写入；

## 5. 预期影响与回滚
- 影响：权限与归属一致，跨模块数据访问稳定；
- 回滚：改动可按“提供映射工具→迁移各模块使用→增强唯一/风控→统计与Realm整合”分步推进，逐步回滚。
