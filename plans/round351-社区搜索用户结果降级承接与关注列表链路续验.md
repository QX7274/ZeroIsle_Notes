# round351 社区搜索用户结果降级承接与关注列表链路续验

## 1. 本轮目标
- 延续 round350 的社区真机现场，继续复测以下 Dev QA 深层链路：
  - `搜索用户结果 -> 个人主页`
  - `搜索帖子结果`
  - `帖子详情`
  - `粉丝列表`
  - `关注列表`
- 在不误动成熟骨架的前提下，优先修复会中断真实验收的前端问题。
- 所有结论必须基于平板 `HGR3Y9MA` 的真实页面证据，不伪造成功态。

## 2. 本轮真实现场
- 设备：`HGR3Y9MA`（联想平板 `TB128FU`）
- 入口页面：社区主页 `state.community.pageState.error`
- 当轮社区主页前台文案：
  - 错误横条：`获取活动流失败`
  - 空态文案：`暂无社区内容`
- 现场仍可正常看到 Dev QA 面板，且入口按钮可点击：
  - `action.community.devQa.postDetail`
  - `action.community.devQa.followers`
  - `action.community.devQa.following`
  - `action.community.devQa.userProfile`
  - `action.community.devQa.searchUserResult`
  - `action.community.devQa.searchPostResult`

## 3. 本轮发现的问题

### 问题 A：`搜索用户结果 -> 个人主页` 会被全局网络弹窗抢占
- 首次复测现象：
  - `搜索用户结果` 可正常进入 `CommunitySearchScreen`
  - 点击唯一用户结果后，没有稳定进入个人主页内容态
  - 前台直接出现项目内统一网络弹窗：
    - 标题：`网络连接问题`
    - 正文：`服务器错误，请稍后重试`
- 判断：
  - 这不是“默认安卓弹窗”问题，统一弹窗样式本身是对的；
  - 真实缺陷在于 `UserProfileScreen` 设计上已经允许“部分资料降级展示”，但其首屏依赖的 `followers / following / posts` 请求仍会触发 API 层全局错误 UI，导致页面自己还没来得及承接，就先被全局弹窗盖住。

### 问题 B：`关注列表` 链路存在两个隐患
- 代码级隐患：
  - `src/screens/community/FollowingScreen.js` 原先的列表项点击是 `navigation?.navigate?.('Community')`
  - 这不符合真实产品行为，也会让后续真机验收失真
- 真机现象：
  - `关注列表` 入口现场多次受到后端失败或应用重装回流噪声干扰，暂未拿到稳定列表内容态证据
  - 但“全局网络弹窗先抢占页面”这一类体验问题，和问题 A 属于同一层级

## 4. 本轮代码修复

### 修复 1：社区个人主页首屏请求改为页内降级承接
- 文件：
  - `src/services/api/communityApi.js`
  - `src/screens/community/UserProfileScreen.js`
- 修改要点：
  - 为 `getUserFollowers` / `getUserFollowing` 新增 `requestOptions.suppressGlobalErrorUI`
  - `UserProfileScreen` 在首屏并发取资料时统一传入 `suppressGlobalErrorUI: true`
- 目的：
  - 后端统计接口失败时，不再先弹全局网络窗打断流程
  - 让页面优先使用 `initialUser` + 页内 `statusCard` 承接“部分资料已降级展示”

### 修复 2：粉丝/关注列表首屏请求也改为页面自己承接错误
- 文件：
  - `src/redux/slices/communitySlice.js`
- 修改要点：
  - `fetchFollowers`
  - `fetchFollowing`
  - 调用 `communityApi.getUserFollowers / getUserFollowing` 时统一传入 `suppressGlobalErrorUI: true`
- 目的：
  - 让粉丝/关注页更接近“深层页自己承接失败状态”的一致规范
  - 避免一进入页面就被全局网络弹窗抢占整个测试流程

### 修复 3：关注列表项点击行为改为按对象类型导航
- 文件：
  - `src/screens/community/FollowingScreen.js`
- 修改要点：
  - 新增 `handleFollowingPress(item)`
  - `user` 类型：
    - 跳 `UserProfile`
  - `post` 类型：
    - 跳 `PostDetail`
  - `tag` 类型：
    - 回社区并带 `tag`
  - 只有无法识别目标时，才兜底回 `Community`
- 目的：
  - 修掉原先“任何关注项都只会回社区首页”的明显错误导航
  - 让后续真实跟踪链路时不再被前端假跳转污染结论

## 5. 本轮真机结果

### 5.1 `搜索用户结果 -> 个人主页`
- 修复前：
  - 进入用户结果后，会被全局网络弹窗打断
- 修复后：
  - 可稳定进入 `screen.community.userProfile`
  - 顶部返回按钮继续统一为已有淡蓝色方形箭头
  - 顶部安全区正常，没有被平板系统状态栏遮挡
  - 页面内出现信息卡片：
    - 标题：`部分资料已降级展示`
    - 说明：`当前已尽量展示个人主页基础信息，但部分统计或最近发布未能从后端取回，稍后可下拉重试。`
  - 说明当前前端已正确承接“后端部分资料取回失败”的真实场景
- 结论：
  - `PASS`
  - 这条链路已经从“被全局错误窗打断”收口为“可进入页面、可继续验收的页内降级态”

### 5.2 `关注列表`
- 修复后已完成：
  - 前端代码层面修复了错误导航逻辑
  - 首屏请求已接入 `suppressGlobalErrorUI`
- 当前真机边界：
  - 本轮多次受到后端失败、系统通知权限弹窗、安装回流到首页/个人资料页等现场噪声影响
  - 暂未拿到稳定的 `screen.community.following` 列表内容态证据
- 结论：
  - `IN_PROGRESS`
  - 当前只能确认“前端已具备更合理的导航与错误承接”，还需下一轮继续抓稳定内容态证据

## 6. 本轮证据
- 社区主页现场：
  - `.local/android-mcp-server/round351_live_start.png`
  - `.local/android-mcp-server/round351_live_start.xml`
- 搜索用户结果页：
  - `.local/android-mcp-server/round351_search_user_result.png`
  - `.local/android-mcp-server/round351_search_user_result.xml`
- 修复前点入用户结果后的全局网络弹窗：
  - `.local/android-mcp-server/round351_search_user_to_profile.png`
  - `.local/android-mcp-server/round351_search_user_to_profile.xml`
- 修复后重新进入社区：
  - `.local/android-mcp-server/round351_force_to_community.png`
  - `.local/android-mcp-server/round351_force_to_community.xml`
- 修复后搜索用户结果页：
  - `.local/android-mcp-server/round351_search_user_after_fix.png`
  - `.local/android-mcp-server/round351_search_user_after_fix.xml`
- 修复后个人主页页内降级承接：
  - `.local/android-mcp-server/round351_search_user_profile_after_fix.png`
  - `.local/android-mcp-server/round351_search_user_profile_after_fix.xml`
- 关注列表受后端失败/现场噪声影响的中间证据：
  - `.local/android-mcp-server/round351_following_entry.png`
  - `.local/android-mcp-server/round351_following_entry.xml`

## 7. 本轮结论
- 已完成并确认有效：
  - 社区 `搜索用户结果 -> 个人主页` 链路不再被全局网络弹窗打断
  - 社区个人主页已能以页内降级态诚实承接后端部分失败
  - 关注列表项的前端错误导航已修正，不再固定回社区首页
- 仍需继续：
  - `关注列表` 稳定内容态与项点击链路
  - `粉丝列表` 稳定内容态与返回链
  - `搜索帖子结果 -> 帖子详情`
  - `帖子详情` 内容态与空态边界

## 8. 下一轮建议顺序
1. 从当前社区 Dev QA 面板继续先测 `粉丝列表`
2. 再测 `关注列表`
3. 最后补 `搜索帖子结果` 与 `帖子详情`
4. 若后端继续只返回失败或无数据，前端只做诚实承接，不伪造“成功内容态”
