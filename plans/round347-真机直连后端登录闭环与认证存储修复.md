# round347-真机直连后端登录闭环与认证存储修复

## 本轮目标
- 不再停留在“接口层可通”，而是在安卓平板真机上把“开发调试直连真实后端登录”完整跑通。
- 确认当前所谓“网络错误”是否仍然成立，避免把后续问题继续误归因为“没网”。
- 若登录成功后仍有运行时错误，继续顺着真实调用链定位并修复。

## 本轮真实结论
- 电脑本地后端与平板之间的通讯已经真实打通，不存在“因为生产域名未部署所以前端一定报网络错误”的情况。
- 真机上的“真实账号直连登录（开发调试）”已经可以真实走通：
  - 验证码发送成功；
  - 登录请求成功；
  - 应用真实进入用户态首页。
- 当前登录主链剩余的真实问题不是网络，而是认证存储链把 `user` 对象按字符串字段错误落盘，导致首页底部出现认证存储错误提示。
- 本轮已修复该问题，并复测确认：
  - 真机重新进入首页成功；
  - 原来的 `Expected value to be a string, got an object` 不再出现；
  - 当前剩余日志噪音主要是平板系统自身通知/证书/厂商服务输出，不属于本次登录链路阻塞。

## 本轮代码修改
- `src/services/auth/authUtils.js`
  - 修复 `saveAuthInfo()`：
    - `StorageItem.value` 实际是字符串字段；
    - 认证用户信息改为先 `JSON.stringify(user)` 再写入 `USER_INFO` / `USER`。
  - 修复 `getAuthInfo()`：
    - 读取到字符串后补 `JSON.parse()`；
    - 保证上层继续拿到对象，而不是裸字符串。

## 本轮真机与联通证据
- 登录前稳定登录页：
  - `.local/android-mcp-server/round_login_verify_before.xml`
  - `.local/android-mcp-server/round_login_verify_before.png`
- 点击“真实账号直连登录（开发调试）”后的首次关键证据：
  - `.local/android-mcp-server/round_login_verify_after_tap.xml`
  - `.local/android-mcp-server/round_login_verify_after_tap.png`
  - `.local/android-mcp-server/round_login_verify_after_tap_logcat.txt`
- 该轮首次关键结论：
  - 弹窗提示 `登录成功`；
  - 文案为 `已通过真实后端完成开发态直连登录`；
  - 但底部同时出现 `设置认证存储项目失败: user Error: Expected value to be a string, got an object`。
- 修复认证存储后的复测证据：
  - `.local/android-mcp-server/round_login_verify_after_storagefix_relaunch.xml`
  - `.local/android-mcp-server/round_login_verify_after_storagefix_relaunch.png`
  - `.local/android-mcp-server/round_login_verify_after_storagefix_logcat.txt`
  - `.local/android-mcp-server/round_home_after_permission_dismiss.xml`
  - `.local/android-mcp-server/round_home_after_permission_dismiss.png`
- 修复后关键结论：
  - 应用可真实进入首页；
  - 首页已命中 `screen.home`、搜索栏、底部导航；
  - 日志中未再出现 `设置认证存储项目失败` 或 `Expected value to be a string`。

## 本轮分层判断
- 网络层：
  - `adb reverse tcp:8001 tcp:8001` 正常；
  - 本机 `http://127.0.0.1:8001/api/v1/auth/verification-code/` 可返回 `200`；
  - 说明本地后端服务在线，平板到电脑链路可用。
- 认证接口层：
  - “开发态真实账号直连登录”已真实进入用户态首页；
  - 说明验证码发送与登录接口闭环都已跑通。
- 本地存储层：
  - 原问题已被定位为前端认证用户信息落盘类型错误；
  - 本轮修复后已完成真机复测。

## 对后续页面测试的影响
- 现在可以把“网络错误是否导致无法测试真实页面”这件事暂时从主阻塞里移除。
- 后续社区、群组、个人主页、功能中心、知识图谱、提醒等真实功能页测试，可以基于当前已恢复的用户态首页继续推进。
- 但每轮仍需继续关注：
  - 页面顶部安全区不要被系统状态栏遮挡；
  - 深层页返回按钮继续统一使用已有淡蓝色方形箭头；
  - 网络异常或服务失败提示继续使用项目内统一优美弹层，不回退到默认安卓弹窗；
  - 只改明显原始的 UI，不误动已成熟页面。

## 本轮边界
- 本轮重点是打通真实登录与认证存储，不继续展开深层业务页大面积 UI 整改。
- 真机现场仍会偶发权限弹窗、厂商服务日志、通知渠道提示，这些不能再误判为“后端不通”。
- 生产域名是否部署，不影响当前“平板通过本机后端完成真实联通测试”的结论。

## 下一步
1. 从当前真实用户态首页继续进入社区、我的、功能中心、知识图谱、提醒等页面做逐页真机验收。
2. 优先复测曾经因为“没网误判”而被挡住的真实功能链，确认现在能否稳定进入内容态。
3. 每完成一轮真实页面整改，继续回填 `plans/` 与三份总控文档，并立即提交推送到 `main`。
