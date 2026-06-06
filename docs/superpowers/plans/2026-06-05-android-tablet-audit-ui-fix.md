# Android Tablet Audit and UI Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在安卓平板上完成 ZeroIsle Notes 的真实设备实测，修复实测中暴露的功能问题，只优化明显原始的界面，同时保持现有成熟区域的视觉风格与交互一致。

**Architecture:** 先以真实 Android 设备为准做端到端巡检，围绕首页、笔记/文件查看、知识图谱、思维导图、社区、群组、提醒、AI、设置和个人空间逐模块走查。每轮都先采集证据再改代码，优先修复可复现的问题，再做最小范围的 UI 收敛，避免整站式重构破坏已有完成度。

**Tech Stack:** React Native 0.75.5、React Navigation 7、Redux Toolkit、React Native Paper、Realm、本地 Android 真机/平板、ADB、Jest、Detox（如需要回归）

---

### Task 1: 建立计划与进度档案，并固化实测路径

**Files:**
- Create: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Create: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/round202_安卓逐页逐子功能验收清单.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 记录当前目标、设备信息和约束**

```md
- 设备：HGR3Y9MA
- 排除项：登录 / 注册
- 目标：优先修复可复现 bug，只调整原始感明显的 UI
- 记录方式：每轮实测后追加进度条目、问题编号、文件路径、处理结果
```

- [x] **Step 2: 确认计划文档和进度文档的更新格式**

```md
- 计划文档：写清任务、涉及文件、验收方法
- 进度文档：写清日期、模块、现象、根因、修复状态、回归结果
```

- [x] **Step 3: 用 ADB 设备号锁定实测对象**

```powershell
adb devices
```

Expected: `HGR3Y9MA	device`

- [x] **Step 4: 在进度文档里写入首轮基线**

```md
- 当前代码库存在大量未提交修改，后续只改与本次目标直接相关的文件
- 主入口、导航、主题、首页已经是优先审查对象
```

### Task 2: 在安卓平板上完成主流程巡检并收集可复现问题

**Files:**
- Inspect: `src/App.js`
- Inspect: `src/navigation/AppNavigator.js`
- Inspect: `src/screens/common/HomeScreen.js`
- Inspect: `src/screens/ai/AIAssistantScreen.js`
- Inspect: `src/screens/knowledge/KnowledgeGraphScreen.js`
- Inspect: `src/screens/mind_map/MindMapScreen.js`
- Inspect: `src/screens/community/CommunityScreen.js`
- Inspect: `src/screens/groups/GroupsScreen.js`
- Inspect: `src/screens/reminder/ReminderDetailScreen.js`
- Inspect: `src/screens/settings/SettingsScreen.js`
- Inspect: `src/screens/personal_activity/PersonalActivityScreen.js`

- [x] **Step 1: 启动 Metro 并安装/运行到真机**

```powershell
npm run start
npm run android -- --deviceId HGR3Y9MA
```

Expected: 应用能在真机打开主界面，且不因认证流程阻断联调。

- [ ] **Step 2: 按模块实测并记录首轮现象**

```md
- 首页：启动、空状态、笔记网格、创建入口、排序入口
- AI：入口渲染、聊天输入、历史侧栏
- 知识图谱：图谱加载、节点详情、关系编辑
- 思维导图：列表、编辑、模板
- 社区：帖子列表、详情、发布、搜索
- 群组：列表、详情、邀请、加入
- 提醒：列表、详情、添加
- 设置：主题、同步、帮助、关于
- 零屿空间：分类、目标、活动表单
- 每个页面都要单独观察顶部安全区和底部系统栏，不能把某一页的正常结果外推成全站完成
- 若页面底部仍可见系统导航栏，需先判断它是不是设备自身可视区，而不是直接认定为布局异常
- 每轮修复都只能覆盖当轮已复测到的页面和子功能，不能因为某一页看起来正常就默认其他页面也完成
- 如果某个页面仍然存在底部原始提示条、原生 Toast 或异常留白，必须单独记页名、记位置、记触发链路，再进入下一轮最小修正
- 群组页如果出现“统一网络弹窗 + 底部黑色原始提示条”并存，优先追查全局通知 / Toast / Snackbar 链路，不要先把它当成页面卡片布局问题
```

- [ ] **Step 3: 捕捉失败截图、Android logcat 和关键交互复现路径**

```powershell
adb logcat -d > tmp/android-logcat-baseline.txt
```

Expected: 每个问题都有“步骤、页面、期望、实际、日志片段”。

- [ ] **Step 4: 把首轮问题按优先级写入进度文档**

```md
- P0: 阻塞使用 / 崩溃 / 空白页
- P1: 功能明显失效 / 路由错误 / 数据不刷新
- P2: 原始 UI、间距、信息层级、按钮样式
- 任何“底部状态栏仍可见”的反馈都要逐页记录，必须写清楚是设备系统栏可视、内容压线，还是页面底部原始提示条回流
- 任何一轮都不允许把“这次已经修过的页面”直接外推成“全站已完成底部安全区问题”，必须保留后续逐页继续观察的待办
- 群组网络错误如果仍出现底部黑条，需继续沿全局通知和页面内 Toast 双线排查，并优先收紧最原始的提示出口
- 群组入口如果在真机上没有稳定切进目标页，先把入口命中和路由时机核准，再判断底部黑条是否真的还存在，不能用桌面或上一个页面的截图做结论
- 群组邀请/创建/加入等页面若仍看到原始底部提示，优先检查 `messageUtils`、全局通知入口和 `apiClient` 的离线错误文案，不要先把它当成单页布局问题
- 新增页面或二级页时，顶部安全区要和底部系统栏一起验收，`paddingTop` / `paddingBottom` 必须按 `useSafeAreaInsets()` 重新核算，不能再沿用写死的 48/64/整屏补偿
```

- [x] **Step 4.1: 群组网络失败只保留统一弹窗，不再向底部原始错误条重复下发**

```md
- 群组邀请、群组列表、群组详情这类网络型错误，只允许出现项目内统一的 `NetworkErrorAlert`
- 页面层不再把同一条 `groups.error` 直接渲染成底部错误卡片或 Snackbar，避免双重提示
- 群组主页面与群组邀请页同步补上底部安全区，继续逐页确认底部系统栏只是设备可视区，不是页面内容越界
```

- [x] **Step 5: 补充顶部不可遮挡的统一验收口径**

```md
- 所有页面顶部都必须完整露出，标题、返回按钮和操作区不得被状态栏、系统导航层或原生 header 遮挡
- 尤其重点复核社区、设置、个人页以及各类二级子页面，避免不同入口下再次出现顶部叠层或被压住的问题
- 发现顶部留白、重叠或遮挡时，优先确认是否存在原生头和页面内头重复渲染，再决定是否进入代码修复
- 平板页面不能按整块设备屏幕直接铺满，必须把系统顶部状态栏和安全区算进可用高度，避免页面顶部标题、返回按钮、搜索框、操作区被系统栏遮挡
- 这里强调的是“合理去除底部/顶部系统栏影响后的可视区域”，不是简单隐藏系统栏；如果只隐藏而不重新计算安全区，页面顶部仍可能超出可视区
- 进一步补充：页面进入后要同时考虑顶部状态栏和底部系统栏对可视区的影响，不能按整块平板屏幕尺寸直接铺页面
- 进一步补充：不是把系统栏隐藏掉就算完成，必须按实际可视区域重新计算首屏、页头和操作区的位置，避免顶部内容被设备自带状态栏裁切
- 对于顶部标题栏、返回按钮和首屏操作区，优先使用 `useSafeAreaInsets()` / `SafeAreaView`，不要继续新增基于 `StatusBar.currentHeight` 的整屏补偿逻辑
```

- [x] **Step 6: 统一外链失败提示，避免原始错误文案裸露**

```md
- 关于页和帮助页的外链打开失败时，必须走项目内统一 Toast 或同等级提示，不允许把 `无法打开链接: ...` 这类原始错误直接露给用户
- 修复范围只限于链接兜底链路，不扩大到关于页信息结构、顶部样式或成熟卡片布局
```

- [x] **Step 5: 本轮补充修复知识库/知识图谱链路的跨栈路由断点，并同步文档**

```md
- 问题现象：知识库空态“创建笔记”在真机上会触发未处理导航，知识图谱分析页仍保留旧式 Notes/NoteEdit 跳转
- 根因：页面拿到的是子栈 navigation，但目标页面注册在根导航；部分旧写法仍在调用已废弃的 NoteEdit 入口
- 修复策略：改为统一走根导航兜底，不再依赖当前子栈是否恰好注册了目标路由
- 验收重点：创建/编辑/跳转路径要在真机上稳定可用，且不新增顶部遮挡、异常留白或原生头叠层
```

### Task 3: 修复实测中暴露的功能性问题，优先保证主流程可用

**Files:**
- Modify: `src/App.js`
- Modify: `src/navigation/AppNavigator.js`
- Modify: `src/screens/common/HomeScreen.js`
- Modify: `src/screens/ai/AIAssistantScreen.js`
- Modify: `src/screens/community/CommunityScreen.js`
- Modify: `src/screens/knowledge/KnowledgeGraphScreen.js`
- Modify: `src/screens/reminder/AddReminderScreen.js`
- Modify: `src/screens/settings/SettingsScreen.js`
- Modify: `src/services/networkErrorService.js`
- Modify: `src/components/common/ErrorState.js`

- [ ] **Step 1: 先修复会阻断实测的导航、初始化或数据加载问题**

```md
- 仅修复能在真机复现的问题
- 每个修复都保留原有行为，避免改动未出问题的分支
```

- [ ] **Step 2: 为每个修复写最小改动并在日志里标注根因**

```md
- 根因说明要包含：触发条件、影响范围、为什么会发生
- 如果涉及默认值或兜底逻辑，必须说明不会影响正常路径
```

- [ ] **Step 3: 在设备上重新跑一遍对应模块验证**

```md
- 修复后必须回到真机复测
- 只在问题页面做定向回归，不扩大修改面
```

- [ ] **Step 4: 更新进度文档中的“已修复 / 待回归”状态**

```md
- 已修复：写明文件路径和验证结果
- 待回归：写明还差什么条件
```

### Task 4: 只对明显原始的 UI 做收敛式美化，保留成熟区域风格

**Files:**
- Modify: `src/screens/common/HomeScreen.js`
- Modify: `src/components/common/EmptyState.js`
- Modify: `src/components/common/ErrorState.js`
- Modify: `src/components/common/LoadingIndicator.js`
- Modify: `src/components/common/Button.js`
- Modify: `src/components/common/Card.js`
- Modify: `src/components/common/GlassCard.js`
- Modify: `src/components/Layout/MainLayout.js`
- Modify: `src/components/Layout/TabBar.js`
- Modify: `src/theme/paperTheme.js`

- [ ] **Step 1: 先识别最原始的界面元素**

```md
- 旧式纯色背景
- 层级不清的卡片
- 间距过密或过松的列表
- 低质阴影、边框和按钮形态
```

- [ ] **Step 2: 只改局部，不推翻现有设计语言**

```md
- 保持现有主色和语义颜色
- 保持导航结构与信息架构不变
- 只收敛按钮、空状态、错误态、列表头部、首页操作区等明显粗糙区域
```

- [ ] **Step 3: 在平板横竖屏下分别检查响应式表现**

```md
- 横屏：信息密度、列数、底部按钮遮挡
- 竖屏：首屏完整性、滚动体验、可触达区域
```

- [ ] **Step 4: 复测后截屏并把优化前后差异写回进度文档**

```md
- 保留“为什么改、改了哪里、为何不动成熟区域”的说明
```

### Task 5: 做回归、补测试并收尾文档

**Files:**
- Add/Modify: `src/tests/**`
- Add/Modify: `e2e/**`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/round202_安卓逐页逐子功能验收清单.md`
- Modify: `docs/全系统优化执行总台账.md`

- [ ] **Step 1: 为修复过的核心路径补最小回归测试**

```md
- 首页空状态/排序
- 关键导航分支
- 易坏的空值兜底逻辑
```

- [ ] **Step 2: 运行 Jest 或已有 e2e 只验证被改动区域**

```powershell
npm test -- --runInBand
```

Expected: 新增或修改的回归用例通过。

- [ ] **Step 3: 重新在真机上跑一轮主流程**

```md
- 不再新增功能范围
- 只确认“修复没回退、UI 没变散”
```

- [ ] **Step 4: 在进度文档中写最终结论、残余风险和下一步建议**

```md
- 最终结论
- 已完成模块
- 仍需后续跟进的低优先级项
```

### Task 6: 收口返回按钮与个人主页功能中心的局部 UI 一致性

**Files:**
- Modify: `src/screens/knowledge/KnowledgeBaseSearchScreen.js`
- Modify: `src/screens/settings/ProfileSettings.js`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [ ] **Step 1: 将知识库搜索页返回按钮切换为统一的淡蓝色方形样式**

```md
- 目标：与其他页面返回按钮保持同一视觉语言
- 约束：仅替换返回按钮组件，不重做搜索页信息架构
```

- [ ] **Step 2: 将个人主页功能中心按钮恢复为更有层次的卡片样式**

```md
- 目标：避免功能入口过素、过扁平
- 约束：保留现有功能入口与顺序，不改成熟内容区
```

- [ ] **Step 3: 将本轮调整写入进度文档并补充验收结论**

```md
- 需要记录：改了什么、为什么改、哪些区域保持不动
- 需要记录：是否仍存在顶部异常留白、按钮风格不统一等问题
- 需要记录：是否已经彻底移除重复的原生头，并确认页面顶部不会被状态栏或系统导航层遮挡
- 需要记录：所有页面顶部都必须完整露出，标题、返回按钮和操作区不得被遮挡，尤其是平板上的社区、设置、个人页和各子页面顶部
- 需要记录：知识图谱关系编辑页 `EdgeEdit` 也必须使用统一顶部壳层与淡蓝色方形返回按钮，不能在不同入口下再出现原生 header 叠层
- 需要记录：所有已自绘顶部页面都要做 safe area 兜底，避免标题、返回按钮、搜索框和操作入口贴到状态栏下方
- 需要记录：知识库链路（列表、详情、创建、编辑、节点编辑、搜索）必须统一隐藏原生头，仅保留页面内自绘头，并对平板状态栏安全区做兜底，避免顶部按钮贴边或被遮挡
- 需要记录：知识图谱链路（主图谱、节点详情、知识分析）也必须统一隐藏原生头，仅保留页面内自绘头，并对平板状态栏安全区做兜底，避免不同路由入口出现两套顶部样式
- 需要记录：知识图谱节点详情与知识分析页在空态、加载态、错误态、正常态都必须保留同一顶部锚点，不允许在某些状态直接把顶部裁掉
- 需要记录：本轮验收重点是“顶部完整露出”，任何返回按钮、标题、操作按钮都不能贴到状态栏下面，更不能被系统导航栏或原生 header 盖住
- 需要记录：各页面顶部都必须完整露出，不能被状态栏、系统导航层、原生 header 或页面自身内容区遮挡，任何新增页面都默认纳入这条硬标准
- 需要记录：本轮及后续每轮都必须再次确认“顶部不被遮挡”这一硬标准，尤其是设置、个人页、社区、知识库、知识图谱、群组和它们的二级子页
```

- [ ] **Step 4: 回到真机复测并确认改动没有破坏现有成熟风格**

```md
- 需要记录：设置子页（AI 助手、帮助与反馈、离线数据、主题、字体、关于、绑定页）也必须统一顶部壳层与返回按钮，避免顶部风格分裂
- 需要记录：设置主页必须提供 `AI 助手设置` 入口，且入口要与其他智能/配置类入口同组，不能只保留路由而没有可见入口
- 需要记录：设置链路中的顶部必须完整露出，不能被状态栏、原生 header 或页面自身内容区遮挡
- 需要记录：本轮真机复核必须逐页确认各页面顶部是否完整露出，尤其要看标题、返回按钮、搜索框、操作按钮是否被状态栏、系统导航层、原生 header 或页面自身内容区压住
- 需要记录：如果某页顶部存在异常留白，要明确区分是安全区兜底、页面内页头、还是原生头残留导致，不能把正常安全区误判为布局问题
- 需要记录：社区、设置、个人资料、知识库、知识图谱这几条链路都必须以“顶部完整露出”为硬标准，任何页面只要顶部被遮挡就要优先修复
- 需要记录：设置链路里的关于、帮助与反馈、通知、主题、字体、离线数据等子页都要逐页复核，顶部标题和返回按钮必须完整露出，不能因为不同入口出现不一致的顶部留白
- 需要记录：如果某页仍出现顶部被遮挡或留白异常，必须先排查原生 header 残留、安全区缺失和页面头重复叠加，再决定是否改动内容区
- 需要记录：`AI 助手设置` 页面本身要收掉重复大标题，顶部只保留一套清晰页头，避免平板上方留白显得松散
- 需要记录：各页面进入后不是简单“隐藏底部状态栏”，而是必须按平板状态栏安全区重新计算页面可用高度，避免把整块平板尺寸直接当作软件可用区域，导致顶部内容被设备自带状态栏截掉
```

```md
- 重点关注：知识库搜索页顶部留白、个人主页功能中心层次感、返回按钮一致性
```

### Task 8: 统一顶部完整露出与安全区验收标准

**Files:**
- Modify: `src/navigation/MainNavigator.js`
- Modify: `src/screens/ai/AIAssistantScreen.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`

- [ ] **Step 1: 继续检查主流程里是否还有原生 header 残留**

```md
- 重点确认 AI、笔记、社区、群组、知识库、知识图谱、设置、个人页等主链路顶部是否统一
- 重点确认平板状态栏下方是否还有标题、返回按钮或操作区被压住的情况
```

- [ ] **Step 2: 对已经自绘顶部的页面统一补安全区兜底**

```md
- 目标：所有页面顶部完整露出，不被状态栏或系统导航层遮挡
- 约束：只收口明显冲突的顶部，不重做成熟内容区
```

- [ ] **Step 3: 将顶部不可遮挡作为每轮固定验收项写入进度文档**

```md
- 需要记录：每轮修改后都要复核顶部是否完整露出
- 需要记录：如果新增页面，必须同步检查是否需要隐藏原生 header
- 需要记录：网络问题统一优美样式弹窗，不使用默认安卓弹窗
- 需要记录：页面布局不能按整块平板屏幕直接铺满，必须把顶部状态栏和底部系统栏都纳入可视高度计算
- 需要记录：如果只是隐藏系统栏但没有重新计算安全区，仍然属于布局缺陷
```

- [ ] **Step 4: 真机复核顶部是否完整露出并写回结果**

```md
- 需要记录：页面名、顶部表现、是否有原生 header 残留
- 需要记录：返回按钮是否统一为淡蓝色方形带箭头样式
- 需要记录：是否还有异常留白，尤其是社区、知识库、知识图谱、群组与设置子页
- 需要记录：各页面顶部必须完整露出，标题、返回按钮、搜索框、操作按钮和页面头都不能被状态栏、系统导航层、原生 header 或页面自身内容区遮挡
- 需要记录：如果某页顶部仍然被遮挡，必须优先处理 safe area、原生 header 残留和重复页头叠加，再考虑其他内容区调整
- 需要记录：知识图谱链路新增的关系编辑页也纳入同一套顶部验收标准，不能因入口不同而出现两套顶部样式
- 需要记录：本轮再次确认所有页面顶部都要完整露出，尤其不能被安卓平板状态栏、系统手势区或任意原生头压住
- 需要记录：若顶部出现任何遮挡，先按“安全区 -> 原生头 -> 页面内页头 -> 内容区”顺序排查，再决定是否修改布局
- 需要记录：每一轮修改完成后都必须先做真机复核，再直接进入 `main` 的 git 流程，提交信息与文档描述均使用中文，并把本轮顶部是否完整露出写清楚
- 需要记录：顶部不可遮挡是长期硬标准，不只检查首页、设置、个人页、社区、知识库、知识图谱和群组，也要覆盖它们的二级子页、空态页、编辑页与路由跳转后的目标页
- 需要记录：社区创建帖子页、分类选择弹窗、发布入口和顶部返回按钮已在真机上复核，顶部完整露出，没有被状态栏、原生 header 或内容区遮挡
- 需要记录：后续所有新增页面都默认纳入“顶部完整露出”验收，不允许再以页面功能完整为由忽略顶部安全区和页头一致性
- 需要记录：本轮再次在安卓平板 `HGR3Y9MA` 上复核首页顶部，页面内自绘头从安全区下方开始，标题、搜索框、分类/排序入口和底部标签栏均正常露出，没有被状态栏、原生 header 或异常留白压住
- 需要记录：UI 树确认顶部存在的是页面内自绘头与系统状态栏背景的正常分层，不存在额外原生标题栏叠层
- 需要记录：页面进入后不能只靠隐藏系统栏来解决遮挡，必须按平板顶部状态栏与底部系统栏重新计算可视区
- 需要记录：如果页面首屏、页头或操作区按整机尺寸铺满而超出可视范围，仍需继续修正布局
- 需要记录：很多页面的底部系统栏不会在一轮里修完，所以每个功能页都要单独观察，不能把某一页的正常结果直接外推成全站完成
- 需要记录：个人页、社区页、群组页、知识图谱页都要分别记录顶部是否完整露出、底部是否压线，以及是否存在原始提示条或异常留白
```

- [x] **Step 4: 真机复核顶部是否完整露出并写回结果**

```md
- 已在安卓平板 `HGR3Y9MA` 上复核知识图谱、知识图谱分析与新建笔记链路，顶部完整露出
- 已确认知识图谱空态“创建笔记”可以稳定进入 `CardNote`
- 已确认页面顶部没有被状态栏、系统导航层、原生 header 或内容区遮挡
```

- [x] **Step 5: 收口社区链路页内错误展示，统一网络异常提示**

```md
- 目标：社区首页、帖子详情、活动、关注、粉丝、通知等页面在网络异常时只保留统一网络弹窗/提示，不再额外显示页内红条或错误卡
- 约束：不改成熟内容区布局，不扩大到其他非社区模块
- 验收：再次真机复核顶部完整露出，并确认没有新的页面级错误展示回退

- [ ] **Step 6: 继续按页补查个人、社区、群组、知识图谱的底部系统栏与入口稳定性**

```md
- 目标：继续按页看底部系统栏，而不是把一页的结果外推成全站完成
- 重点：个人页、社区页、群组页都要确认顶部完整露出，底部没有内容压线
- 重点：知识图谱入口要单独复核，确认从个人页点击后能稳定切到图谱页本体
- 约束：不重做成熟卡片和内容区，只记录仍需修正的入口或安全区问题
```
```

- [x] **Step 7: 继续补查底部系统栏可见性并同步知识图谱入口复核**

```md
- 目标：再次确认底部系统栏可见时，页面内容没有压线
- 重点：个人页、社区页、知识图谱页都要再次逐页核对
- 结果：当前页面未出现新的原始弹窗或明显异常留白
- 结果：知识图谱入口仍需作为独立观察项，后续继续单独验证点击稳定性
```

### Task 7: 收口群组邀请链路的网络错误展示

**Files:**
- Modify: `src/redux/slices/groupsSlice.js`
- Modify: `src/screens/groups/GroupsScreen.js`
- Modify: `src/screens/groups/InvitationsScreen.js`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`

- [x] **Step 1: 让群组邀请/列表在离线无缓存时优先走统一网络错误处理**

```md
- 目标：避免底部错误条破坏页面一致性
- 约束：不重做群组页顶部和成熟卡片样式
```

- [x] **Step 2: 复测群组页与邀请页，确认错误展示不再回退到原始提示条**

```md
- 目标：网络问题只能走统一弹窗或静默降级
- 约束：如果出现错误，必须明确是全局网络弹窗还是页面内业务失败
```

- [x] **Step 3: 把群组网络错误收口结果写回进度文档**

```md
- 需要记录：根因、修改范围、真机复测结果
- 需要记录：顶部结构和返回按钮未被这次修改影响
```

### Task 8: 继续补强顶部安全区与群组提示统一标准

**Files:**
- Modify: `src/screens/groups/GroupScreen.js`
- Modify: `src/screens/groups/InviteMembersScreen.js`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`

- [x] **Step 1: 去掉群组旧入口里的默认安卓底部提示**

```md
- 目标：避免黑色 Toast/snackbar 与统一网络弹窗并存
- 约束：不改成熟卡片，只收口提示出口
```

- [x] **Step 2: 将本轮顶部不遮挡与返回按钮一致性写入文档**

```md
- 目标：顶部完整露出，不能被状态栏、系统导航层、原生 header 或内容区遮挡
- 目标：返回按钮统一使用淡蓝色方形带箭头样式
- 约束：只记录与修正明显原始的部分，不动成熟区域
```

- [x] **Step 3: 真机复测群组主链路是否只剩统一网络弹窗**

```md
- 需要验证：群组列表、邀请页、加入群组、创建群组、群组详情
- 需要验证：不再出现默认安卓黑色提示条
- 需要验证：顶部安全区与留白仍然合理
- 需要验证：网络问题统一走项目内优美样式弹窗/提示，通知链路不会再把网络错误直接当成底部 Snackbar 贴出来
```

### Task 9: 持续复核每个功能页的底部系统栏可见性

**Files:**
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 把“底部系统栏也要逐页复核”写成固定要求**

```md
- 说明：很多页面不会在一轮里完全修完，底部系统栏是否可见必须在每个功能页测试时持续观察
- 说明：不能只看首页或少数页面，社区、设置、个人页、知识库、知识图谱、群组、提醒都要逐页核对
```

- [x] **Step 2: 记录底部系统栏可见与布局缺陷的区别**

```md
- 说明：如果底部系统栏仍可见，要判断是系统可视区正常保留，还是页面布局把内容顶出了安全区
- 说明：不能把“能看到系统栏”直接当作异常，也不能把“隐藏系统栏”当作真正修复
```

- [x] **Step 3: 将本轮结论写入进度和总台账**

```md
- 需要记录：每轮修复后都要继续回到 main 的 git 流程，并在文档里用中文写清楚当前还需要复测的页面
- 需要记录：页面顶部完整露出、底部系统栏可视区、返回按钮统一样式都要一起检查
- 需要记录：如果某页顶部或底部仍不合理，必须明确写出页面名和问题位置，再继续修
```

- [x] **Step 4: 同步时间必须使用稳定本地键，避免再次撞到冲突 Schema**

```md
- 说明：同步设置页的上次同步时间不要继续读写旧的 SyncInfo 兼容字段，改为 StorageItem / LAST_SYNC_TIME
- 说明：复测时若仍看到底部原始提示，先看数据字段是否对齐，再判断是否是界面问题
- 说明：任何页面都要继续按页观察底部系统栏，不要把“看见系统栏”本身当成异常
```

- [x] **Step 5: 将调试覆盖层与真实页面问题彻底分离**

```md
- 说明：`Cannot connect to Metro`、React Native Dev Menu、RedBox、调试黑框不属于业务页面 UI 缺陷
- 说明：后续只记录真实页面态下的顶部安全区、底部系统栏、异常留白、返回按钮一致性和统一网络弹窗
- 说明：若调试覆盖层再次阻断真机验收，只记录“需恢复真实页面态后复测”，不再当作页面底部黑条或群组布局问题处理
```

### Task 10: 群组页开发态错误浮层与真实业务提示彻底拆分

**Files:**
- Modify: `src/services/api/groupApi.js`
- Modify: `src/App.js`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 确认群组页底部原始提示条是否来自调试层错误浮层**

```md
- 目标：把“统一网络弹窗正常出现”与“底部原始长条仍然冒出”拆成两条链路看
- 结论：`获取群组邀请失败: Error: 网络错误且无缓存，无法完成请求` 对应的是开发态错误浮层，不是正式产品 Toast
- 证据：页面中央已有项目内统一网络弹窗，同时底部条文案与 `console.error('获取群组邀请失败:', error)` 完整对齐
```

- [x] **Step 2: 下调群组预期网络失败日志级别，避免开发态错误浮层继续冒充产品缺陷**

```md
- 目标：真实网络失败继续保留统一优美样式弹窗，但不再让开发态 `console.error` 额外生成底部错误浮层
- 做法：群组 API 中对预期网络/离线失败改为 `console.warn`，非预期失败才保留 `console.error`
- 约束：不改群组成熟布局，不改已有统一网络弹窗设计
```

- [x] **Step 3: 将群组失败前缀加入现有开发日志过滤，继续稳定真机验收环境**

```md
- 目标：减少开发联调时 React Native 错误浮层对真实页面验收的干扰
- 做法：把群组链路常见失败前缀加入 `App.js` 现有开发日志过滤名单
- 约束：仅过滤已判定为预期噪声的群组网络失败，不隐藏真正需要排查的业务异常
```

- [x] **Step 4: 继续收口 `API网络错误` 开发态底部长条**

```md
- 目标：避免统一网络弹窗出现时，底部又被 `API网络错误：{...}` 调试长条二次污染
- 根因：`networkErrorService.handleApiError` 在预期网络失败时仍使用 `console.error('API网络错误:', ...)`
- 做法：把该日志降级为 `console.warn`，并把 `API网络错误:` 前缀补进 `App.js` 的开发日志过滤名单
- 约束：不影响正式页面里的统一网络弹窗展示，不改成熟群组布局
```

### Task 11: 群组页头入口逐项复测并修正真实子页缺陷

**Files:**
- Modify: `src/components/groups/JoinGroup.js`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 重新核验群组主页头部入口是否真的回到首页**

```md
- 目标：不要再凭混杂截图下结论，必须从“我的 -> 群组”稳定路径重新进入群组页
- 结论：本轮已确认群组主页可进入，“邀请”入口会进入 `群组邀请` 页面；“回首页”未复现成当前稳定事实
```

- [x] **Step 2: 修复 `JoinGroup` 页面的真实运行时错误**

```md
- 根因：`useSafeAreaInsets` 从错误的包导入，导致“加入”入口一点击就抛运行时错误
- 做法：改为从 `react-native-safe-area-context` 导入
- 约束：不动成熟布局，不改统一顶部与返回按钮样式
```

- [x] **Step 3: 将联调环境波动与产品缺陷分离写入文档**

```md
- 说明：旧 bundle 残留、Metro 连接恢复、首页白屏等联调态现象不计入产品缺陷
- 说明：文档只记录已经被真机证据确认的页面问题与代码修复
```

- [x] **Step 4: 为群组“加入 / 创建”子页补齐统一顶部与返回入口**

```md
- 目标：群组主页、加入页、创建页顶部风格保持一致，继续统一使用现有淡蓝色方形返回按钮
- 做法：在 `JoinGroupScreen` / `CreateGroupScreen` 增加统一页头，并让内容区避开重复安全区占位
- 验收：安卓平板真机确认“加入群组 / 创建群组”页顶部标题完整露出，返回按钮位置和样式与群组主页一致
```

### Task 12: 群组离线草稿链路补齐与真机阻塞留痕

**Files:**
- Modify: `src/redux/slices/groupsSlice.js`
- Modify: `src/components/groups/GroupDetail.js`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 补齐本地群组草稿 reducer 与列表合并逻辑**

```md
- 根因：`CreateGroup` 在离线时已调用 `upsertLocalGroup(localGroup)`，但 `groupsSlice` 实际未导出该 reducer，导致本地草稿链路不完整
- 做法：补齐 `upsertLocalGroup`，并把本地草稿与远端群组在 `fetchGroups.fulfilled`、`createGroup.fulfilled`、`fetchGroupDetail.fulfilled` 中统一按 `id` 合并
- 约束：不改群组成熟列表样式，不重做现有群组主页结构
```

- [x] **Step 2: 让本地草稿详情页优先读取本地数据，避免离线请求打断详情链路**

```md
- 根因：创建本地草稿后虽然导航到了 `GroupDetail`，但详情页仍会继续请求远端详情，离线时会把页面打回错误态或统一网络弹窗
- 做法：`GroupDetail` 遇到 `local_only` 群组时优先 `setCurrentGroup(localGroup)`，刷新时也先走本地数据，不再继续请求远端详情
- 目标：为后续“创建群组 -> 详情 -> 邀请成员”真机验收补齐离线兜底基础能力
```

- [x] **Step 3: 真机记录本轮新的稳定阻塞，不把空白根视图误写成页面 UI 问题**

```md
- 现象：重新安装调试包后，安卓平板 `HGR3Y9MA` 上应用可拉起进程，但多次进入 `com.zeroisle_notes` 后停在空白根视图
- 证据：`round259_after_reinstall_launch.xml/.png`、`round260_open_app_after_reinstall.xml/.png`
- 说明：这不是群组详情页、邀请页或返回按钮样式问题，而是当前真机调试态的新阻塞，需要单独继续排查
```

- [x] **Step 4: 下一轮从“空白根视图/高占用”阻塞恢复后继续补完群组详情与邀请成员真机闭环**

```md
- 下一步：优先确认空白根视图是否由 Hermes / Realm / 本地数据初始化链路触发，再回到群组创建后详情页与邀请成员页
- 继续验收：顶部完整露出、淡蓝色返回按钮一致、异常留白、统一网络弹窗、离线草稿详情链路
- 本轮结论：已先恢复真实页面态，确认阻塞更接近启动期持久化恢复门禁，而不是群组页或顶部安全区问题
- 本轮修复：在 `src/App.js` 增加启动期持久化恢复可视加载与超时放行兜底，避免真机再次长时间停在空白根视图
- 真机结果：安卓平板 `HGR3Y9MA` 已重新进入首页真实页面，后续可继续恢复逐模块验收
```

### Task 13: 收口个人资料页头像热区误触群组入口问题

**Files:**
- Modify: `src/screens/settings/ProfileSettings.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 以真机精确点击证据确认个人资料页群组入口误触**

```md
- 现象：从个人资料页功能中心点击“群组”卡片时，会误拉起系统照片选择器
- 范围：只在真机实际交互里确认，不把旧截图或旧坐标外推成当前事实
- 证据：`round268_after_precise_group_tap.png/.xml`
```

- [x] **Step 2: 采用最小修复策略收紧头像触发热区**

```md
- 根因判断：头像区域整块可点击，热区过大，和功能中心入口形成误触干扰
- 做法：头像图片区改为纯展示，新增独立“更换头像”按钮作为唯一图片选择入口
- 约束：不重做成熟表单区、功能中心卡片或其他稳定区域
```

- [x] **Step 3: 真机复测群组入口稳定性并核对顶部/弹窗规范**

```md
- 修复后按新的群组卡片中心点复测，点击后应稳定进入群组页
- 群组页顶部标题、淡蓝色方形返回按钮必须完整露出
- 网络失败仍只允许出现项目内统一优美样式弹窗，不允许回退到默认安卓弹窗
- 证据：`round273_after_fix_profile_tab.png/.xml`、`round275_after_fix_precise_group_tap.png/.xml/.log`
```

- [x] **Step 4: 将“不要把单点修复外推成全站完成”继续写入文档**

```md
- 本轮只确认个人资料页 -> 群组入口这一个真实问题已收口
- 其他功能页仍需继续逐页观察顶部完整露出、异常留白和统一网络弹窗
- 底部黑框已明确属于调试态现象，本轮不再作为产品缺陷处理
```

### Task 14: 收口群组详情页成员列表的虚拟列表嵌套警告

**Files:**
- Modify: `src/components/groups/MemberList.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 用真机离线创建链路确认本地详情页已可进入**

```md
- 路径：群组空态 -> 创建群组 -> 填写测试数据 -> 提交 -> 关闭统一网络弹窗
- 结果：已进入本地草稿详情页，说明离线详情兜底链路仍然有效
- 证据：`tmp_group_create_after_dismiss.png/.xml`
```

- [x] **Step 2: 收口群组详情页底部开发态警告条**

```md
- 现象：详情页底部出现 `VirtualizedLists should never be nested inside plain ScrollViews...` 警告条
- 根因：`GroupDetail` 外层是 `ScrollView`，`MemberList` 内层仍使用 `FlatList`
- 做法：成员列表改为普通映射渲染，避免在小规模成员区继续嵌套虚拟列表
- 约束：不重做详情页成熟卡片、顶部壳层、返回按钮或操作区布局
```

- [x] **Step 3: 继续沿同一条真机链路复测**

```md
- 重点：群组详情页顶部完整露出、离线草稿详情仍可进入、统一网络弹窗保留、开发态虚拟列表警告不再干扰验收
- 说明：这次收口的是开发态验收噪声，不把它误写成产品底部黑框问题
```

### Task 15: 收口本地离线草稿群组详情页的误导性联网入口

**Files:**
- Modify: `src/redux/slices/groupsSlice.js`
- Modify: `src/components/groups/CreateGroup.js`
- Modify: `src/components/groups/GroupDetail.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 用真机确认本地草稿详情页仍暴露远端群组入口**

```md
- 路径：群组空态 -> 创建群组 -> 离线提交 -> 关闭统一网络弹窗 -> 进入本地草稿详情页
- 现象：本地草稿详情页仍显示“邀请成员 / 屏幕共享 / 刷新”等远端群组入口
- 证据：`tmp_round283_menu_open.png`、`tmp_round283_after_refresh_tap.png/.xml/.log`
```

- [x] **Step 2: 按本地草稿态与正式群组态拆分可操作项**

```md
- 根因：`upsertLocalGroup` 与 `CreateGroup` 的离线草稿默认能力过宽，详情页继续把草稿当成可联网群组处理
- 做法：本地草稿默认关闭邀请成员 / 生成加入码能力；详情页本地草稿态隐藏屏幕共享入口，并把刷新改为只展示草稿状态说明
- 约束：不重做成熟详情卡片、顶部壳层、返回按钮和正常远端群组的既有交互
```

- [x] **Step 3: 保留统一网络弹窗标准，但避免草稿态误导点击**

```md
- 目标：网络问题仍统一走项目内优美样式弹窗
- 目标：本地草稿页不再主动暴露会稳定触发网络错误的联网操作入口
- 说明：这轮修的是离线草稿态边界，不把启动过渡页、系统照片选择器或联调波动误记成群组详情产品缺陷
```

### Task 16: 修复创建群组页离线提交未自动落本地草稿的问题

**Files:**
- Modify: `src/components/groups/CreateGroup.js`
- Modify: `src/redux/slices/groupsSlice.js`
- Modify: `src/redux/slices/__tests__/groupsSlice.localFallback.test.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 用真机确认“创建群组”首击与离线提交链路仍有断点**

```md
- 路径：群组空态 -> 创建群组 -> 输入群组名称 -> 点击“创建群组”
- 现象一：输入框仍聚焦时，首次点提交容易被键盘/焦点层吞掉，页面停留在创建页
- 现象二：再次点击后虽然真正发起请求，但会直接弹统一网络错误弹窗，没有自动进入本地草稿详情
- 证据：`tmp_round285_after_create_tap.png/.xml`、`tmp_round285_after_submit.png/.xml`、`tmp_round285_after_second_submit.png/.xml/.log`
```

- [x] **Step 2: 保留网络错误标记并禁止创建群组请求重复弹全局网络窗**

```md
- 根因：`groupsSlice.createGroup` 在 reject 时只回传字符串，丢失了 `isNetworkError` 标记，`CreateGroup` 组件无法识别为离线失败并进入本地草稿 fallback
- 做法：`createGroup` thunk 调用 `groupApi.createGroup(..., { suppressGlobalErrorUI: true })`，并在 rejectWithValue 中保留 `message + isNetworkError`
- 补充：`selectGroupsError` 改为兼容对象型错误，并继续对网络型错误返回 `null`，避免又把网络失败渲染成页面内错误块
```

- [x] **Step 3: 修复平板端创建页提交触控体验**

```md
- 做法：`CreateGroup` 提交前主动 `Keyboard.dismiss()`，并给 `ScrollView` 增加 `keyboardShouldPersistTaps="handled"`
- 目标：让平板端在输入名称后第一次点“创建群组”就能稳定触发提交，不再要求用户先额外点空白处收起焦点
- 约束：不重做成熟表单样式，只修真实阻断交互
```

### Task 17: 收口加入群组页平板端异常留白与过度居中布局

**Files:**
- Modify: `src/components/groups/JoinGroup.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 真机确认加入群组页存在中上部异常留白**

```md
- 路径：个人资料 -> 功能中心 -> 群组 -> 页头“加入”
- 现象：加入页顶部自定义页头完整露出，但主体内容被整屏垂直居中压到中下部，页头下方出现非常明显的大块空白
- 说明：这不是系统状态栏、底部调试黑框或默认安卓弹窗问题，而是页面自身对平板高度的使用方式不合理
- 证据：`tmp_round288_join_entry.png/.xml`
```

- [x] **Step 2: 按平板规范改为顶部对齐卡片布局**

```md
- 根因：`JoinGroup` 外层内容区使用 `justifyContent: 'center'`，导致 1200px 宽平板上整块表单被硬性垂直居中
- 做法：内容区改为顶部对齐，主体改为限宽卡片承载；四位码输入框同步增大并收进卡片内，避免横向过散、纵向悬空
- 约束：保留已有淡蓝色页头、统一返回按钮、统一网络弹窗和成熟配色，不重做页面语义结构
```

- [x] **Step 3: 持续保持网络异常反馈统一**

```md
- 复测中从个人资料页进入群组、再进加入链路时，网络波动仍只出现项目内统一优美样式弹窗
- 这轮不回退到默认安卓弹窗，也不把联调态网络波动误记为加入页产品逻辑错误
- 后续继续复测四位码输入、退格焦点与离线提交，但本轮先收口最明显的平板布局缺陷
```

- [x] **Step 4: 真机补测加入码输入与离线提交流程**

```md
- 4 位数字 `1234` 输入后，四格输入框都能正确落值，“加入群组”按钮会按预期从禁用切到可点击
- 删除最后一位后，按钮会立即恢复禁用，说明输入完整度联动逻辑正常
- 离线点击提交后，页面继续只出现项目内统一优美样式网络弹窗，没有回退默认安卓弹窗，也没有再冒出底部原始错误条
- 证据：`tmp_round289_join_entry.png/.xml`、`tmp_round289_after_input_1234.png/.xml`、`tmp_round289_after_backspace_once.png/.xml`、`tmp_round289_after_submit.png/.xml`
```

### Task 18: 收口群组邀请页空态过度下沉的平板留白

**Files:**
- Modify: `src/screens/groups/InvitationsScreen.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 真机确认邀请页已经能进入，但空态仍有明显下沉**

```md
- 路径：个人资料 -> 功能中心 -> 群组 -> 顶部“邀请”
- 现象：关闭统一网络弹窗后，页面实际已经成功进入“群组邀请”页，顶部标题与淡蓝色方形返回按钮都完整露出
- 但空态图标与文案仍被放在屏幕中下部，平板页头下方形成很大一片视觉空区，属于页面自身布局节奏不合理，不是状态栏遮挡
- 证据：`tmp_round290_after_dismiss.png/.xml`
```

- [x] **Step 2: 只改邀请页空态容器的纵向分布，不动成熟头部与网络弹窗链路**

```md
- 根因：`InvitationsScreen` 在空态时把 `FlatList` 内容容器做成了 `justifyContent: 'center'`，导致整个空态块被强行压到大屏中部
- 做法：空态列表容器改为顶部展开，并增加适中的 `paddingTop`、`paddingBottom` 与限宽空态块，让页头信息卡之后的内容自然向下展开
- 保留：统一页头、淡蓝色方形返回按钮、邀请页头卡片、统一网络错误弹窗、现有 testID 与成熟配色
```

- [x] **Step 3: 真机复核邀请页离线反馈仍统一，且记录联调噪声边界**

```md
- 关闭统一网络弹窗后，邀请页空态仍可稳定停留在页面内，没有回退默认安卓弹窗
- 再次点击“刷新”或从群组主页重新点击“邀请”时，离线环境下继续只出现项目内统一优美样式网络弹窗
- 本轮测试中出现过一次应用被切回桌面、一次启动过渡页短暂停留，这两者都作为联调/系统层噪声单独记录，不计为本轮邀请页 UI 缺陷
- 证据：`tmp_round291_invitation_after_fix.png/.xml`、`tmp_round291_invite_tap_wait.png/.xml`、`tmp_round291_relaunch_screen.png/.xml`
```

### Task 19: 收口创建群组页外层整块玻璃壳导致的平板异常留白

**Files:**
- Modify: `src/screens/groups/CreateGroupScreen.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 真机确认创建群组页主体外仍有大块无效留白**

```md
- 路径：个人资料 -> 功能中心 -> 群组 -> 创建群组
- 现象：页头、返回按钮和表单本身都正常，但表单卡片外层还被包进一整块铺满余高的玻璃壳，导致卡片下方出现非常突兀的大块空白
- 判定：这不是状态栏遮挡，不是底部系统栏，也不是提交流程问题，而是创建页外层容器设计不合理
- 证据：`tmp_round292_create_entry.png/.xml`
```

- [x] **Step 2: 仅移除外层撑满高度的装饰壳，保留成熟表单内容**

```md
- 根因：`CreateGroupScreen` 用了 `flex: 1` 的 `glassShell` 把 `CreateGroup` 整体再次包裹，平板上形成“大容器 + 小表单卡片”的原始留白感
- 做法：移除这层额外玻璃壳的装饰属性，只保留普通内容承载容器，让表单卡片按自身内容高度呈现
- 保留：统一页头、淡蓝色方形返回按钮、创建表单结构、离线本地草稿 fallback、统一网络弹窗、既有 testID
```

- [x] **Step 3: 记录真机联调噪声，避免把重装后桌面/加载态误记成页面缺陷**

```md
- 代码修改后 `npx eslint src/screens/groups/CreateGroupScreen.js` 通过，`./gradlew.bat :app:installDebug` 成功安装到平板
- 安装后再次出现应用被系统切回桌面、重新拉起后短暂停在 `Loading from localhost:8081...` 的联调现象
- 这些现象本轮继续单独记录，不计为“创建群组页布局缺陷”，避免把运行时联调波动和实际页面问题混淆
- 证据：`tmp_round292_create_after_fix.png/.xml`、`tmp_round292_relaunch_after_fix.png/.xml`
```
