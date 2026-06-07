# round313 社区搜索链路与粉丝空态复测记录

## 目标
- 基于 round312 已打通的社区个人主页链路，继续补测两条关联入口：
  - `粉丝列表 -> 个人主页`
  - `社区搜索 -> 搜索结果/个人主页`
- 优先处理真机实际暴露的功能错误与异常 UI，不扩散修改成熟页面。

## 本轮真机复测结论

### 1. 粉丝列表链路
- 设备从社区 QA 区进入 `粉丝列表`，链路可达，顶部安全区和统一淡蓝返回按钮正常。
- 当前后端返回为真实空态：`共 0 位`、`暂无粉丝`。
- 本轮未发现新的断链、错页或默认安卓弹窗问题。
- 结论：
  - 这条链当前是“功能正常但缺数据”，不是前端故障。
  - 后续要等真实粉丝数据出现后继续复测列表项点击进个人主页的对象正确性。

### 2. 社区搜索链路
- 真机实际打开社区搜索时，原页面顶部出现一条明显不应该给用户看的调试横条：
  - `debug round295 | scope:community | module:present | log:function`
- 继续在搜索页输入 `user` 并提交后，原行为是直接回落到社区首页，没有停留在搜索结果页，也没有清晰的“0 结果”承接。
- 这两个问题都属于真实可感知缺陷：
  - 调试信息外露是异常 UI。
  - 搜索后被甩回首页会让用户误以为搜索没有执行。

## 本轮修改
- 移除 `MultiModalSearch` 顶部开发调试横条，保留开发日志能力但不再把调试签名展示给最终用户。
- 调整社区搜索提交流程：
  - 从社区首页发起搜索后，无论有没有结果，都进入 `CommunitySearchScreen` 承接结果态或空结果态。
  - 不再因 `0` 结果直接退回社区首页。
- 修复 `CommunitySearchScreen` 初始化逻辑：
  - 正确接收路由传入的 `results/query/searchPerformed`
  - 正确切换 `searchPerformed/showHistory`
  - 修正 `handleSearch` 回调签名，避免历史记录与结果态失配
- 修整 `SearchResults` 对社区结果类型的兼容：
  - 支持 `post/user/tag`
  - 动态生成过滤项
  - 日期缺失时不再硬渲染异常时间文本
  - 标题与内容支持更稳的回退字段

## 真机证据
- 搜索页原始异常 UI：`.local/android-mcp-server/round313_search_open.png/.xml`
- 搜索后被甩回社区首页：`.local/android-mcp-server/round313_search_submit_user.png/.xml`
- 修复后搜索页：`.local/android-mcp-server/round313_search_open_after_fix.png/.xml`
- 修复后 `0` 结果承接页：`.local/android-mcp-server/round313_search_submit_user_after_fix.png/.xml`
- 粉丝列表空态复测：`.local/android-mcp-server/round313_followers_open.png/.xml`

## 本轮结论
- 社区搜索当前已从“调试 UI 外露 + 0 结果直接回首页”的异常状态，修复为“正常搜索页 + 空结果态承接”。
- 粉丝列表当前仍是真实空态，没有新的前端错误；`粉丝列表 -> 个人主页` 的最终对象正确性还需等待真实数据后继续复测。

## 下一轮建议
- 若后端已有真实社区用户/帖子数据，优先继续补测：
  - `CommunitySearch -> 用户结果 -> UserProfile`
  - `CommunitySearch -> 帖子结果 -> PostDetail`
  - `Followers -> 列表项 -> UserProfile`
