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
| GAP-ROUTE-001 | 3/5 | P1 | IN_PROGRESS | 验证智能体 | 清理可选功能入口的启动期导入阻塞，确保功能审查前各路由可被正常挂载 | `mind_map`、`document_converter`、`personal_activity`、`code_editor` 等入口不因模块级初始化失败或历史导入别名缺失而被跳过 | `ff72009, 22f0bed, 待补本次提交` | `manage.py check` 输出；`document_converter/tasks.py` 与 `notification/signals.py` 导入副作用修复差异；`python manage.py test code_editor.tests.test_urls code_editor.tests.test_persistence_contract --settings=backend.settings.testing` | 已在首轮 3 个入口基础上继续收敛 `document_converter` 与 `notification` 的模块级副作用；本轮继续把 `code_editor` 的 `snippets/executions` 从 Django ORM 与 Mongo 文档混用收敛到 Mongo 口径，并补齐 `mongo_user` 保存链与最小持久化契约测试；后续仍需继续扩展更深层 CRUD 与真实联调验证 |
| GAP-NOTIFY-001 | 5 | P1 | IN_PROGRESS | 验证智能体 | 统一通知模块 Django/Mongo 用户映射口径，消除批量接口与权限判断断裂 | 批量已读、未读数、全部删除以及 `recipient/user` 对象权限判断统一走 Mongo 用户映射，不再把 Django 用户 ID 直接当 Mongo 用户 ID 使用 | `22f0bed` | `python manage.py test notification.tests.test_views --settings=backend.settings.testing`；`backend/notification/views.py`；`backend/notification/services.py`；`backend/common/permissions.py` | 本轮已修复批量接口、平铺路由与对象权限判断，但通知列表、单条读写与更多真实调用链仍需继续回归，当前只完成最小契约验证 |
| GAP-MOBILE-001 | 4 | P1 | IN_PROGRESS | 移动端/Android 智能体 | 补齐关键页面稳定 `testID` 与 Detox smoke 基础 | 首页、底部导航、AI、提醒、知识图谱、我的页具备稳定 `testID`；smoke 可构建安装 | `fba2e33, 22f0bed` | `detoxrc.js`；`e2e/starter.test.js`；`android/app/build.gradle`；`android/settings.gradle`；`android/app/src/androidTest/java/com/zeroisle_notes/DetoxTest.java`；APK 产物 `android/app/build/outputs/apk/debug/app-debug.apk`、`android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk`；真实平板安装成功记录；`node node_modules/detox/local-cli/cli.js test -c android.att.debug --testNamePattern="Smoke"` 在 `HGR3Y9MA` 上 7/7 通过 | `testID`、Instrumentation、attached-device 配置已就绪，NDK 权限阻塞与第三方库 `minSdk` 阻塞已解除；本轮已进一步完成提醒创建页固定底部操作栏、知识图谱/知识分析页空态锚点与分析入口补强，attached-device smoke 已全量通过，后续进入 Android 专用 MCP 可视化验证 |
| GAP-REVIEW-001 | 5 | P0 | IN_PROGRESS | 验证智能体 | 使用工具进行功能审查，核查规划功能是否完成、是否足以上线 | 形成逐模块核查结论、缺口清单、体验与速度评估 | `fba2e33, 22f0bed, 待补本次提交` | smoke 静态审查结论；`jest --config e2e/jest.config.js --listTests`；`detox build -c android.att.debug` 成功日志；`adb devices -l`；`adb -s HGR3Y9MA install -r` 成功日志；`adb reverse tcp:8081 tcp:8081`；`node node_modules/detox/local-cli/cli.js test -c android.att.debug --testNamePattern="Smoke"` 在 `HGR3Y9MA` 上 7/7 通过；`python manage.py test notification.tests.test_views code_editor.tests.test_urls code_editor.tests.test_persistence_contract --settings=backend.settings.testing`；`python manage.py check --settings=backend.settings.testing` | 系统层 SDK/NDK 修复已完成，attached-device 基础页面可达性与无后端联调降级已通过；本轮继续确认 `code_editor` 的 `snippets/executions` 最小持久化契约已收敛到 Mongo 用户与 Mongo 文档口径，前端 `codeService` 也已兼容新的片段返回结构；仍不得宣称真机验证完成，直到 Android 专用 MCP/插件验证证据补齐 |
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
