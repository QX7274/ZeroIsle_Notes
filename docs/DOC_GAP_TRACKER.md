# 生产上线整改 GAP 台账

> 唯一台账入口：所有整改项、功能审查项、真机验证项都必须先登记到本台账，再进入实施、验证、提交与推送流程。  
> 总控入口：[生产上线整改总控](D:/ZeroIsle_Notes/docs/生产上线整改总控.md)  
> 历史映射：[ARCHIVE_TO_GAP_MAPPING](D:/ZeroIsle_Notes/docs/ARCHIVE_TO_GAP_MAPPING.md)

## 1. 状态定义
- `TODO`：已登记，尚未开始实施。
- `IN_PROGRESS`：正在实施或验证中。
- `BLOCKED`：存在外部阻塞，暂不能完成。
- `DONE`：代码、文档、验证、Git 记录均已闭环。
- `DEFERRED`：本轮不执行，但必须保留跟踪。

## 2. 字段要求
- `GAP ID`：唯一编号，不得复用。
- `优先级`：`P0`、`P1`、`P2`。
- `责任智能体`：总控、后端/安全、部署/CI、移动端/Android、验证，或对应子智能体名称。
- `验收标准`：必须可执行、可验证、可复核。
- `关联提交`：记录提交哈希；未提交时写 `待提交`。
- `验证证据`：记录命令、截图、日志、测试报告或文档位置。
- `备注`：记录风险、阻塞、删除范围、局域网信息、未完成规划约束等。

## 3. 当前 GAP 清单

| GAP ID | 批次 | 优先级 | 状态 | 责任智能体 | 问题/目标 | 验收标准 | 关联提交 | 验证证据 | 备注 |
|---|---|---|---|---|---|---|---|---|---|
| GAP-BASELINE-001 | 0 | P0 | DONE | 总控智能体 | 将当前工作区作为生产整改基线入库并推送 `main` | 基线提交存在、已推送、总控文档已记录基线范围与风险 | `a1931d5` | `git log --oneline --decorate -3`；总控文档第 5 节 | 仍需持续补充基线未验证风险 |
| GAP-BASELINE-002 | 0 | P0 | IN_PROGRESS | 总控智能体 | 建立唯一文档入口，停止以 `archive/*` 作为执行入口 | 总控文档、GAP 台账、历史映射三者一致，后续整改全部从总控入口分派 | `1d96221` | 本台账；总控文档；历史映射文档 | 本轮已恢复台账并完成批次结构对齐，后续继续随整改推进维护 |
| GAP-SEC-001 | 1 | P0 | IN_PROGRESS | 后端/安全智能体 | 清理仓库中的真实凭据、连接串与危险默认值 | 仓库中不再存在真实凭据；生产与测试不内置真实远程连接；危险默认值移除或显式失败 | `c7b162d` | 首轮代码差异；配置检查记录 | 已完成首轮整改，仍需继续扫尾与轮换说明 |
| GAP-SEC-002 | 1 | P0 | TODO | 后端/安全智能体 | 轮换历史泄露的 MongoDB/第三方密钥并补充环境契约 | 轮换动作有记录；示例配置不再包含真实值；生产缺失配置时明确失败 | `待提交` | 后续环境核查与配置验证 | 涉及外部平台操作，当前仓库内只能先记录待办与约束 |
| GAP-SLIM-001 | 2 | P1 | IN_PROGRESS | 瘦身与环境智能体 | 删除无用、过时、可再生文件，完成软件首轮瘦身 | 已形成删除清单；只删除安全对象；不影响规划功能与后续实施路径 | `1d96221, 待补本次提交` | `git status`；删除前后清单；`patches/detox+20.50.4.patch`、`patches/@shopify+react-native-skia+1.12.4.patch`；删除 `.tmp_skia_original.txt` 记录 | 已完成未跟踪缓存、`backend/tests/*.log`、`backend/manage_check*.log`、`.pytest_cache/` 首轮清理；本轮继续删除第三方补丁临时对照文件并将 patch 收敛为可重放最小集；dump、audit、E2E 证据文件保留到后续分批处理 |
| GAP-SLIM-002 | 2 | P1 | IN_PROGRESS | 瘦身与环境智能体 | 清理已跟踪缓存产物，如 `__pycache__`、`.pyc` 等仓库噪声 | 跟踪缓存文件被移除；`.gitignore` 足以防止再次入库；最小验证通过 | `1d96221` | `git ls-files 'admin_system/backend/**/__pycache__/*'` 结果为 `0`；`git status` 删除清单 | 已从 Git 移除 54 个已跟踪 `.pyc` / `__pycache__` 产物，并在 `.gitignore` 增加防回流规则 |
| GAP-ENV-001 | 2 | P0 | IN_PROGRESS | 瘦身与环境智能体 | 统一 Python 环境为 Conda `ZeroIsle` 并补齐定位方式 | 找到 `conda`/`conda.bat`；确认 `ZeroIsle` 环境存在或明确阻塞；文档写明启用命令 | `1d96221` | `where.exe conda`、`C:\\Users\\QX\\.conda\\environments.txt`、`conda run -n Zeroisle python --version` | 当前系统 PATH 未暴露 `conda`，但已定位 `D:\\APP\\Anaconda\\condabin\\conda.bat`，实际环境目录名为 `Zeroisle` |
| GAP-ENV-002 | 2 | P0 | IN_PROGRESS | 移动端/Android 智能体 | 统一前端安装与 Android 运行命令为 `yarn install` / `yarn android` | 仓库脚本、文档、执行记录统一使用 yarn；如存在偏差已记录原因 | `1d96221` | 根目录 `package.json`；`admin_system/frontend/package.json`；`where.exe yarn` | 根目录命令适用于 React Native 主应用，`admin_system/frontend` 需单独安装依赖，不受根目录覆盖 |
| GAP-ENV-003 | 2 | P1 | IN_PROGRESS | 移动端/Android 智能体 | 明确局域网联调方案，支撑未部署阶段的平板测试 | 文档记录热点/局域网/IP/ADB 方案；实际可用于后续真机验证 | `1d96221` | `where.exe adb`；`android/local.properties`；`adb devices -l` | 推荐优先 USB + `adb reverse tcp:8081 tcp:8081`，热点同局域网作为多设备补充方案；当前已识别真实平板 `TB128FU`，但尚未执行 Android 专用 MCP 真机验证 |
| GAP-DEPLOY-001 | 3 | P0 | IN_PROGRESS | 部署/CI 智能体 | 统一生产入口为 ASGI 主线，收敛 Docker / Compose / 健康检查 | `/health/` 与 `/ready/` 职责清晰；Docker `HEALTHCHECK` 使用 `/health/` | `c7b162d` | 首轮部署整改差异；最小验证日志 | 已完成首轮整改，仍需继续演练冷启动与依赖故障场景 |
| GAP-DEPLOY-002 | 3 | P0 | TODO | 部署/CI 智能体 | 明确迁移、静态资源、日志目录、持久化路径启动顺序 | 启动链路文档完整；容器冷启动可复现；职责边界清晰 | `待提交` | 启动命令、日志、文档记录 | 后续结合容器验证一起闭环 |
| GAP-CONFIG-001 | 3 | P0 | TODO | 后端/安全智能体 | 统一生产环境变量契约，不允许真实默认值兜底 | `DJANGO_SECRET_KEY`、`MONGO_URI`、Redis/Neo4j 等缺失时显式失败 | `待提交` | 配置检查与启动失败验证 | 与安全整改、测试环境收敛联动 |
| GAP-CI-001 | 4 | P0 | IN_PROGRESS | 部署/CI 智能体 | 让 `mypy`、前端 `lint`、构建检查全部 hard-fail | 不存在 `|| true`、空脚本或 `echo` 伪检查；关键检查失败时流水线失败 | `fba2e33, 22f0bed` | `package.json` 脚本差异；`jest --config e2e/jest.config.js --listTests`；`node node_modules/detox/local-cli/cli.js build -c android.att.debug` 成功日志；`adb -s HGR3Y9MA install -r ...app-debug.apk` 成功；`adb -s HGR3Y9MA install -r ...app-debug-androidTest.apk` 成功；`node node_modules/detox/local-cli/cli.js test -c android.att.debug --testNamePattern="Smoke"` 在 `HGR3Y9MA` 上 7/7 通过 | SDK/NDK 系统侧阻塞已修复；CI/构建链、真实平板安装链与 attached-device smoke 已打通，后续重点转为 Android 专用 MCP 可视化验证与更深层功能审查 |
| GAP-TEST-001 | 4 | P0 | IN_PROGRESS | 后端/安全智能体 | 测试环境不得强依赖真实外部 Mongo，需改成本地/容器/in-memory | `manage.py check --settings=backend.settings.testing` 不再强连 `127.0.0.1:27017`，并能稳定完成系统检查 | `ff72009` | `python manage.py check --settings=backend.settings.testing`；最小导入验证：`get_document_converter()`、`mongodb_realm_service` | 已完成第二轮修复：`mongodb_realm_service` 改为惰性初始化，同步客户端不再在构造期建立；后续继续清理其余重初始化噪声 |
| GAP-ROUTE-001 | 3/5 | P1 | IN_PROGRESS | 验证智能体 | 清理可选功能入口的启动期导入阻塞，确保功能审查前各路由可被正常挂载 | `mind_map`、`document_converter`、`personal_activity`、`code_editor` 等入口不因模块级初始化失败或历史导入别名缺失而被跳过 | `ff72009, 22f0bed, 1dd520c, 待补本次提交` | `manage.py check` 输出；`document_converter/tasks.py` 与 `notification/signals.py` 导入副作用修复差异；`python manage.py test code_editor.tests.test_urls code_editor.tests.test_persistence_contract --settings=backend.settings.testing` | 已在首轮 3 个入口基础上继续收敛 `document_converter` 与 `notification` 的模块级副作用；本轮继续补齐 `code_editor` 的 update/retrieve/rerun/by_tag/by_language 等最小 CRUD 与筛选回归用例，进一步确认 Mongo 用户映射、Mongo 文档序列化和执行服务重跑链不再残留 Django ORM 语义假设；后续再切入群组/协作专项审查 |
| GAP-NOTIFY-001 | 5 | P1 | IN_PROGRESS | 验证智能体 | 统一通知模块 Django/Mongo 用户映射口径，消除批量接口与权限判断断裂 | 批量已读、未读数、全部删除以及 `recipient/user` 对象权限判断统一走 Mongo 用户映射，不再把 Django 用户 ID 直接当 Mongo 用户 ID 使用 | `22f0bed` | `python manage.py test notification.tests.test_views --settings=backend.settings.testing`；`backend/notification/views.py`；`backend/notification/services.py`；`backend/common/permissions.py` | 本轮已修复批量接口、平铺路由与对象权限判断，但通知列表、单条读写与更多真实调用链仍需继续回归，当前只完成最小契约验证 |
| GAP-GROUP-001 | 5 | P0 | IN_PROGRESS | 验证智能体 | 收口群组主资源外部契约，确保 `/api/v1/groups/*` 与前端 `API_ENDPOINTS.GROUPS` 一致 | `/api/v1/groups/`、`/api/v1/groups/join-by-code/`、`/api/v1/groups/{id}/generate-join-code/`、`/api/v1/groups/invitations/`、`/api/v1/groups/shared-screens/` 均可按预期解析；共享屏幕创建缺参/缺群组/无权限时返回 DRF 异常语义而非假成功 | `ea3e6ab` | `python manage.py test groups.tests.test_urls groups.tests.test_view_contracts --settings=backend.settings.testing`；`python manage.py check --settings=backend.settings.testing`；`backend/groups/urls.py`；`backend/groups/views.py` | 本轮已完成首刀修复：去除 `/groups/groups/` 双层前缀，补齐短横线路径契约，并将 `SharedScreenViewSet.perform_create()` 改为异常流；下一步继续收口 Mongo 成员查询链 |
| GAP-GROUP-002 | 5 | P0 | IN_PROGRESS | 后端/安全智能体 | 修复群组/共享屏幕列表对 Mongo 成员关系的 ORM 风格误用，避免空列表或 500 | `GroupViewSet.get_queryset()` 与 `SharedScreenViewSet.get_queryset()` 不再依赖 `members__...` 反向关系；群组列表、共享屏幕列表和成员权限链具备最小回归验证 | `4fcfbf5` | `python manage.py test groups.tests.test_urls groups.tests.test_view_contracts groups.tests.test_mongo_contracts --settings=backend.settings.testing`；`python manage.py check --settings=backend.settings.testing`；`backend/groups/views.py`；`backend/groups/tests/test_mongo_contracts.py` | 本轮已将群组权限、创建、加入、邀请、离开、共享屏幕查询链统一到 `request.mongo_user / get_mongo_user_from_django()`，并将可见群组查询改为先查 `GroupMember` 再回查 `Group`；下一步继续补 `GroupDetailSerializer` 的加入码展示口径和更深层真实页面消费验证 |
| GAP-GROUP-003 | 5 | P1 | IN_PROGRESS | 验证智能体 | 收口群组详情展示口径与前端未接线路由，避免详情页操作链断裂 | `GroupDetailSerializer` 的加入码展示统一使用 Mongo 用户映射判断创建者/管理员；前端详情页不再暴露未注册的 `EditGroup` 导航；群组详情最小契约测试通过 | `3e0cfe2` | `python manage.py test groups.tests.test_urls groups.tests.test_view_contracts groups.tests.test_mongo_contracts groups.tests.test_serializer_contracts --settings=backend.settings.testing`；`python manage.py check --settings=backend.settings.testing`；`backend/groups/serializers.py`；`backend/groups/tests/test_serializer_contracts.py`；`src/components/groups/GroupDetail.js` | 本轮已修复详情序列化器仍使用 `request.user` 的 Mongo 口径漂移，并移除前端详情页未接线 `EditGroup` 菜单项；提交 `3e0cfe2` 已于 2026-05-12 11:48:09 +0800 推送到当前批次分支；下一步继续进入前端群组页面真实消费链审查与更细粒度 UI/体验优化 |
| GAP-GROUP-004 | 5 | P0 | IN_PROGRESS | 验证智能体 | 收口共享屏幕信令地址、用户身份口径与详情页无效管理动作，避免共享链假可用和普通成员误触 403 | WebRTC 信令地址不再误拼到 `/api/v1/ws/...`；共享页使用当前登录用户身份初始化信令；移动端不再创建假共享会话；详情页仅按后端能力字段显示“生成加入码/邀请成员”；群组最小回归与前端目标文件 lint 通过 | `f56f6b8` | `python manage.py test groups.tests.test_urls groups.tests.test_view_contracts groups.tests.test_mongo_contracts groups.tests.test_serializer_contracts --settings=backend.settings.testing`；`node node_modules/eslint/bin/eslint.js src/components/groups/GroupDetail.js src/components/groups/ScreenShare.js src/screens/groups/ScreenShareScreen.js src/services/webrtc/webrtcService.js`；`backend/groups/serializers.py`；`backend/groups/tests/test_serializer_contracts.py`；`src/components/groups/GroupDetail.js`；`src/components/groups/ScreenShare.js`；`src/screens/groups/ScreenShareScreen.js`；`src/services/webrtc/webrtcService.js` | 本轮已补后端 `can_invite` / `can_generate_join_code` 能力字段，修正 WebSocket 基址拼接、共享页错误使用 `currentGroup.creator.id` 作为当前用户身份的问题，并把移动端共享入口改为明确提示而非创建假活跃共享；当前邀请成员页仍停留在手填 `userId` 形态，共享观看端仅完成最小列表/加入入口收口，尚未完成检索式邀请体验与 Android 专用 MCP 真机可视化验证 |
| GAP-GROUP-005 | 5 | P1 | IN_PROGRESS | 移动端/Android 智能体 | 将邀请成员页从手填 `userId` 的调试态升级为搜索选择式流程，补齐群组域内候选搜索契约与最小体验收口 | 新增 `/api/v1/groups/{id}/invite-candidates/`；邀请页支持按用户名/昵称/邮箱搜索候选、展示不可邀请原因、成功后保留最近邀请反馈；后端/前端最小回归与目标文件 lint 通过 | `49c933b` | `python manage.py test groups.tests.test_urls groups.tests.test_mongo_contracts --settings=backend.settings.testing`；`node node_modules/eslint/bin/eslint.js src/screens/groups/InviteMembersScreen.js src/redux/slices/groupsSlice.js src/services/api/groupApi.js src/config/api.js`；`backend/groups/views.py`；`backend/groups/serializers.py`；`backend/groups/tests/test_urls.py`；`backend/groups/tests/test_mongo_contracts.py`；`src/screens/groups/InviteMembersScreen.js`；`src/redux/slices/groupsSlice.js`；`src/services/api/groupApi.js`；`src/config/api.js` | 现有 `backend/users` 管理员专用搜索接口不适合群组邀请场景，本轮改为在 `groups` 域内补最小候选搜索契约；Android 专用 MCP 真机可视化验证尚未开始，当前只能先完成无后端联调之外的契约与页面体验收口 |
| GAP-GROUP-006 | 5 | P1 | IN_PROGRESS | 移动端/Android 智能体 | 收口共享观看端页面状态与交互体验，补齐“共享中 / 观看中 / 空闲”三态与离开观看能力 | 共享页区分共享中、观看中、空闲三态；活跃共享列表支持刷新、加入、离开；直接进入页面时能主动拉取群组详情与共享列表；目标文件 lint 通过 | `fed56c8` | `node node_modules/eslint/bin/eslint.js src/components/groups/ScreenShare.js src/screens/groups/ScreenShareScreen.js src/services/webrtc/webrtcService.js src/redux/slices/groupsSlice.js`；`src/components/groups/ScreenShare.js`；`src/screens/groups/ScreenShareScreen.js`；`src/services/webrtc/webrtcService.js` | 当前仍未接入 Android 专用 MCP 真机可视化验证，WebRTC 深层联调证据也未补齐；本轮先收口前端状态机与页面体验，后续再继续补真实观看链证据 |
| GAP-GROUP-007 | 5 | P1 | IN_PROGRESS | 移动端/Android 智能体 | 修复共享观看链的房间切换与远端流承载前置问题，避免真实联调时出现复用旧连接、重复回调或观看态无画面 | WebRTC 服务在切换房间时不再复用旧连接；共享页回调可解绑；观看态提供真实远端视频承载区与等待提示；目标文件 lint 通过 | `f092c10` | `node node_modules/eslint/bin/eslint.js src/services/webrtc/webrtcService.js`；`node node_modules/eslint/bin/eslint.js src/components/groups/ScreenShare.js src/screens/groups/ScreenShareScreen.js`；`src/services/webrtc/webrtcService.js`；`src/components/groups/ScreenShare.js` | 仍缺 Android 专用 MCP 真机可视化验证与 WebRTC 端到端证据；本轮先补真实联调前置能力，减少后续进入真机验证时的重复返工 |
| GAP-GROUP-008 | 5 | P1 | IN_PROGRESS | 移动端/Android 智能体 | 收口共享观看态的自动回收与会话快照同步，避免共享结束、房主离开或列表刷新后页面仍停留在假观看态 | 观看端在房主离开、共享会话结束或共享列表刷新后目标会话消失时能够自动退出观看态；观看中的共享对象在刷新后会同步为最新快照；目标文件 lint 通过 | `待提交` | `node node_modules/eslint/bin/eslint.js src/components/groups/ScreenShare.js src/screens/groups/ScreenShareScreen.js`；`src/components/groups/ScreenShare.js` | 当前仍缺 Android 专用 MCP 真机可视化验证与 WebRTC 端到端证据；本轮先补观看态状态回收，减少真实联调时出现“流已断但页面仍显示观看中”的假状态返工 |
| GAP-MOBILE-001 | 4 | P1 | IN_PROGRESS | 移动端/Android 智能体 | 补齐关键页面稳定 `testID` 与 Detox smoke 基础 | 首页、底部导航、AI、提醒、知识图谱、我的页具备稳定 `testID`；smoke 可构建安装 | `fba2e33, 22f0bed` | `detoxrc.js`；`e2e/starter.test.js`；`android/app/build.gradle`；`android/settings.gradle`；`android/app/src/androidTest/java/com/zeroisle_notes/DetoxTest.java`；APK 产物 `android/app/build/outputs/apk/debug/app-debug.apk`、`android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk`；真实平板安装成功记录；`node node_modules/detox/local-cli/cli.js test -c android.att.debug --testNamePattern="Smoke"` 在 `HGR3Y9MA` 上 7/7 通过 | `testID`、Instrumentation、attached-device 配置已就绪，NDK 权限阻塞与第三方库 `minSdk` 阻塞已解除；本轮已进一步完成提醒创建页固定底部操作栏、知识图谱/知识分析页空态锚点与分析入口补强，attached-device smoke 已全量通过，后续进入 Android 专用 MCP 可视化验证 |
| GAP-REVIEW-001 | 5 | P0 | IN_PROGRESS | 验证智能体 | 使用工具进行功能审查，核查规划功能是否完成、是否足以上线 | 形成逐模块核查结论、缺口清单、体验与速度评估 | `fba2e33, 22f0bed, 1dd520c, f56f6b8` | smoke 静态审查结论；`jest --config e2e/jest.config.js --listTests`；`detox build -c android.att.debug` 成功日志；`adb devices -l`；`adb -s HGR3Y9MA install -r` 成功日志；`adb reverse tcp:8081 tcp:8081`；`node node_modules/detox/local-cli/cli.js test -c android.att.debug --testNamePattern="Smoke"` 在 `HGR3Y9MA` 上 7/7 通过；`python manage.py test notification.tests.test_views code_editor.tests.test_urls code_editor.tests.test_persistence_contract --settings=backend.settings.testing`；`python manage.py check --settings=backend.settings.testing`；`python manage.py test groups.tests.test_urls groups.tests.test_view_contracts groups.tests.test_mongo_contracts groups.tests.test_serializer_contracts --settings=backend.settings.testing`；`node node_modules/eslint/bin/eslint.js src/components/groups/GroupDetail.js src/components/groups/ScreenShare.js src/screens/groups/ScreenShareScreen.js src/services/webrtc/webrtcService.js` | 系统层 SDK/NDK 修复已完成，attached-device 基础页面可达性与无后端联调降级已通过；本轮继续确认 `code_editor` 的最小 CRUD、筛选和重跑链已具备测试兜底，并根据并行审查结果确定“群组/协作”是下一批比继续深挖 `code_editor` 更值得马上切入的高风险模块；当前已继续完成共享链与详情权限收口，但仍不得宣称真机验证完成，直到 Android 专用 MCP/插件验证证据补齐 |
| GAP-TOKEN-001 | 4/5 | P1 | IN_PROGRESS | 总控智能体 | 将 RTK 纳入默认 shell 巡检与验证策略，降低多轮整改过程中的 token 消耗 | 总控文档与台账明确 RTK 规则；后续常规搜索、读文件、diff、测试输出默认优先使用 `rtk` | `fba2e33` | `C:\\Users\\QX\\.codex\\AGENTS.md`；`C:\\Users\\QX\\.codex\\RTK.md`；本地 `D:\\rtk` 目录核查；本轮低 token 巡检记录 | 仅在 RTK 不支持目标命令或需要完整原始输出时回退原生命令，并在日志中说明原因；本轮已按 RTK/最小上下文原则收敛 Detox 与页面锚点整改范围 |
| GAP-DEVICE-001 | 5 | P0 | BLOCKED | 验证智能体 | 使用 Android 专用 MCP/插件连接真实平板完成可视化验证 | 至少覆盖首页、底部导航、AI、提醒/日程、我的、一个原生能力页面并产出证据包 | `待提交` | Android 专用 MCP/插件接入后生成 | 插件未就位前不得标记完成 |
| GAP-DEVICE-002 | 5 | P1 | TODO | 验证智能体 | 输出上线可用性评审结论与遗留阻塞 | 给出“可上线 / 整改完成待真机 / 不可上线”结论并绑定证据 | `待提交` | 真机验证与功能审查汇总报告 | 必须在所有高优先级 GAP 验证后进行 |

## 4. 删除与保留判定规则
- 可删除：缓存、编译产物、临时测试输出、可再生报告、无引用本地运行状态文件。
- 需谨慎确认：历史报告但仍被当前文档引用、可能作为验证证据的产物、尚不确定是否被脚本读取的本地文件。
- 必须保留：规划文档、功能设计、模块状态、总控/GAP/映射文档、实现计划、未完成功能代码与测试、被当前流程引用的脚本。

## 5. 更新记录

| 日期 | 更新人 | 变更说明 |
|---|---|---|
| 2026-05-11 | Codex | 新建生产整改 GAP 台账，建立批次 0~5 的唯一问题跟踪入口 |
| 2026-05-11 | Codex | 恢复误删的 GAP 台账，并补充瘦身、Conda ZeroIsle、`yarn install`、`yarn android`、功能审查与真机验证相关条目 |
| 2026-05-11 | Codex | 回填批次 2 首轮瘦身执行结果、Conda `Zeroisle` 可执行证据、ADB 识别真实平板证据，并明确尚未进入 Android 专用 MCP 真机验证阶段 |
| 2026-05-12 | Codex | 回填批次 2 首轮瘦身与环境准备提交哈希 `1d96221`，统一文档与 Git 对应关系 |
| 2026-05-12 | Codex | 将 GAP-TEST-001 从 `BLOCKED` 更新为 `IN_PROGRESS`，新增 GAP-ROUTE-001 跟踪可选功能入口导入稳定性，并登记批次 3 的 testing 自检与单测验证证据 |
| 2026-05-12 | Codex | 继续登记批次 3 第二轮启动期副作用清理，补充 `mongodb_realm_service`、`document_converter`、`notification` 的惰性初始化修复与最小导入验证证据 |
| 2026-05-12 | Codex | 追加前端工具链阻塞记录：登记根目录 `react-native` CLI 调用失效与 `detox` 依赖缺口，转入批次 4/5 的脚本可执行性修复 |
| 2026-05-12 | Codex | 新增 GAP-TOKEN-001，登记 RTK 默认化规则与本地 RTK 目录核查结果，用于后续整改阶段降低 token 消耗 |
| 2026-05-12 | Codex | 追加 Detox Android 最小接入与 smoke 扩展记录：补齐 `androidTest` instrumentation、attached-device 配置、独立 `test:e2e:jest`，以及 AI/提醒/知识图谱关键 `testID` |
| 2026-05-12 | Codex | 追加 Detox 链路验证结果：确认 Jest/Detox 入口已能识别 smoke 文件，`settings.gradle` 已切换本地 CLI autolink 并移除重复 include，当前主阻塞收敛为 `react-native-reanimated` NDK 链接权限错误与 SDK 环境变量要求 |
| 2026-05-12 | Codex | 追加 Android 原生构建根因收敛记录：移除 `createPlaceholderLibs` 伪造 `.so` 任务、清理 `android/app/build` 与 `react-native-reanimated/android/.cxx` 后复测 attached-device `detox build`，确认仓库侧污染链已解除，当前主阻塞为 `D:\Android\Sdk\ndk\26.1.10909125` 内 `libc++_shared.so` 单文件 ACL 异常；后续优先执行重装同版 NDK 或迁移到用户目录 SDK 的系统修复方案 |
| 2026-05-12 | Codex | 追加 Android SDK/NDK 修复闭环：确认 `libc++_shared.so: Permission denied` 已解除，`react-native-document-opener` / `@react-native-voice/voice` `minSdk` 已提升到主工程契约，Skia Gradle 8.8 兼容步骤已补齐，`detox build -c android.att.debug` 已成功产出调试 APK 与 `androidTest` APK |
| 2026-05-12 | Codex | 追加第三方补丁持久化与真实平板安装链验证：删除无效/噪声 patch 与临时对照文件，重建 `detox`、`@shopify/react-native-skia` 最小 `patch-package` 补丁；在 `HGR3Y9MA` / `TB128FU` 上成功安装调试 APK 与 `androidTest` APK，并执行 `adb reverse tcp:8081 tcp:8081` |
| 2026-05-12 | Codex | 追加 attached-device smoke 收口记录：提醒创建页改为固定底部操作栏，知识图谱/知识分析页补齐无后端空态锚点与分析入口，知识图谱 API/Redux 网络错误统一降级为空图；`Smoke` 用例已在 `HGR3Y9MA` 上 7/7 通过，但 Android 专用 MCP/插件真机可视化验证仍待完成 |
| 2026-05-12 | Codex | 追加功能审查主线修复记录：补齐 `/api/v1/code/*` 外部契约挂载、`code.*` 历史导入兼容别名、`src/services/codeService.js` 前端服务别名，并将 `notification` 批量接口统一到 Mongo 用户映射口径；最小验证 `python manage.py test notification.tests.test_views code_editor.tests.test_urls --settings=backend.settings.testing` 已通过 |
| 2026-05-12 | Codex | 新增 `GAP-NOTIFY-001`，将通知模块 Django/Mongo 用户映射修复独立挂账，明确批量已读、未读数、全部删除与对象权限判断的最小验证边界 |
| 2026-05-12 | Codex | 追加 `code_editor` 持久化契约收敛记录：将 `snippets/executions` 从 Django ORM 与 Mongo 文档混用调整为 Mongo 口径，补齐 `mongo_user` 保存链、执行服务 `save()` 语义兼容，以及 `code_editor.tests.test_persistence_contract` 最小回归验证 |
| 2026-05-12 | Codex | 追加 `code_editor` CRUD 与筛选回归记录：补齐 update、retrieve、rerun、by_tag、by_language 等最小用例，将回归范围从“最小持久化契约”扩展到“最小 CRUD 与筛选链” |
| 2026-05-12 | Codex | 新增 `GAP-GROUP-001` 与 `GAP-GROUP-002`，正式将群组/协作专项纳入批次 5 台账；记录本轮已完成 `/api/v1/groups/*` 外部契约收口、短横线路径对齐及共享屏幕创建异常流修复，并明确下一刀聚焦 Mongo 成员查询链 |
| 2026-05-12 | Codex | 回填群组专项首刀提交哈希 `ea3e6ab`，将 `/api/v1/groups/*` 外部契约收口、共享屏幕创建异常流修复与最小验证证据绑定到 GAP 台账 |
| 2026-05-12 | Codex | 追加 `GAP-GROUP-002` 进展：已将群组与共享屏幕查询链、权限链、创建链统一到 Mongo 用户口径，并补 `groups.tests.test_mongo_contracts` 最小回归验证 |
| 2026-05-12 | Codex | 回填群组专项第二刀提交哈希 `4fcfbf5`，将 Mongo 用户映射收口、可见群组查询修复与 14 项最小回归验证绑定到 GAP 台账 |
| 2026-05-12 | Codex | 新增 `GAP-GROUP-003`，记录群组详情序列化器加入码展示口径收口、前端 `EditGroup` 未接线路由移除，以及 16 项群组最小回归验证通过 |
| 2026-05-12 | Codex | 回填群组专项第三刀提交哈希 `3e0cfe2`，将详情加入码展示口径收口、`EditGroup` 未接线路由移除与 16 项群组回归验证绑定到 GAP 台账 |
| 2026-05-12 | Codex | 新增 `GAP-GROUP-004`，记录共享屏幕信令地址修复、当前用户身份口径收口、移动端假共享拦截，以及详情页管理动作改为能力字段驱动 |
| 2026-05-12 | Codex | 回填群组专项第四刀提交哈希 `f56f6b8`，将共享屏幕信令链修复、详情页能力字段收口与 17 项群组回归验证绑定到 GAP 台账 |
| 2026-05-12 | Codex | 新增 `GAP-GROUP-005`，记录邀请成员流程从手填 `userId` 向搜索选择式体验升级，并同步补群组域内候选用户搜索契约 |
| 2026-05-12 | Codex | 回填群组专项第五刀提交哈希 `49c933b`，将邀请成员搜索选择链、群组域候选搜索契约与 15 项最小回归验证绑定到 GAP 台账 |
| 2026-05-12 | Codex | 新增 `GAP-GROUP-006`，记录共享观看端从“最小列表入口”向完整三态页面升级，并继续为后续真机可视化验证做前端体验收口 |
| 2026-05-12 | Codex | 回填群组专项第六刀提交哈希 `fed56c8`，将共享观看端三态页面收口与目标文件静态校验绑定到 GAP 台账 |
| 2026-05-12 | Codex | 新增 `GAP-GROUP-007`，记录共享观看链的房间切换、回调解绑与远端流承载前置修复，继续为真实联调和真机验证做准备 |
| 2026-05-12 | Codex | 回填群组专项第七刀提交哈希 `f092c10`，将共享观看链前置联调修复与目标文件静态校验绑定到 GAP 台账 |
| 2026-05-12 | Codex | 新增 `GAP-GROUP-008`，记录共享观看态在房主离开、共享结束与列表刷新后的自动回收收口，继续为真实联调证据补强减少假状态返工 |
