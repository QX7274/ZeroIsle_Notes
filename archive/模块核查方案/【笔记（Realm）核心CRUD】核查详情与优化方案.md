# 【笔记（Realm）核心CRUD】核查详情与优化方案

## 1. 基础信息
- 模块/功能名称：笔记（Realm）核心CRUD
- 核查日期：2025-11-17
- 核心代码路径：
  - 后端：/backend/notes/
    - 模型：/backend/notes/mongodb_models/note.py
    - 视图：/backend/notes/views/realm_note.py
    - 序列化器：/backend/notes/serializers/note.py

## 2. 核查结果
### 2.1 功能实现
- 结论：部分实现（可用性取决于数据与序列化细节，存在多处潜在运行期不一致）
- 已实现：
  - 笔记列表、详情、创建、更新、删除（软删除 is_deleted=true）、统计接口；
  - 查询条件：分类/收藏/公开/标签/全文搜索；
  - 手动分页（page/page_size）；
  - 与MongoDB用户映射（Django用户username→MongoUser.username）；
  - 更新/创建后触发知识图谱构建任务（异步调用）。
- 未实现/缺陷：
  1) 创建/更新序列化器错误使用：
     - 视图create/update使用NoteSerializer而非NoteCreateUpdateSerializer；
     - NoteSerializer中category字段定义为source='category.id'，用于输出映射；作为输入时可能验证不通过或validated_data不含期望字段，导致后续逻辑异常。
  2) 字段派生与序列化不一致：
     - NoteList/Detail序列化器包含word_count、tags（List[CharField]）等读字段，但Note模型无word_count字段；tags为ReferenceField列表，序列化为字符串依赖Tag.__str__，否则将返回对象repr或报错；
  3) 用户映射脆弱：
     - 通过username映射Django用户→MongoUser，若用户名修改/重名将导致无法定位或错配；缺少基于稳定ID的绑定（如在User表维护映射字段）。
  4) 排序/分页安全性：
     - ordering参数未白名单控制，任意字段可触发异常；分页无上限保护；
  5) 权限与可见性：
     - get_queryset允许“公开笔记”被任何登录用户读取；细粒度权限（协作/分享可读写）未并入；
  6) 统计接口效率：
     - statistics多次count独立发起，未用聚合；在大数据量下开销较大；
  7) 任务调用鲁棒性：
     - build_graph_for_note_task.delay异常被捕获但未区分可重试/失败记录；无重试策略与审计。
  8) 删除仅软删除：
     - 无回收站恢复接口；也未设置自动清理策略；

### 2.2 代码质量
- 问题清单：
  1) 序列化器职责混乱：
     - NoteSerializer用于输出，视图误用于输入验证；应使用NoteCreateUpdateSerializer进行校验与映射（category/tags输入ID→对象）。
  2) 安全与健壮性：
     - ordering无白名单；分页无上限；
  3) 逻辑重复：
     - create/update对分类与标签的获取逻辑重复；建议抽取服务层或Serializer内部处理；
  4) 时间/审计：
     - last_viewed_at/view_count更新分支不一致（仅非本人查看才+1，且本人查看才更新last_viewed_at），可按产品策略明确；
  5) 用户映射：
     - 运行时每次请求都进行MongoUser查找；可缓存或在JWT中携带映射ID；

- 改进方向：
  - 使用NoteCreateUpdateSerializer接收输入，输出使用NoteDetail/ListSerializer；
  - 将category/tag解析放入序列化器或NoteService，减少视图重复；
  - ordering白名单（['updated_at','created_at','title','-updated_at','-created_at','-title']），page_size设上限（如<=100）；
  - 用户映射改为稳定键（如在Django用户模型扩展字段存放mongo_user_id），或建立专门映射表；
  - 统计接口改用Mongo聚合管道一次返回；
  - 对任务失败记录重试标记；
  - 提供回收站恢复接口，或清理策略；

### 2.3 可维护性
- 问题：创建/更新路径与序列化器职责不清，各处解析分类/标签重复；权限与协作/分享未整合；
- 建议：抽取NoteService处理增删改查与派生字段计算（如word_count）、权限聚合；统一错误码与异常。

### 2.4 集成情况（直接关联模块）
- 用户模块：依赖MongoUser存在并与Django用户用户名一致；
- 分类/标签模块：通过引用过滤与统计；
- 知识图谱：异步构建任务触发；
- 协作/分享：当前未纳入权限判断，需后续融合。

## 3. 具体优化建议（可直接落地）
1) 序列化器对齐：
   - create/update使用NoteCreateUpdateSerializer；Detail/List仅用于输出；
   - 在序列化器中完成category/tag对象解析与归属校验；
2) 安全与分页：
   - ordering白名单、page_size上限与默认值；
3) 用户映射：
   - 引入稳定ID映射；请求期直接以映射ID查询MongoUser；
4) 统计优化：
   - 使用aggregate聚合统计；
5) 权限整合：
   - 将协作/分享权限合并到get_queryset；
6) 字段派生：
   - word_count在服务层计算并作为只读字段返回；
7) 任务可靠性：
   - 失败记录重试次数与最后错误；必要时采用队列重试策略。

## 4. 建议的改动点清单（代码级）
- views/realm_note.py：
  - create/update使用NoteCreateUpdateSerializer；统一category/tag解析；
  - ordering白名单、分页上限；
  - get_queryset合并协作/分享权限（后续与相应模块联动）；
  - 统计接口改为聚合；
- serializers/note.py：
  - 确认List/Detail的tags序列化为名称或ID数组，避免直接返回对象；
  - 提供word_count的SerializerMethodField或在服务层注入；

## 5. 预期影响与回滚
- 影响：创建/更新稳定性提升，查询安全；权限一致性更好；统计性能改善；
- 回滚：改动集中在notes（realm）视图与序列化器，可按“序列化器对齐→安全分页→统计聚合→权限整合”分步上线，任一步可回滚。
