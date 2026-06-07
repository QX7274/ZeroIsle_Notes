# round346 零屿空间管理入口补齐与目标管理原生弹窗收口

## 本轮目标
- 补齐 `个人资料 -> 零屿空间` 真实产品流中的“规划功能入口不可达”问题。
- 修复 `GoalManagerScreen` 中残留的原生安卓 `Alert`，统一改为项目内弹层与 Toast。
- 保持成熟页面结构、顶部安全区、统一淡蓝色方形返回按钮和深层页隐藏主底部 Tab 的既有规范不回退。

## 真实问题
- `零屿空间` 主页此前只有空态与新增 FAB，没有通往：
  - `目标管理`
  - `分类管理`
  - `数据分析`
  的真实入口，导致规划功能“代码已注册、产品流不可达”。
- 首次补入口后，真机点击 `目标管理` 出现：
  - `The action 'NAVIGATE' with payload {"name":"GoalManager"} was not handled by any navigator.`
  - 说明 `个人资料 -> 零屿空间` 实际走的是 `SettingsNavigator` 分支，而不是此前已注册这些页面的另一条导航栈。
- `GoalManagerScreen` 仍大量使用原生安卓 `Alert.alert(...)`：
  - 加载失败
  - 空标题校验
  - 创建成功/失败
  - 更新成功/失败
  - 删除确认
  - 删除成功/失败
- `GoalManagerScreen` 类型选择里还存在一个真实运行时问题：
  - `trending_up` 不是 `MaterialIcons` 的合法图标名
  - 真机会出现底部调试警告条

## 本轮代码修改

### 1. 零屿空间主页补真实管理入口
- 文件：
  - `src/screens/personal_activity/PersonalActivityScreen.js`
- 修改：
  - 在 `hero` 下方新增 `空间管理` 管理面板。
  - 新增三张入口卡片：
    - `目标管理`
    - `分类管理`
    - `数据分析`
  - 新增可测锚点：
    - `list.personalActivity.managementEntries`
    - `entry.personalActivity.management.GoalManager`
    - `entry.personalActivity.management.PersonalActivitySettings`
    - `entry.personalActivity.management.PersonalActivityAnalytics`
- 设计原则：
  - 不重做成熟 hero 与右下角新增 FAB。
  - 只补足明显原始、功能不可达的部分。
  - 保持浅色大屏风格与合理留白。

### 2. 补齐真实导航链
- 文件：
  - `src/navigation/SettingsNavigator.js`
- 修改：
  - 新增注册：
    - `GoalManager`
    - `PersonalActivitySettings`
    - `PersonalActivityAnalytics`
- 结果：
  - `个人资料 -> 零屿空间 -> 空间管理` 里的三个入口在真实导航分支上都具备落点。

### 3. 目标管理页原生弹窗收口
- 文件：
  - `src/screens/personal_activity/GoalManagerScreen.js`
- 修改：
  - 移除页面内所有原生 `Alert.alert(...)`。
  - 引入：
    - `showToast`
    - `NetworkErrorAlert`
    - 页面级删除确认弹层
    - 页面级网络错误承接状态
  - 行为调整：
    - 空标题保存：
      - 改为 `showToast.warning('目标标题不能为空')`
    - 创建成功 / 更新成功 / 删除成功：
      - 改为 `showToast.success(...)`
    - 非网络失败：
      - 改为 `showToast.error(...)`
    - 网络失败：
      - 改为项目内统一 `NetworkErrorAlert`
    - 删除确认：
      - 改为页面内圆角危险确认弹层
  - 另外修复：
    - `trending_up -> trending-up`
    - 消除 `MaterialIcons` 无效图标名导致的开发警告

## 本轮真机路径与证据

### 已确认通过
- `个人资料 -> 零屿空间`
  - 有效证据：
    - `.local/android-mcp-server/round346_live_current.png`
  - 结论：
    - `空间管理` 面板已真实出现。
    - 三张卡片均已可见。
    - 头部未被系统状态栏遮挡。
    - 管理面板留白合理，没有再次出现大面积原始白区。

- `零屿空间 -> 目标管理`
  - 修复前错误证据：
    - `.local/android-mcp-server/round346_goal_manager_entry.png`
  - 修复后可达证据：
    - `.local/android-mcp-server/round346_goal_manager_after_navfix.png`
  - 结论：
    - 导航未注册错误已经被修复。
    - 真机已可从真实入口进入 `目标管理` 页面。
    - `目标管理` 顶部返回按钮继续使用统一淡蓝色方形箭头。
    - 深层页不再走错导航链。

- `目标管理` 页面运行时警告修复
  - 修复前现场：
    - `.local/android-mcp-server/round346_goal_manager_after_navfix.png`
    - 底部出现 `Invalid prop 'name' of value 'trending_up'...`
  - 修复后现场：
    - `.local/android-mcp-server/round346_goal_manager_after_reload.png`
  - 结论：
    - 图标命名错误已修正。
    - 页面恢复为干净状态，没有继续出现该类运行时警告条。

### 本轮已落代码但未完成稳定补证
- `GoalManagerScreen` 的下列行为已经完成代码收口，但真机深交互补证受现场波动阻塞：
  - 空标题保存 Toast
  - 创建成功 Toast
  - 删除确认自定义弹层
  - 网络失败统一弹层
- 阻塞原因：
  - 调试菜单中途误弹出
  - 返回键将应用带回桌面
  - 开发包恢复阶段偶发空白中间态
  - 页面在白屏容器态与首页之间来回恢复，无法稳定完成整条深交互证据链
- 处理原则：
  - 本轮只把“已稳定看到的真实结果”记为通过；
  - 对未跑稳的深交互不伪造结论，保留到下一轮继续补证。

## 本轮页面规范复核
- 返回按钮：
  - 继续统一使用已有淡蓝色方形箭头。
- 顶部安全区：
  - `零屿空间` 与 `目标管理` 头部均位于系统状态栏下方。
- 深层页主底部 Tab：
  - 本轮修改未把深层页重新挂回主底部 Tab。
- 留白：
  - `零屿空间` 的新增管理面板承接了原本空白过多、功能又不可达的区域；
  - 未改动成熟 hero 区与 FAB；
  - `目标管理` 仍保留原页面骨架，本轮只收口明显原始的提示层与运行时告警。

## 本轮结论
- `零屿空间` 已从“规划功能实际不可达”推进到“真实入口已补齐、目标管理已可进入”。
- `GoalManagerScreen` 已完成原生系统弹窗向项目内统一提示体系的代码收口。
- 本轮未去重做成熟页面，而是只修复了：
  - 入口缺失
  - 导航断链
  - 原生弹窗
  - 图标运行时警告
- 下一轮优先事项：
  - 在更稳定的真机现场下补齐 `GoalManagerScreen` 的创建、空标题校验、删除确认与网络失败交互证据。
