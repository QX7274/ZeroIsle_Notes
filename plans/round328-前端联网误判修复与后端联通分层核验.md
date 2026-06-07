# round328 - 前端联网误判修复与后端联通分层核验

## 1. 本轮目标
- 修复安卓平板联调时“后端实际可达，但前端仍误判离线”的真实阻断问题。
- 在不破坏既有布尔值调用方的前提下，补齐网络状态对象接口，收口社区、群组、标注、绘图路径、知识图谱等服务中的误用点。
- 用真实后端联通证据把问题分层：
  - 一层确认“平板/电脑/本地后端基础联通已打通”；
  - 一层确认“后端业务接口当前仍存在阻塞/超时”，避免继续把两类问题混记为“没网”。
- 按既定要求同步更新计划、总控、子批次记录和页面能力矩阵，为后续继续做真实生产联调留出清晰边界。

## 2. 根因定位
- `src/services/network/networkService.js` 中的 `checkConnection()` 历史语义一直是“返回布尔值”。
- 但社区、标注、绘图路径、知识图谱等多个服务后续把它当成了“返回 `{ isOnline, ... }` 状态对象”来使用。
- 典型错误形态：
  - `const status = await networkService.checkConnection();`
  - `if (!status?.isOnline) { ... }`
- 当 `status` 实际是布尔值时：
  - `true?.isOnline` / `false?.isOnline` 都会得到 `undefined`
  - `!status?.isOnline` 会恒为 `true`
- 结果就是：
  - 即使 `adb reverse tcp:8000 tcp:8000` 已打通；
  - 即使本机 `http://127.0.0.1:8000/health/` 可正常返回；
  - 像 `communityApi.createPost()` 这样的链路仍会在前端被提前挡成“离线模式下无法创建帖子”。

## 3. 代码处理
- 文件：`src/services/network/networkService.js`
  - 新增 `checkConnectionState()`，统一返回完整状态对象：
    - `isOnline`
    - `connectionType`
    - `connectionQuality`
    - `details`
  - 保留 `checkConnection()` 继续返回布尔值，避免破坏大量既有 `if (!isOnline)` 调用。
  - 新增 `resolveConnectionState()`，为后续兼容收口保留统一归一入口。
- 同步修复误用调用点：
  - `src/services/api/communityApi.js`
  - `src/services/api.js`
  - `src/services/group/groupService.js`
  - `src/services/api/authApi.js`
  - `src/services/api/userApi.js`
  - `src/services/api/annotationApi.js`
  - `src/services/api/drawingPathApi.js`
  - `src/services/api/knowledgeGraphApi.js`
- 收口原则：
  - 需要布尔值的地方，仍继续用 `checkConnection()`；
  - 需要读取 `isOnline/details` 的地方，改成 `checkConnectionState()`；
  - 不扩大改动到本轮无关 UI 和成熟页面。

## 4. 联调环境与执行动作
- 设备：`HGR3Y9MA`
- 已执行：
  - `adb reverse tcp:8081 tcp:8081`
  - `adb reverse tcp:8000 tcp:8000`
  - `android/gradlew.bat :app:installDebug --console=plain`
- 后端基础健康检查：
  - `http://127.0.0.1:8000/health/` 返回 `200`
  - 返回体：`{"status": "alive", ...}`
- 为避免 8000 端口历史脏进程干扰，本轮额外起了一个干净对照实例：
  - `D:\APP\Anaconda\Scripts\conda.exe run -n Zeroisle python -X utf8 manage.py runserver 0.0.0.0:8001 --noreload`
  - `http://127.0.0.1:8001/health/` 同样返回 `200`

## 5. 真实接口核验
- 已通过本地 Django 生成真实 access token：
  - 用户：`dbgfc7b2c10`
  - 用户 ID：`060f7ce5-d16a-4b90-9805-878fe0ba5408`
- 本轮尝试核验：
  - `GET /api/v1/auth/profile/`
  - `GET /api/v1/community/posts/my/`
  - `POST /api/v1/community/posts/`
- 结果分层如下：
  - `health/` 秒回，说明基础服务可达，电脑与平板后端联通主链不是当前主问题；
  - 鉴权业务接口在 `8000`、`8001` 两个实例上都出现长时间无响应直至超时，说明当前剩余问题已经转移为“后端业务服务自身阻塞/卡死”，而不是本轮前端联网判定逻辑仍有误。

## 6. 本轮证据
- 代码证据：
  - `src/services/network/networkService.js`
  - `src/services/api/communityApi.js`
  - `src/services/api.js`
  - `src/services/group/groupService.js`
  - `src/services/api/authApi.js`
  - `src/services/api/userApi.js`
  - `src/services/api/annotationApi.js`
  - `src/services/api/drawingPathApi.js`
  - `src/services/api/knowledgeGraphApi.js`
- 环境证据：
  - `backend/runserver_round328_8001.log`
  - `.local/android-mcp-server/round328_start.xml/.png`
  - `.local/android-mcp-server/round328_after_install_wait8.xml/.png`
  - `.local/android-mcp-server/round328_after_tap_community.xml/.png`
  - `.local/android-mcp-server/round328_after_back_key.xml/.png`
  - `.local/android-mcp-server/round328_community_try2.xml`
- 额外观察：
  - 当前仍有“首页点社区时偶发落到搜索页”的历史联调噪声；
  - 该问题会干扰社区真实点击复测，但不属于本轮网络误判修复的回归。

## 7. 本轮结论
- 这轮已经完成“前端误把在线当离线”的核心修复。
- 现在如果再出现社区发帖/个人资料/知识图谱等联网业务失败，优先应从后端业务阻塞或接口实现本身排查，而不是继续回到“是不是没网”的旧结论。
- 也就是说：
  - 基础联通问题：当前已基本打通；
  - 前端联网判定问题：本轮已收口；
  - 后端业务接口阻塞问题：仍待后续专项处理。

## 8. 对 UI / 布局 / 规范要求的承接说明
- 本轮未新增 UI 改动，继续保持以下既有约束不被破坏：
  - 顶部风格统一；
  - 页面顶部不得被系统状态栏遮挡；
  - 深层页返回按钮继续统一为已有淡蓝色方形箭头；
  - 网络问题继续统一走项目内优美样式弹窗，不回退原生安卓弹窗；
  - 不动成熟页面，只修真实原始/错误部分；
  - 布局继续要求避免不合理留白。

## 9. 下一步
1. 继续专项排查后端业务接口阻塞：
   - 优先看 `auth/profile`、`community/posts/my`、`community/posts` 为何在健康检查正常时仍超时。
2. 待后端业务接口恢复后，重新在真机补跑：
   - `社区 -> 创建帖子 -> 输入标题正文 -> 发布`
   - 确认链路不再被前端误判离线挡住。
3. 若社区 tab 仍被搜索页承接，则单开下一轮处理该导航噪声，避免继续污染联网验收结论。
