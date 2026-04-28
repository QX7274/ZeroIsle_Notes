# 【笔记功能（Realm）】核查详情与优化方案

## 1. 基础信息
- 模块/功能名称：笔记（MongoDB Realm 版本）
- 核查日期：2025-11-18
- 核心代码所在路径：
  - backend/notes/views/realm_note.py（RealmNoteViewSet：列表/详情/创建/更新/删除/统计）
  - backend/notes/mongodb_models.py（Note/Category/Tag 文档模型，含 is_deleted/权限相关字段）
  - backend/notes/serializers.py（NoteSerializer/NoteListSerializer/NoteDetailSerializer）
  - knowledge_graph/tasks.py（build_graph_for_note_task 异步触发）

## 2. 功能实现结论
- 结论：基本可用（CRUD、筛选、分页、统计、与知识图谱的异步联动），但权限/分页一致性、查询性能、字段校验与安全、协作/分享能力等存在明显改进空间。

### 2.1 已实现能力（功能面）
- 可见范围：get_queryset 组合 Q(user=本人, 未删除) OR Q(公开, 未删除)，支持“本人 + 公开”视图。
- 列表 list：
  - 过滤：category、is_favorite、is_public、search（title/content icontains）、tag；
  - 排序：ordering（默认 -updated_at），支持倒序/正序；
  - 分页：page/page_size 手动切片，返回 count + results。
- 详情 retrieve：
  - 权限：仅本人或公开可见；
  - 观看统计：非本人查看时 view_count++；本人查看时 last_viewed_at 更新。
- 创建 create：
  - 处理 category/tag 关联校验；
  - 支持 is_favorite/is_public/is_encrypted/encryption_key；
  - realm_sync_status=pending；
  - 异步触发知识图谱构建任务。
- 更新 update：
  - 校验并更新分类/标签/核心字段；
  - realm_sync_status=pending；异步触发建图。
- 删除 destroy：
  - 软删（is_deleted=true, deleted_at）；
- 统计 statistics：
  - 总数、收藏数、公开数、删除数；
  - 分类、标签维度的计数列表。

### 2.2 功能缺陷/缺失（聚焦可用性）
1) 身份与用户映射
- 通过 username 映射 Django→Mongo 用户（MongoUser.objects(username=...)），多租户/改名场景易失配；建议使用跨库一致的 user_id（外键/映射表）。

2) 分页与总数
- list 使用切片后 count=queryset.count()，可用；但 retrieve 等非列表接口无“是否可见”的一致性帮助函数；
- page_size 未设上限保护。

3) 搜索与过滤
- search 基于 icontains，未用全文索引/拼音/简繁；
- 缺时间范围过滤（updated_at/created_at）、多标签 AND/OR、归档/优先级等常用条件。

4) 权限与协作
- 仅本人/公开；缺协作者/组织范围/分享链接/只读模式；
- IsOwnerOrReadOnly 与公开可写的策略未明确（当前接口按用户校验，公开并不允许他人修改，但建议在权限类中统一）。

5) 字段校验与安全
- content 未做长度上限、HTML 白名单与 XSS 清洗；
- encryption_key 明文透传/存储风险；
- is_public 切换缺“公开范围确认”（例如是否包含敏感内容提示）。

6) 数据一致性与性能
- statistics 存在 N+1（按分类/标签逐个 count）；
- list 过滤 tags 使用“tags=tag_id”但未说明索引，可能性能差；
- retrieve 中 view_count 与 last_viewed_at 更新为两次 save，且成员可见性判断后重复 save，可合并；
- UUID 转换逻辑在多个方法重复。

7) 软删一致性
- list 中基础 queryset 过滤 is_deleted=False；但其他关联（Category/Tag）未统一过滤其 is_deleted；
- 删除策略未说明“恢复/回收站/清空”。

8) 审计与风控
- 无操作审计（创建/更新/删除/公开），无限流/速率限制；

9) Realm 同步
- realm_sync_status 标记为 pending，但未在此模块看到同步执行/回滚/重试策略与冲突解决（可能在 sync 模块，仍建议在 note 侧定义状态机）。

## 3. 具体优化建议（可落地）
1) 身份映射与多租户（P0）
- 为 User 建立稳定的跨存储 ID（如 uuid），DjangoUser.profile.mongo_id ←→ MongoUser.id；
- get_mongo_user(request.user) 封装，所有视图调用统一函数。

2) 搜索/过滤/分页（P0）
- 增加过滤：时间范围、仅本人/仅公开、标签逻辑（AND/OR）、是否加密/收藏；
- 设置 page_size 最大值（例如 100）；
- 接入全文索引（Atlas Search/ES/Meilisearch）或 text index，支持权重与高亮；

3) 权限与协作（P0）
- 模型增加 collaborators（读/写权限）、organization/tenant 字段；
- 分享链接 token（只读），可设过期；
- 权限类汇总：IsOwnerOrCollaboratorOrPublicRead。

4) 校验与安全（P0）
- content 进行 HTML 清洗（bleach 白名单）与长度上限；
- encryption_key 不经由 API 直接下传，改为 KMS/服务端封装；
- 对 is_public 修改加入二次确认与审计；

5) 性能与一致性（P1）
- 统计接口使用聚合：
  - categories: $group by category
  - tags: $unwind tags + $group by tag
- 检索建立索引：user+is_deleted、updated_at、is_public、category、tags、is_favorite；
- 合并 retrieve 的视图计数更新为一次 save；
- 提取 UUID 解析与可见性校验为通用方法。

6) 软删与回收站（P1）
- 提供回收站接口：list_deleted、restore、purge；
- 软删的 Category/Tag 同步过滤；

7) 审计与风控（P1）
- 重要操作写入审计日志（前后差异、操作者、时间、IP/UA）；
- 接口限流：创建/更新/删除、公开切换；

8) Realm 同步（P2）
- 明确状态：pending/syncing/success/failed；
- 同步冲突：updated_at 对比、乐观锁版本号、合并策略；

## 4. 关键代码改造建议（片段级思路）
- 统一用户映射：
  - def get_mongo_user(django_user): return MongoUser.objects(id=django_user.profile.mongo_id).first()
- 统计聚合（标签）：
  - pipeline=[{'$match': {'user': uid, 'is_deleted': False}},{'$unwind': '$tags'},{'$group': {'_id': '$tags','count': {'$sum':1}}},{'$sort': {'count': -1}}]
- 权限类：
  - class IsOwnerOrCollaboratorOrPublicRead(...): has_object_permission: read for public or collaborator; write only owner/collaborator(write)
- 清洗：
  - content = bleach.clean(raw, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS)

—— 建议优先落地“用户映射统一→搜索/过滤/分页→权限与协作→校验与索引聚合”的 P0 项，随后完善软删回收站、审计风控与 Realm 同步状态机。
