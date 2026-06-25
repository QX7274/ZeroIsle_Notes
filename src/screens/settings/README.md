# 设置模块说明（Settings Module）

本目录包含 ZeroIsle Notes 的设置相关屏幕与入口编排，覆盖账户、安全绑定、外观主题、离线与同步、通知、隐私与服务条款等能力。

## 当前文件结构（与代码一致）

- `index.js`：设置模块统一导出
- `SettingsScreen.js`：设置主入口页
- `ProfileSettings.js`：个人资料与功能中心入口
- `BindPhone.js`：手机号绑定
- `BindEmail.js`：邮箱绑定
- `BindWechat.js`：微信绑定
- `BindQQ.js`：QQ 绑定
- `ThemeSettingsScreen.js`：主题选择
- `ThemeEditorScreen.js`：主题颜色编辑
- `FontSettings.js`：字体大小设置
- `NotificationSettingsScreen.js`：通知设置
- `OfflineDataScreen.js`：离线数据管理
- `SyncSettingsScreen.js`：同步设置
- `HelpScreen.js`：帮助与反馈
- `AboutScreen.js`：关于页面
- `PrivacyPolicyScreen.js`：隐私政策
- `TermsOfServiceScreen.js`：服务条款
- `AIAssistantSettingsScreen.js`：AI 助手配置

## 主要能力分组

### 1) 账户与身份

- 个人资料编辑（头像、用户名、简介）
- 功能中心六个入口采用纯色 iOS 风格卡片，保留不同颜色区分与统一层次
- 最新一版已收回到更接近初版的干净骨架：无渐变、无标签、无底部附加文案，减少无意义留白
- 手机/邮箱绑定
- 微信/QQ 绑定
- 退出登录

### 2) 外观与可访问性

- 主题预设切换
- 主题颜色自定义
- 字体大小切换（小/中/大）

### 3) 数据与同步

- 离线模式切换
- 手动同步与同步状态查看
- 搜索索引重建
- 离线数据清理
- 缓存大小查看与清理

### 4) 通知与策略

- 通知总开关与子通道配置
- 优先级、免打扰、声音振动等选项

### 5) 合规与支持

- 隐私政策
- 服务条款
- 帮助与反馈
- 关于与版本信息

## 状态与数据流（RTK）

核心由 Redux Toolkit 管理，关键切片：

- `settingsSlice`：主题、字体、通知、离线、自动保存等偏好设置
- `authSlice`：用户登录态与绑定信息（phone/email/wechat_openid/qq_openid）

常见流转：

1. 设置页读取 `settings` 与 `auth.user`
2. 用户交互触发 `updateSettings` / `setUserInfo` / `logout`
3. 局部页面执行 API 调用（绑定、资料更新、同步动作）
4. 页面通过状态锚点（testID）暴露可观测状态，供安卓自动验收

## 安卓验收约定

设置模块页面均已逐步补齐状态锚点，建议验收时覆盖：

- 页面可见性：`state.*.visibility.visible`
- 忙碌态/加载态：`state.*.state.busy` 或 `*.loading.visibility.visible`
- 关键动作入口：`action.*`
- 列表分区可见：`list.*`

推荐脚本：

```powershell
python scripts/android/capture_android_round.py --round <round_name> --ensure-foreground
```

## 维护建议

- 新增设置子页面时，必须同步更新 `index.js` 与本 README 的“当前文件结构”。
- 新增交互应补充 testID 锚点，避免安卓验收不可观测。
- 与远端 API 强耦合的动作，保留本地兜底提示，避免弱网导致空白失败。
- 设置模块中的成熟头部、输入区与标准按钮样式尽量保持一致，只有明显原始或过素的区域才允许针对性重做。
- 纯色卡片方案必须避免渐变色与过多装饰层，重点控制顶部留白和卡片内部空壳感。
