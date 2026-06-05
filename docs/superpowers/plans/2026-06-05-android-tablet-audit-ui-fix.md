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
- 需要记录：本轮及后续每轮都必须再次确认“顶部不被遮挡”这一硬标准，尤其是设置、个人页、社区、知识库、知识图谱、群组和它们的二级子页
```

- [ ] **Step 4: 回到真机复测并确认改动没有破坏现有成熟风格**

```md
- 需要记录：设置子页（AI 助手、帮助与反馈、离线数据、主题、字体、关于、绑定页）也必须统一顶部壳层与返回按钮，避免顶部风格分裂
- 需要记录：设置链路中的顶部必须完整露出，不能被状态栏、原生 header 或页面自身内容区遮挡
- 需要记录：本轮真机复核必须逐页确认各页面顶部是否完整露出，尤其要看标题、返回按钮、搜索框、操作按钮是否被状态栏、系统导航层、原生 header 或页面自身内容区压住
- 需要记录：如果某页顶部存在异常留白，要明确区分是安全区兜底、页面内页头、还是原生头残留导致，不能把正常安全区误判为布局问题
- 需要记录：社区、设置、个人资料、知识库、知识图谱这几条链路都必须以“顶部完整露出”为硬标准，任何页面只要顶部被遮挡就要优先修复
- 需要记录：设置链路里的关于、帮助与反馈、通知、主题、字体、离线数据等子页都要逐页复核，顶部标题和返回按钮必须完整露出，不能因为不同入口出现不一致的顶部留白
- 需要记录：如果某页仍出现顶部被遮挡或留白异常，必须先排查原生 header 残留、安全区缺失和页面头重复叠加，再决定是否改动内容区
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
```

- [x] **Step 4: 真机复核顶部是否完整露出并写回结果**

```md
- 已在安卓平板 `HGR3Y9MA` 上复核知识图谱、知识图谱分析与新建笔记链路，顶部完整露出
- 已确认知识图谱空态“创建笔记”可以稳定进入 `CardNote`
- 已确认页面顶部没有被状态栏、系统导航层、原生 header 或内容区遮挡
```

### Task 7: 收口群组邀请链路的网络错误展示

**Files:**
- Modify: `src/redux/slices/groupsSlice.js`
- Modify: `src/screens/groups/GroupsScreen.js`
- Modify: `src/screens/groups/InvitationsScreen.js`
- Modify: `docs/superpowers/progress/2026-06-05-android-tablet-audit-ui-fix.md`

- [ ] **Step 1: 让群组邀请/列表在离线无缓存时优先走统一网络错误处理**

```md
- 目标：避免底部错误条破坏页面一致性
- 约束：不重做群组页顶部和成熟卡片样式
```

- [ ] **Step 2: 复测群组页与邀请页，确认错误展示不再回退到原始提示条**

```md
- 目标：网络问题只能走统一弹窗或静默降级
- 约束：如果出现错误，必须明确是全局网络弹窗还是页面内业务失败
```

- [ ] **Step 3: 把群组网络错误收口结果写回进度文档**

```md
- 需要记录：根因、修改范围、真机复测结果
- 需要记录：顶部结构和返回按钮未被这次修改影响
```
