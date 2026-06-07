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

### Task 20: 收口群组深层功能页仍暴露主标签栏的导航层问题

**Files:**
- Modify: `src/navigation/AppNavigator.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 真机确认群组深层页仍露出底部主标签栏**

```md
- 路径：个人资料 -> 功能中心 -> 群组 -> 创建群组 / 邀请 / 加入
- 现象：群组已属于从“我的”进入的深层功能链路，但真机截图里底部仍能看到 `首页 / AI / 社区 / 我的` 主标签栏
- 判定：这不是用户已明确忽略的调试黑框，也不是系统导航条，而是应用主导航没有对该子链路稳定隐藏 tabBar
- 证据：`tmp_round294_create_after_fix.png`、`tmp_round294_group_entry_after_tabfix.png/.xml`
```

- [x] **Step 2: 在主导航层统一收口深层子链路的 tabBar 显隐**

```md
- 根因：`AppNavigator` 的 `getTabBarStyle` 只对少数全屏页面和最深层 `hideTabBar` 参数做判断；而 `SettingsNavigator -> GroupsNavigator` 这类嵌套链路并不会在每一层都稳定透传该参数
- 做法：
  - 新增 `hasHideTabBarInFocusedChain`，递归检查当前聚焦路由链上是否已声明 `hideTabBar`
  - 对 `Groups / GroupsList / GroupDetail / CreateGroup / JoinGroup / Invitations / ScreenShare / InviteMembers` 增加显式隐藏规则
- 目标：让群组子页统一按软件规范进入“深层功能页不再暴露主标签栏”的状态，同时不改已有淡蓝色返回按钮、顶部风格和成熟内容区
```

- [x] **Step 3: 记录真机复测边界，避免把联调白屏混入页面缺陷**

```md
- `npx eslint src/navigation/AppNavigator.js` 通过，无新增 error；保留仓库里原有 warning
- `./gradlew.bat :app:installDebug` 两次均成功安装到平板 `HGR3Y9MA`
- 但安装后又反复出现 `Loading from localhost:8081...`、短时纯白页和重新回首页的联调噪声，导致本轮无法一次性拿到完全干净的“群组深层页已隐藏主标签栏”终态证据
- 这些现象继续单独记录，不计为群组产品页布局缺陷；下一轮要在恢复真实页面态后，优先补抓群组创建页/邀请页/加入页的修后终态截图与 XML
- 证据：`tmp_round294_relaunch_after_tabfix.png/.xml`、`tmp_round294_after_wait8.png/.xml`、`tmp_round294_relaunch_after_tabfix2.png/.xml`
```

### Task 21: 用真机终态证据补完群组深层页主标签栏隐藏验收

**Files:**
- Modify: `src/navigation/GroupsNavigator.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 继续以真机真实入口确认上一轮静态隐藏规则未完全命中**

```md
- 路径：首页 / 我的 -> 个人资料 -> 功能中心 -> 群组
- 现象：群组主页已弹统一网络错误弹窗，但底部仍可见 `首页 / AI / 社区 / 我的` 主标签栏
- 判定：说明仅在 `AppNavigator` 做静态路由名判断还不够，真实运行时父导航层级仍有漏口
- 证据：`tmp_round296_group.png/.xml`
```

- [x] **Step 2: 改为在 `GroupsNavigator` 运行时沿父导航链逐层隐藏 tabBar**

```md
- 根因：`SettingsNavigator -> GroupsNavigator` 进入后，真实生效的 tab navigator 层级并不稳定，固定写 `getParent()?.getParent?.()` 容易漏到更外层父导航
- 做法：在 `GroupsNavigator` 使用 `useFocusEffect` 沿 `navigation.getParent()` 链逐层收集父导航，并在群组流聚焦时统一 `setOptions({ tabBarStyle: { display: 'none' } })`
- 离开群组流时逐层恢复 `tabBarStyle: undefined`
- 约束：只修群组链路主标签栏显隐，不重做群组成熟页头、统一网络弹窗、返回按钮和既有表单布局
```

- [x] **Step 3: 逐页真机复核群组首页、邀请、加入、创建四个页面**

```md
- 群组主页：关闭统一网络弹窗后，底部主标签栏已消失，XML 中不再出现 `nav.tab.home/nav.tab.ai/nav.tab.community/nav.tab.profile`
- 邀请页：`群组邀请` 顶部完整露出，统一网络弹窗仍保留，底部主标签栏未回流
- 加入页：顶部淡蓝色方形返回按钮与标题完整露出，输入卡片布局正常，底部主标签栏未回流
- 创建页：页头、表单和按钮保持当前成熟样式，底部主标签栏未回流
- 证据：`tmp_round296_group_after_fix.png/.xml`、`tmp_round296_invitations.png/.xml`、`tmp_round296_join.png/.xml`、`tmp_round296_create.png/.xml`
```

- [x] **Step 4: 将“顶部完整露出、布局合理、底部调试黑框不再处理”的边界继续写入文档**

```md
- 本轮继续按真机可视区验收：页面高度不能按整块平板尺寸直接铺满，必须同时考虑顶部状态栏安全区
- 本轮确认群组四个页面顶部标题、返回按钮和操作区都完整露出，没有被状态栏或原生头遮挡
- 用户已明确底部黑框属于调试噪声，本轮及后续不再把它作为产品侧缺陷处理；但功能深层页误露出的主标签栏仍必须逐页验收
```

### Task 22: 收口社区深层功能页误露出主标签栏的问题

**Files:**
- Modify: `src/navigation/AppNavigator.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 继续以真机真实链路确认社区首页与社区深层页的边界**

```md
- 社区首页作为一级 tab 页面，底部主标签栏应正常保留，不能为了“全隐藏”破坏一级导航
- 通知消息、动态、帖子详情、发帖、关注/粉丝、社区搜索这类深层页进入后，不应再露出 `首页 / AI / 社区 / 我的`
- 重点继续确认顶部完整露出、布局合理无异常留白、统一网络弹窗保留，不把底部调试黑框重新记成产品缺陷
```

- [x] **Step 2: 在主导航层把社区深层页纳入统一隐藏规则**

```md
- 根因：社区栈此前只对群组等已知深层路由做了主标签栏隐藏判断，`Notifications / Activity / Followers / Following / ApiTest / PostDetail / CreatePost / CommunitySearch` 仍未纳入统一规则
- 做法：在 `src/navigation/AppNavigator.js` 的 `nestedFlowScreens` 中补入上述社区深层页路由名
- 目标：不动成熟社区首页布局，只收口社区子页误露出主标签栏这一类导航层真实问题
```

- [x] **Step 3: 真机逐页复核至少两个社区深层页**

```md
- 社区首页：顶部完整露出，搜索条、分类条、空态与发布按钮保持原样，底部主标签栏作为一级页正常保留
- 通知消息：进入后虽然离线环境会先出现项目内统一优美样式网络弹窗，但 XML 中已不再出现任何 `nav.tab.*` 主标签栏节点
- 动态：进入后同样只剩统一网络弹窗，不再出现主标签栏节点
- 证据：`tmp_round298_community.png/.xml`、`tmp_round298_notifications_after_fix.png/.xml`、`tmp_round298_activity_after_fix.png/.xml`
```

- [x] **Step 4: 将“不要把单点修复外推成全站完成”继续写入文档**

```md
- 本轮只确认社区深层页里的 `通知消息` 与 `动态` 两条真实子链路已收口
- 不能据此直接外推成社区全部深层页、乃至全站所有深层页都已彻底完成同类验收
- 后续仍需继续逐页复测社区搜索、帖子详情、发帖、关注/粉丝等链路，同时持续确认顶部完整露出、返回按钮一致和布局没有异常留白
```

### Task 23: 用真机截图补完社区深层页主标签栏隐藏的终态证据

**Files:**
- Modify: `src/navigation/AppNavigator.js`
- Add: `src/screens/community/useHideMainTabBar.js`
- Modify: `src/screens/community/ActivityScreen.js`
- Modify: `src/screens/community/NotificationsScreen.js`
- Modify: `src/screens/community/PostDetailScreen.js`
- Modify: `src/screens/community/CreatePostScreen.js`
- Modify: `src/screens/community/ApiTest.js`
- Modify: `src/screens/community/CommunitySearchScreen.js`
- Modify: `src/screens/community/FollowersScreen.js`
- Modify: `src/screens/community/FollowingScreen.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 承认上一轮社区深层页“已修好”的结论不够硬**

```md
- 重新真机复测时，`活动动态` 页在统一网络弹窗出现的同时，底部主标签栏仍然可见
- 这说明仅靠 `AppNavigator` 里的静态路由名判断和局部 listeners，不足以形成稳定终态
- 本轮必须以截图为主、XML 为辅，不再只凭 `uiautomator` 搜不到 `nav.tab.*` 就直接入账
```

- [x] **Step 2: 把社区深层页的主标签栏隐藏职责下沉到页面自身**

```md
- 根因：`CommunityStack` 里混写的 listeners / 参数透传 / 静态路由名判断会被真实运行时层级和重渲染覆盖，链路不够稳
- 做法：
  - 新增 `src/screens/community/useHideMainTabBar.js`
  - 在 `Activity / Notifications / PostDetail / CreatePost / ApiTest / CommunitySearch / Followers / Following` 这些深层页聚焦时，沿父导航链逐层隐藏主标签栏
  - 同时移除 `AppNavigator` 里社区栈那套不稳定的逐页 listeners，避免双重控制互相覆盖
- 目标：社区首页继续保留一级 tab，社区深层页自己负责在聚焦时稳定收口主标签栏
```

- [x] **Step 3: 真机优先复测 `活动动态` 与 `通知消息` 两条最容易暴露问题的链路**

```md
- 路径一：`首页 -> 社区 -> 活动动态`
- 结果一：统一网络弹窗出现时，底部已不再出现 `首页 / AI / 社区 / 我的`
- 结果二：关闭统一网络弹窗后，`活动动态` 页空态、页头和返回按钮仍正常，底部主标签栏继续保持隐藏
- 证据：`tmp_round300_activity.png`、`tmp_round300_activity_after_dismiss.png`

- 路径二：`首页 -> 社区 -> 通知消息`
- 结果：统一网络弹窗出现时，底部同样未再露出主标签栏；页头、返回按钮与“全部标记已读”操作区仍完整露出
- 证据：`tmp_round300_notifications_real.png`
```

- [x] **Step 4: 把本轮边界继续写死，避免夸大完成度**

```md
- 本轮已经能确认：社区深层页中的 `活动动态` 与 `通知消息` 两条真机链路，主标签栏误露出问题已完成截图级终态闭环
- 本轮还不能外推成 `社区搜索 / 帖子详情 / 发帖 / 关注 / 粉丝` 等所有社区深层页都自动完成验收
- 本轮继续保持：
  - 顶部标题、返回按钮、操作区完整露出
  - 返回按钮统一使用淡蓝色方形带箭头样式
  - 网络问题继续使用项目内统一优美样式弹窗，不回退默认安卓弹窗
  - 不再处理用户已明确排除的底部调试黑框
```

### Task 24: 收口社区搜索真实入口与创建帖子原生弹窗

**Files:**
- Modify: `src/components/search/MultiModalSearch.js`
- Modify: `src/screens/community/CreatePostScreen.js`
- Modify: `src/screens/community/CommunitySearchScreen.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 先纠正社区搜索真实入口，避免继续修错页面**

```md
- 真机重新从 `社区` 首页点击搜索框后，实际弹出的不是先前猜测的 `CommunitySearchScreen`，而是 `UnifiedSearchBar` 打开的 `MultiModalSearch` 全屏模态
- 因此这轮必须把“搜索真实入口”写进文档，避免把 `CommunitySearchScreen` 的局部调整误记成主命中修复
- 同时继续坚持既有验收口径：
  - 顶部完整露出，不能被平板状态栏遮挡
  - 返回按钮统一使用项目内已有淡蓝色方形带箭头样式
  - 布局合理，不出现异常留白
  - 网络或校验失败继续只使用项目内统一优美样式弹窗
```

- [x] **Step 2: 在真实搜索入口补齐统一头部与首屏说明**

```md
- 在 `src/components/search/MultiModalSearch.js` 为社区搜索范围补入统一头部元信息：
  - 标题：`社区搜索`
  - 副标题：`搜索帖子、用户和标签`
  - 右侧 scope badge：`社区`
- 将真实搜索模态的返回入口统一替换为淡蓝色方形返回按钮
- 增加首屏 helper 卡片，收口“页面过空、看起来偏原始”的问题，但不去重做已经成熟的输入区和模式切换区
- `CommunitySearchScreen.js` 保留同步风格补齐，但文档中明确注明：本轮真机主命中入口不是它
```

- [x] **Step 3: 把创建帖子页的原生 `Alert` 改成统一自绘弹窗，并做最小布局收口**

```md
- 在 `src/screens/community/CreatePostScreen.js` 用页面内 `dialogState + Modal` 替换原生 `Alert.alert`
- 覆盖真实使用链路中的以下场景：
  - 选封面失败
  - 选附件失败
  - 附件超过 10MB
  - 标题为空
  - 内容为空
  - 发布成功
  - 发布失败
- 同时只做最小幅度布局收口：
  - 顶部按安全区补齐，保证标题、返回按钮和发布按钮完整露出
  - 页头内边距微调
  - 滚动区底部留白轻微上收
  - 内容输入框最小高度轻微收口
- 目标是不破坏当前成熟结构，只把仍显原始或不统一的部分收掉
```

- [x] **Step 4: 用真机把“搜索真实入口”和“发帖统一弹窗”都补成截图级证据**

```md
- 路径一：`首页 -> 社区 -> 搜索框`
  - 真机已确认真实命中入口为 `MultiModalSearch`
  - 顶部淡蓝色方形返回按钮、标题“社区搜索”、副标题“搜索帖子、用户和标签”与右侧 `社区` badge 已完整露出
  - helper 卡片已出现，首屏不再像之前那样过空、过原始
  - 证据：`.local/android-mcp-server/round302_search_modal.png/.xml`

- 路径二：`首页 -> 社区 -> 发布 -> 直接点发布`
  - 真机已确认 `创建帖子` 页顶部完整露出，返回按钮已统一为淡蓝色方形样式
  - 空提交后出现的是页面内统一自绘弹窗，文案为“发布失败 / 请输入帖子标题 / 知道了”
  - XML 中未命中系统原生 `AlertDialog` 结构，可与原生安卓弹窗区分
  - 证据：`.local/android-mcp-server/round302_create_post.png/.xml`、`.local/android-mcp-server/round302_create_post_empty_submit.png/.xml`
```

- [x] **Step 5: 把本轮边界继续写实，避免错误外推**

```md
- 本轮可以明确确认：
  - 社区搜索真实入口是 `MultiModalSearch`，不是先前假设的 `CommunitySearchScreen`
  - 创建帖子页的空校验失败链路已不再回退到原生安卓弹窗
- 本轮仍不能外推成：
  - `帖子详情 / 关注 / 粉丝` 等剩余社区深层页已经全部完成验收
  - `CommunitySearchScreen` 在所有链路里都不再可能被命中
- 后续仍需继续逐页复测社区剩余深层链路，同时保持：
  - 顶部完整露出
  - 返回按钮统一
  - 布局无异常留白
  - 网络与失败反馈继续使用项目内统一优美样式弹窗
  - 不把用户已明确排除的底部调试黑框重新记成产品缺陷
```
### Task 25: 补齐社区剩余深层页验证入口并统一粉丝关注页头

**Files:**
- Modify: `src/screens/community/CommunityScreen.js`
- Modify: `src/screens/community/FollowersScreen.js`
- Modify: `src/screens/community/FollowingScreen.js`
- Modify: `src/services/api/communityApi.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 在社区空态补一个仅开发态可见的剩余深层页验证入口**

```md
- 入口位置：`社区` 首页空态卡片内
- 命中目标：`帖子详情 / 粉丝列表 / 关注列表`
- 限制条件：仅 `__DEV__` 显示，不作为正式用户链路改版
- 目标：让平板真机能稳定命中剩余社区深层页，不再因首页空态而卡住验收
```

- [x] **Step 2: 将粉丝 / 关注页头统一到现有深层页规范**

```md
- 返回按钮统一使用淡蓝色方形带箭头样式
- 顶部必须完整露出，继续按平板状态栏安全区计算
- 页头说明只补明显原始区域，不重做成熟列表卡片
- 深层页进入后不应露出主标签栏
```

- [x] **Step 3: 修复社区关注链路阻断真机验收的接口运行时错误**

```md
- 真机问题：进入 `粉丝列表 / 关注列表` 后出现 `config.url.includes is not a function`
- 根因：`communityApi` 把函数型端点 `FOLLOW / FOLLOWERS / FOLLOWING` 当作字符串直接传给 `axios`
- 做法：改回正确函数调用，恢复这三条请求的真实 URL
```

- [x] **Step 4: 真机补证据时继续写清边界，不把单点结果外推成全社区完成**

```md
- `社区` 空态页：已出现开发态验证面板，说明剩余深层页的真机可达性已补齐
- `帖子详情`：当前示例 `postId=1` 命中“帖子不存在或已被删除”，只说明入口已打通，不能记成详情页功能完成
- `粉丝列表 / 关注列表`：页头、返回按钮、安全区、布局和主标签栏隐藏必须单独以真机截图验收
- 接口修复后若仍离线，应继续只出现项目内统一优美样式网络弹窗，不回退原生安卓弹窗
```

### Task 26: 收口帖子详情开发态入口的真实帖子解析与顶部安全区

**Files:**
- Modify: `src/screens/community/CommunityScreen.js`
- Modify: `src/screens/community/PostDetailScreen.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 让开发态“帖子详情”入口优先命中真实帖子，而不是继续写死 `postId=1`**

```md
- 优先顺序：
  1. 当前 Redux `posts` 列表里的第一条真实帖子
  2. 本地 `community_posts` 缓存中的第一条真实帖子
  3. 最后才退回开发态默认 ID
- 约束：仅服务开发态联调验收，不改正式用户链路
```

- [x] **Step 2: 帖子详情页头继续补平板顶部安全区**

```md
- 目标：即使后续命中真实帖子内容态，顶部标题、返回按钮和右侧操作区也不能被平板状态栏遮挡
- 约束：只补 `useSafeAreaInsets()` 的顶部兜底，不重做成熟内容区
```

- [x] **Step 3: 真机复测时把联调噪声和产品问题分开记录**

```md
- 若重装后短时出现 `Loading from localhost:8081...`、纯白根视图或空白首屏，单独记为联调环境噪声，不误写成社区页面缺陷
- 若离线且无真实帖子缓存，帖子详情入口当前允许落到统一优美样式网络弹窗，但不能回退原生安卓弹窗
- 若开发态解析失败，不应再把控制台级调试信息以底部原始提示条暴露给验收页面
```

- [x] **Step 4: 边界继续写实，不能夸大为“帖子详情已完成”**

```md
- 本轮代码已把入口稳定性往前推进，但离线无缓存时仍可能只验证到失败态/统一网络弹窗态
- 只有在真机命中真实帖子内容并确认顶部完整露出、返回按钮统一、主标签栏不回流后，才能把帖子详情记成完成
```

### Task 27: 复测帖子详情离线失败终态并固化文档边界

**Files:**
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 在稳定真机页面态下重新走社区空态到开发态帖子详情入口**

```md
- 验证路径：`首页 -> 社区 -> 空态开发联调验证面板 -> 帖子详情`
- 目标：补齐上一轮因联调白屏打断而缺失的终态证据
- 约束：不改正式用户路径，不把开发态验证入口误写成正式交互设计
```

- [x] **Step 2: 明确确认离线无缓存时是否仍有底部原始调试提示**

```md
- 若只出现项目内统一优美样式网络弹窗，则记为本轮通过项
- 若仍有底部原始调试提示条、黑色开发浮层或控制台文案外露，则继续记为未收口
- 用户已明确排除调试黑框，不再把底部调试黑框当作产品缺陷处理
```

- [x] **Step 3: 继续坚持社区页面顶部安全区与布局边界**

```md
- 社区空态页顶部标题、副标题、搜索框、分类条和开发态验证面板必须完整露出
- 顶部不能被平板状态栏遮挡
- 页面留白要合理；当前空态下的大面积下半屏留白属于内容量不足带来的自然留白，不等同于页头安全区缺陷
```

- [x] **Step 4: 下一步继续只按真实证据推进帖子详情内容态**

```md
- 本轮即使离线失败态已收口，也不能外推成帖子详情页已完成
- 下一步仍需在联网或存在 `community_posts` 缓存的场景下补抓真实内容态
- 只有拿到真实内容页并确认顶部完整露出、返回按钮统一、主标签栏不回流、布局无异常留白，才能关闭帖子详情链路
```

### Task 28: 用最小联调手段恢复社区可测性并补齐帖子详情空态页头

**Files:**
- Modify: `src/screens/community/PostDetailScreen.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 先用 USB 调试链路为真机补齐最小后端可达路径**

```md
- 使用 `adb reverse tcp:8000 tcp:8000`
- 使用 `adb reverse tcp:8081 tcp:8081`
- 目标：让平板访问 `127.0.0.1:8000/8081` 时回到电脑本机，优先避开“热点同网但不可达”的额外变量
- 约束：这只解决转发路径，不代表后端服务或 MongoDB 已经可用
```

- [x] **Step 2: 如实记录后端依赖阻断，不把联调环境问题误写成社区页面缺陷**

```md
- 后端 Python 环境统一使用用户指定的 `D:\anaconda\envs\ZeroIsle`
- 本轮不再继续使用 Docker 作为 MongoDB 恢复方案
- Docker 方案本轮已尝试，但 `mongo:6` 拉取被 Docker Hub 未登录限额阻断
- 结合 `backend/.env` 与既有环境检查记录，当前后端仍指向 `127.0.0.1:27017`，而本机 MongoDB 服务尚未就绪；`manage.py check` 在 `ZeroIsle` 环境下也未形成可用通过结果
- 结论：社区真实内容态若仍不可达，应先记为联调后端依赖阻断，不能误写成“社区 UI 自身失败”
```

- [x] **Step 3: 收口帖子详情空态页头，让空态也遵循统一深层页规范**

```md
- 问题态：`帖子不存在或已被删除` 空态之前会丢掉顶部统一页头，只剩居中的原始大按钮“返回”
- 修复目标：
  - 顶部继续显示“帖子详情”
  - 返回按钮统一为现有淡蓝色方形带箭头
  - 顶部继续按平板安全区露出
- 约束：只修空态页头，不重做成熟详情内容区
```

- [x] **Step 4: 继续保留帖子详情内容态未完成的边界**

```md
- 即使本轮把空态页头和联调转发路径补齐，也不能外推成帖子详情页已完成
- 只有后端依赖恢复、真机拿到真实帖子内容并完成同口径验收后，才能关闭该链路
```

### Task 29: 收口帖子详情空态异常留白并校准 ZeroIsle 环境执行口径

**Files:**
- Modify: `src/screens/community/PostDetailScreen.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 继续收口帖子详情空态布局，只改明显原始的留白**

```md
- 问题态：空态虽然已经恢复统一页头，但主体内容仍整页垂直居中，页头下方留白过大
- 修复目标：
  - 空态内容改为顶部展开
  - 用轻量卡片承载错误图标、文案和返回按钮
  - 不改正常帖子详情内容区
```

- [x] **Step 2: 将 ZeroIsle 后端命令口径按 PowerShell 兼容链路重新校准**

```md
- shell 仍保持工作区要求的 `pwsh`
- 但涉及 ZeroIsle/Conda 环境时，优先记录 PowerShell 5 / Conda 兼容链路，不再把 `pwsh` 下的异常直接当成项目代码问题
- 本轮已确认：
  - `D:\anaconda\Scripts\conda.exe` 在当前线程内直接执行会返回访问拒绝
  - 通过临时 `.ps1` 脚本走 PowerShell 5 调 `D:\anaconda\envs\ZeroIsle\python.exe` 时，`manage.py check` 当前退出码为 `-1073741790`
```

- [x] **Step 3: 继续把环境阻断和产品问题拆开记录**

```md
- 当前不能把 `ZeroIsle` 环境命令失败误记成社区页面缺陷
- 当前也不能据此断言 MongoDB 已是唯一阻断，至少还要继续确认该环境自身依赖和启动链是否完整
- 但 Android 新包安装已成功，可继续推进不依赖后端的真机页面验收
```

### Task 30: 打通平板与电脑后端/生产环境通讯口径

**Files:**
- Modify: `src/config/index.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 先核对当前真实网络状态，不凭印象写结论**

```md
- 电脑热点 IPv4：`192.168.137.1`
- 当前本机仅确认 `8081` 的 Metro 在监听，`8000` 后端尚未监听
- 生产域名 `https://api.zeroislenotes.com/api/v1/` 当前从本机测试仍存在 TLS 握手异常
```

- [x] **Step 2: 给开发包补一个完整 API 地址覆盖口，便于切真实后端**

```md
- 现状：开发环境默认只认 `ZEROISLE_API_HOST / ZEROISLE_API_PORT`，且默认指向 `127.0.0.1:8000`
- 问题：这会把真机开发包锁死在本机回环地址，不利于切到热点局域网地址或真实生产环境域名
- 做法：新增 `ZEROISLE_API_URL`，允许直接覆盖完整 API 基地址
- 目标：后续既可指向 `http://192.168.137.1:8000`，也可切到真实生产域名，而不必改代码多处拼接逻辑
```

- [x] **Step 3: 继续把后端阻断与前端通讯能力分开记录**

```md
- 当前主目标是让平板直连电脑本地后端；生产域名未部署，不是本轮主路径
- 当前生产域名握手异常只作为旁证记录，不应误写成前端 UI 缺陷
- 当前本机 MongoDB 未监听、后端 `8000` 未起，不应误写成平板网络本身有问题
- 当前前端已具备“完整 API 基地址可切换”的能力，后续只需把真实后端服务拉起或填入真实可用生产地址即可继续真机联调
```

### Task 31: 恢复本地后端监听并校准真机联通路径

**Files:**
- Modify: `backend/notes/serializers/annotation.py`
- Modify: `backend/voice_recognition/serializers/transcription.py`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 先把本机后端真正拉起到 0.0.0.0:8000**

```md
- 目标：不要只停在“地址可切换”，而要让电脑本机真正提供可访问 API
- 验证：
  - `Get-NetTCPConnection` 看到 `0.0.0.0:8000`
  - `http://127.0.0.1:8000/health/` 返回 200
```

- [x] **Step 2: 处理阻断 runserver 的导入期 Mongo 查询**

```md
- 根因：部分 serializer 在模块导入阶段直接写 `queryset=Model.objects.all()`，会在 URL include 时立即触发 Mongo 连接
- 做法：把这些关系字段改成延迟绑定，避免在 import 阶段就撞 `127.0.0.1:27017`
- 约束：只收口导入期阻断，不重写业务查询逻辑
```

- [x] **Step 3: 分清“热点直连失败”和“USB reverse 已打通”**

```md
- 真机当前 `wlan0` 地址是 `10.137.128.87/14`，不在电脑热点 `192.168.137.1/24` 网段
- 结论：当前无法把 `192.168.137.1:8000` 不通误记成后端未启动，它首先是“设备未接入电脑热点”
- 同时执行 `adb reverse tcp:8000 tcp:8000` 与 `adb reverse tcp:8081 tcp:8081`
- `adb reverse --list` 已返回：
  - `UsbFfs tcp:8000 tcp:8000`
  - `UsbFfs tcp:8081 tcp:8081`
- 结论：真机到电脑本地后端的 USB 联调链路已恢复，可优先沿这条链路继续页面级联网复测
```

### Task 32: 收口冷启动空白根视图并继续维持本地联通口径

**Files:**
- Modify: `metro.config.js`
- Modify: `src/App.js`
- Modify: `docs/superpowers/plans/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`
- Modify: `docs/全系统优化执行总台账.md`

- [x] **Step 1: 先把“网络未通”和“应用冷启动白屏”彻底拆开**

```md
- 当前本机后端健康页 `http://127.0.0.1:8000/health/` 返回 200
- 真机经 `adb reverse` 访问 `127.0.0.1:8000/health/` 与 `127.0.0.1:8081/status` 也都返回 200
- 结论：本轮主阻断已不再是“电脑和平板后端不通”，而是 APP 冷启动后根视图空白，无法继续逐模块真机操作
```

- [x] **Step 2: 先收口 Metro 对工作区巨量临时证据文件的误扫描**

```md
- 现象：`/status` 正常，但请求 `index.bundle?platform=android` 会长期卡住
- 排查：仓库根目录堆积了大量 `tmp_*.png/xml`、`dump_*.xml`、followup 证据图和文档目录
- 根因：`metro.config.js` 里原先 `blockList` 主要按相对路径写正则，Metro 实际遍历的是绝对路径，导致排除规则失效
- 修复：
  - 让目录级排除规则改按绝对路径命中
  - 额外屏蔽 `tmp_*/dump_*` 这类真机证据文件
- 目标：避免 Metro/Bundle 阶段被大量无关文件拖慢，继续污染真机启动判定
```

- [x] **Step 3: 给启动屏补初始化兜底放行，避免再次卡死在空白根视图**

```md
- 现象：日志显示 Redux store / Persist / Realm 已开始运行，但真机 UI 树仍只有空的 `FrameLayout`
- 风险：即使 JS 部分已起来，只要 Splash 完成回调或初始化门禁某一步没顺利落到 `setIsAppReady(true)`，真机就会继续表现为空白
- 修复：
  - 在 `src/App.js` 给初始化流程加单次防重入
  - 增加 `SplashScreen` 超时兜底触发初始化
- 约束：只补启动门禁兜底，不重做成熟导航结构
```

- [ ] **Step 4: 继续确认真正的白屏剩余根因，不把本轮修复外推成启动问题已闭环**

```md
- 当前真机证据仍显示：
  - `ReactNativeJS` 已执行到 store / persist / Realm
  - 但 UIAutomator 抓到的仍是空根视图
- 这说明本轮只是把“网络未通”和“启动空白”拆清，并补了两个低风险收口点
- 下一轮仍要继续查：
  - Splash 动画回调是否在真机上稳定完成
  - 是否有初始化噪声或原生模块把首屏渲染继续拦住
  - 真正进入首页/社区后再继续逐模块联网测试
```

- [x] **Step 5: 把启动阶段导入即副作用和 Metro watcher 硬阻断单独收口**

```md
- 通知服务原先在模块加载时就 `new NotificationService()` 并立即 `initialize()`，会把 Firebase / RNPushNotification / Alarm 权限噪声提前塞进首屏关键路径
- 修复：
  - `src/services/notification/notificationService.js` 改为显式初始化，增加 `initPromise / isInitialized`
  - `src/context/NotificationContext.js` 改为 Provider 挂载后延迟触发通知初始化
- Metro 进一步排查结果：
  - 本地 `react-native bundle` 先前不是普通语法错误，而是 `Failed to start watch mode`
  - 已确认真正控制点是 `resolver.useWatchman`
  - 本轮已把 `metro.config.js` 改为 `useWatchman: false`
  - 同时把排除大体量临时证据文件的逻辑改成更稳的字符串模式，避免 Windows 路径下正则再次炸裂
```

- [ ] **Step 6: 继续验证 Metro/首屏链路是否已经从“秒挂”进入“真实打包/真实渲染”阶段**

```md
- 当前已确认：
  - `require('./metro.config.js')` 可成功加载
  - `Failed to start watch mode` 这条硬错误已不再是当前首个报错
- 但真机冷启动后 UI 树仍可能停在空白根视图
- 下一轮继续：
  - 验证 Metro bundle 是否能在更长时间窗口内产出
  - 验证首页/社区主内容是否终于挂载出来
  - 若仍为空白，再继续拆 `Splash / Notification / Provider / 原生模块` 链路
```

- [x] **Step 7: 复核“本地后端联通 / Metro 可产出 bundle / 真机仍白屏”的分界线**

```md
- 本轮必须把三个判断彻底拆开记录，避免后续又把启动白屏误写成网络问题：
  - 本地 Django 健康检查：`http://127.0.0.1:8000/health/` 持续返回 `200`
  - 真机 USB reverse：`tcp:8000` 与 `tcp:8081` 持续存在
  - Metro 状态：`http://127.0.0.1:8081/status` 返回 `packager-status:running`
- 进一步验证到：
  - Metro 已可直接返回 `index.bundle?platform=android&dev=true&minify=false`
  - 返回头中 `Content-Length` 约 39MB，说明不再停在 `Failed to start watch mode`
  - 真机应用进程 `com.zeroisle_notes` 存活，前台 `MainActivity` 也确已拉起
- 但 UI 树仍是空白根 `FrameLayout`
- 日志出现关键新证据：
  - `ReactRootView: Unable to dispatch touch to JS as the catalyst instance has not been attached`
- 这说明本轮后续排查重点应继续前移到：
  - JS bundle 实例附着链路
  - ReactContext / CatalystInstance 创建与附着过程
  - 是否存在原生包、桥接脚本或开发包装载路径拦截
```

- [ ] **Step 8: 沿 Catalyst / Bundle 注入链路继续拆首屏白屏，而不是回到“网络未通”叙事**

```md
- 下一轮优先动作：
  - 精抓 `ReactInstanceManager / createReactContext / JS bundle attach` 日志
  - 校验是否存在项目自定义原生包或桥接 bundle 装载逻辑影响首屏
  - 若确认是开发包附着链路，再决定是否需要补原生日志、改启动容错或调整 Debug bundle 策略
- 继续约束：
  - 顶部布局、安全区、返回按钮、异常留白等 UI 规范仍要持续遵守并记录
  - 网络问题统一走项目内优美弹窗，不允许回退默认安卓弹窗
  - 成熟页面先不乱动，优先解决当前阻断主流程使用与测试的根问题
```

- [x] **Step 9: 补原生入口日志与 JS 根组件导入兜底，确认白屏不是单纯根组件导入异常**

```md
- 代码收口：
  - `index.js` 改为运行时 `require('./src/App')`，若根组件导入阶段直接抛错，则显示启动诊断兜底页 `RootImportErrorFallback`
  - `android/app/src/main/java/com/zeroisle_notes/MainActivity.java` 增加 `onCreate / getMainComponentName / createReactActivityDelegate` 原生日志
  - `android/app/src/main/java/com/zeroisle_notes/MainApplication.java` 增加 `attachBaseContext / onCreate / getUseDeveloperSupport / getPackages / getJSMainModuleName` 原生日志
- 目标：
  - 先排除“`src/App` 导入阶段直接炸掉”这种会让真机只剩白屏但又缺少可视诊断页的情况
  - 同时补齐原生入口阶段证据，确认 `MainActivity / MainApplication` 是否真的走到了 React 容器创建前后
- 当前边界：
  - 真机仍是空白根视图，且没有看到根组件导入失败兜底页
  - 这进一步支持“问题不只是 JS 根组件同步导入异常”，而是更前面的 RN 容器附着/上下文建立链路
```

- [x] **Step 10: 将 release 验证链路与 debug 白屏主线拆开记录，避免互相污染判断**

```md
- 本轮尝试用 release 包验证“是否仅 debug 装载链路异常”，但被 Gradle/JVM 原生内存崩溃阻断
- 已在 `android/gradle.properties` 收口：
  - `org.gradle.jvmargs` 从更高内存回调为 `-Xmx4096m -XX:MaxMetaspaceSize=1024m ... -XX:HeapBaseMinAddress=2g`
  - 新增 `org.gradle.workers.max=4`
- 目的：
  - 降低 Gradle daemon 在当前机器上的原生内存申请压力，争取先让 `installRelease` 至少能继续向前跑
- 当前边界：
  - release 构建验证仍未打通，`hs_err_pid27812.log` 与 `hs_err_pid30052.log` 说明当前是 Gradle/JVM 原生崩溃，不应误写成业务页面或后端网络问题
  - 因此后续要维持两条主线并行记录：
    1. `debug` 白屏继续沿 `CatalystInstance / ReactContext / attachRootView` 排查
    2. `release` 仅作为构建稳定性旁线，单独收口 Gradle/JVM 崩溃
```

- [x] **Step 11: 确认新 debug 包已真正进入设备，并把系统 ANR 遮挡与应用自身启动链路拆开**

```md
- 已执行：
  - `android\\gradlew.bat :app:installDebug --console=plain`
  - 清空 logcat、强停 APP、重新冷启动后重新抓启动日志
- 新证据表明：
  - `ZeroIsleMainApplication` 与 `ZeroIsleMainActivity` 新增原生日志已经在真机打印
  - 说明本轮加的原生入口诊断代码已经真实进入设备，不再是旧安装包现场
- 同时抓到两条必须拆开的事实：
  1. 设备在 2026-06-07 11:00 左右发生的是 `system_server` 输入分发 ANR，弹出 `进程“system”没有响应`
  2. 重新安装后的新进程 `pid=29128` 里，`MainActivity` 窗口已经建立，但前台仍被系统 `Application Not Responding: system` 弹窗遮挡
- 因此后续排查约束要更新为：
  - 不能再把当前可见界面误判成纯 APP 白屏终态
  - 需要同时记录：
    - 应用自身原生入口是否已走通
    - 系统 ANR 弹窗是否仍在遮挡前台
    - JS 线程是否继续出现 `mqt_js` 慢分发
```

- [x] **Step 12: 收口通知链路底部原始黑条，并把“黑条已消失”与“首屏已恢复”明确拆开**

```md
- 代码收口：
  - `src/services/analytics/analyticsService.js` 补 `export { analyticsService };`
  - `src/App.js` 的开发日志过滤前缀补入通知渠道超时与 `NotificationProvider` 延后初始化失败文案
- 已确认命中的现象：
  - 启动后底部两条开发态黑条已经消失
  - 其中一条根因就是 `analyticsService` 命名导出缺失，导致 `trackError` 调用链拿到 `undefined`
- 但边界必须写清楚：
  - 顶部 `Loading from localhost:8081...` 仍在
  - 系统 `ANR` 弹窗仍在
  - 应用真实前台会落在“搜索”模态页，而不是稳定首页
- 因此后续仍要继续沿：
  - 搜索模态页默认落地根因
  - `mqt_js` 慢分发
  - `Loading from localhost:8081...`
  - 系统 `ANR`
  四条证据并行推进
```

- [x] **Step 13: 用系统弹窗遮挡下的新证据纠偏“搜索模态页已成稳定首屏”的判断**

```md
- 新证据表明：
  - 系统 `ANR` 弹窗反复压回前台时，应用底层稳定基底页可以是首页
  - 因此上一轮抓到的“搜索”模态页还不能直接定义为当前唯一稳定首屏终态
- 本轮低风险动作：
  - 只在 `src/components/search/UnifiedSearchBar.js` 增加开发态诊断日志
  - 记录挂载、显隐变化、请求打开模态的当前路由和时间差
- 后续排查口径更新为：
  - 先判断搜索模态到底是不是无点击自动打开
  - 再判断它与 `mqt_js` 慢分发、`Loading from localhost:8081...`、系统 `ANR` 的时序关系
  - 在拿到更强证据前，不把“搜索模态页默认打开”写成已确认根因
```

- [ ] **Step 14: 用新包与 round283 日志继续确认搜索模态是否会冷启动自动打开**

```md
- 已确认：
  - `android\\gradlew.bat :app:installDebug --console=plain` 必须在 `android` 目录执行，且新 debug 包已成功进入真机
  - `round283_full_logcat.txt` 里继续出现 `mqt_js` 慢分发
  - `round283.png` / `round283_ui.xml` 再次证明系统 `ANR` 弹窗会盖住首页基底
- 本轮新口径：
  - 还没有在冷启动时间窗里抓到 `UnifiedSearchBar` 诊断日志，不能反向脑补成“搜索模态一定自动打开”
  - 在没有 `[UnifiedSearchBar] open modal requested`、`[UnifiedSearchBar] visibility changed` 直接证据前，搜索模态默认打开只能继续作为待证实分支
- 下一步动作：
  - 更早清空 logcat 后立即冷启动再抓更短时间窗
  - 如仍无日志，再手动点击首页搜索栏一次，验证诊断日志链路本身是否工作
  - 若手动点击有日志而冷启动无日志，则把主线进一步收紧为“system ANR 持续遮挡 + `mqt_js` 慢分发”，而不是继续把搜索模态写成首要根因
```

- [ ] **Step 15: 用 round284 第一时间窗证据确认系统弹窗仍是当前首要前台污染源**

```md
- 已执行：
  - 清空 `logcat`
  - 强停 APP
  - 冷启动后等待约 6 秒立即导出 `round284_short_logcat.txt`
  - 同步抓取 `round284.png`、`round284_ui.xml`、窗口栈与 pid
- 当前结论：
  - `round284_ui.xml` 与 `dumpsys window windows` 再次直接命中 `Application Not Responding: system`
  - `round284_short_logcat.txt` 在这一短时间窗里没有搜到 `UnifiedSearchBar` 诊断日志
  - 也没有在当前检索结果里命中新的 `mqt_js` 慢分发文案
  - 因而这一轮更强的直接证据仍是“系统弹窗遮挡前台”，而不是“搜索模态已确认自动打开”
- 后续动作：
  - 继续保留搜索模态为待证实分支
  - 下一步优先在系统弹窗存在时手动点击一次首页搜索栏，验证 `UnifiedSearchBar` 日志链路本身是否能打出来
  - 若手动点击仍无日志，再继续排查日志抓取窗口、过滤条件与开发态日志输出链
```

- [ ] **Step 16: 在 JS console 链路不可信的前提下，补原生日志桥继续验证搜索模态时序**

```md
- 已确认的新边界：
  - 当前 `logcat` 里不仅抓不到 `UnifiedSearchBar`，连 `ReactNativeJS` / 常规 `console.log` 也抓不到
  - 因而“没搜到搜索日志”不能再直接当成业务结论
- 本轮低风险动作：
  - 新增 Android 原生日志桥 `DebugLogModule`
  - 让 `UnifiedSearchBar` 的开发态诊断同时走 JS `console.log` 与 Android `Logcat`
- 真机验证口径：
  - 先确认新包已安装成功
  - 再分别抓：
    - 冷启动 6 秒时间窗
    - 冷启动约 14 秒时间窗
  - 对照搜索模态、空根容器、system ANR 与 `mqt_js` 慢分发的时序
- 后续动作：
  - 若原生日志桥仍没有打出 `UnifiedSearchBar`，就继续验证“搜索模态页上的显式交互”能否触发桥接
  - 在桥接链路被证明有效前，不再把“没搜到搜索日志”写成搜索模态已排除
```

- [ ] **Step 17: 先证实原生日志桥已初始化，再区分“搜索页链路存在”与“桥接调用未落地”**

```md
- 已确认的新边界：
  - `ZeroIsleNotesPackage.createNativeModules` 已在真机启动日志中打印
  - `DebugLogModule` 构造函数与 `getName()` 已在真机启动日志中打印
  - `ReactNativeJS` 在本轮冷启动日志里重新恢复可见，说明不能再继续沿用“JS 日志链路整体不可信”的旧结论
  - 冷启动约 14 秒后前台显示的“搜索”页，已可通过文案与组件检索确认属于 `UnifiedSearchBar -> MultiModalSearch` 这一条链路，而不是另一个独立搜索页面
- 但当前仍未确认：
  - `DebugLogModule.log(...)` 是否真的被 JS 调用
  - `src/native/debugLog.js` 里的一次性 `js-bridge-detected` 探针是否曾实际触发
  - `UnifiedSearchBar.emitDebugLog(...)` 在当前搜索页现场里是否真的被命中
- 本轮验证口径：
  - 先把“原生模块注册成功 / 实例已创建”与“桥接调用已真正执行”分开记录
  - 不再因为搜索页真实出现，就直接推导“搜索模态自动打开根因已确认”
  - 也不再因为 `DebugLogModule` 构造日志已出现，就直接推导“JS 到原生日志桥调用链已经完全打通”
- 下一步动作：
  - 继续给 `debugLog.js` 或搜索页显式交互点补更靠近调用入口的低风险探针
  - 再次真机冷启动并抓 `DebugLogModule: log invoked`、`js-bridge-detected`、`UnifiedSearchBar`
  - 在拿到 `log invoked` 之前，不把搜索模态时序问题写成业务层已定位完成
```

- [ ] **Step 18: 若搜索页已挂载且直连 `NativeModules.DebugLogModule.log(...)` 仍无日志，则把主线转向 RN -> Native 调用链本身**

```md
- 已确认的新边界：
  - `MultiModalSearch` 页面已真实挂载并显示在真机前台
  - 搜索页顶部、输入框、说明卡与统一提示条都能稳定抓到 UI 树
  - 即使在 `MultiModalSearch` 挂载点直接调用 `NativeModules.DebugLogModule.log(...)`，仍没有出现 `DebugLogModule: log invoked`
- 因而当前更准确的技术判断应为：
  - 问题已经不再是“搜索页有没有挂载”
  - 也不再是“`debugLog.js` 封装有没有走到”
  - 而是 React Native JS 到该原生模块方法调用这一层本身还没有被证明打通
- 下一步动作：
  - 优先检查当前 RN 版本下该原生模块导出方式是否存在兼容性问题
  - 继续增加更底层、可直接比对的模块可用性探针
  - 在确认 `DebugLogModule.log(...)` 真的可从 JS 命中前，不再继续猜搜索模态业务根因
```

- [ ] **Step 19: 若 Metro bundle 已确认包含新诊断代码，但 `MultiModalSearch` 更早阶段探针仍完全不打印，则把问题继续前移到运行时装载/执行链**

```md
- 已确认的新边界：
  - 当前本机 Metro 返回的开发 bundle 中，已经真实包含：
    - `[MultiModalSearch] native debug module snapshot`
    - `[MultiModalSearch] direct native debug log call finished`
    - `[MultiModalSearch] DebugLogModule missing at mount`
    - `direct-native-log-from-multimodalsearch`
  - 说明“这次新增诊断代码没有进当前 bundle”已经基本排除
  - 真机冷启动后前台 UI 仍稳定是 `MultiModalSearch` 页面：
    - `action.search.modal.back`
    - `搜索笔记、标签、内容...`
    - `从这里开始搜索`
    - 底部仍会出现统一项目内提示：`通知权限请求超时(5000ms)`
- 本轮进一步前移探针：
  - 在 `src/components/search/MultiModalSearch.js` 增加三个更早阶段日志：
    - `[MultiModalSearch] module evaluated`
    - `[MultiModalSearch] component render start`
    - `[MultiModalSearch] mount effect start`
  - 目的不是改业务，而是区分：
    - 模块是否被求值
    - 组件函数是否被执行
    - `useEffect` 是否真正进入
- round292 新证据必须写实记录：
  - `DebugLogModule` 构造与 `getName()` 继续正常打印
  - `ReactNativeJS` 初始化日志继续正常打印
  - `mqt_js` 慢分发继续存在，典型值约 `2865ms / 2860ms / 2828ms`
  - 但即便如此，`round292_launch_logcat.txt` 里仍完全没有：
    - `[MultiModalSearch] module evaluated`
    - `[MultiModalSearch] component render start`
    - `[MultiModalSearch] mount effect start`
    - `native debug module snapshot`
    - `direct native debug log call finished`
    - `DebugLogModule: log invoked`
    - `js-bridge-detected`
- 因而当前最准确的技术判断继续收紧为：
  - 问题已不再是“后端没通”
  - 也不再是“搜索页没挂载”
  - 甚至不仅仅是“`useEffect` 没执行”
  - 而是当前真机运行时里，`MultiModalSearch` 这份新增诊断代码本身没有被证明真实执行到日志语句
- 下一步动作：
  - 优先核对当前 RN 0.75.5 开发态是否存在旧 bundle / 预加载 bundle / 恢复态代码路径混入
  - 必要时把探针再前移到更稳定的文件级副作用或搜索入口路由层
  - 在出现上述三条更早阶段日志之前，不再继续猜搜索业务根因
```

- [ ] **Step 20: 若 bundle 已含开发态 UI 诊断探针，但 UI 树证据仍不足，则把结论收紧为“执行链未证实且现场受 system ANR 污染”**

```md
- 已确认的新边界：
  - 本机后端与 Metro 联通继续正常，不能再把当前主问题写成“生产域名没部署”或“后端网络错误”：
    - `http://127.0.0.1:8000/health/` 已返回 `200`
    - `http://127.0.0.1:8081/status` 已返回 `200`
    - `adb reverse --list` 持续包含 `tcp:8000` 与 `tcp:8081`
  - `MultiModalSearch` / `UnifiedSearchBar` 新诊断代码已确认进入当前 Metro bundle
  - 真机前台搜索页仍可稳定抓到：
    - `action.search.modal.back`
    - `搜索`
    - `搜索笔记、标签、内容...`
    - `从这里开始搜索`
- round293 必须写实记录：
  - 在 `src/components/search/MultiModalSearch.js` 增加了开发态零尺寸 `View testID` 诊断探针
  - 当前 bundle 已确认包含该探针字符串
  - 但 `round293_launch_ui.xml` 中没有抓到该零尺寸节点
  - 这个结果只能说明“零尺寸节点可能被 UI 树裁掉”，不能反推为“代码一定没有执行”
  - 同轮中 `DebugLogModule` 构造 / `getName()` 与 `ReactNativeJS` 初始化日志继续正常可见，搜索页也仍真实挂载
- round294 必须写实记录：
  - 把探针改成极小透明 `RNText + accessibilityLabel + testID`，并确认 bundle 中已包含 `debug.multimodal.signature.round294...`
  - 但本轮抓取 `round294_launch_ui.xml` 时，前台命中的是系统 `Application Not Responding: system` 弹窗
  - 因而该轮 UI 树证据已经被系统弹窗污染，不能再拿这份 UI 树判断应用内容树里是否出现了诊断标记
  - 同轮 `ReactNativeJS: Running "ZeroIsle_Notes" with {"rootTag":11}` 继续出现，`mqt_js` 慢分发进一步升高到约 `3099ms / 3094ms / 3214ms`
- 因而当前最准确的技术判断必须继续收紧为：
  - 不能再写成后端联通问题
  - 也不能仅凭“UI 树里没看到 round293/294 诊断标记”就认定 `MultiModalSearch` 新代码没有执行
  - 当前现场同时受 `system` ANR 弹窗、`mqt_js` 慢分发、`ReactRootView` 未附着提示污染
  - 搜索页真实挂载已经确定，但 JS -> Native 方法调用链和更细的运行时执行链仍未被证实打通
- 下一步动作：
  - 下一轮优先规避系统 `ANR` 弹窗污染：若再出现弹窗，先在平板上点“等待”，再立即抓 UI 树与 `logcat`
  - 不再继续使用“完全不可见”的开发态探针，改为可被 `uiautomator` 稳定抓到的小型可见文案或标签
  - 在拿到更强证据前，不把当前问题写成网络故障，也不把搜索业务根因写成已完成定位
```

- [ ] **Step 21: 若可见 UI 探针仍未进入内容树，且冷启动前台落到空白根容器，则把主线继续收紧为 RN 附着前白屏**

```md
- 已确认的新边界：
  - 本机后端与 Metro 联通继续正常：
    - `http://127.0.0.1:8000/health/` 返回 `200`
    - `http://127.0.0.1:8081/status` 返回 `200`
    - `adb -s HGR3Y9MA reverse --list` 继续包含 `tcp:8000` 与 `tcp:8081`
  - 真机 `HGR3Y9MA` 上重新安装 debug 包成功
- 本轮诊断动作：
  - 将 `src/components/search/MultiModalSearch.js` 中的 round294 极小透明文本探针升级为 round295 可见小标签：
    - `View + accessibilityLabel + testID`
    - 标签文案包含 `scope / module / log` 三个关键信息
  - 目的不是改业务 UI，而是让 `uiautomator` 在应用内容树真实挂载时一定能抓到该探针
- round295 必须写实记录：
  - 冷启动约 8 秒后抓到的 [round295_launch_ui.xml](D:/ZeroIsle_Notes/.codex-tmp/round295_launch_ui.xml) 不是搜索页，也不是 `system ANR` 弹窗，而是 `com.zeroisle_notes` 自身空白根容器
  - [round295_launch.png](D:/ZeroIsle_Notes/.codex-tmp/round295_launch.png) 同步呈现整屏白底，仅残留右侧浮动铅笔按钮与顶部指示点
  - UI 树中没有出现 round295 可见探针，也没有出现：
    - `action.search.modal.back`
    - `搜索笔记、标签、内容...`
  - [round295_launch_logcat.txt](D:/ZeroIsle_Notes/.codex-tmp/round295_launch_logcat.txt) 中继续出现：
    - `ZeroIsleNotesPackage: createNativeModules: start/success`
    - `DebugLogModule: constructor: initialized`
    - `DebugLogModule: getName -> DebugLogModule`
    - 大量 `ReactRootView: Unable to dispatch touch to JS as the catalyst instance has not been attached`
    - 后续 `before the dispatcher is available`
  - 但本轮仍没有出现：
    - `Running "ZeroIsle_Notes" with {"rootTag":11}`
    - `DebugLogModule: log invoked`
    - `js-bridge-detected`
    - `MultiModalSearch` 相关诊断日志
- 因而当前最准确的技术判断必须继续收紧为：
  - 当前主阻断不是网络，也不是“探针又被裁掉了”
  - 在 round295 这一时间窗里，应用内容树本身尚未真正起来，前台先落到了 RN 附着前的空白根容器白屏
  - 原生日志桥模块注册继续正常，但 JS 运行时与内容树挂载尚未被证明完成
  - `system ANR` 仍是并行噪声，但在这一轮里更强主证据已经变成 APP 自身白屏，而不是 system 弹窗
- 下一步动作：
  - 优先继续抓更长时间窗证据，确认白屏之后是否会转入搜索页、首页或 system ANR
  - 必要时把启动附着链继续前移到 `App.js` / 根导航层做最小探针
  - 在 `Running "ZeroIsle_Notes"` 与可见内容树重新出现前，不把问题误写成搜索业务层故障
```

- [ ] **Step 22: 若 `App.js` 根入口探针也未落地，且白屏现场不变，则把主线继续前移到 JS 根层未真正跑起**

```md
- 已确认的新边界：
  - 本轮在 `src/App.js` 增加了只用于开发态诊断的原生日志探针，覆盖：
    - `AppContainer` 首次渲染
    - `beginInitialization(...)`
    - `SplashScreen` 渲染分支
    - `PersistBootstrapGate`
    - `PersistGate.onBeforeLift`
    - `NavigationContainer.onReady`
  - 这些探针统一通过 `debugLog('info' | 'warn' | 'error', 'AppRoot', ...)` 走原生日志桥
- round296 必须写实记录：
  - 新包已成功安装到真机 `HGR3Y9MA`
  - 冷启动约 10 秒后抓到的 [round296_launch_ui.xml](D:/ZeroIsle_Notes/.codex-tmp/round296_launch_ui.xml) 与 [round296_launch.png](D:/ZeroIsle_Notes/.codex-tmp/round296_launch.png) 仍和 round295 一致：
    - 前台仍是 `com.zeroisle_notes` 自身空白根容器
    - 整屏白底，仅残留顶部三个黑点与右侧浮动铅笔按钮
  - [round296_launch_logcat.txt](D:/ZeroIsle_Notes/.codex-tmp/round296_launch_logcat.txt) 中继续出现：
    - `ZeroIsleNotesPackage: createNativeModules: start/success`
    - `DebugLogModule: constructor: initialized`
    - `DebugLogModule: getName -> DebugLogModule`
    - 大量 `ReactRootView: Unable to dispatch touch to JS as the catalyst instance has not been attached`
    - 后续 `before the dispatcher is available`
  - 但这轮仍完全没有出现：
    - 任何 `AppRoot` 探针日志
    - `PersistGate` / `PersistBootstrapGate` 新探针日志
    - `NavigationContainer` 新探针日志
    - `Running "ZeroIsle_Notes" with {"rootTag":11}`
    - `DebugLogModule: log invoked`
    - `js-bridge-detected`
- 因而当前最准确的技术判断必须继续收紧为：
  - 当前主阻断已经不只是搜索页、导航层或持久化门禁问题
  - 更像是 `src/App.js` 这一层 JS 根组件尚未真正跑起，或尚未进入可执行到探针的阶段
  - 原生日志桥模块注册仍正常，但 JS 根层、内容树挂载与后续导航都还未被证实启动
- 下一步动作：
  - 优先继续核对 `index.js -> AppRegistry.registerComponent -> require('./src/App')` 这条链上是否存在更前置的执行中断
  - 必要时把探针继续前移到 `index.js` 导入边界或更原始的注册链路
  - 在 `AppRoot` 或 `Running "ZeroIsle_Notes"` 任一根层日志重新出现前，不把问题误写成业务页面故障
```

- [ ] **Step 23: 以“同一调试包下启动链时序不稳定”为新主线，继续用真机冷启动三件套收口，而不再把问题误写成固定的 JS 根入口未启动**

```md
- 已确认的新边界：
  - round297 的干净冷启动日志已经推翻了“`index.js/AppRegistry` 还没跑到”的旧判断：
    - `ReactNativeJS: ZeroIsle_Notes 应用已成功注册`
    - `Running "ZeroIsle_Notes" with {"rootTag":11}`
    - `ZeroIsle_Notes 根组件导入成功`
    - `DebugLogModule: log invoked`
    - `AppRoot: {"event":"persist-gate-loading-render"}`
    - `AppRoot: {"event":"persist-gate-before-lift"}`
    - `AppRoot: {"event":"persist-bootstrap-marked-ready"...}`
  - 这说明：
    - `index.js -> AppRegistry.registerComponent -> require('./src/App')`
    - 原生日志桥初始化
    - `PersistGate / PersistBootstrapGate`
    - 都已经在真机上真实跑通过
- round297 仍必须写实记录的矛盾现场：
  - [round297_launch_ui.xml](D:/ZeroIsle_Notes/.codex-tmp/round297_launch_ui.xml) 与 [round297_launch.png](D:/ZeroIsle_Notes/.codex-tmp/round297_launch.png) 继续呈现 `android:id/content` 下空 `FrameLayout`
  - 这轮前台不是权限弹窗，也不是业务页异常，而是“JS 链已明显启动，但前台内容树仍停留空白根容器”
  - 因此主线判断必须从“根入口根本没跑”收紧为“同一调试包下启动时序存在不稳定分叉”
- 本轮为避免继续在 Provider 链上盲猜，已在 [src/App.js](D:/ZeroIsle_Notes/src/App.js) 加入最小 `DebugRenderProbe`：
  - `provider-store`
  - `provider-persist-bootstrap-gate`
  - `provider-persist-gate-child`
  - `provider-safe-area`
  - `provider-theme`
  - `provider-font-size`
  - `provider-accessibility`
  - `provider-realm`
  - `provider-notification`
  - `provider-gesture-handler`
  - 目的不是改结构，而是继续确认空白现场是否卡在某一层 Provider 之前
- round298 必须写实记录的新转折：
  - 新包再次成功安装到真机 `HGR3Y9MA`
  - [round298_launch_logcat.txt](D:/ZeroIsle_Notes/.codex-tmp/round298_launch_logcat.txt) 已出现：
    - `AppRoot: {"event":"initialization-begin","trigger":"splashTimeoutFallback"}`
    - `AppRoot: {"event":"app-container-render-start"}`
    - `AppRoot: {"event":"rendering-splash-screen"...}`
    - `AppRoot: {"event":"initialization-result","success":true,...}`
    - `AppRoot: {"event":"app-ready","trigger":"splashTimeoutFallback"}`
    - `AppRoot: {"event":"navigation-container-ready"}`
  - [round298_launch_ui.xml](D:/ZeroIsle_Notes/.codex-tmp/round298_launch_ui.xml) 已不再是空白根容器，而是成功进入真实搜索页，能稳定看到：
    - 淡蓝色方形返回按钮
    - `搜索`
    - `输入关键词快速查找内容`
    - `搜索笔记、标签、内容...`
    - 以及 round295 的可见诊断标签
  - 这说明白屏主线继续前移后，新的准确说法不再是“应用固定卡死在 JS 根入口前”，而是“真机冷启动在同一调试包下存在可恢复的时序波动”
- 下一步动作：
- 继续沿“真机冷启动时序不稳定”而不是“固定根入口未启动”去收口
- 每轮仍先抓 `logcat + UI 树 + 截图` 三件套，再判断是空白根容器、搜索页、首页还是其他页面
- 在启动链稳定前，不把这轮恢复到搜索页误写成“问题已彻底解决”
- 后续回到功能模块测试时，继续遵守既有 UI 规范：
  - 顶部不得被平板状态栏遮挡
  - 各页返回按钮继续统一使用现有淡蓝色方形箭头
  - 不合理留白继续逐页记录
  - 网络问题继续统一用项目内优美弹窗，不回退到默认安卓弹窗
```

- [ ] **Step 24: 以搜索模态返回链路为例，继续落实“页头返回 + 系统返回 + Modal 关闭”三口一致的真机验收标准**

```md
- round300 新确认的问题边界：
  - 搜索模态页里，页头淡蓝色返回按钮与系统返回都必须走同一条关闭链路
  - 不能只验证其中一个入口恢复，就把整个搜索返回链路写成已完成
- 本轮代码最小修复口径：
  - 在 `src/components/search/UnifiedSearchBar.js` 新增统一的 `closeSearchModal(reason, shouldNotifyCancel)`
  - `Modal.onRequestClose`、`MultiModalSearch.onCancel` 和 `hardwareBackPress` 统一收口到同一函数
  - 只修搜索模态关闭链，不改首页、社区、设置、个人页等成熟 UI
- round300 真机验收必须写实记录：
  - [round300_current_for_backcheck.xml](D:/ZeroIsle_Notes/.codex-tmp/round300_current_for_backcheck.xml) 先确认前台仍是搜索模态页，包含：
    - `action.search.modal.back`
    - `搜索`
    - `搜索笔记、标签、内容...`
  - 点击页头淡蓝色返回按钮后，[round300_after_header_back.xml](D:/ZeroIsle_Notes/.codex-tmp/round300_after_header_back.xml) 必须回到首页：
    - `screen.home`
    - `零屿笔记`
    - 首页搜索栏、分类、排序与底部 Tab 重新可见
  - 再次进入搜索模态后，按系统返回，[round300_after_keyback_recheck.xml](D:/ZeroIsle_Notes/.codex-tmp/round300_after_keyback_recheck.xml) 也必须回到首页
- 本轮写文档时必须继续保留的约束：
  - 搜索页顶部、返回按钮和说明区不得被平板状态栏遮挡
  - 返回按钮仍统一使用现有淡蓝色方形箭头，不另起新样式
  - 网络问题仍统一走项目内优美弹窗；若出现系统通知权限弹窗，应单列记为系统权限流程，不误写成业务页原生弹窗回退
  - 不把这次搜索返回修复外推成全站返回链路已全部完成，后续各模块仍要逐页继续验收
```

- [ ] **Step 25: 继续逐页收口社区关注/粉丝列表空态异常留白，保持顶部安全区与返回按钮统一**

```md
- round301 新确认的问题边界：
  - 社区首页与帖子详情子页当前真机复核下，顶部标题、说明区与淡蓝色方形返回按钮都处在安全区内，没有新的状态栏遮挡问题
  - 但 `粉丝列表` 空态在平板上被整屏垂直居中压到中下部，页头下方形成明显异常留白，观感很原始
  - `关注列表` 使用了同类空态布局模式，因此需要一并收口，避免两个深层页风格继续分叉
- 本轮代码最小修复口径：
  - 只修改 `src/screens/community/FollowersScreen.js` 与 `src/screens/community/FollowingScreen.js`
  - 去掉空态列表容器的整屏垂直居中
  - 将空态内容调整为页头下方更合理的上对齐展示，并补 `paddingTop: 72` 与 `paddingBottom: 24`
  - 不改顶部壳层、返回按钮、数据逻辑、刷新逻辑、普通列表项和成熟社区首页样式
- round301 真机验收必须写实记录：
  - [round301_community.xml](D:/ZeroIsle_Notes/.codex-tmp/round301_community.xml) 先确认社区首页当前前台正常，包含：
    - `state.community.pageState.empty`
    - 顶部 `社区` 标题、副标题、搜索条、分类条
    - 右下角 `发布` 按钮
  - [round301_community_postdetail.xml](D:/ZeroIsle_Notes/.codex-tmp/round301_community_postdetail.xml) 复核帖子详情子页顶部仍完整露出，包含：
    - `action.community.postDetail.back`
    - `帖子详情`
    - `state.community.postDetail.empty`
  - 修复前的 [round301_community_followers.xml](D:/ZeroIsle_Notes/.codex-tmp/round301_community_followers.xml) 必须保留：
    - `screen.community.followers`
    - `action.community.followers.back`
    - `粉丝列表`
    - 空态 `state.community.followers.empty` bounds 为 `[21,964][1179,1199]`，证明空态被压到页面中下部
  - 修复后的 [round301_followers_after_fix.xml](D:/ZeroIsle_Notes/.codex-tmp/round301_followers_after_fix.xml) 与 [round301_followers_after_fix.png](D:/ZeroIsle_Notes/.codex-tmp/round301_followers_after_fix.png) 必须体现：
    - `screen.community.followers`
    - 空态 `state.community.followers.empty` bounds 变为 `[21,320][1179,555]`
    - 说明异常留白已明显收下
  - 修复后的 [round301_community_following_after_fix.xml](D:/ZeroIsle_Notes/.codex-tmp/round301_community_following_after_fix.xml) 与 [round301_community_following_after_fix.png](D:/ZeroIsle_Notes/.codex-tmp/round301_community_following_after_fix.png) 必须体现：
    - `screen.community.following`
    - `action.community.following.back`
    - `关注列表`
    - 空态 `state.community.following.empty` bounds 为 `[21,320][1179,555]`
- 本轮写文档时必须继续保留的约束：
  - 顶部不得被平板状态栏遮挡，社区首页、帖子详情、粉丝列表、关注列表都要继续逐页验收
  - 返回按钮仍统一使用现有淡蓝色方形箭头，不另起新样式
  - 不合理留白继续逐页记录，本轮只收口 `粉丝列表 / 关注列表` 空态，不把结果外推成社区全链路都已完成
  - 网络问题仍统一走项目内优美弹窗，不回退到默认安卓弹窗
```

- [ ] **Step 26: 继续逐页收口社区活动与通知空态异常留白，补强社区深层页返回链路验收**

```md
- round302 新确认的问题边界：
  - `关注列表` 当前系统返回已可正确回到社区首页，说明上一轮修复后该返回链路在真机上仍然稳定
  - 但 `活动动态` 与 `通知消息` 的空态在平板上仍被整屏垂直居中压到中下部，页头下方留白非常大，和上一轮 `粉丝列表 / 关注列表` 是同类漏口
  - 这轮要继续只修 `活动动态 / 通知消息` 的空态容器，不去动社区首页、搜索条、分类条、发布按钮和成熟页头结构
- 本轮代码最小修复口径：
  - 只修改 `src/screens/community/ActivityScreen.js` 与 `src/screens/community/NotificationsScreen.js`
  - 去掉空态列表容器的整屏垂直居中
  - 将空态内容调整为页头下方更合理的上对齐展示，并补 `paddingTop: 72` 与 `paddingBottom: 24`
  - 不改顶部壳层、淡蓝色方形返回按钮、刷新逻辑、列表项逻辑和通知“全部标记已读”行为
- round302 真机验收必须写实记录：
  - [round302_after_following_keyback_full.xml](D:/ZeroIsle_Notes/.codex-tmp/round302_after_following_keyback_full.xml) 先确认：
    - 系统返回从 `关注列表` 已回到社区首页
    - 前台包含 `state.community.pageState.error`
    - 顶部 `社区` 标题、副标题、`action.community.notifications`、`action.community.activity` 完整露出
  - 修复前的 [round302_activity.xml](D:/ZeroIsle_Notes/.codex-tmp/round302_activity.xml) 与 [round302_activity.png](D:/ZeroIsle_Notes/.codex-tmp/round302_activity.png) 必须保留：
    - `screen.community.activity`
    - `action.community.activity.back`
    - `活动动态`
    - 空态 `state.community.activity.empty` bounds 为 `[21,978][1179,1213]`
  - 修复前的 [round302_notifications.xml](D:/ZeroIsle_Notes/.codex-tmp/round302_notifications.xml) 与 [round302_notifications.png](D:/ZeroIsle_Notes/.codex-tmp/round302_notifications.png) 必须保留：
    - `screen.community.notifications`
    - `action.community.notifications.back`
    - `通知消息`
    - 空态 `state.community.notifications.empty` bounds 为 `[21,974][1179,1209]`
  - 修复后的 [round302_activity_after_fix.xml](D:/ZeroIsle_Notes/.codex-tmp/round302_activity_after_fix.xml) 与 [round302_activity_after_fix.png](D:/ZeroIsle_Notes/.codex-tmp/round302_activity_after_fix.png) 必须体现：
    - `screen.community.activity`
    - 空态 `state.community.activity.empty` bounds 变为 `[21,348][1179,583]`
  - 修复后的 [round302_notifications_after_fix_stable.xml](D:/ZeroIsle_Notes/.codex-tmp/round302_notifications_after_fix_stable.xml) 与 [round302_notifications_after_fix_stable.png](D:/ZeroIsle_Notes/.codex-tmp/round302_notifications_after_fix_stable.png) 必须体现：
    - `screen.community.notifications`
    - `action.community.notifications.back`
    - 空态 `state.community.notifications.empty` bounds 变为 `[21,340][1179,575]`
- 本轮写文档时必须继续保留的约束：
  - 顶部不得被平板状态栏遮挡，社区首页、活动动态、通知消息都要继续逐页验收
  - 返回按钮仍统一使用现有淡蓝色方形箭头，不另起新样式
  - 不合理留白继续逐页记录，本轮只收口 `活动动态 / 通知消息` 空态，不把结果外推成社区全链路都已完成
  - 网络问题仍统一走项目内优美弹窗，不回退到默认安卓弹窗
```

- [ ] **Step 27: 继续补齐社区活动与通知返回链路真机回归，确认页头返回与系统返回都稳定回到社区首页**

```md
- round303 新确认的问题边界：
  - 在 `round302` 收口空态留白后，本轮优先补社区深层页的返回链路真机回归，不急着再改代码
  - 重点验收 `通知消息` 与 `活动动态` 的系统返回，以及 `通知消息` 的页头淡蓝色方形返回按钮
  - 如果返回链路已稳定，就不为了“凑修改”去动成熟页面
- round303 真机验收必须写实记录：
  - [round303_current.xml](D:/ZeroIsle_Notes/.codex-tmp/round303_current.xml) 与 [round303_current.png](D:/ZeroIsle_Notes/.codex-tmp/round303_current.png) 先确认前台起点是：
    - `screen.community.notifications`
    - `通知消息`
    - `action.community.notifications.back`
  - 从 `通知消息` 按系统返回后，[round303_after_notifications_keyback.xml](D:/ZeroIsle_Notes/.codex-tmp/round303_after_notifications_keyback.xml) 与 [round303_after_notifications_keyback.png](D:/ZeroIsle_Notes/.codex-tmp/round303_after_notifications_keyback.png) 必须体现：
    - 已回到社区首页
    - 前台包含 `state.community.pageState.error`
    - 顶部 `社区` 标题、副标题、`action.community.notifications`、`action.community.activity` 完整露出
  - 再次进入 `活动动态` 后，[round303_activity_recheck.xml](D:/ZeroIsle_Notes/.codex-tmp/round303_activity_recheck.xml) 与 [round303_activity_recheck.png](D:/ZeroIsle_Notes/.codex-tmp/round303_activity_recheck.png) 必须确认：
    - `screen.community.activity`
    - `活动动态`
    - `action.community.activity.back`
    - 修后的空态仍保持在合理上方区域
  - 从 `活动动态` 按系统返回后，[round303_after_activity_keyback.xml](D:/ZeroIsle_Notes/.codex-tmp/round303_after_activity_keyback.xml) 与 [round303_after_activity_keyback.png](D:/ZeroIsle_Notes/.codex-tmp/round303_after_activity_keyback.png) 必须体现：
    - 已回到社区首页
    - 前台仍包含 `state.community.pageState.error`
    - 社区首页页头和两个入口按钮完整露出
  - 再次进入 `通知消息` 后，[round303_notifications_reenter.xml](D:/ZeroIsle_Notes/.codex-tmp/round303_notifications_reenter.xml) 与 [round303_notifications_reenter.png](D:/ZeroIsle_Notes/.codex-tmp/round303_notifications_reenter.png) 必须确认：
    - `screen.community.notifications`
    - `通知消息`
    - `action.community.notifications.back`
  - 点击页头淡蓝色返回按钮后，[round303_after_notifications_header_back.xml](D:/ZeroIsle_Notes/.codex-tmp/round303_after_notifications_header_back.xml) 与 [round303_after_notifications_header_back.png](D:/ZeroIsle_Notes/.codex-tmp/round303_after_notifications_header_back.png) 必须体现：
    - 已回到社区首页
    - 前台包含 `state.community.pageState.error`
    - 社区首页顶部元素和页头按钮完整露出
- 本轮写文档时必须继续保留的约束：
  - 顶部不得被平板状态栏遮挡，社区首页、活动动态、通知消息都要继续逐页验收
  - 返回按钮仍统一使用现有淡蓝色方形箭头，不另起新样式
  - 不把本轮返回链路通过外推成社区全链路都已完成，后续仍要继续测其他深层页与错误态
  - 网络问题仍统一走项目内优美弹窗，不回退到默认安卓弹窗
```

- [ ] **Step 28: 继续补齐社区帖子详情与创建帖子真实链路回归，确认统一弹窗和页头返回都稳定**

```md
- round304 新确认的问题边界：
  - 在 `round303` 把 `活动动态 / 通知消息` 返回链路补齐后，社区剩余高频深层页里，仍缺少 `帖子详情` 与 `创建帖子` 的完整真机链路证据
  - 这轮优先做“可达性 + 统一弹窗 + 返回链路”验收，不为了凑修改去重构成熟社区首页
  - 如果 `创建帖子` 空提交仍走项目内统一优美样式弹窗，且 `帖子详情 / 创建帖子` 的页头返回都能稳定回到社区首页，本轮就只更新文档，不强行改代码
- round304 真机验收必须写实记录：
  - [round304_community_home.xml](D:/ZeroIsle_Notes/.codex-tmp/round304_community_home.xml) 先确认社区首页前台包含：
    - `state.community.pageState.error`
    - `action.community.createPost`
    - `action.community.devQa.postDetail`
    - `action.community.notifications`
    - `action.community.activity`
  - 从开发态入口进入 `帖子详情` 后，[round304_postdetail_entry.xml](D:/ZeroIsle_Notes/.codex-tmp/round304_postdetail_entry.xml) 必须体现：
    - `state.community.postDetail.empty`
    - `帖子详情`
    - `action.community.postDetail.back`
    - `帖子不存在或已被删除`
  - 点击 `帖子详情` 页头淡蓝色返回按钮后，[round304_after_postdetail_back.xml](D:/ZeroIsle_Notes/.codex-tmp/round304_after_postdetail_back.xml) 必须体现：
    - 已回到社区首页
    - 前台包含 `state.community.pageState.error`
    - `action.community.devQa.postDetail`
    - `action.community.createPost`
  - 进入 `创建帖子` 后，[round304_createpost_entry.xml](D:/ZeroIsle_Notes/.codex-tmp/round304_createpost_entry.xml) 必须确认：
    - `action.community.backFromCreatePost`
    - `action.community.publishPost`
    - `帖子标题`
    - 顶部返回按钮、标题和右上角发布按钮完整露出
  - 在 `创建帖子` 空提交后，[round304_createpost_empty_submit.xml](D:/ZeroIsle_Notes/.codex-tmp/round304_createpost_empty_submit.xml) 必须体现：
    - `发布失败`
    - `请输入帖子标题`
    - `知道了`
    - 且不能出现 `android:id/alertTitle` 或 `AlertDialog`
  - 关闭统一弹窗后，[round304_createpost_after_dialog_dismiss.xml](D:/ZeroIsle_Notes/.codex-tmp/round304_createpost_after_dialog_dismiss.xml) 必须体现：
    - 已回到 `创建帖子` 页面
    - 仍包含 `action.community.backFromCreatePost`
    - 不再包含 `发布失败`
  - 从 `创建帖子` 页头点击淡蓝色返回按钮后，[round304_after_createpost_back.xml](D:/ZeroIsle_Notes/.codex-tmp/round304_after_createpost_back.xml) 与 [round304_after_createpost_back.png](D:/ZeroIsle_Notes/.codex-tmp/round304_after_createpost_back.png) 必须体现：
    - 已回到社区首页
    - 前台包含 `state.community.pageState.error`
    - `action.community.createPost`
    - `action.community.devQa.postDetail`
    - 社区首页顶部标题、副标题、`action.community.notifications`、`action.community.activity` 完整露出
- 本轮写文档时必须继续保留的约束：
  - 顶部不得被平板状态栏遮挡，社区首页、帖子详情、创建帖子都要继续逐页验收
  - 返回按钮仍统一使用现有淡蓝色方形箭头，不另起新样式
  - 网络问题与失败提示仍统一走项目内优美样式弹窗，不回退到默认安卓弹窗
  - 不把本轮 `帖子详情 / 创建帖子` 的可达性与返回链路通过外推成社区全部深层页都已完成，后续仍要继续测分类选择、附件失败链路和其他真实入口
```

- [ ] **Step 29: 继续补齐创建帖子分类/标签选择器与基础开关链路真机回归，确认空数据态与关闭链路稳定**

```md
- round305 新确认的问题边界：
  - 在 `round304` 补齐 `帖子详情 / 创建帖子` 返回链路后，`创建帖子` 页里仍缺少 `分类选择器 / 标签选择器 / 公开帖子 / 允许评论` 这几类常用交互的真实设备证据
  - 这轮先按“空数据态 + 关闭链路 + 基础开关响应”验收，不贸然把当前 `暂无分类 / 暂无标签` 直接判成代码缺陷
  - 如果弹层是项目内自绘面板、关闭链路稳定、两个开关点击后状态有真实变化，本轮就只更新文档，不强行改成熟结构
- round305 真机验收必须写实记录：
  - [round305_createpost_start.xml](D:/ZeroIsle_Notes/.codex-tmp/round305_createpost_start.xml) 与 [round305_createpost_start.png](D:/ZeroIsle_Notes/.codex-tmp/round305_createpost_start.png) 先确认：
    - 前台仍是 `创建帖子`
    - 存在 `action.community.openCategoryPicker`
    - 存在 `action.community.openTagPicker`
    - 存在 `action.community.togglePublic` 与 `action.community.toggleComments`
    - 顶部返回按钮、标题和右上角发布按钮完整露出
  - 打开分类选择器后，[round305_category_picker_open.xml](D:/ZeroIsle_Notes/.codex-tmp/round305_category_picker_open.xml) 与 [round305_category_picker_open.png](D:/ZeroIsle_Notes/.codex-tmp/round305_category_picker_open.png) 必须体现：
    - 项目内面板 `panel.community.categoryPicker`
    - 标题 `选择分类`
    - 空数据态文案 `暂无分类`
    - 底部关闭按钮 `关闭`
    - 且不能出现 `android:id/alertTitle` 或 `AlertDialog`
  - 关闭分类选择器后，[round305_category_picker_closed.xml](D:/ZeroIsle_Notes/.codex-tmp/round305_category_picker_closed.xml) 与 [round305_category_picker_closed.png](D:/ZeroIsle_Notes/.codex-tmp/round305_category_picker_closed.png) 必须体现：
    - 已回到 `创建帖子` 页面
    - `panel.community.categoryPicker` 已消失
    - `action.community.openCategoryPicker` 与 `action.community.openTagPicker` 再次可见
  - 打开标签选择器后，[round305_tag_picker_open.xml](D:/ZeroIsle_Notes/.codex-tmp/round305_tag_picker_open.xml) 与 [round305_tag_picker_open.png](D:/ZeroIsle_Notes/.codex-tmp/round305_tag_picker_open.png) 必须体现：
    - 项目内面板 `panel.community.tagPicker`
    - 标题 `选择标签`
    - 空数据态文案 `暂无标签`
    - 底部完成按钮 `完成`
    - 且不能出现 `android:id/alertTitle` 或 `AlertDialog`
  - 关闭标签选择器后，[round305_tag_picker_closed.xml](D:/ZeroIsle_Notes/.codex-tmp/round305_tag_picker_closed.xml) 与 [round305_tag_picker_closed.png](D:/ZeroIsle_Notes/.codex-tmp/round305_tag_picker_closed.png) 必须体现：
    - 已回到 `创建帖子` 页面
    - `panel.community.tagPicker` 已消失
    - `action.community.togglePublic` 与 `action.community.toggleComments` 仍可见
  - 点击两个基础开关后，[round305_toggles_after_tap.xml](D:/ZeroIsle_Notes/.codex-tmp/round305_toggles_after_tap.xml) 与 [round305_toggles_after_tap.png](D:/ZeroIsle_Notes/.codex-tmp/round305_toggles_after_tap.png) 必须体现：
    - `action.community.togglePublic` 与 `action.community.toggleComments` 仍然存在
    - 两个开关内部滑块 bounds 相比点击前发生位移，证明状态有实际切换，不是点击无响应
- 本轮写文档时必须继续保留的约束：
  - 顶部不得被平板状态栏遮挡，创建帖子页和两个选择器弹层都要继续逐页验收
  - 返回按钮仍统一使用现有淡蓝色方形箭头，不另起新样式
  - 弹层继续优先使用项目内自绘样式，不回退到默认安卓弹窗
  - 当前 `暂无分类 / 暂无标签` 只能如实记录成当前数据态，不能直接外推成代码缺陷或功能完成，后续仍要继续补真实可选数据场景与附件失败链路
```

- [ ] **Step 30: 继续补齐创建帖子封面/附件入口与超限失败链路真机回归，确认系统选择器与统一提示协同正常**

```md
- round306 新确认的问题边界：
  - 在 `round305` 补齐分类、标签和开关证据后，`创建帖子` 页仍缺少 `封面选择 / 附件选择 / 附件超限失败提示` 的真实设备证据
  - 这轮既要区分“系统选择器是正常外部组件”与“应用内统一提示是项目内体验”，也要验证取消后是否能稳定回到发帖页
  - 如果封面入口走系统照片选择器、附件入口走系统文件选择器，且附件超限后回到应用内统一提示，本轮就只记录真实链路，不强行改码
- round306 真机验收必须写实记录：
  - [round306_current.xml](D:/ZeroIsle_Notes/.codex-tmp/round306_current.xml) 与 [round306_current.png](D:/ZeroIsle_Notes/.codex-tmp/round306_current.png) 先确认：
    - 前台仍是 `创建帖子`
    - 存在 `action.community.selectCoverImage`
    - 存在 `action.community.selectAttachments`
  - 点击封面入口后，[round306_cover_tap.xml](D:/ZeroIsle_Notes/.codex-tmp/round306_cover_tap.xml) 与 [round306_cover_tap.png](D:/ZeroIsle_Notes/.codex-tmp/round306_cover_tap.png) 必须体现：
    - 前台包名切到 `com.android.providers.media.module`
    - 顶部存在 `取消`
    - 可见 `照片 / 影集 / 最近`
    - 说明封面入口正常拉起系统照片选择器，而不是应用异常或原生报错弹窗
  - 点击系统照片选择器 `取消` 后，[round306_after_cover_cancel.xml](D:/ZeroIsle_Notes/.codex-tmp/round306_after_cover_cancel.xml) 与 [round306_after_cover_cancel.png](D:/ZeroIsle_Notes/.codex-tmp/round306_after_cover_cancel.png) 必须体现：
    - 已回到 `创建帖子`
    - `action.community.selectCoverImage` 与 `action.community.selectAttachments` 再次可见
  - 点击附件入口后，[round306_attachment_tap.xml](D:/ZeroIsle_Notes/.codex-tmp/round306_attachment_tap.xml) 与 [round306_attachment_tap.png](D:/ZeroIsle_Notes/.codex-tmp/round306_attachment_tap.png) 必须体现：
    - 前台包名切到 `com.android.documentsui`
    - 页面显示 `下载`
    - 顶部包含 `显示根目录 / 搜索 / 更多选项`
    - 说明附件入口正常拉起系统文件选择器
  - 在系统文件选择器里选中一个超过 10MB 的文件后，[round306_attachment_selected.xml](D:/ZeroIsle_Notes/.codex-tmp/round306_attachment_selected.xml) 与 [round306_attachment_selected.png](D:/ZeroIsle_Notes/.codex-tmp/round306_attachment_selected.png) 必须体现：
    - 已回到应用包 `com.zeroisle_notes`
    - 应用内出现统一提示 `部分文件未添加`
    - 提示文案包含 `超过 10MB 的文件已被自动过滤。`
    - 底部操作为 `知道了`
    - 且不能出现 `android:id/alertTitle` 或 `AlertDialog`
  - 关闭该统一提示后，[round306_after_attachment_dialog_dismiss.xml](D:/ZeroIsle_Notes/.codex-tmp/round306_after_attachment_dialog_dismiss.xml) 与 [round306_after_attachment_dialog_dismiss.png](D:/ZeroIsle_Notes/.codex-tmp/round306_after_attachment_dialog_dismiss.png) 必须体现：
    - 已回到 `创建帖子`
    - `部分文件未添加` 与 `超过 10MB` 文案已消失
    - `action.community.backFromCreatePost` 与 `action.community.publishPost` 继续可见
- 本轮写文档时必须继续保留的约束：
  - 顶部不得被平板状态栏遮挡，创建帖子页以及返回后的承接页都要继续逐页验收
  - 返回按钮仍统一使用现有淡蓝色方形箭头，不另起新样式
  - 应用内失败提示继续统一走项目内自绘样式，不回退到默认安卓弹窗
  - 系统照片/文件选择器属于平台组件，本轮只能如实记录其拉起与取消/返回链路正常，后续仍需继续补小文件成功添加与封面真实选择态
```

- [ ] **Step 31: 继续补齐创建帖子小文件附件成功态与封面真实选择承接态真机回归，确认回页预览与附件列表稳定**

```md
- round307 新确认的问题边界：
  - `round306` 已确认封面/附件入口与超限失败提示都正常，但还缺“成功态”证据，不能只凭入口可达和失败提示就外推成上传交互已完整闭环
  - 这轮重点不是继续改 UI，而是补齐“小文件成功添加附件”与“真实选择封面后回页承接态”两条真机证据
  - 如果附件成功回页后能出现附件计数、文件名、大小和删除入口，而封面回页后占位文案消失并变为图片承载态，本轮就只记录真实链路，不强行动成熟布局
- round307 真机验收必须写实记录：
  - [round307_current.xml](D:/ZeroIsle_Notes/.codex-tmp/round307_current.xml) 与 [round307_current.png](D:/ZeroIsle_Notes/.codex-tmp/round307_current.png) 先确认：
    - 前台仍是 `创建帖子`
    - 存在 `action.community.selectCoverImage`
    - 存在 `action.community.selectAttachments`
  - 重新打开附件系统文件选择器后，[round307_picker_live.xml](D:/ZeroIsle_Notes/.codex-tmp/round307_picker_live.xml) 与 [round307_picker_live.png](D:/ZeroIsle_Notes/.codex-tmp/round307_picker_live.png) 必须体现：
    - 前台包名为 `com.android.documentsui`
    - 页面标题为 `下载`
    - 本轮现场可用小文件至少包含 `高质量C++编程指南.pdf 334 kB`
    - 该文件卡片 bounds 为 `[891,1254][1164,1598]`，可作为稳定的小文件成功态样本
  - 选中该小文件后，[round307_attachment_small_selected.xml](D:/ZeroIsle_Notes/.codex-tmp/round307_attachment_small_selected.xml) 与 [round307_attachment_small_selected.png](D:/ZeroIsle_Notes/.codex-tmp/round307_attachment_small_selected.png) 必须体现：
    - 已回到应用包 `com.zeroisle_notes`
    - 页面继续是 `创建帖子`
    - 出现 `附件（1）`
    - 列表项显示 `高质量C++编程指南.pdf`
    - 同时显示大小 `326.1 KB`
    - 存在删除入口 `action.community.removeAttachment.0`
  - 再打开封面系统照片选择器后，[round307_cover_picker_open.xml](D:/ZeroIsle_Notes/.codex-tmp/round307_cover_picker_open.xml) 与 [round307_cover_picker_open.png](D:/ZeroIsle_Notes/.codex-tmp/round307_cover_picker_open.png) 必须体现：
    - 前台包名为 `com.android.providers.media.module`
    - 可见 `取消 / 照片 / 影集 / 最近`
    - 说明封面入口继续稳定走系统照片选择器
  - 选中第一张最近照片并回页后，[round307_cover_selected.xml](D:/ZeroIsle_Notes/.codex-tmp/round307_cover_selected.xml) 与 [round307_cover_selected.png](D:/ZeroIsle_Notes/.codex-tmp/round307_cover_selected.png) 必须体现：
    - 已回到应用包 `com.zeroisle_notes`
    - 页面继续是 `创建帖子`
    - `action.community.selectCoverImage` 仍可点击
    - 原占位文案 `点击添加封面图片` 已消失
    - 封面区域内部不再是图标+文案占位，而是纯图片承载节点，说明封面已进入真实预览承接态
- 本轮写文档时必须继续保留的约束：
  - 顶部不得被平板状态栏遮挡，创建帖子页头、成功回页后的附件区域和封面区域都要继续逐页验收
  - 返回按钮仍统一使用现有淡蓝色方形箭头，不另起新样式
  - 应用内失败提示继续统一走项目内自绘样式，不回退到默认安卓弹窗
  - 系统照片/文件选择器仍属于平台组件，本轮只能如实确认成功选择后的回页承接态，后续仍需继续补真实发帖提交、分类标签非空选择态等更深链路
```
