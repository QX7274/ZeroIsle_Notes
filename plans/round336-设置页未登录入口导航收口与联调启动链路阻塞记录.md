# round336 设置页未登录入口导航收口与联调启动链路阻塞记录

## 本轮目标
- 继续沿 `我的 -> 应用设置` 深层页推进真机复核，优先抽查：
  - `帮助与反馈`
  - `关于`
- 在不破坏成熟页面样式的前提下，优先清理会污染真机测试结论的真实代码问题。
- 同步落实“及时释放相关资源，避免 CPU、内存资源不足”的执行要求。

## 本轮先验约束
- 继续保持顶部安全区、统一淡蓝色方形返回按钮、深层页主 Tab 隐藏规范不回退。
- 不把 `Cannot connect to Metro...`、瞬时白屏容器态、安装后加载时序噪声误记为业务页面回归。
- 工作区存在大量既有脏改，本轮只做最小增量，不回滚用户改动。

## 本轮实际处理

### 1. 设置页未登录入口错误导航收口
- 定位文件：`src/screens/settings/SettingsScreen.js`
- 真实问题：
  - 设置主页未登录卡片点击后仍直接执行 `navigate('Login')`；
  - 但当前导航结构中认证入口实际挂在 `Auth` 容器下；
  - 在开发跳过登录模式下，这条跳转会持续触发：
    - `The action 'NAVIGATE' with payload {"name":"Login"} was not handled by any navigator.`
  - 该告警会污染平板底部调试提示区，影响后续设置深层页真机取证。
- 本轮代码收口：
  - 新增 `handleLoginEntryPress`：
    - 开发联调模式下不再误跳不存在的 `Login` 路由；
    - 改为使用项目内统一 `Toast` 提示：`当前为开发联调模式，登录入口已跳过`；
    - 非开发态优先向最外层导航派发 `CommonActions.navigate({ name: 'Auth' })`；
    - 若外层导航不可用，再退回 `navigationRef`；
    - 最后兜底统一 `Toast`，避免再次冒出默认导航错误。
  - 未登录卡片点击行为从原来的 `navigateTo('Login')` 改为 `handleLoginEntryPress`。

### 2. 调试与资源链路恢复
- 本轮中途曾出现：
  - 多个残留 `adb.exe`
  - 挂住的 `gradle wrapper java` 进程
  - `127.0.0.1:8081` 初始未监听
  - `buildLogic.lock` 被其他 Gradle 实例长期占用
- 本轮执行过的资源恢复动作：
  - 清理残留 `adb` 进程并恢复 `adb start-server`
  - 重新补挂：
    - `adb -s HGR3Y9MA reverse tcp:8081 tcp:8081`
    - `adb -s HGR3Y9MA reverse tcp:8001 tcp:8001`
  - 终止挂住的 Gradle 包装进程，避免持续占用 CPU/内存
  - 直接使用已生成的 `android/app/build/outputs/apk/debug/app-debug.apk` 做 `adb install -r`，绕开 `installDebug` 锁竞争
  - 前台确认 Metro 最终处于：
    - `packager-status:running`

## 真机现场与阻塞证据

### 1. 设置主页有效现场
- 有效证据：
  - `tmp_round336_live_current.png`
  - `tmp_round336_live_current.xml`
- 有效结论：
  - 命中 `state.settings.main.state.ready`
  - 顶部安全区正常
  - 返回按钮仍为统一淡蓝色方形箭头
  - 设置主页保留主 Tab 合理
- 同时确认到底部两条开发提示中，真正值得处理的是：
  - 未登录卡片误跳 `Login` 引发的导航告警

### 2. 安装后联调启动链路阻塞
- 安装结果：
  - `adb -s HGR3Y9MA install -r D:\ZeroIsle_Notes\android\app\build\outputs\apk\debug\app-debug.apk`
  - 结果：`Success`
- 但安装后真机长期停在：
  - `Loading from localhost:8081...`
- 现场证据：
  - `tmp_round336_postinstall_current.png`
  - `tmp_round336_relaunch.png`
  - `tmp_round336_wait45.png`
  - `tmp_round336_relaunch.xml`
  - `tmp_round336_wait45.xml`
- 相关链路证据：
  - Metro `status` 已返回 `packager-status:running`
  - 但：
    - `http://127.0.0.1:8081/index.bundle?platform=android&dev=true&minify=false`
    - 在 `20s` 与 `60s` 两次请求中均超时未返回
- 本轮判断：
  - 该阻塞属于开发包启动/Bundle 下发链路异常；
  - 不是 `帮助与反馈` / `关于` 页面本身的 UI 回归；
  - 因此本轮不能伪造这两个深层页的“已通过”结论。

## 本轮结论
- 已完成：
  - 设置主页未登录入口错误导航收口
  - 资源占用清理与调试链路恢复
  - 调试包重新安装到平板
  - Metro / ADB reverse / 真机加载阻塞的分层定位
- 未完成：
  - `帮助与反馈`
  - `关于`
  - 两个深层页的最终真机通过取证
- 未完成原因：
  - 不是页面功能逻辑本身阻塞；
  - 而是调试包在真机上持续卡在 RN 开发 Bundle 加载态，导致业务页无法稳定进入。

## 下一步
- 下一轮优先把 `Metro -> index.bundle -> 真机前台业务页` 这条开发包启动链路单独打通；
- 待业务页可稳定进入后，按原计划继续复核：
  - `帮助与反馈`
  - `关于`
  - `AI 助手设置`
  - `主题`
  - `字体大小`
- 继续保持：
  - 顶部不被平板状态栏遮挡
  - 统一淡蓝色方形返回按钮
  - 深层页主 Tab 隐藏
  - 网络异常统一项目内优美样式
  - 不把联调噪声误写成业务页面缺陷
