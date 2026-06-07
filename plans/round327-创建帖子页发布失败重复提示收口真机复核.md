# round327 - 创建帖子页发布失败重复提示收口真机复核

## 1. 本轮目标
- 在安卓平板真机上继续验证 `社区 -> 创建帖子` 页真实发布失败链。
- 复核离线发布失败时，是否只保留页面内统一样式弹窗。
- 收口底部重复错误横幅，避免同一次失败同时出现两套反馈。
- 继续区分业务问题与开发联调噪声，不把 Metro / 安装后短暂白屏误记为产品缺陷。

## 2. 根因定位
- `CreatePostScreen` 在发布失败时已经只通过页面内 `openDialog(...)` 展示统一样式弹窗。
- 真机底部重复横幅并不是业务 `Snackbar`，而是 React Native 开发环境把 `communityApi.createPost` 里的：
  - `console.error('创建帖子失败:', error)`
  渲染成了底部错误提示条。
- 因此当前问题不是“业务上报了两次失败”，而是“页面弹窗已接管失败反馈，但开发态错误日志又额外生成了一条底部错误横幅”。

## 3. 代码处理
- 文件：`src/services/api/communityApi.js`
- 本轮仅做最小修复：
  - 对离线、网络、请求状态码等“已由页面统一弹窗接管”的预期失败，降级为普通日志输出；
  - 仅对真正未识别、未被页面接管的异常保留 `console.error`；
  - 不修改创建帖子接口抛错逻辑；
  - 不修改 `CreatePostScreen` 现有统一弹窗样式和文案。

## 4. 真机环境
- 设备：`HGR3Y9MA`
- 页面：`CreatePostScreen`
- 日期：`2026-06-07`

## 5. 真机执行路径
1. 代码修改后重新执行：
   - `adb reverse tcp:8081 tcp:8081`
   - `adb reverse tcp:8000 tcp:8000`
   - `android/gradlew.bat :app:installDebug --console=plain`
2. 安装后应用曾短暂出现历史联调态白屏；等待并重新拉起后恢复到可操作页面。
3. 重新进入 `社区 -> 发布 -> 创建帖子` 页。
4. 输入：
   - 标题：`round327_publish_test`
   - 正文：`round327_publish_body`
5. 直接点击 `发布`，在离线条件下复测失败反馈链。

## 6. 证据文件
- 旧问题现场：
  - `.local/android-mcp-server/round327_current_state.xml/.png`
  - `.local/android-mcp-server/round327_after_publish_attempt.xml/.png`
- 本轮安装与恢复现场：
  - `.local/android-mcp-server/round327_after_install.xml/.png`
  - `.local/android-mcp-server/round327_after_install_wait8.xml/.png`
  - `.local/android-mcp-server/round327_after_tap_community.xml/.png`
  - `.local/android-mcp-server/round327_reopen_create_post.xml/.png`
- 本轮复测现场：
  - `.local/android-mcp-server/round327_after_title_input.xml/.png`
  - `.local/android-mcp-server/round327_after_body_input.xml/.png`
  - `.local/android-mcp-server/round327_after_publish_fix.xml/.png`

## 7. 现场结论
- 修复前，真机同一次失败会同时出现：
  - 页面中央统一样式弹窗：`发布失败 / 离线模式下无法创建帖子，请连接网络后重试`
  - 页面底部重复错误横幅：`创建帖子失败: Error: 离线模式下无法创建帖子，请连接网络后重试`
- 修复后，证据 `.local/android-mcp-server/round327_after_publish_fix.xml/.png` 已确认：
  - 页面仍停留在 `创建帖子`
  - 中央统一样式弹窗继续保留：
    - 标题：`发布失败`
    - 文案：`离线模式下无法创建帖子，请连接网络后重试`
    - 按钮：`知道了`
  - 底部重复错误横幅已消失
  - 同屏不再出现 `创建帖子失败: Error: ...`
- 说明当前“创建帖子失败链”已经收口为单一、统一的项目内反馈，不再叠加第二套底部错误提示。

## 8. 联调噪声边界
- `round327_after_install.xml/.png` 对应的安装后短暂白屏仍属于历史联调时序波动，不作为本轮业务缺陷记账。
- `round327_after_install_wait8.xml/.png` 底部出现的 `通知渠道创建失败，但应用将继续运行` 也属于开发/运行环境提示，不属于本轮社区发布失败链的业务回归。
- 本轮核心业务结论仍以 `.local/android-mcp-server/round327_after_publish_fix.xml/.png` 为准。

## 9. 后续建议
- 下一轮继续补测：
  - 联网可达后端条件下的真实发帖成功链；
  - 带附件、分类、标签并存时的真实发布失败链；
  - 创建帖子页在真实联通后端条件下的完整发布闭环。
