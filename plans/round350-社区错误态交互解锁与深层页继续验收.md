# round350 社区错误态交互解锁与深层页继续验收

## 1. 本轮目标
- 承接 round349 后的真实现场，优先修复社区主页在错误态下被整体锁死的问题。
- 确保 `社区服务暂时不可用` 横条存在时，用户仍可继续：
  - 刷新
  - 进入通知
  - 进入动态
  - 切换分类
  - 使用联调入口继续做深层页验收
- 保持既有成熟视觉骨架不乱动，只修交互锁死与相关真机可测性。
- 将本轮真机结论详细回填到中文台账，继续强调：
  - 顶部不得被系统状态栏遮挡
  - 返回按钮统一使用已有淡蓝色方形带箭头样式
  - 网络失败提示必须使用项目内统一优美弹窗
  - 平板布局不能出现不合理大面积留白

## 2. round349 遗留真实阻塞
- 真机设备：`HGR3Y9MA`（TB128FU）
- 真实现场已确认：
  - 平板与电脑本机后端通讯已经打通，不再是“没网”问题
  - 社区后端 `GroupMember` 导入 500 已修复
  - 社区主页前台不再显示 Django 调试页原文
- 但社区主页出现新的主阻塞：
  - 页面处于 `state.community.pageState.error`
  - 同时顶部 `刷新 / 通知 / 动态`
  - 分类按钮
  - errorBanner 上的 `刷新`
  - `发布`
  - 都处于 `enabled=false`
- 这会直接阻断后续所有深层页验收，所以本轮优先级最高。

## 3. 根因判断
- `communitySlice` 中 `fetchPosts.rejected` 已会把 `state.isLoading = false`。
- 因此问题不在 Redux loading 状态本身，而在 `CommunityScreen` 的交互锁设计：
  - 旧逻辑使用 `requestInFlightRef.current` 参与 `interactionBusy`
  - 但 `ref` 变化本身不会触发重渲染
  - 当首屏请求失败后，即便 finally 已把 `requestInFlightRef.current = false`
  - 当前 render 仍可能停留在“上一帧 busy=true”的结果
  - 从而把整页动作永久锁住

## 4. 本轮代码修改
- 文件：`src/screens/community/CommunityScreen.js`
- 修改原则：
  - 只修错误态交互锁死
  - 不动成熟头部结构、分类风格、空态卡片骨架
- 实施内容：
  - 新增 `requestInFlight` state，用于把请求锁变化同步到可重渲染状态
  - 保留 `requestInFlightRef` 作为并发保护
  - 抽出：
    - `beginRequestLock()`
    - `releaseRequestLock()`
  - 将 `interactionBusy` 从：
    - `isLoading || refreshing || requestInFlightRef.current`
    - 改为
    - `isLoading || refreshing || requestInFlight`
  - 在以下链路统一接入显式加锁/释放：
    - `loadPosts`
    - `handleLoadMore`
    - `useFocusEffect` 清理阶段
- 预期结果：
  - 即使社区首页请求失败，也只保留错误横条与空态
  - 不再把整页动作一起锁死

## 5. 真机验证过程
- 重新安装调试包到平板：
  - `./gradlew installDebug --console=plain`
- 启动应用并处理系统通知权限弹窗：
  - 该弹窗属于 Android 系统权限，不属于业务默认弹窗
- 重新进入 `社区`
- 验证错误态页面能否继续操作

## 6. 本轮真机证据
- 启动后系统通知权限弹窗：
  - `.local/android-mcp-server/round350_after_busy_fix_launch.png`
  - `.local/android-mcp-server/round350_after_busy_fix_launch.xml`
- 允许权限后首页恢复：
  - `.local/android-mcp-server/round350_after_permission.png`
  - `.local/android-mcp-server/round350_after_permission.xml`
- 社区主页交互解锁后现场：
  - `.local/android-mcp-server/round350_after_busy_fix_community.png`
  - `.local/android-mcp-server/round350_after_busy_fix_community.xml`
- 通知页真实入口现场：
  - `.local/android-mcp-server/round350_notifications_after_busy_fix.png`
  - `.local/android-mcp-server/round350_notifications_after_busy_fix.xml`
- 通知页返回社区现场：
  - `.local/android-mcp-server/round350_back_from_notifications.png`
  - `.local/android-mcp-server/round350_back_from_notifications.xml`
- 动态页真实入口现场：
  - `.local/android-mcp-server/round350_activity_after_busy_fix.png`
  - `.local/android-mcp-server/round350_activity_after_busy_fix.xml`
- 个人主页联调入口现场：
  - `.local/android-mcp-server/round350_devqa_profile_after_busy_fix.png`
  - `.local/android-mcp-server/round350_devqa_profile_after_busy_fix.xml`

## 7. 本轮真实结论
- 已确认修复生效：
  - `action.community.refresh` 已恢复 `enabled=true`
  - `action.community.notifications` 已恢复 `enabled=true`
  - `action.community.activity` 已恢复 `enabled=true`
  - `action.community.retryInlineError` 已恢复 `enabled=true`
  - `filter.community.*` 分类按钮已恢复 `enabled=true`
  - `action.community.createPost` 已恢复 `enabled=true`
- 说明社区主页错误态已经从“整页锁死不可继续验收”恢复为“可继续操作的诚实错误态”。
- 继续深层页实测后得到以下结果：
  - `通知消息`
    - 已能从社区真实入口正常进入
    - 现场为 `暂无通知消息`
    - 刷新时出现项目内自定义网络错误弹窗
    - 不是默认安卓系统弹窗
  - `活动动态`
    - 已能从社区真实入口正常进入
    - 现场为 `暂无活动动态`
    - 顶部返回按钮、刷新按钮和空态布局稳定
  - `个人主页`
    - 已能通过社区联调入口继续进入
    - 基础资料页可展示
    - 后续部分统计/最近发布拉取失败时，仍走项目内统一网络弹窗
- 因此本轮最大的实际进展不是“又改了样式”，而是：
  - 社区主页不再阻断深层页测试
  - 社区深层页验收重新恢复可持续推进

## 8. 布局与 UI/UX 规范复核
- 顶部安全区：
  - 社区主页、通知页、动态页、个人主页本轮都继续确认未被平板系统状态栏遮挡
- 返回按钮统一性：
  - 通知页、动态页、个人主页继续使用已有淡蓝色方形带箭头按钮
- 留白合理性：
  - 社区主页在错误横条、搜索、分类、空态卡片、联调区之间留白保持可接受
  - 动态页空态与通知页空态本轮未出现新的异常大面积白区回退
- 深层页主底部 Tab：
  - 通知页、动态页、个人主页为深层页，不展示主底部 Tab，符合既定规范
  - 社区主页保留主底部 Tab，属主页级结构，正常

## 9. 本轮仍保留的边界
- 社区后端当前已不再是导入 500，但仍处于认证/数据不可用阶段，前台暂表现为：
  - 中文错误横条
  - 空态卡片
- 这不是本轮前端交互锁修复失败，而是当前真实后端数据态尚未补齐。
- 社区搜索结果内容态、帖子详情真实内容态仍需继续补真实帖子数据后的现场证据。

## 10. 下一轮建议
1. 继续优先沿社区链做真实深层页复测：
   - 搜索用户结果
   - 搜索帖子结果
   - 帖子详情
   - 粉丝列表
   - 关注列表
2. 若后端认证或数据态继续限制社区内容，可先记录为后端待补项，不在前端伪造成功态。
3. 持续坚持只修明显原始部分，不误动成熟模块；每轮继续写中文详细台账并直推 `main`。
